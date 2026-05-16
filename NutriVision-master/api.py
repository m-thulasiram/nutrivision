from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import pickle
import os
from fastapi import UploadFile, File
import io
from PIL import Image
from ultralytics import YOLO
import time
import sqlite3
from fastapi import Depends
from database import get_db, init_db
import crud
from services.health_calculator import calculate_bmr, calculate_tdee, calculate_targets

# ==========================================
# 1. SERVER SETUP & CORS
# ==========================================
app = FastAPI(title="NutriVision Neuro-Symbolic API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DB
init_db()

# ==========================================
# 2. LOAD PYTORCH MODELS & DATASET
# ==========================================
class DietAutoencoder(nn.Module):
    def __init__(self, input_dim=6):
        super().__init__()
        self.encoder = nn.Sequential(nn.Linear(input_dim, 16), nn.ReLU(), nn.Linear(16, 8))
        self.decoder = nn.Sequential(nn.Linear(8, 16), nn.ReLU(), nn.Linear(16, input_dim))
    def forward(self, x): 
        return self.encoder(x), self.decoder(self.encoder(x))

print("🧠 Booting up NutriVision AI Engine...")

try:
    model = DietAutoencoder(input_dim=6)
    
    diet_model_path = "diet_model.pth"
    db_path = "processed_diet_database.csv"
    scaling_path = "scaling_params.pkl"

    if not all(os.path.exists(p) for p in [diet_model_path, db_path, scaling_path]):
        raise RuntimeError(f"CRITICAL: Missing Recommender Model Files. Required: {diet_model_path}, {db_path}, {scaling_path}")

    model.load_state_dict(torch.load(diet_model_path, map_location=torch.device('cpu'), weights_only=True))
    model.eval()
    
    # User specified: Use processed_diet_database.csv for mapping
    df = pd.read_csv(db_path)
    with open(scaling_path, "rb") as f:
        scaling = pickle.load(f)
except Exception as e:
    import sys
    print(f"⚠️ FATAL ERROR: Could not load AI Recommender models or data. Exception: {e}")
    sys.exit(1)

try:
    yolo_path = os.path.join("runs", "detect", "train2", "weights", "best.pt")
    if not os.path.exists(yolo_path):
        raise RuntimeError(f"CRITICAL: Missing YOLO weights at {yolo_path}")
    # User specified: runs/detect/train/weights/best.pt but locally it is train2
    yolo_model = YOLO(yolo_path)
except Exception as e:
    import sys
    print(f"⚠️ FATAL ERROR: Could not load YOLO model: {e}")
    sys.exit(1)

def norm(val, name): 
    return (val - scaling['means'][name]) / scaling['stds'][name]

# ==========================================
# 3. DEFINE ENDPOINTS
# ==========================================
class MacroRequest(BaseModel):
    target_cals: float
    target_pro: float
    target_carb: float
    target_fat: float
    diet_type: str  
    user_id: int = 1

class UserProfileCreate(BaseModel):
    name: str = "Astronaut"
    age: int = 30
    gender: str = "Male"
    height_cm: float = 175.0
    weight_kg: float = 70.0
    activity_level: str = "moderate"
    goal: str = "maintain"

@app.post("/api/users/profile")
def create_or_update_profile(profile: UserProfileCreate, db: sqlite3.Connection = Depends(get_db)):
    bmr = calculate_bmr(profile.weight_kg, profile.height_cm, profile.age, profile.gender)
    tdee = calculate_tdee(bmr, profile.activity_level)
    targets = calculate_targets(tdee, profile.goal, profile.weight_kg)
    
    user_data = profile.dict()
    user_data["bmr"] = bmr
    user_data["tdee"] = tdee
    user_data.update(targets)
    
    user = crud.get_user(db, user_id=1)
    if user:
        user = crud.update_user(db, 1, user_data)
    else:
        user = crud.create_user(db, user_data)
        
    return {"status": "success", "user": {"id": user["id"], "name": user["name"], "tdee": user["tdee"]}}

@app.get("/api/users/{user_id}/progress")
def get_user_progress(user_id: int, db: sqlite3.Connection = Depends(get_db)):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    today_str = crud.get_today_str()
    daily_log = crud.get_daily_log(db, user_id, today_str)
    
    consumed_cals = daily_log["consumed_calories"] if daily_log else 0.0
    macros = {
        "protein": daily_log["consumed_protein"] if daily_log else 0,
        "carbs": daily_log["consumed_carbs"] if daily_log else 0,
        "fats": daily_log["consumed_fats"] if daily_log else 0
    }
        
    target_cals = user["target_calories"]
    pct_consumed = (consumed_cals / target_cals * 100) if target_cals > 0 else 0
    remaining_cals = max(0, target_cals - consumed_cals)
    
    return {
        "status": "success",
        "target_calories": target_cals,
        "consumed_calories": consumed_cals,
        "remaining_calories": remaining_cals,
        "percentage_consumed": round(pct_consumed, 1),
        "macros_consumed": macros,
        "targets": {
            "protein": user["target_protein"],
            "carbs": user["target_carbs"],
            "fats": user["target_fats"]
        }
    }

@app.post("/api/analyze-meal")
async def analyze_meal(image: UploadFile = File(...), user_id: int = 1, db: sqlite3.Connection = Depends(get_db)):
    start_time = time.time()
    if yolo_model is None:
        raise HTTPException(status_code=500, detail="YOLO model is not loaded")
        
    try:
        contents = await image.read()
        pil_image = Image.open(io.BytesIO(contents)).convert('RGB')
        
        detections = []
        top3_predictions = []
        
        # Helper to map to DB EXACTLY
        def map_to_nutrition_db(predicted_label):
            def normalize_label(label: str) -> str:
                return label.replace("_", " ").strip().lower()
            
            predicted_label_norm = normalize_label(predicted_label)
            
            if 'Food_items' in df.columns:
                match_col = 'Food_items'
            elif 'Food' in df.columns:
                match_col = 'Food'
            else:
                match_col = df.columns[0] # Fallback
                
            df['food_normalized'] = df[match_col].astype(str).str.strip().str.lower()
            
            print("YOLO label:", predicted_label)
            print("Normalized label:", predicted_label_norm)
            print("CSV columns:", df.columns.tolist())
            print("First 5 foods:", df.head())
            print("Mutton Manual Test:")
            print(df[df.iloc[:,0].str.contains("Mutton", case=False, na=False)])
            
            match = df[df['food_normalized'] == predicted_label_norm]
            
            if not match.empty:
                row = match.iloc[0]
                return {
                    "name": row[match_col],
                    "calories": float(row.get('Calories', 0)),
                    "protein": float(row.get('Proteins', 0)),
                    "carbs": float(row.get('Carbohydrates', 0)),
                    "fat": float(row.get('Fats', 0))
                }
            return None 

        # --- PyTorch YOLO Inference --- #
        results = yolo_model(pil_image)
        
        # Process results
        for r in results:
            if len(r.boxes) == 0:
                continue
                
            # Convert boxes to a list of dicts for sorting
            boxes_data = []
            for box in r.boxes:
                # Calculate normalized area (0 to 1) 
                # xyxyn is [x_min, y_min, x_max, y_max] normalized
                xyxyn = box.xyxyn[0]
                area = float(xyxyn[2] - xyxyn[0]) * float(xyxyn[3] - xyxyn[1])
                
                boxes_data.append({
                    "cls": int(box.cls[0].item() if hasattr(box.cls[0], 'item') else box.cls[0]),
                    "conf": float(box.conf[0].item() if hasattr(box.conf[0], 'item') else box.conf[0]),
                    "area": area
                })
                
            # Sort by confidence
            boxes_sorted = sorted(boxes_data, key=lambda x: x["conf"], reverse=True)
            
            for index, box in enumerate(boxes_sorted):
                cls_name = yolo_model.names[box["cls"]]
                conf = box["conf"]
                area = box["area"]
                
                print(f"YOLO Detected: {cls_name} at {conf:.2f} confidence, Area: {area:.2f}")
                
                # We need top 3 predictions overall
                if index < 3:
                    top3_predictions.append({
                        "label": cls_name,
                        "prob": conf
                    })
                
                # Unknown food short-circuit - do NOT process low confidence boxes into macros at all
                if conf < 0.60:
                    continue
                
                # Heuristic portion scaling utilizing Square Root approximation
                import math
                multiplier = max(0.5, min(2.5, math.sqrt(area) * 5.0))
                
                matched_nutrition = map_to_nutrition_db(cls_name)
                if matched_nutrition:
                    detections.append({
                        "class_name": matched_nutrition["name"],
                        "confidence": conf,
                        "calories": float(matched_nutrition["calories"] * multiplier),
                        "protein": float(matched_nutrition["protein"] * multiplier),
                        "carbs": float(matched_nutrition["carbs"] * multiplier),
                        "fat": float(matched_nutrition["fat"] * multiplier),
                        "estimated_weight_g": float(100 * multiplier),
                        "raw_model_label": cls_name
                    })
                else:
                    # If it's a valid YOLO class but not in nutrition DB, we can't hallucinate
                    detections.append({
                        "class_name": cls_name.replace("_", " "),
                        "confidence": conf,
                        "calories": 0.0,
                        "protein": 0.0,
                        "carbs": 0.0,
                        "fat": 0.0,
                        "estimated_weight_g": float(100 * multiplier),
                        "raw_model_label": cls_name
                    })

        # If absolutely nothing detected at all or all boxes threw away due to < 0.60 confidence
        if not detections:
            max_conf = max([p["prob"] for p in top3_predictions]) if top3_predictions else 0.0
            return {
                "status": "uncertain",
                "message": "Food not recognized with sufficient confidence.",
                "confidence": max_conf,
                "detected_items": [],
                "recommendation": "Please upload a clearer image or add this food to the nutrition database.",
                "total_calories": 0.0,
                "microgravity_priority_score": 0.0,
                "daily_percentage_consumed": 0.0,
                "remaining_calories": 0.0,
                "alerts": [],
                "macro_distribution": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0},
                "uncertain": True
            }

        # Format Final JSON response
        detected_items_names = [d["class_name"] for d in detections]
        confidence_scores = [d["confidence"] for d in detections]
        
        total_pro = sum(d['protein'] for d in detections)
        total_cal = sum(d['calories'] for d in detections)
        total_carb = sum(d['carbs'] for d in detections)
        total_fat = sum(d['fat'] for d in detections)
        
        alerts = []
        score = 100
        
        # Microgravity protein req: +20% protein ratio
        if total_cal > 0:
            protein_cal = total_pro * 4
            if protein_cal / total_cal < 0.20:
                alerts.append("Critical: Protein intake is below the 20% microgravity threshold for preventing muscle atrophy.")
                score -= 15
            else:
                alerts.append("Sufficient protein for muscle retention.")
                
        # Leucine, Calcium, Vit D checks
        if total_pro < 10:
            alerts.append("Warning: Leucine levels may be insufficient for mTOR activation.")
            score -= 10
            
        macro_dist = {
            "calories": round(total_cal, 1),
            "protein": round(total_pro, 1),
            "carbs": round(total_carb, 1),
            "fat": round(total_fat, 1)
        }

        pct_consumed = 0.0
        rem_cals = 0.0

        # Database Persistence & Smart Real-Time Alerts
        if total_cal > 0:
            user = crud.get_user(db, user_id)
            # Create meal log
            crud.create_meal_log(db, {
                "user_id": user_id,
                "detected_items": ", ".join(detected_items_names),
                "total_calories": total_cal,
                "total_protein": total_pro,
                "total_carbs": total_carb,
                "total_fats": total_fat
            })
            # Create/update daily log
            daily_log = crud.create_or_update_daily_log(
                db, user_id, crud.get_today_str(),
                total_cal, total_pro, total_carb, total_fat
            )
            
            # Generate smart contextual strings
            if user and user["target_calories"] > 0:
                pct_consumed = (daily_log["consumed_calories"] / user["target_calories"]) * 100
                rem_cals = max(0, user["target_calories"] - daily_log["consumed_calories"])
                alerts.append(f"You have consumed {pct_consumed:.1f}% of your daily requirement.")
                if rem_cals > 0:
                    alerts.append(f"You need {int(rem_cals)} calories more today.")
                else:
                    alerts.append(f"You have exceeded your calorie target by {int(abs(user['target_calories'] - daily_log['consumed_calories']))} calories.")

        inference_time_ms = round((time.time() - start_time) * 1000, 2)
        print("Model Used: YOLO (Custom Dataset) -> Custom Diet Recommender")
        print(f"Top Predictions: {top3_predictions}")
        print(f"⏱️ Inference metrics: {inference_time_ms}ms")

        return {
            "status": "success",
            "detected_items": detected_items_names,
            "confidence_scores": [round(c, 2) for c in confidence_scores],
            "macro_distribution": macro_dist,
            "total_calories": round(total_cal, 1),
            "microgravity_priority_score": score,
            "daily_percentage_consumed": round(pct_consumed, 1),
            "remaining_calories": round(rem_cals, 1),
            "alerts": alerts,
            "detections": detections,
            "top3_predictions": top3_predictions,
            "inference_time_ms": inference_time_ms,
            "uncertain": False
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/recommend")
async def recommend_food(req: MacroRequest, db: sqlite3.Connection = Depends(get_db)):
    try:
        if req.diet_type.lower() == "veg":
             if 'VegNovVeg' in df.columns:
                 available_df = df[df['VegNovVeg'] != '1'] 
             else:
                 available_df = df
        elif req.diet_type.lower() == "nonveg":
             if 'VegNovVeg' in df.columns:
                 available_df = df[df['VegNovVeg'] == '1']
             else:
                 available_df = df
        else:
             available_df = df

        target_macros = {
            'Calories': float(req.target_cals),
            'Fats': float(req.target_fat),
            'Proteins': float(req.target_pro),
            'Carbohydrates': float(req.target_carb),
            'Fibre': 10.0, 
            'Sugars': 5.0  
        }
        
        # Apply goal-based penalties/biases
        user = crud.get_user(db, req.user_id)
        remaining_cals = float("inf")
        if user:
            today_str = crud.get_today_str()
            daily_log = crud.get_daily_log(db, req.user_id, today_str)
            consumed = daily_log["consumed_calories"] if daily_log else 0.0
            
            # Default to 2000 ceiling if they haven't set up their targets properly yet
            target = user["target_calories"] if user["target_calories"] > 0 else 2000.0
            remaining_cals = max(0.0, target - consumed)
                
            if user["goal"] == "weight_loss":
                target_macros['Carbohydrates'] = max(0, target_macros['Carbohydrates'] - 25)
                target_macros['Fibre'] += 5.0
            elif user["goal"] == "muscle_gain":
                target_macros['Proteins'] += 25
        else:
            remaining_cals = 2000.0
        
        try:
            # Try to build the normalized vector
            input_vector = []
            for col in ['Calories', 'Fats', 'Proteins', 'Carbohydrates', 'Fibre', 'Sugars']:
                norm_val = norm(target_macros[col], col) if col in scaling['means'] else 0.0
                input_vector.append(norm_val)
                
            input_tensor = torch.tensor([input_vector], dtype=torch.float32)
            
            with torch.no_grad():
                latent, _ = model(input_tensor)
                latent_np = latent.numpy()
                
            # Now we need the latent vectors of all candidate foods to find closest matches
            # Instead of re-inferencing everything, we compute distances in macro space
            # as a quick proxy if precomputed latents aren't available in df.
            # But wait, Autoencoder is meant to reconstruct. Better to use Euclidean distance 
            # on the scaled inputs directly, OR pass all df rows through encoder and find closest.
            
            # Since df is small (91 rows), we can encode all candidate rows:
            candidate_vectors = []
            valid_indices = []
            for idx, row in available_df.iterrows():
                try:
                    vec = []
                    for col in ['Calories', 'Fats', 'Proteins', 'Carbohydrates', 'Fibre', 'Sugars']:
                        val = float(row[col]) if pd.notnull(row[col]) else 0.0
                        norm_val = norm(val, col) if col in scaling['means'] else 0.0
                        vec.append(norm_val)
                    candidate_vectors.append(vec)
                    valid_indices.append(idx)
                except:
                    continue
                    
            if candidate_vectors:
                cand_tensor = torch.tensor(candidate_vectors, dtype=torch.float32)
                with torch.no_grad():
                    cand_latents, _ = model(cand_tensor)
                    
                # Calculate distances in latent space
                distances = torch.cdist(latent, cand_latents).squeeze().numpy()
                
                # Get closest, filtering by Caloric Budget Hard Limit
                sorted_indices_in_tensor = distances.argsort()
                
                recommendations = []
                for idx_in_tensor in sorted_indices_in_tensor:
                    if len(recommendations) >= 5:
                        break
                        
                    idx = valid_indices[idx_in_tensor]
                    row = df.loc[idx]
                    food_cals = float(row.get('Calories', 0))
                    
                    # HARD CONSTRAINT: Do not recommend foods exceeding their daily limit
                    if food_cals > remaining_cals:
                        print(f"Skipping {row.get('Food_items', 'Food')} (Cals: {food_cals} > Rem: {remaining_cals})")
                        continue
                        
                    match_col = 'Food_items' if 'Food_items' in df.columns else df.columns[0]
                    recommendations.append({
                        "name": str(row[match_col]),
                        "calories": food_cals,
                        "protein": float(row.get('Proteins', 0)),
                        "carbs": float(row.get('Carbohydrates', 0)),
                        "fat": float(row.get('Fats', 0)),
                        "portion": "1 serving",
                        "tags": ["AI Recommended"]
                    })
                    
                print(f"Final Recommender Ceiling applied: User has {remaining_cals} macros left.")
                return {"status": "success", "recommendations": recommendations}
            else:
                return {"status": "success", "recommendations": []}
                
        except Exception as model_err:
            print(f"Model Error: {model_err}. Falling back to basic distance.")
            
        # Basic heuristic fallback if model fails
        return {"status": "success", "recommendations": []}

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/next-meal-suggestion/{user_id}")
async def get_next_meal_suggestion(user_id: int, anti_gravity: bool = False, db: sqlite3.Connection = Depends(get_db)):
    print(f"DEBUG HIT: next-meal-suggestion for {user_id} with anti_gravity={anti_gravity}")
    try:
        user = crud.get_user(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        today_str = crud.get_today_str()
        daily_log = crud.get_daily_log(db, user_id, today_str)
        
        # User targets
        target_cals = user.get("target_calories", 2000.0)
        target_pro = user.get("target_protein", 50.0)
        
        # Rule 1: Increase Protein Requirement
        if anti_gravity:
            target_pro *= 1.2
            
        target_carbs = user.get("target_carbs", 250.0)
        target_fats = user.get("target_fats", 70.0)
        user_goal = user.get("goal", "maintain")
        height_cm = user.get("height_cm", 175.0)
        weight_kg = user.get("weight_kg", 70.0)
        
        # BMI Calculation
        height_m = height_cm / 100.0
        bmi = weight_kg / (height_m ** 2) if height_m > 0 else 22.0
        
        # Consumed macros
        consumed_cals = daily_log["consumed_calories"] if daily_log else 0.0
        consumed_pro = daily_log["consumed_protein"] if daily_log else 0.0
        consumed_carbs = daily_log["consumed_carbs"] if daily_log else 0.0
        consumed_fats = daily_log["consumed_fats"] if daily_log else 0.0
        
        # Calculate remaining
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
            # Add Microgravity Score
            mg_score = 100.0
            if consumed_pro < (target_pro * 0.5):
                mg_score -= 20.0
            elif consumed_pro < (target_pro * 0.8):
                mg_score -= 10.0
            if consumed_cals > 0 and (consumed_carbs * 4.0) / consumed_cals > 0.6:
                mg_score -= 15.0 # Excessive empty carbs penalty
            response["microgravity_priority_score"] = int(max(0, min(100, mg_score)))
            
        if rem_cals <= 0:
            return response
            
        available_df = df.copy()
        
        # Determine Priority Deficit (Which macro needs the most help?)
        pro_deficit_pct = rem_pro / target_pro if target_pro > 0 else 0
        carb_deficit_pct = rem_carbs / target_carbs if target_carbs > 0 else 0
        fat_deficit_pct = rem_fats / target_fats if target_fats > 0 else 0
        
        priority_macro = "Balanced"
        if pro_deficit_pct > carb_deficit_pct and pro_deficit_pct > fat_deficit_pct:
            priority_macro = "Protein"
        elif carb_deficit_pct > pro_deficit_pct and carb_deficit_pct > fat_deficit_pct:
            priority_macro = "Carbohydrates"
        elif fat_deficit_pct > pro_deficit_pct and fat_deficit_pct > carb_deficit_pct:
            priority_macro = "Fats"

        # Apply Goal and BMI Modifiers to Priority
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

        ideal_cals = rem_cals
        ideal_pro = rem_pro
        ideal_carbs = rem_carbs
        ideal_fats = rem_fats
        
        try:
            input_vector = []
            for col in ['Calories', 'Fats', 'Proteins', 'Carbohydrates', 'Fibre', 'Sugars']:
                val = ideal_cals if col == 'Calories' \
                      else ideal_fats if col == 'Fats' \
                      else ideal_pro if col == 'Proteins' \
                      else ideal_carbs if col == 'Carbohydrates' \
                      else 10.0 if col == 'Fibre' else 15.0
                      
                norm_v = norm(val, col) if col in scaling['means'] else 0.0
                input_vector.append(norm_v)
                
            input_tensor = torch.tensor([input_vector], dtype=torch.float32)
            
            with torch.no_grad():
                latent, _ = model(input_tensor)
                
            candidate_vectors = []
            valid_indices = []
            valid_rows = []
            
            for idx, row in available_df.iterrows():
                try:
                    food_cals = float(row.get('Calories', 0))
                    # STRICT RULE: Skip foods if Calories > remaining_calories
                    if food_cals > rem_cals or food_cals == 0:
                        continue
                        
                    # STRICT RULE: If Remaining < 200, suggest only snacks/light modes
                    if rem_cals < 200 and food_cals > 150:
                        continue
                        
                    vec = []
                    for col in ['Calories', 'Fats', 'Proteins', 'Carbohydrates', 'Fibre', 'Sugars']:
                        val = float(row[col]) if pd.notnull(row[col]) else 0.0
                        norm_v = norm(val, col) if col in scaling['means'] else 0.0
                        vec.append(norm_v)
                    candidate_vectors.append(vec)
                    valid_indices.append(idx)
                    valid_rows.append(row)
                except Exception as e:
                    continue
            
            if candidate_vectors:
                cand_tensor = torch.tensor(candidate_vectors, dtype=torch.float32)
                with torch.no_grad():
                    cand_latents, _ = model(cand_tensor)
                    
                distances = torch.cdist(latent, cand_latents).squeeze().numpy()
                
                # We do custom scoring instead of pure Euclidean sort
                scored_candidates = []
                max_dist = distances.max() if len(distances) > 0 and distances.max() > 0 else 1.0
                min_dist = distances.min() if len(distances) > 0 else 0.0
                dist_range = max_dist - min_dist if max_dist > min_dist else 1.0

                for i, row in enumerate(valid_rows):
                    dist = distances[i] if distances.ndim == 1 else distances
                    # Base normalized autoencoder score (0 to 100) -> latent_similarity
                    latent_similarity = max(0.0, 100.0 * (1.0 - ((dist - min_dist) / dist_range)))
                    
                    food_pro = float(row.get('Proteins', 0))
                    food_carbs = float(row.get('Carbohydrates', 0))
                    food_fats = float(row.get('Fats', 0))
                    food_cals = float(row.get('Calories', 0))
                    
                    if anti_gravity:
                        food_name = str(row.get('Food_items', row.get('Food', ''))).lower()
                        # Rule 2: Leucine Priority
                        leucine_estimate = food_pro * 0.08
                        leucine_rich = any(word in food_name for word in ['egg', 'chicken', 'fish', 'yogurt', 'paneer'])
                        
                        # Rule 3: Bone Density Support
                        calcium_rich = any(word in food_name for word in ['dairy', 'milk', 'cheese', 'paneer', 'spinach', 'leafy'])
                        
                        macro_alignment = 50.0
                        if rem_pro > 0 and food_pro > 10: macro_alignment += 30
                        if rem_carbs < 30 and food_carbs > 30: macro_alignment -= 30
                        if rem_cals > 0: macro_alignment += 40 * (1 - abs(food_cals - ideal_cals) / max(rem_cals, 1))
                        macro_alignment = max(0.0, min(100.0, macro_alignment))
                        
                        leucine_support = 100.0 if leucine_rich else (leucine_estimate * 10.0)
                        cal_support = 100.0 if calcium_rich else 0.0
                        
                        leucine_support = max(0.0, min(100.0, leucine_support))
                        cal_support = max(0.0, min(100.0, cal_support))
                        
                        # Rule 4: Adjust Weighted Score
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
                        
                        # Custom Weights & Penalties
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
                            explanation = f"Low in carbs to support your weight management while staying within limits."
                        elif rem_cals < 300 and food_cals < 200:
                            explanation = "A great lightweight snack that won't blow your remaining budget."
                            
                    # STRICT normalization & clamping to [0, 100] exactly
                    final_score = max(0.0, min(100.0, final_score))
                        
                    scored_candidates.append({
                        "row": row,
                        "score": final_score,
                        "explanation": explanation
                    })
                
                # Sort descending by custom calculated score
                scored_candidates.sort(key=lambda x: x["score"], reverse=True)
                
                for cand in scored_candidates[:3]: # Strictly Top 3
                    row = cand["row"]
                    match_col = 'Food_items' if 'Food_items' in df.columns else df.columns[0]
                    
                    response["suggested_meals"].append({
                        "food": str(row[match_col]),
                        "calories": int(float(row.get('Calories', 0))),
                        "protein": int(float(row.get('Proteins', 0))),
                        "match_score": round(cand["score"], 1),
                        "explanation": cand["explanation"]
                    })
        except Exception as model_err:
            print(f"Suggestion Model Error: {model_err}")
            
        return response
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))