import pandas as pd
import numpy as np
from sklearn.neighbors import NearestNeighbors

INPUT_FEATURES = ['Calories', 'Fats', 'Proteins', 'Carbohydrates', 'Sugars',
                  'Fibre', 'Iron', 'Calcium', 'Sodium', 'Potassium', 'VitaminD']

class Recommender:
    def __init__(self, db_path: str = "processed_diet_database.csv",
                 regional_path: str = "regional_foods.csv"):
        self.df = pd.read_csv(db_path)
        self._normalize()
        self._build_index()
        self._load_regional(regional_path)

    def _normalize(self):
        for col in INPUT_FEATURES:
            if col not in self.df.columns:
                self.df[col] = 0.0
            self.df[col] = pd.to_numeric(self.df[col], errors='coerce').fillna(0.0)
        self.feature_means = self.df[INPUT_FEATURES].mean().to_dict()
        self.feature_stds = self.df[INPUT_FEATURES].std().to_dict()
        for k in self.feature_stds:
            if self.feature_stds[k] == 0:
                self.feature_stds[k] = 1.0
        norm_cols = []
        for col in INPUT_FEATURES:
            ncol = f"norm_{col}"
            self.df[ncol] = (self.df[col] - self.feature_means[col]) / self.feature_stds[col]
            norm_cols.append(ncol)
        self.norm_cols = norm_cols

    def _build_index(self):
        X = self.df[self.norm_cols].values
        self.knn = NearestNeighbors(n_neighbors=min(20, len(self.df)), metric='euclidean')
        self.knn.fit(X)

    def _load_regional(self, path: str):
        import os
        if os.path.exists(path):
            self.regional_df = pd.read_csv(path)
            self.regional_df['Food_normalized'] = self.regional_df['Food_items'].astype(str).str.strip().str.lower()
        else:
            self.regional_df = pd.DataFrame()

    def get_regional_info(self, food_name: str) -> dict:
        if self.regional_df.empty:
            return {"region": "", "state": "", "cuisine": "", "meal_type": ""}
        norm = str(food_name).strip().lower()
        match = self.regional_df[self.regional_df['Food_normalized'] == norm]
        if not match.empty:
            row = match.iloc[0]
            return {
                "region": str(row.get('region', '')),
                "state": str(row.get('state', '')),
                "cuisine": str(row.get('cuisine', '')),
                "meal_type": str(row.get('meal_type', ''))
            }
        return {"region": "", "state": "", "cuisine": "", "meal_type": ""}

    def _build_vector(self, target_macros: dict) -> np.ndarray:
        vec = []
        for col in INPUT_FEATURES:
            val = target_macros.get(col, 0)
            vec.append((val - self.feature_means[col]) / self.feature_stds[col])
        return np.array([vec])

    def recommend(self, target_macros: dict, diet_type: str = "any",
                  calorie_budget: float = float("inf"),
                  preferred_region: str = "", preferred_state: str = "",
                  max_results: int = 5) -> list:
        if diet_type.lower() == "veg":
            candidates = self.df[self.df.get('Veg_Flag', 0) == 0].copy()
        elif diet_type.lower() == "nonveg":
            candidates = self.df[self.df.get('Veg_Flag', 0) == 1].copy()
        elif diet_type.lower() == "eggetarian":
            veg = self.df[self.df.get('Veg_Flag', 0) == 0].copy()
            egg = self.df[self.df['Food_items'].astype(str).str.lower().str.contains('egg', na=False)].copy()
            candidates = pd.concat([veg, egg]).drop_duplicates()
        else:
            candidates = self.df.copy()

        if candidates.empty:
            return []

        query_vec = self._build_vector(target_macros)
        candidate_indices = candidates.index.tolist()
        candidate_vectors = candidates[self.norm_cols].values

        if len(candidate_vectors) == 0:
            return []

        try:
            knn_local = NearestNeighbors(
                n_neighbors=min(max_results * 4, len(candidate_vectors)),
                metric='euclidean'
            )
            knn_local.fit(candidate_vectors)
            distances, indices = knn_local.kneighbors(query_vec)
        except Exception:
            return []

        results = []
        for i in indices[0]:
            if len(results) >= max_results:
                break
            idx = candidate_indices[i]
            row = candidates.loc[idx]
            food_cals = float(row.get('Calories', 0))

            if food_cals > calorie_budget:
                continue

            food_name = str(row.get('Food_items', row.iloc[0]))
            region_info = self.get_regional_info(food_name)

            if preferred_region:
                r = region_info.get('region', '')
                if r.lower() != preferred_region.lower() and r != 'All India':
                    continue
            if preferred_state:
                s = region_info.get('state', '')
                if s.lower() != preferred_state.lower() and s != 'All':
                    continue

            reasoning = {
                "protein_gap": max(0, float(target_macros.get('Proteins', 0) - float(row.get('Proteins', 0)))),
                "fiber_gap": max(0, float(30.0 - float(row.get('Fibre', 0)))),
                "calorie_fit": min(100, int(food_cals / max(1, target_macros.get('Calories', 1)) * 100)),
                "regional_match": region_info.get('region', ''),
                "state_match": region_info.get('state', ''),
                "cuisine": region_info.get('cuisine', ''),
                "meal_type": region_info.get('meal_type', ''),
                "vegetarian_safe": float(row.get('Veg_Flag', 0)) == 0.0
            }

            results.append({
                "name": food_name,
                "calories": food_cals,
                "protein": float(row.get('Proteins', 0)),
                "carbs": float(row.get('Carbohydrates', 0)),
                "fat": float(row.get('Fats', 0)),
                "portion": "1 serving",
                "tags": ["AI Recommended"],
                "reasoning_trace": reasoning
            })

        return results

    def suggest_next_meal(self, remaining_calories: float, remaining_macros: dict,
                          user_goal: str = "maintain", anti_gravity: bool = False,
                          preferred_region: str = "", preferred_state: str = "",
                          max_results: int = 3) -> tuple:
        target_macros = {
            'Calories': remaining_calories,
            'Fats': remaining_macros.get('fat', 0),
            'Proteins': remaining_macros.get('protein', 0),
            'Carbohydrates': remaining_macros.get('carbs', 0),
            'Sugars': 5.0,
            'Fibre': 30.0,
            'Iron': 18.0,
            'Calcium': 1000.0,
            'Sodium': 2300.0,
            'Potassium': 3500.0,
            'VitaminD': 600.0
        }
        if anti_gravity and target_macros['Proteins'] > 0:
            target_macros['Proteins'] *= 1.2

        if remaining_calories <= 0:
            return [], {}

        candidates = self.df.copy()
        query_vec = self._build_vector(target_macros)
        candidate_indices = candidates.index.tolist()
        candidate_vectors = candidates[self.norm_cols].values

        if len(candidate_vectors) == 0:
            return [], {}

        try:
            knn_local = NearestNeighbors(
                n_neighbors=min(30, len(candidate_vectors)),
                metric='euclidean'
            )
            knn_local.fit(candidate_vectors)
            distances, indices = knn_local.kneighbors(query_vec)
        except Exception:
            return [], {}

        scored = []
        for i in indices[0]:
            idx = candidate_indices[i]
            row = candidates.loc[idx]
            food_cals = float(row.get('Calories', 0))

            if food_cals > remaining_calories or food_cals == 0:
                continue
            if remaining_calories < 200 and food_cals > 150:
                continue

            food_name = str(row.get('Food_items', row.iloc[0]))
            region_info = self.get_regional_info(food_name)

            if preferred_region:
                r = region_info.get('region', '')
                if r.lower() != preferred_region.lower() and r != 'All India':
                    continue
            if preferred_state:
                s = region_info.get('state', '')
                if s.lower() != preferred_state.lower() and s != 'All':
                    continue

            food_pro = float(row.get('Proteins', 0))
            food_carbs = float(row.get('Carbohydrates', 0))

            score = 50.0

            if remaining_macros.get('protein', 0) > 0 and food_pro > 10:
                score += 20
            if remaining_macros.get('carbs', 0) < 30 and food_carbs > 30:
                score -= 20
            if remaining_calories > 0:
                cal_ratio = 1 - abs(food_cals - remaining_calories) / max(remaining_calories, 1)
                score += 30 * max(0, cal_ratio)

            if anti_gravity:
                leucine_rich = any(w in food_name.lower() for w in ['egg', 'chicken', 'fish', 'yogurt', 'paneer'])
                calcium_rich = any(w in food_name.lower() for w in ['dairy', 'milk', 'cheese', 'paneer', 'spinach', 'leafy'])
                if leucine_rich or food_pro > 15:
                    score += 20
                    explanation = "High leucine density supports muscle preservation in microgravity."
                elif calcium_rich:
                    score += 10
                    explanation = "High calcium content supports bone density in low mechanical loading."
                elif food_pro > 5:
                    score += 5
                    explanation = "Optimized for leucine support in low mechanical loading environments."
                else:
                    explanation = "A balanced choice that fits your remaining calorie limits."
            else:
                if "Protein" in user_goal and food_pro > 15:
                    score += 15
                    explanation = f"High protein ({int(food_pro)}g) supports your muscle goals."
                elif "weight" in user_goal and food_carbs < 20:
                    score += 10
                    explanation = "Low in carbs to support weight management."
                elif remaining_calories < 300 and food_cals < 200:
                    explanation = "A great lightweight option that won't blow your remaining budget."
                else:
                    explanation = "A balanced choice that fits your remaining calorie limits."

            score = max(0, min(100, score))

            reasoning = {
                "protein_gap": max(0, int(remaining_macros.get('protein', 0) - food_pro)),
                "fiber_gap": max(0, int(30.0 - float(row.get('Fibre', 0)))),
                "calorie_fit": min(100, int(food_cals / max(1, remaining_calories) * 100)),
                "regional_match": region_info.get('region', ''),
                "state_match": region_info.get('state', ''),
                "cuisine": region_info.get('cuisine', ''),
                "meal_type": region_info.get('meal_type', ''),
                "vegetarian_safe": float(row.get('Veg_Flag', 0)) == 0.0
            }

            scored.append({
                "food": food_name,
                "calories": int(food_cals),
                "protein": int(food_pro),
                "match_score": round(score, 1),
                "explanation": explanation,
                "reasoning_trace": reasoning
            })

        scored.sort(key=lambda x: x["match_score"], reverse=True)
        return scored[:max_results], {}

    def suggest_next_meal_adjusted(self, remaining_calories: float, remaining_macros: dict,
                                     consumed_macros: dict, target_macros: dict,
                                     user_goal: str = "maintain",
                                     preferred_region: str = "", preferred_state: str = "",
                                     max_results: int = 3) -> tuple:
        pro_pct = remaining_macros.get('protein', 0) / max(target_macros.get('protein', 1), 1)
        carb_pct = remaining_macros.get('carbs', 0) / max(target_macros.get('carbs', 1), 1)
        fat_pct = remaining_macros.get('fat', 0) / max(target_macros.get('fat', 1), 1)

        deficient = []
        if pro_pct > 0.3:
            deficient.append(("protein", pro_pct, 1.4))
        if carb_pct > 0.3:
            deficient.append(("carbs", carb_pct, 1.3))
        if fat_pct > 0.3:
            deficient.append(("fat", fat_pct, 1.1))
        deficient.sort(key=lambda x: x[1], reverse=True)

        deficit_reason = "Balanced"
        if deficient:
            top_macro = deficient[0][0]
            if top_macro == "protein":
                deficit_reason = "You're low on protein — try these high-protein choices"
                remaining_macros['protein'] = int(remaining_macros.get('protein', 0) * 1.4)
            elif top_macro == "carbs":
                deficit_reason = "You're low on carbs — try these energy-rich options"
                remaining_macros['carbs'] = int(remaining_macros.get('carbs', 0) * 1.3)
            else:
                deficit_reason = "You're low on fats — try these healthy fat sources"
                remaining_macros['fat'] = int(remaining_macros.get('fat', 0) * 1.1)

        target = {
            'Calories': remaining_calories,
            'Fats': remaining_macros.get('fat', 0),
            'Proteins': remaining_macros.get('protein', 0),
            'Carbohydrates': remaining_macros.get('carbs', 0),
            'Sugars': 5.0,
            'Fibre': 30.0,
            'Iron': 18.0,
            'Calcium': 1000.0,
            'Sodium': 2300.0,
            'Potassium': 3500.0,
            'VitaminD': 600.0
        }

        if remaining_calories <= 0:
            return [], deficit_reason

        candidates = self.df.copy()
        query_vec = self._build_vector(target)
        candidate_indices = candidates.index.tolist()
        candidate_vectors = candidates[self.norm_cols].values

        if len(candidate_vectors) == 0:
            return [], deficit_reason

        try:
            knn_local = NearestNeighbors(
                n_neighbors=min(30, len(candidate_vectors)),
                metric='euclidean'
            )
            knn_local.fit(candidate_vectors)
            distances, indices = knn_local.kneighbors(query_vec)
        except Exception:
            return [], deficit_reason

        scored = []
        for i in indices[0]:
            idx = candidate_indices[i]
            row = candidates.loc[idx]
            food_cals = float(row.get('Calories', 0))

            if food_cals > remaining_calories or food_cals == 0:
                continue
            if remaining_calories < 200 and food_cals > 150:
                continue

            food_name = str(row.get('Food_items', row.iloc[0]))
            region_info = self.get_regional_info(food_name)

            if preferred_region:
                r = region_info.get('region', '')
                if r.lower() != preferred_region.lower() and r != 'All India':
                    continue
            if preferred_state:
                s = region_info.get('state', '')
                if s.lower() != preferred_state.lower() and s != 'All':
                    continue

            food_pro = float(row.get('Proteins', 0))
            food_carbs = float(row.get('Carbohydrates', 0))
            food_fat = float(row.get('Fats', 0))

            score = 50.0

            if deficient and deficient[0][0] == "protein" and food_pro > 10:
                score += 30
            elif deficient and deficient[0][0] == "carbs" and food_carbs > 20:
                score += 30
            elif deficient and deficient[0][0] == "fat" and food_fat > 10:
                score += 30

            if remaining_calories > 0:
                cal_ratio = 1 - abs(food_cals - remaining_calories) / max(remaining_calories, 1)
                score += 20 * max(0, cal_ratio)

            score = max(0, min(100, score))

            reasoning = {
                "protein_gap": max(0, int(remaining_macros.get('protein', 0) - food_pro)),
                "fiber_gap": max(0, int(30.0 - float(row.get('Fibre', 0)))),
                "calorie_fit": min(100, int(food_cals / max(1, remaining_calories) * 100)),
                "regional_match": region_info.get('region', ''),
                "state_match": region_info.get('state', ''),
                "cuisine": region_info.get('cuisine', ''),
                "meal_type": region_info.get('meal_type', ''),
                "vegetarian_safe": float(row.get('Veg_Flag', 0)) == 0.0
            }

            scored.append({
                "food": food_name,
                "calories": int(food_cals),
                "protein": int(food_pro),
                "match_score": round(score, 1),
                "explanation": deficit_reason,
                "reasoning_trace": reasoning
            })

        scored.sort(key=lambda x: x["match_score"], reverse=True)
        return scored[:max_results], deficit_reason
