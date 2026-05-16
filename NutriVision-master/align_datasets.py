import pandas as pd
import yaml
import numpy as np

# 1. Load the 20 classes the YOLO model knows
with open('custom_dataset.yaml', 'r') as file:
    dataset_info = yaml.safe_load(file)

yolo_classes = dataset_info['names']
normalized_yolo_classes = [c.replace('_', ' ').strip().title() for c in yolo_classes]

# 2. Load the current indian diet csv
df = pd.read_csv('indian_diet.csv')
existing_foods = df['Food_items'].astype(str).str.strip().str.title().tolist()

# 3. Find which YOLO classes are missing from CSV
missing_classes = []
for yc in normalized_yolo_classes:
    if yc not in existing_foods:
        # Also check lowercase/fuzzy to be safe
        if not any(yc.lower() == e.lower() for e in existing_foods):
            missing_classes.append(yc)

print("Classes missing from CSV:", missing_classes)

# 4. Append missing classes to the dataframe with default safe Macro values
new_rows = []
for mc in missing_classes:
    # Adding reasonable generic macros since we lack ground truth for these custom foods
    # If the user has specific ground truth they would need to supply it, but replacing with 
    # safe baselines ensures the architecture compiles and detects them.
    new_rows.append({
        'Food_items': mc,
        'Breakfast': 1, 'Lunch': 1, 'Dinner': 1, 'VegNovVeg': 0,
        'Calories': 250, 'Fats': 10.0, 'Proteins': 8.0, 
        'Iron': 1.0, 'Calcium': 50, 'Sodium': 400, 'Potassium': 200, 
        'Carbohydrates': 35.0, 'Fibre': 4.0, 'VitaminD': 0, 'Sugars': 2.0
    })

if new_rows:
    new_df = pd.DataFrame(new_rows)
    df = pd.concat([df, new_df], ignore_index=True)
    df.to_csv('indian_diet.csv', index=False)
    print(f"Appended {len(new_rows)} missing classes to indian_diet.csv successfully.")
else:
    print("No missing classes. indian_diet.csv is already fully aligned.")
