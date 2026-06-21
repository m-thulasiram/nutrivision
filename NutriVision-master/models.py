import os
import pickle
import pandas as pd
import torch
import torch.nn as nn
from ultralytics import YOLO
from dataclasses import dataclass
from typing import Optional
from services.recommendation_service import Recommender

from config import config
YOLO_CONFIDENCE_THRESHOLD = config.yolo_confidence

INPUT_FEATURES = ['Calories', 'Fats', 'Proteins', 'Carbohydrates', 'Sugars',
                  'Fibre', 'Iron', 'Calcium', 'Sodium', 'Potassium', 'VitaminD']

class DietAutoencoder(nn.Module):
    def __init__(self, input_dim=12):
        super().__init__()
        self.encoder = nn.Sequential(nn.Linear(input_dim, 16), nn.ReLU(), nn.Linear(16, 8))
        self.decoder = nn.Sequential(nn.Linear(8, 16), nn.ReLU(), nn.Linear(16, input_dim))
    def forward(self, x):
        return self.encoder(x), self.decoder(self.encoder(x))

@dataclass
class Models:
    autoencoder: DietAutoencoder
    df: pd.DataFrame
    scaling: dict
    yolo_model: YOLO
    knn_recommender: Optional[Recommender]
    regional_df: pd.DataFrame

_instance: Optional[Models] = None

def load_models() -> Models:
    global _instance
    if _instance is not None:
        return _instance

    print("Booting up NutriVision AI Engine...")
    autoencoder = DietAutoencoder(input_dim=len(INPUT_FEATURES) + 1)
    diet_model_path = "diet_model.pth"
    db_path = "processed_diet_database.csv"
    scaling_path = "scaling_params.pkl"
    if not all(os.path.exists(p) for p in [diet_model_path, db_path, scaling_path]):
        raise RuntimeError(f"Missing Recommender Model Files. Required: {diet_model_path}, {db_path}, {scaling_path}")
    autoencoder.load_state_dict(torch.load(diet_model_path, map_location=torch.device('cpu'), weights_only=True))
    autoencoder.eval()
    df = pd.read_csv(db_path)
    match_col = 'Food_items' if 'Food_items' in df.columns else ('Food' if 'Food' in df.columns else df.columns[0])
    df['food_normalized'] = df[match_col].astype(str).str.strip().str.lower()
    with open(scaling_path, "rb") as f:
        scaling = pickle.load(f)

    try:
        knn = Recommender(db_path="processed_diet_database.csv", regional_path="regional_foods.csv")
    except Exception as e:
        print(f"KNN recommender init failed (will use autoencoder): {e}")
        knn = None

    regional_path = "regional_foods.csv"
    regional_df = pd.read_csv(regional_path) if os.path.exists(regional_path) else pd.DataFrame()
    if not regional_df.empty:
        regional_df['Food_normalized'] = regional_df['Food_items'].astype(str).str.strip().str.lower()

    yolo_path = os.path.join("runs", "detect", "train2", "weights", "best.pt")
    if not os.path.exists(yolo_path):
        raise RuntimeError(f"Missing YOLO weights at {yolo_path}")
    yolo_model = YOLO(yolo_path)

    _instance = Models(
        autoencoder=autoencoder,
        df=df,
        scaling=scaling,
        yolo_model=yolo_model,
        knn_recommender=knn,
        regional_df=regional_df
    )
    return _instance

def get_models() -> Models:
    global _instance
    if _instance is None:
        _instance = load_models()
    return _instance

def get_regional_info(food_name: str) -> dict:
    regional_df = get_models().regional_df
    if regional_df.empty:
        return {"region": "", "state": "", "cuisine": "", "meal_type": ""}
    norm_name = str(food_name).strip().lower()
    match = regional_df[regional_df['Food_normalized'] == norm_name]
    if not match.empty:
        row = match.iloc[0]
        return {
            "region": str(row.get('region', '')),
            "state": str(row.get('state', '')),
            "cuisine": str(row.get('cuisine', '')),
            "meal_type": str(row.get('meal_type', ''))
        }
    return {"region": "", "state": "", "cuisine": "", "meal_type": ""}

def norm(val, name):
    scaling = get_models().scaling
    return (val - scaling['means'][name]) / scaling['stds'][name]
