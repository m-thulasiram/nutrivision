import pandas as pd
import yaml

KNOWN_DEFAULTS = {
    "Chicken Curry": {"Calories": 250, "Fats": 15.0, "Proteins": 20.0, "Iron": 1.0, "Calcium": 15.0, "Sodium": 400, "Potassium": 200, "Carbohydrates": 5.0, "Fibre": 1.0, "VitaminD": 0, "Sugars": 1.0, "VegNovVeg": "1"},
    "Plain Omelette": {"Calories": 154, "Fats": 11.0, "Proteins": 11.0, "Iron": 1.0, "Calcium": 50.0, "Sodium": 400, "Potassium": 150, "Carbohydrates": 1.0, "Fibre": 0.0, "VitaminD": 88, "Sugars": 0.4, "VegNovVeg": "1"},
    "Spinach Paneer": {"Calories": 340, "Fats": 18.0, "Proteins": 14.0, "Iron": 3.0, "Calcium": 200.0, "Sodium": 350, "Potassium": 300, "Carbohydrates": 12.0, "Fibre": 3.0, "VitaminD": 0, "Sugars": 2.0, "VegNovVeg": "0"},
    "Appam": {"Calories": 120, "Fats": 2.0, "Proteins": 2.0, "Iron": 1.0, "Calcium": 10.0, "Sodium": 100, "Potassium": 50, "Carbohydrates": 24.0, "Fibre": 1.0, "VitaminD": 0, "Sugars": 2.0, "VegNovVeg": "0"},
    "Avial": {"Calories": 150, "Fats": 10.0, "Proteins": 3.5, "Iron": 1.0, "Calcium": 50.0, "Sodium": 200, "Potassium": 250, "Carbohydrates": 12.0, "Fibre": 4.0, "VitaminD": 0, "Sugars": 2.0, "VegNovVeg": "0"},
    "Chapati Roti": {"Calories": 297, "Fats": 7.5, "Proteins": 11.0, "Iron": 3.0, "Calcium": 93.0, "Sodium": 409, "Potassium": 266, "Carbohydrates": 46.0, "Fibre": 4.9, "VitaminD": 0, "Sugars": 2.7, "VegNovVeg": "0"},
    "Chocolate Cake": {"Calories": 350, "Fats": 15.0, "Proteins": 5.0, "Iron": 1.5, "Calcium": 60.0, "Sodium": 300, "Potassium": 150, "Carbohydrates": 50.0, "Fibre": 2.0, "VitaminD": 0, "Sugars": 35.0, "VegNovVeg": "0"},
    "Fruit Salad": {"Calories": 120, "Fats": 0.5, "Proteins": 1.5, "Iron": 0.5, "Calcium": 20.0, "Sodium": 5, "Potassium": 200, "Carbohydrates": 30.0, "Fibre": 3.0, "VitaminD": 0, "Sugars": 20.0, "VegNovVeg": "0"},
    "Kulfi": {"Calories": 300, "Fats": 18.0, "Proteins": 8.0, "Iron": 0.5, "Calcium": 150.0, "Sodium": 100, "Potassium": 200, "Carbohydrates": 30.0, "Fibre": 0.0, "VitaminD": 0, "Sugars": 25.0, "VegNovVeg": "0"},
    "Marble Cake": {"Calories": 350, "Fats": 14.0, "Proteins": 5.0, "Iron": 1.5, "Calcium": 50.0, "Sodium": 300, "Potassium": 150, "Carbohydrates": 52.0, "Fibre": 1.5, "VitaminD": 0, "Sugars": 32.0, "VegNovVeg": "0"},
    "Masala Dosa": {"Calories": 200, "Fats": 5.0, "Proteins": 4.0, "Iron": 2.0, "Calcium": 20.0, "Sodium": 300, "Potassium": 150, "Carbohydrates": 35.0, "Fibre": 2.0, "VitaminD": 0, "Sugars": 1.0, "VegNovVeg": "0"},
    "Masala Vada": {"Calories": 250, "Fats": 15.0, "Proteins": 6.0, "Iron": 2.0, "Calcium": 30.0, "Sodium": 400, "Potassium": 300, "Carbohydrates": 25.0, "Fibre": 4.0, "VitaminD": 0, "Sugars": 1.0, "VegNovVeg": "0"},
    "Mutton Biryani": {"Calories": 350, "Fats": 12.0, "Proteins": 18.0, "Iron": 2.5, "Calcium": 30.0, "Sodium": 500, "Potassium": 300, "Carbohydrates": 40.0, "Fibre": 1.5, "VitaminD": 0, "Sugars": 1.0, "VegNovVeg": "1"},
    "Pancake": {"Calories": 200, "Fats": 7.0, "Proteins": 5.0, "Iron": 1.0, "Calcium": 80.0, "Sodium": 300, "Potassium": 100, "Carbohydrates": 30.0, "Fibre": 1.0, "VitaminD": 0, "Sugars": 8.0, "VegNovVeg": "0"},
    "Sambar": {"Calories": 120, "Fats": 3.0, "Proteins": 5.0, "Iron": 2.0, "Calcium": 30.0, "Sodium": 400, "Potassium": 250, "Carbohydrates": 18.0, "Fibre": 5.0, "VitaminD": 0, "Sugars": 3.0, "VegNovVeg": "0"},
    "Lemonade": {"Calories": 40, "Fats": 0.0, "Proteins": 0.0, "Iron": 0.0, "Calcium": 5.0, "Sodium": 5, "Potassium": 30, "Carbohydrates": 10.0, "Fibre": 0.0, "VitaminD": 0, "Sugars": 8.0, "VegNovVeg": "0"},
    "Rice Puttu": {"Calories": 200, "Fats": 2.0, "Proteins": 4.0, "Iron": 1.0, "Calcium": 20.0, "Sodium": 100, "Potassium": 100, "Carbohydrates": 42.0, "Fibre": 2.0, "VitaminD": 0, "Sugars": 0.5, "VegNovVeg": "0"},
}

