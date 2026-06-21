import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "expanded_food_database.csv"
MAPPING_PATH = BASE_DIR / "category_mapping.csv"

# Load database and category mapping
db_df = pd.read_csv(DB_PATH)
mapping_df = pd.read_csv(MAPPING_PATH)

# Build a lookup mapping: Food Name -> Super Category
food_to_super_cat = dict(zip(mapping_df["Food Name"], mapping_df["Super Category"]))

# Inject Super Category into db_df
db_df["Super Category"] = db_df["Food Name"].map(food_to_super_cat)

YOLO_TO_SUPER_CAT = {
    "Chicken_Curry": "Chicken Dish",
    "Plain_Omelette": "Egg Dish",
    "Spinach_Paneer": "Curry",
    "Appam": "Rice Dish",
    "Avial": "Curry",
    "Banana_Chips": "Snack",
    "Chapati_Roti": "Bread/Roti",
    "Chocolate_Cake": "Dessert",
    "Fruit_Salad": "Snack",
    "Idli": "Idli Variant",
    "Kulfi": "Dessert",
    "Marble_Cake": "Dessert",
    "Masala_Dosa": "Dosa Variant",
    "Masala_Vada": "Snack",
    "Mutton_Biryani": "Rice Dish",
    "Pancake": "Bread/Roti",
    "Sambar": "Dal",
    "Uttapam": "Dosa Variant",
    "Lemonade": "Beverage",
    "Rice_Puttu": "Rice Dish"
}

def get_hybrid_candidates(detected_class: str,
                          user_state: str,
                          diet_type: str,
                          hour: int = 12,
                          remaining_protein: float = 0.0,
                          limit: int = 5) -> list:
    """
    Map detected YOLO class to Super Category, filter by diet,
    score by State, Meal Type (hour), and nutrition goals, and return Top 5.
    """
    # 1. Map YOLO class to Super-Category
    cls_key = detected_class.replace(" ", "_")
    super_cat = YOLO_TO_SUPER_CAT.get(cls_key)
    if not super_cat:
        # Try case-insensitive matching
        for k, v in YOLO_TO_SUPER_CAT.items():
            if k.lower() == cls_key.lower():
                super_cat = v
                break
        if not super_cat:
            super_cat = "Snack"  # fallback
            
    # 2. Filter by Super Category
    df = db_df[db_df["Super Category"] == super_cat].copy()
    if df.empty:
        return []
        
    # 3. Filter by Diet Type
    dt = diet_type.lower() if diet_type else "any"
    if dt in ("vegetarian", "veg"):
        df = df[df["VegNovVeg"] == 0]
    elif dt == "eggetarian":
        is_veg = df["VegNovVeg"] == 0
        is_egg = df["Food Name"].str.lower().str.contains("egg|omelette", na=False)
        df = df[is_veg | is_egg]
    
    if df.empty:
        return []
        
    # 4. Score candidates
    scores = []
    
    # Map hour to Meal Type
    if 6 <= hour < 11:
        current_meal = "Breakfast"
    elif 11 <= hour < 16:
        current_meal = "Lunch"
    elif 16 <= hour < 19:
        current_meal = "Snack"
    elif 19 <= hour < 23:
        current_meal = "Dinner"
    else:
        current_meal = "Snack"
        
    for idx, row in df.iterrows():
        score = 0
        
        # State priority
        if user_state and str(row["State"]).lower().strip() == user_state.lower().strip():
            score += 50
            
        # Meal type priority
        if str(row["Meal Type"]).lower() == current_meal.lower():
            score += 25
            
        # Nutrition priority (high protein remaining -> favor high protein foods)
        if remaining_protein > 20 and row["Protein"] > 8:
            score += 15
        elif remaining_protein > 5 and row["Protein"] > 4:
            score += 8
            
        scores.append((score, row))
        
    # Sort descending by score, then alphabetically by Food Name
    scores.sort(key=lambda x: (-x[0], x[1]["Food Name"]))
    
    results = []
    for score, row in scores[:limit]:
        results.append({
            "food_name": row["Food Name"],
            "state": row["State"],
            "cuisine": row["Cuisine"],
            "meal_type": row["Meal Type"],
            "veg_nov_veg": int(row["VegNovVeg"]),
            "calories": float(row["Calories"]),
            "protein_g": float(row["Protein"]),
            "fats_g": float(row["Fat"]),
            "carbs_g": float(row["Carbs"]),
            "fiber_g": float(row["Fiber"]),
            "iron_mg": float(row["Iron"]),
            "calcium_mg": float(row["Calcium"]),
            "score": score
        })
        
    return results
