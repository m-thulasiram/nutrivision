from fastapi import APIRouter, HTTPException, Depends, Request
import sqlite3
import torch
import time
import pandas as pd
from database import get_db
import crud
from models import get_models, get_regional_info, norm, INPUT_FEATURES
from schemas import MacroRequest
from logging_config import get_logger
from metrics import recommendation_latency
from dependencies import require_user_id

router = APIRouter(tags=["recommend"])
logger = get_logger("nutrivision.recommend")

from rate_limiter import rate_limit as _rate_limit


@router.post("/api/recommend")
@_rate_limit("60/minute")
async def recommend_food(request: Request, req: MacroRequest, db: sqlite3.Connection = Depends(get_db), current_user_id: int = Depends(require_user_id)):
    start = time.monotonic()
    user_id = current_user_id
    try:
        target_macros = {
            'Calories': float(req.target_cals),
            'Fats': float(req.target_fat),
            'Proteins': float(req.target_pro),
            'Carbohydrates': float(req.target_carb),
            'Sugars': 5.0,
            'Fibre': 30.0,
            'Iron': 18.0,
            'Calcium': 1000.0,
            'Sodium': 2300.0,
            'Potassium': 3500.0,
            'VitaminD': 600.0
        }

        user = crud.get_user(db, user_id)
        remaining_cals = float("inf")
        if user:
            today_str = crud.get_today_str()
            daily_log = crud.get_daily_log(db, user_id, today_str)
            consumed = daily_log["consumed_calories"] if daily_log else 0.0
            target = user["target_calories"] if user["target_calories"] > 0 else 2000.0
            remaining_cals = max(0.0, target - consumed)
            if user["goal"] == "weight_loss":
                target_macros['Carbohydrates'] = max(0, target_macros['Carbohydrates'] - 25)
                target_macros['Fibre'] += 5.0
            elif user["goal"] == "muscle_gain":
                target_macros['Proteins'] += 25
        else:
            remaining_cals = 2000.0

        knn = get_models().knn_recommender
        if knn is not None:
            results = knn.recommend(
                target_macros=target_macros,
                diet_type=req.diet_type,
                calorie_budget=remaining_cals,
                preferred_region=req.preferred_region or (user.get("preferred_region", "") if user else ""),
                preferred_state=req.preferred_state or (user.get("preferred_state", "") if user else ""),
                max_results=5
            )
            duration = time.monotonic() - start
            recommendation_latency.labels(engine="knn").observe(duration)
            logger.info("Recommendation via KNN", extra={"user_id": user_id, "duration_ms": round(duration * 1000, 2), "results": len(results)})
            return {"status": "success", "recommendations": results}

        return await _recommend_fallback(req, target_macros, remaining_cals, db, start)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Recommendation failed", extra={"user_id": user_id, "error": str(e)}, exc_info=True)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


