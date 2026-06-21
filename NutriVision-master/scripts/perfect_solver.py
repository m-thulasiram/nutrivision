import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import pickle
from scipy.optimize import minimize

INPUT_FEATURES = ['Calories', 'Fats', 'Proteins', 'Carbohydrates', 'Sugars', 'Fibre', 'Iron', 'Calcium', 'Sodium', 'Potassium', 'VitaminD']

class DietAutoencoder(nn.Module):
    def __init__(self, input_dim=12):
        super().__init__()
        self.encoder = nn.Sequential(nn.Linear(input_dim, 16), nn.ReLU(), nn.Linear(16, 8))
        self.decoder = nn.Sequential(nn.Linear(8, 16), nn.ReLU(), nn.Linear(16, input_dim))
    def forward(self, x):
        return self.encoder(x), self.decoder(self.encoder(x))

print("1. Loading AI Brain and Database...")
model = DietAutoencoder(input_dim=len(INPUT_FEATURES) + 1)
model.load_state_dict(torch.load("diet_model.pth", weights_only=True))
model.eval()

df = pd.read_csv("processed_diet_database.csv")
with open("scaling_params.pkl", "rb") as f:
    scaling = pickle.load(f)

def norm(val, name):
    return (val - scaling['means'][name]) / scaling['stds'][name]

# Expand the South Indian vocabulary
si_keywords = ['dosa', 'idli', 'sambar', 'appam', 'avial', 'uttapam', 'upma',
               'vada', 'pongal', 'rasam', 'curd', 'rice', 'dal', 'chana', 'sundal']
pattern = '|'.join(si_keywords)

si_df = df[df['Food_items'].str.contains(pattern, case=False, na=False)].copy()

target_cals = 550
target_pro = 30
target_carb = 60
target_fat = 15
veg_flag = 0.0

print("\n2. PyTorch is pulling the South Indian menu...")
ideal_vals = {
    'Calories': target_cals, 'Fats': target_fat, 'Proteins': target_pro,
    'Carbohydrates': target_carb, 'Sugars': 5.0,
    'Fibre': 30.0, 'Iron': 18.0, 'Calcium': 1000.0,
    'Sodium': 2300.0, 'Potassium': 3500.0, 'VitaminD': 600.0
}
ideal_input = torch.FloatTensor(
    [norm(ideal_vals[c], c) for c in INPUT_FEATURES] + [veg_flag]
)

si_veg_df = si_df[si_df['Veg_Flag'] == 0.0].copy()
input_cols = [f"norm_{c}" for c in INPUT_FEATURES] + ['Veg_Flag']

with torch.no_grad():
    user_latent = model.encoder(ideal_input)
    db_tensor = torch.FloatTensor(si_veg_df[input_cols].values)
    db_latent = model.encoder(db_tensor)
    cos = nn.CosineSimilarity(dim=1, eps=1e-6)
    si_veg_df['AI_Match_Score'] = cos(user_latent.unsqueeze(0), db_latent).numpy()

top_15_foods = si_veg_df.sort_values(by='AI_Match_Score', ascending=False).head(15)['Food_items'].tolist()

print("\n3. SciPy is balancing the macros using Percentage Scaling...")
features = ['Calories', 'Proteins', 'Carbohydrates', 'Fats']
food_data = df[df['Food_items'].isin(top_15_foods)][['Food_items'] + features].drop_duplicates(subset=['Food_items'])

macro_matrix = food_data[features].values.T
targets = np.array([target_cals, target_pro, target_carb, target_fat])

def objective_function(x):
    actual = np.dot(macro_matrix, x)

    # DATA SCIENCE FIX: Percentage Error!
    # By dividing by the target, the math stays stable no matter how big the calories get.
    cal_err = (((actual[0] - targets[0]) / targets[0])**2) * 1.0
    pro_err = (((actual[1] - targets[1]) / targets[1])**2) * 8.0  # Protein gets 8x priority
    carb_err = (((actual[2] - targets[2]) / targets[2])**2) * 2.0
    fat_err = (((actual[3] - targets[3]) / targets[3])**2) * 2.0

    complexity_penalty = np.sum(x) * 0.05
    return cal_err + pro_err + carb_err + fat_err + complexity_penalty

bounds = [(0, None) for _ in range(len(food_data))]
initial_guess = np.full(len(food_data), 0.5) # Start by guessing 50g of each

# Increased max iterations to ensure it completely finishes the math
result = minimize(objective_function, initial_guess, bounds=bounds, method='SLSQP', options={'maxiter': 1000})
actual_macros = np.dot(macro_matrix, result.x)

print("\n" + "="*50)
print(f"🎯 TARGET TO HIT: {target_cals} kcal | {target_pro}g P | {target_carb}g C | {target_fat}g F")
print("="*50)
print("✅ PERFECT SOUTH INDIAN PORTIONS CALCULATED:\n")

for i, food_name in enumerate(food_data['Food_items']):
    grams = result.x[i] * 100
    if grams > 15.0:
        print(f"  🍽️ {str(food_name).title()}: {grams:.0f} grams")

print("-" * 50)
print(f"📊 ACTUAL ACHIEVED: {actual_macros[0]:.1f} kcal | {actual_macros[1]:.1f}g P | {actual_macros[2]:.1f}g C | {actual_macros[3]:.1f}g F")
print("="*50)
