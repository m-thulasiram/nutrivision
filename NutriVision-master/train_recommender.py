import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
import pickle

print("1. Loading Indian Diet Dataset...")
try:
    df = pd.read_csv("indian_diet.csv")
except FileNotFoundError:
    print("❌ ERROR: Could not find 'indian_diet.csv'.")
    exit()

df.columns = df.columns.str.strip()
for col in ['Breakfast', 'Lunch', 'Dinner']:
    if col not in df.columns:
        df[col] = 1 

if 'VegNovVeg' in df.columns:
    df['Veg_Flag'] = df['VegNovVeg'].apply(lambda x: 1.0 if str(x).strip() in ['1', '1.0', 'Non Veg', 'Non-Veg'] else 0.0)
else:
    df['Veg_Flag'] = 0.0

features = ['Calories', 'Fats', 'Proteins', 'Carbohydrates', 'Sugars']
for col in features:
    if col not in df.columns:
        df[col] = 0.0
    df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)

feature_means = df[features].mean().to_dict()
feature_stds = df[features].std().to_dict()

for k in feature_stds:
    if feature_stds[k] == 0: feature_stds[k] = 1.0

for col in features:
    df[f"norm_{col}"] = (df[col] - feature_means[col]) / feature_stds[col]

input_cols = [f"norm_{col}" for col in features] + ['Veg_Flag']
X = torch.FloatTensor(df[input_cols].values)

class DietAutoencoder(nn.Module):
    def __init__(self, input_dim):
        super().__init__()
        self.encoder = nn.Sequential(nn.Linear(input_dim, 16), nn.ReLU(), nn.Linear(16, 8))
        self.decoder = nn.Sequential(nn.Linear(8, 16), nn.ReLU(), nn.Linear(16, input_dim))
    def forward(self, x):
        return self.encoder(x), self.decoder(self.encoder(x))

print("2. Training Deep Learning Autoencoder for 500 Epochs...")
model = DietAutoencoder(input_dim=6)
criterion = nn.MSELoss()
optimizer = optim.Adam(model.parameters(), lr=0.01)

for epoch in range(500):
    optimizer.zero_grad()
    encoded, decoded = model(X)
    loss = criterion(decoded, X)
    loss.backward()
    optimizer.step()

print("3. Saving AI Model and Processed Database...")
torch.save(model.state_dict(), "diet_model.pth")

# 🚨 THE FIX IS HERE: Saving as CSV so Pandas doesn't crash!
df.to_csv("processed_diet_database.csv", index=False)

scaling_params = {"means": feature_means, "stds": feature_stds}
with open("scaling_params.pkl", "wb") as f:
    pickle.dump(scaling_params, f)

print("✅ SUCCESS! Recommender AI is ready.")