async def _recommend_fallback(req: MacroRequest, target_macros: dict, remaining_cals: float, db: sqlite3.Connection, start: float = 0):
    m = get_models()
    df = m.df
    if req.diet_type.lower() == "veg":
        available_df = df[df.get('Veg_Flag', df.get('VegNovVeg', 0)) == 0] if 'Veg_Flag' in df.columns or 'VegNovVeg' in df.columns else df
    elif req.diet_type.lower() == "nonveg":
        available_df = df[df.get('Veg_Flag', df.get('VegNovVeg', 0)) == 1] if 'Veg_Flag' in df.columns or 'VegNovVeg' in df.columns else df
    else:
        available_df = df
    try:
        input_vector = []
        for col in INPUT_FEATURES:
            norm_val = norm(target_macros.get(col, 0), col) if col in m.scaling['means'] else 0.0
            input_vector.append(norm_val)
        input_vector.append(0.0)
        input_tensor = torch.tensor([input_vector], dtype=torch.float32)
        with torch.no_grad():
            latent, _ = m.autoencoder(input_tensor)
        candidate_vectors, valid_indices = [], []
        for idx, row in available_df.iterrows():
            try:
                vec = []
                for col in INPUT_FEATURES:
                    val = float(row[col]) if pd.notnull(row[col]) else 0.0
                    norm_val = norm(val, col) if col in m.scaling['means'] else 0.0
                    vec.append(norm_val)
                vec.append(float(row.get('Veg_Flag', 0.0)))
                candidate_vectors.append(vec)
                valid_indices.append(idx)
            except Exception:
                continue
        if not candidate_vectors:
            if start:
                duration = time.monotonic() - start
                recommendation_latency.labels(engine="autoencoder_fallback").observe(duration)
            return {"status": "success", "recommendations": []}
        cand_tensor = torch.tensor(candidate_vectors, dtype=torch.float32)
        with torch.no_grad():
            cand_latents, _ = m.autoencoder(cand_tensor)
        distances = torch.cdist(latent, cand_latents).squeeze().numpy()
        recommendations = []
        for idx_in_tensor in distances.argsort():
            if len(recommendations) >= 5:
                break
            idx = valid_indices[idx_in_tensor]
            row = df.loc[idx]
            food_cals = float(row.get('Calories', 0))
            if food_cals > remaining_cals:
                continue
            food_name = str(row.get('Food_items', ''))
            region_info = get_regional_info(food_name)
            if req.preferred_region and region_info.get('region', '').lower() != req.preferred_region.lower() and region_info.get('region', '') != 'All India':
                continue
            if req.preferred_state and region_info.get('state', '').lower() != req.preferred_state.lower() and region_info.get('state', '') != 'All':
                continue
            match_col = 'Food_items' if 'Food_items' in df.columns else df.columns[0]
            recommendations.append({
                "name": str(row[match_col]),
                "calories": food_cals,
                "protein": float(row.get('Proteins', 0)),
                "carbs": float(row.get('Carbohydrates', 0)),
                "fat": float(row.get('Fats', 0)),
                "portion": "1 serving",
                "tags": ["AI Recommended"],
                "reasoning_trace": {
                    "protein_gap": max(0, float(req.target_pro - float(row.get('Proteins', 0)))),
                    "fiber_gap": max(0, float(30.0 - float(row.get('Fibre', 0)))),
                    "calorie_fit": min(100, int(food_cals / max(1, req.target_cals) * 100)),
                    "regional_match": region_info.get('region', ''),
                    "state_match": region_info.get('state', ''),
                    "cuisine": region_info.get('cuisine', ''),
                    "meal_type": region_info.get('meal_type', ''),
                    "vegetarian_safe": float(row.get('Veg_Flag', 0)) == 0.0
                }
            })
        if start:
            duration = time.monotonic() - start
            recommendation_latency.labels(engine="autoencoder_fallback").observe(duration)
        logger.info("Recommendation via autoencoder fallback", extra={"results": len(recommendations)})
        return {"status": "success", "recommendations": recommendations}
    except Exception as model_err:
        logger.error("Fallback recommendation failed", extra={"error": str(model_err)}, exc_info=True)
        logger.warning("Model error, falling back to basic distance", extra={"error": str(model_err)})
        return {"status": "success", "recommendations": []}