# 1. Load the 20 classes the YOLO model knows
with open('custom_dataset.yaml', 'r') as file:
    dataset_info = yaml.safe_load(file)

yolo_classes = dataset_info['names']

def normalize(s):
    return s.replace('_', ' ').strip().lower()

normalized_yolo_classes = [normalize(c) for c in yolo_classes]

# 2. Load the current indian diet csv
df = pd.read_csv('indian_diet.csv')
existing_foods = df['Food_items'].astype(str).str.strip().str.lower().tolist()

# 3. Find which YOLO classes are missing from CSV
missing_classes = []
for yc_norm in normalized_yolo_classes:
    if yc_norm not in existing_foods:
        missing_classes.append(yc_norm)

if missing_classes:
    print("⚠️  Classes missing from CSV:", missing_classes)
    print("   These need real nutritional data. Checking KNOWN_DEFAULTS...")

    new_rows = []
    for mc_norm in missing_classes:
        title_key = mc_norm.title()
        if title_key in KNOWN_DEFAULTS:
            row = KNOWN_DEFAULTS[title_key]
            row['Food_items'] = title_key
            new_rows.append(row)
            print(f"   ✓ Added from KNOWN_DEFAULTS: {title_key}")
        else:
            print(f"   ✗ ERROR: {title_key} has no known defaults!")
            print(f"     Add real nutritional data for '{mc_norm}' to indian_diet.csv before continuing.")
            exit(1)

    if new_rows:
        new_df = pd.DataFrame(new_rows)
        # Ensure column order matches existing
        new_df = new_df[df.columns]
        df = pd.concat([df, new_df], ignore_index=True)
        df.to_csv('indian_diet.csv', index=False)
        print(f"\n✅ Appended {len(new_rows)} missing classes to indian_diet.csv with real data.")
else:
    print("✅ No missing classes. indian_diet.csv is fully aligned.")