@router.get("/api/next-meal-suggestion/{user_id}")
@_rate_limit("60/minute")
async def get_next_meal_suggestion(request: Request, user_id: int, anti_gravity: bool = False, db: sqlite3.Connection = Depends(get_db), current_user_id: int = Depends(require_user_id)):
    if current_user_id != user_id:
        raise HTTPException(status_code=403, detail="You can only view your own meal suggestions")
    try:
        user = crud.get_user(db, current_user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        today_str = crud.get_today_str()
        daily_log = crud.get_daily_log(db, user_id, today_str)

        target_cals = user.get("target_calories", 2000.0)
        target_pro = user.get("target_protein", 50.0)
        if anti_gravity:
            target_pro *= 1.2
        target_carbs = user.get("target_carbs", 250.0)
        target_fats = user.get("target_fats", 70.0)
        user_goal = user.get("goal", "maintain")
        preferred_region = user.get("preferred_region", "")
        preferred_state = user.get("preferred_state", "")
        height_cm = user.get("height_cm", 175.0)
        weight_kg = user.get("weight_kg", 70.0)
        height_m = height_cm / 100.0
        bmi = weight_kg / (height_m ** 2) if height_m > 0 else 22.0

        consumed_cals = daily_log["consumed_calories"] if daily_log else 0.0
        consumed_pro = daily_log["consumed_protein"] if daily_log else 0.0
        consumed_carbs = daily_log["consumed_carbs"] if daily_log else 0.0
        consumed_fats = daily_log["consumed_fats"] if daily_log else 0.0

        rem_cals = max(0.0, target_cals - consumed_cals)
        rem_pro = max(0.0, target_pro - consumed_pro)
        rem_carbs = max(0.0, target_carbs - consumed_carbs)
        rem_fats = max(0.0, target_fats - consumed_fats)

        response = {
            "remaining_calories": int(rem_cals),
            "remaining_macros": {
                "protein": int(rem_pro),
                "carbs": int(rem_carbs),
                "fat": int(rem_fats)
            },
            "suggested_meals": []
        }

        if anti_gravity:
            mg_score = 100.0
            if consumed_pro < (target_pro * 0.5):
                mg_score -= 20.0
            elif consumed_pro < (target_pro * 0.8):
                mg_score -= 10.0
            if consumed_cals > 0 and (consumed_carbs * 4.0) / consumed_cals > 0.6:
                mg_score -= 15.0
            response["microgravity_priority_score"] = int(max(0, min(100, mg_score)))

        if rem_cals <= 0:
            return response

        priority_macro = "Balanced"
        pro_deficit_pct = rem_pro / target_pro if target_pro > 0 else 0
        carb_deficit_pct = rem_carbs / target_carbs if target_carbs > 0 else 0
        fat_deficit_pct = rem_fats / target_fats if target_fats > 0 else 0

        if pro_deficit_pct > carb_deficit_pct and pro_deficit_pct > fat_deficit_pct:
            priority_macro = "Protein"
        elif carb_deficit_pct > pro_deficit_pct and carb_deficit_pct > fat_deficit_pct:
            priority_macro = "Carbohydrates"
        elif fat_deficit_pct > pro_deficit_pct and fat_deficit_pct > carb_deficit_pct:
            priority_macro = "Fats"

        if anti_gravity:
            priority_macro = "Protein (Anti-Gravity Mode)"
            response["priority_macro"] = priority_macro
            response["priority_focus"] = "Muscle Preservation"
        else:
            if user_goal == "muscle_gain" or pro_deficit_pct > 0.4:
                priority_macro = "Protein Focus (Muscle Gain)"
            elif user_goal == "weight_loss" or bmi > 25.0:
                priority_macro = "Low-Carb / High-Protein (Weight Management)"
            response["priority_macro"] = priority_macro

        remaining_macros = {"protein": rem_pro, "carbs": rem_carbs, "fat": rem_fats}

        knn = get_models().knn_recommender
        if knn is not None:
            suggested, _ = knn.suggest_next_meal(
                remaining_calories=rem_cals,
                remaining_macros=remaining_macros,
                user_goal=user_goal,
                anti_gravity=anti_gravity,
                preferred_region=preferred_region,
                preferred_state=preferred_state,
                max_results=3
            )
            response["suggested_meals"] = suggested
            logger.info("Meal suggestion via KNN", extra={"user_id": user_id, "results": len(suggested)})
            return response

        return await _suggest_fallback(rem_cals, rem_pro, rem_carbs, rem_fats,
                                       priority_macro, preferred_region, preferred_state,
                                       anti_gravity, response)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Meal suggestion failed", extra={"user_id": user_id, "error": str(e)}, exc_info=True)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/users/me/next-meal-recommendation")
@_rate_limit("60/minute")
async def get_smart_next_meal_recommendation(request: Request, db: sqlite3.Connection = Depends(get_db), current_user_id: int = Depends(require_user_id)):
    try:
        user = crud.get_user(db, current_user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        today_str = crud.get_today_str()
        daily_log = crud.get_daily_log(db, current_user_id, today_str)

        target_cals = user.get("target_calories", 2000.0)
        target_pro = user.get("target_protein", 50.0)
        target_carbs = user.get("target_carbs", 250.0)
        target_fats = user.get("target_fats", 70.0)
        user_goal = user.get("goal", "maintain")
        preferred_region = user.get("preferred_region", "")
        preferred_state = user.get("preferred_state", "")

        consumed_cals = daily_log["consumed_calories"] if daily_log else 0.0
        consumed_pro = daily_log["consumed_protein"] if daily_log else 0.0
        consumed_carbs = daily_log["consumed_carbs"] if daily_log else 0.0
        consumed_fats = daily_log["consumed_fats"] if daily_log else 0.0

        rem_cals = max(0.0, target_cals - consumed_cals)
        rem_pro = max(0.0, target_pro - consumed_pro)
        rem_carbs = max(0.0, target_carbs - consumed_carbs)
        rem_fats = max(0.0, target_fats - consumed_fats)

        remaining_macros = {"protein": rem_pro, "carbs": rem_carbs, "fat": rem_fats}
        consumed_macros = {"protein": consumed_pro, "carbs": consumed_carbs, "fat": consumed_fats}
        target_macros_full = {"protein": target_pro, "carbs": target_carbs, "fat": target_fats}

        response = {
            "remaining_calories": int(rem_cals),
            "remaining_macros": {k: int(v) for k, v in remaining_macros.items()},
            "consumed_macros": {k: int(v) for k, v in consumed_macros.items()},
            "suggested_meals": [],
            "deficit_reason": "Balanced",
        }

        if rem_cals <= 0:
            response["deficit_reason"] = "You've hit your calorie target for today!"
            return response

        knn = get_models().knn_recommender
        if knn is not None:
            suggested, reason = knn.suggest_next_meal_adjusted(
                remaining_calories=rem_cals,
                remaining_macros=remaining_macros,
                consumed_macros=consumed_macros,
                target_macros=target_macros_full,
                user_goal=user_goal,
                preferred_region=preferred_region,
                preferred_state=preferred_state,
                max_results=3
            )
            response["suggested_meals"] = suggested
            response["deficit_reason"] = reason
            logger.info("Smart next-meal recommendation", extra={"user_id": current_user_id, "reason": reason, "results": len(suggested)})
            return response

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Smart recommendation failed", extra={"user_id": current_user_id, "error": str(e)}, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


async def _suggest_fallback(rem_cals, rem_pro, rem_carbs, rem_fats,
                            priority_macro, preferred_region, preferred_state,
                            anti_gravity, response):
    m = get_models()
    df = m.df
    try:
        available_df = df.copy()
        ideal_cals, ideal_pro, ideal_carbs, ideal_fats = rem_cals, rem_pro, rem_carbs, rem_fats

        input_vector = []
        for col in INPUT_FEATURES:
            val = ideal_cals if col == 'Calories' \
                  else ideal_fats if col == 'Fats' \
                  else ideal_pro if col == 'Proteins' \
                  else ideal_carbs if col == 'Carbohydrates' \
                  else 30.0 if col == 'Fibre' \
                  else 18.0 if col == 'Iron' \
                  else 1000.0 if col == 'Calcium' \
                  else 2300.0 if col == 'Sodium' \
                  else 3500.0 if col == 'Potassium' \
                  else 600.0 if col == 'VitaminD' \
                  else 5.0
            norm_v = norm(val, col) if col in m.scaling['means'] else 0.0
            input_vector.append(norm_v)
        input_vector.append(0.0)

        input_tensor = torch.tensor([input_vector], dtype=torch.float32)
        with torch.no_grad():
            latent, _ = m.autoencoder(input_tensor)

        candidate_vectors, valid_indices, valid_rows = [], [], []
        for idx, row in available_df.iterrows():
            try:
                food_cals = float(row.get('Calories', 0))
                if food_cals > rem_cals or food_cals == 0:
                    continue
                if rem_cals < 200 and food_cals > 150:
                    continue
                vec = []
                for col in INPUT_FEATURES:
                    val = float(row[col]) if pd.notnull(row[col]) else 0.0
                    norm_v = norm(val, col) if col in m.scaling['means'] else 0.0
                    vec.append(norm_v)
                vec.append(float(row.get('Veg_Flag', 0.0)))
                candidate_vectors.append(vec)
                valid_indices.append(idx)
                valid_rows.append(row)
            except Exception:
                continue

        if candidate_vectors:
            cand_tensor = torch.tensor(candidate_vectors, dtype=torch.float32)
            with torch.no_grad():
                cand_latents, _ = m.autoencoder(cand_tensor)
            distances = torch.cdist(latent, cand_latents).squeeze().numpy()

            scored_candidates = []
            max_dist = distances.max() if len(distances) > 0 and distances.max() > 0 else 1.0
            min_dist = distances.min() if len(distances) > 0 else 0.0
            dist_range = max_dist - min_dist if max_dist > min_dist else 1.0

            for i, row in enumerate(valid_rows):
                food_name = str(row.get('Food_items', row.get('Food', '')))
                region_info = get_regional_info(food_name)
                if preferred_region and region_info.get('region', '').lower() != preferred_region.lower() and region_info.get('region', '') != 'All India':
                    continue
                if preferred_state and region_info.get('state', '').lower() != preferred_state.lower() and region_info.get('state', '') != 'All':
                    continue

                dist = distances[i] if distances.ndim == 1 else distances
                latent_similarity = max(0.0, 100.0 * (1.0 - ((dist - min_dist) / dist_range)))

                food_pro = float(row.get('Proteins', 0))
                food_carbs = float(row.get('Carbohydrates', 0))
                food_cals = float(row.get('Calories', 0))

                if anti_gravity:
                    food_name_lower = food_name.lower()
                    leucine_rich = any(w in food_name_lower for w in ['egg', 'chicken', 'fish', 'yogurt', 'paneer'])
                    calcium_rich = any(w in food_name_lower for w in ['dairy', 'milk', 'cheese', 'paneer', 'spinach', 'leafy'])

                    macro_alignment = 50.0
                    if rem_pro > 0 and food_pro > 10:
                        macro_alignment += 30
                    if rem_carbs < 30 and food_carbs > 30:
                        macro_alignment -= 30
                    if rem_cals > 0:
                        macro_alignment += 40 * (1 - abs(food_cals - ideal_cals) / max(rem_cals, 1))
                    macro_alignment = max(0.0, min(100.0, macro_alignment))

                    leucine_support = max(0.0, min(100.0, 100.0 if leucine_rich else (food_pro * 0.08 * 10.0)))
                    cal_support = max(0.0, min(100.0, 100.0 if calcium_rich else 0.0))
                    final_score = (0.4 * latent_similarity) + (0.3 * macro_alignment) + (0.2 * leucine_support) + (0.1 * cal_support)

                    explanation = "A balanced choice that fits your remaining calorie limits."
                    if leucine_rich or (food_pro > 15):
                        explanation = "High leucine density supports muscle preservation in microgravity."
                    elif calcium_rich:
                        explanation = "High calcium content supports bone density in low mechanical loading environments."
                    elif food_pro > 5:
                        explanation = "Optimized for leucine support in low mechanical loading environments."
                else:
                    base_score = latent_similarity
                    custom_bonus = 0.0
                    if "Protein" in priority_macro and food_pro > 15:
                        custom_bonus += 15.0
                    if "Low-Carb" in priority_macro and food_carbs > 30:
                        custom_bonus -= 20.0
                    final_score = base_score + custom_bonus

                    explanation = "A balanced choice that fits your remaining calorie limits."
                    if "Protein" in priority_macro and food_pro > 10:
                        explanation = f"High protein ({int(food_pro)}g) fits perfectly into your muscle and deficit goals."
                    elif "Low-Carb" in priority_macro and food_carbs < 20:
                        explanation = "Low in carbs to support your weight management while staying within limits."
                    elif rem_cals < 300 and food_cals < 200:
                        explanation = "A great lightweight snack that won't blow your remaining budget."

                final_score = max(0.0, min(100.0, final_score))
                scored_candidates.append({"row": row, "score": final_score, "explanation": explanation})

            scored_candidates.sort(key=lambda x: x["score"], reverse=True)
            for cand in scored_candidates[:3]:
                row = cand["row"]
                match_col = 'Food_items' if 'Food_items' in df.columns else df.columns[0]
                food_name = str(row[match_col])
                region_info = get_regional_info(food_name)
                response["suggested_meals"].append({
                    "food": str(row[match_col]),
                    "calories": int(float(row.get('Calories', 0))),
                    "protein": int(float(row.get('Proteins', 0))),
                    "match_score": round(cand["score"], 1),
                    "explanation": cand["explanation"],
                    "reasoning_trace": {
                        "protein_gap": max(0, int(rem_pro - float(row.get('Proteins', 0)))),
                        "fiber_gap": max(0, int(30.0 - float(row.get('Fibre', 0)))),
                        "calorie_fit": min(100, int(float(row.get('Calories', 0)) / max(1, rem_cals) * 100) if rem_cals > 0 else 0),
                        "regional_match": region_info.get('region', ''),
                        "state_match": region_info.get('state', ''),
                        "cuisine": region_info.get('cuisine', ''),
                        "meal_type": region_info.get('meal_type', ''),
                        "vegetarian_safe": float(row.get('Veg_Flag', 0)) == 0.0
                    }
                })
        logger.info("Meal suggestion via autoencoder fallback", extra={"results": len(response["suggested_meals"])})
    except Exception as model_err:
        logger.error("Suggestion fallback failed", extra={"error": str(model_err)}, exc_info=True)
        logger.warning("Suggestion model error", extra={"error": str(model_err)})
    return response
