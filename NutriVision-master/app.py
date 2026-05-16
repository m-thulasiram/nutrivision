import streamlit as st
import pandas as pd
import plotly.express as px
from PIL import Image
import numpy as np
from ultralytics import YOLO
import torch
import torch.nn as nn
import pickle
import os

# --- PAGE CONFIGURATION ---
st.set_page_config(page_title="NutriVision AI", layout="wide")
st.title("🥗 NutriVision: Dual-AI Health Platform")
st.markdown("**System Priority:** Accuracy > Safety > Diet Rules > Personalization")

# ==========================================================
# 1. LOAD VISION MODEL (YOLO)
# ==========================================================
@st.cache_resource
def load_yolo():
    model_path = r"runs\detect\train2\weights\best.pt"
    if os.path.exists(model_path):
        return YOLO(model_path)
    return None

yolo_model = load_yolo()

vision_db = {
    "Chicken_Curry": {"kcal": 240, "protein": 20.0}, "Plain_Omelette": {"kcal": 154, "protein": 11.0},
    "Spinach_Paneer": {"kcal": 340, "protein": 14.0}, "Appam": {"kcal": 120, "protein": 2.0},
    "Avial": {"kcal": 150, "protein": 3.5}, "Masala_Dosa": {"kcal": 168, "protein": 3.0},
    "Idli": {"kcal": 58, "protein": 2.0}, "default": {"kcal": 150, "protein": 5.0}
}

# ==========================================================
# 2. LOAD RECOMMENDER MODEL (PYTORCH)
# ==========================================================
class DietAutoencoder(nn.Module):
    def __init__(self, input_dim=6):
        super().__init__()
        self.encoder = nn.Sequential(nn.Linear(input_dim, 16), nn.ReLU(), nn.Linear(16, 8))
        self.decoder = nn.Sequential(nn.Linear(8, 16), nn.ReLU(), nn.Linear(16, input_dim))
    def forward(self, x): 
        return self.encoder(x), self.decoder(self.encoder(x))

@st.cache_resource
def load_recommender():
    if os.path.exists("diet_model.pth") and os.path.exists("processed_diet_database.csv"):
        model = DietAutoencoder(input_dim=6)
        model.load_state_dict(torch.load("diet_model.pth", weights_only=True))
        model.eval()
        df = pd.read_csv("processed_diet_database.csv")
        with open("scaling_params.pkl", "rb") as f:
            scaling = pickle.load(f)
        return model, df, scaling
    return None, None, None

rec_model, diet_df, scaling = load_recommender()

# Helper for normalizing PyTorch inputs
def norm_val(val, name, scale_dict): 
    return (val - scale_dict['means'][name]) / scale_dict['stds'][name]

# --- STRICT GUARDRAIL: DIET FILTERING ---
def enforce_diet_rules(df, preference):
    meat_keywords = ['chicken', 'mutton', 'fish', 'prawn', 'meat', 'beef', 'pork', 'salmon', 'surmai', 'rohu', 'sausage', 'kebab']
    egg_keywords = ['egg', 'omelette']
    
    meat_pattern = '|'.join(meat_keywords)
    egg_pattern = '|'.join(egg_keywords)
    filtered_df = df.copy()
    
    if preference == "Vegetarian":
        filtered_df = filtered_df[~filtered_df['Food_items'].str.contains(meat_pattern, case=False, na=False)]
        filtered_df = filtered_df[~filtered_df['Food_items'].str.contains(egg_pattern, case=False, na=False)]
        if 'Veg_Flag' in filtered_df.columns:
            filtered_df = filtered_df[filtered_df['Veg_Flag'] == 0.0]
            
    elif preference == "Eggetarian":
        filtered_df = filtered_df[~filtered_df['Food_items'].str.contains(meat_pattern, case=False, na=False)]
        
    return filtered_df

# ==========================================================
# 3. UI TABS
# ==========================================================
tab1, tab2, tab3 = st.tabs(["📸 Vision AI (Scanner)", "🧠 Deep Learning Diet Planner", "🍽️ Meal Tracker & Gap Filler"])

# --- TAB 1: YOLO VISION ---
with tab1:
    st.header("📸 Snap a picture of your food")
    if yolo_model is None:
        st.error("⚠️ YOLO Model not found!")
    else:
        uploaded_file = st.file_uploader("Upload meal image", type=["jpg", "jpeg", "png"])
        if uploaded_file is not None:
            image = Image.open(uploaded_file).convert('RGB')
            with st.spinner("🤖 AI is looking at the image..."):
                results = yolo_model(image, conf=0.10)
                col1, col2 = st.columns([1, 1])
                annotated_img = results[0].plot()[..., ::-1]
                col1.image(annotated_img, caption="AI Object Detection", use_container_width=True)
                
                with col2:
                    st.markdown("### AI Analysis")
                    for r in results:
                        for box in r.boxes:
                            cls_name = yolo_model.names[int(box.cls[0])]
                            conf = float(box.conf[0])
                            
                            if conf < 0.85:
                                st.error(f"⚠️ **Low confidence detection ({conf*100:.1f}%)** – please re-upload image.")
                                if "egg" in cls_name.lower() or "idli" in cls_name.lower():
                                    st.warning("🧐 **Clarification Needed:** Is this an Egg (smooth oval) or Idli (porous rice cake)?")
                                elif "paneer" in cls_name.lower() or "chicken" in cls_name.lower():
                                    st.warning("🧐 **Clarification Needed:** Is this Paneer (smooth cubes) or Chicken (fibrous meat)?")
                                else:
                                    st.warning(f"🧐 **Clarification Needed:** Is this actually {cls_name.replace('_', ' ')}?")
                            else:
                                macros = vision_db.get(cls_name, vision_db["default"])
                                st.success(f"✅ **{cls_name.replace('_', ' ')}** detected ({conf*100:.1f}% confidence)")
                                st.info(f"🔥 {macros['kcal']} kcal | 💪 {macros['protein']}g Protein")
                    if len(results[0].boxes) == 0:
                        st.warning("⚠️ The AI couldn't recognize any food in this image.")

# --- TAB 2: PYTORCH RECOMMENDER ---
with tab2:
    st.header("🧠 Guardrailed AI Diet Generation")
    
    if rec_model is None:
        st.warning("⚠️ Diet Database or Model not found.")
    else:
        with st.form("diet_form"):
            c1, c2, c3 = st.columns(3)
            age = c1.number_input("Age", min_value=10, max_value=100, value=22)
            weight = c2.number_input("Weight (kg)", min_value=30, max_value=200, value=70)
            height = c3.number_input("Height (cm)", min_value=100, max_value=250, value=175)
            
            c4, c5 = st.columns(2)
            gender = c4.selectbox("Gender", ["Male", "Female"])
            activity = c5.selectbox("Activity Level", ["Sedentary", "Lightly Active", "Active", "Very Active"])
            
            c6, c7 = st.columns(2)
            diet_pref = c6.radio("Strict Diet Preference", ["Vegetarian", "Eggetarian", "Non-Vegetarian"])
            diabetic = c7.radio("Diabetic?", ["No", "Yes"])
            
            submitted = st.form_submit_button("🚀 Generate AI Meal Plan & Save Profile")

        if submitted:
            if gender == "Male": bmr = 10*weight + 6.25*height - 5*age + 5
            else: bmr = 10*weight + 6.25*height - 5*age - 161
            
            multipliers = {"Sedentary": 1.2, "Lightly Active": 1.375, "Active": 1.55, "Very Active": 1.725}
            tdee = bmr * multipliers[activity]
            
            daily_protein = (tdee * 0.30) / 4
            daily_carbs = (tdee * 0.45) / 4
            daily_fats = (tdee * 0.25) / 9
            daily_sugar = 15.0 if diabetic == "Yes" else 45.0
            veg_flag = 0.0 if diet_pref in ["Vegetarian", "Eggetarian"] else 1.0
            
            # Save to session state for the Tracker Tab!
            st.session_state['user_profile'] = {
                'tdee': tdee, 'protein': daily_protein, 'carbs': daily_carbs,
                'fats': daily_fats, 'sugar': daily_sugar, 'veg_flag': veg_flag,
                'diet_pref': diet_pref, 'diabetic': diabetic
            }
            
            st.markdown(f"### 🎯 Your Target Profile: **{int(tdee)} kcal / day**")
            st.markdown(f"**Active Guardrails:** `{diet_pref}` | `Diabetic: {diabetic}`")
            
            ideal_input = torch.FloatTensor([
                norm_val(tdee/3.0, 'Calories', scaling), norm_val(daily_fats/3.0, 'Fats', scaling), 
                norm_val(daily_protein/3.0, 'Proteins', scaling), norm_val(daily_carbs/3.0, 'Carbohydrates', scaling), 
                norm_val(daily_sugar/3.0, 'Sugars', scaling), veg_flag
            ])
            
            filtered_df = enforce_diet_rules(diet_df, diet_pref)
            if diabetic == "Yes":
                filtered_df = filtered_df[(filtered_df['Sugars'] < 10.0) & (filtered_df['Carbohydrates'] < 40.0)]
            
            with torch.no_grad():
                user_latent = rec_model.encoder(ideal_input)
                input_cols = [f"norm_{c}" for c in ['Calories', 'Fats', 'Proteins', 'Carbohydrates', 'Sugars']] + ['Veg_Flag']
                db_tensor = torch.FloatTensor(filtered_df[input_cols].values)
                db_latent = rec_model.encoder(db_tensor)
                cos = nn.CosineSimilarity(dim=1, eps=1e-6)
                filtered_df = filtered_df.copy()
                filtered_df['AI_Match_Score'] = cos(user_latent.unsqueeze(0), db_latent).numpy()
            
            st.markdown("---")
            m1, m2, m3 = st.columns(3)
            for col, meal_name, icon in zip([m1, m2, m3], ["Breakfast", "Lunch", "Dinner"], ["🌅", "☀️", "🌙"]):
                with col:
                    st.subheader(f"{icon} {meal_name}")
                    if meal_name in filtered_df.columns:
                        recs = filtered_df[filtered_df[meal_name] == 1].sort_values(by='AI_Match_Score', ascending=False).head(3)
                        for idx, row in recs.iterrows():
                            st.success(f"**{str(row.get('Food_items', 'Meal')).title()}**\n\n"
                                     f"🔥 {row['Calories']} kcal | 💪 {row['Proteins']}g P\n\n"
                                     f"🌾 {row['Carbohydrates']}g C | 💧 {row['Sugars']}g Sug\n\n"
                                     f"*(Match: {row['AI_Match_Score']*100:.1f}%)*")

# --- TAB 3: DAILY MEAL TRACKER & AI GAP FILLER ---
with tab3:
    st.header("🍽️ Daily Tracker & Smart Suggestions")
    
    if 'user_profile' not in st.session_state:
        st.info("👈 Please go to the **Diet Planner** tab and click 'Generate AI Meal Plan' first to set your baseline targets!")
    else:
        profile = st.session_state['user_profile']
        st.markdown(f"### 🎯 Daily Calorie Goal: **{int(profile['tdee'])} kcal**")
        
        # Multiselect for consumed foods
        all_food_names = sorted(diet_df['Food_items'].dropna().unique())
        eaten_foods = st.multiselect("What have you eaten today?", all_food_names)
        
        if eaten_foods:
            # Calculate what was eaten
            eaten_df = diet_df[diet_df['Food_items'].isin(eaten_foods)]
            c_cals = eaten_df['Calories'].sum()
            c_prot = eaten_df['Proteins'].sum()
            c_carb = eaten_df['Carbohydrates'].sum()
            c_fats = eaten_df['Fats'].sum()
            c_sug = eaten_df['Sugars'].sum()
            
            # Calculate remaining gaps
            rem_cals = max(0, profile['tdee'] - c_cals)
            rem_prot = max(0, profile['protein'] - c_prot)
            rem_carb = max(0, profile['carbs'] - c_carb)
            rem_fats = max(0, profile['fats'] - c_fats)
            rem_sug = max(0, profile['sugar'] - c_sug)
            
            # Progress bar
            progress = min(1.0, c_cals / profile['tdee'])
            st.progress(progress)
            st.write(f"**Consumed:** {int(c_cals)} kcal | **Remaining:** {int(rem_cals)} kcal")
            
            if rem_cals > 50:
                st.markdown("---")
                st.markdown(f"### 💡 AI Gap Filler Suggestions (For remaining {int(rem_cals)} kcal)")
                
                # Create a tensor for the EXACT REMAINING macros
                ideal_gap_input = torch.FloatTensor([
                    norm_val(rem_cals, 'Calories', scaling), norm_val(rem_fats, 'Fats', scaling), 
                    norm_val(rem_prot, 'Proteins', scaling), norm_val(rem_carb, 'Carbohydrates', scaling), 
                    norm_val(rem_sug, 'Sugars', scaling), profile['veg_flag']
                ])
                
                # Apply strictly safe guardrails to recommendations
                safe_df = enforce_diet_rules(diet_df, profile['diet_pref'])
                if profile['diabetic'] == "Yes":
                    safe_df = safe_df[(safe_df['Sugars'] < 10.0) & (safe_df['Carbohydrates'] < 40.0)]
                
                # Remove foods they already ate today from suggestions
                safe_df = safe_df[~safe_df['Food_items'].isin(eaten_foods)]
                
                with torch.no_grad():
                    gap_latent = rec_model.encoder(ideal_gap_input)
                    input_cols = [f"norm_{c}" for c in ['Calories', 'Fats', 'Proteins', 'Carbohydrates', 'Sugars']] + ['Veg_Flag']
                    db_tensor = torch.FloatTensor(safe_df[input_cols].values)
                    db_latent = rec_model.encoder(db_tensor)
                    cos = nn.CosineSimilarity(dim=1, eps=1e-6)
                    
                    safe_df = safe_df.copy()
                    safe_df['Gap_Match_Score'] = cos(gap_latent.unsqueeze(0), db_latent).numpy()
                
                # Show top 4 items that perfectly complete their day
                top_gap_fillers = safe_df.sort_values(by='Gap_Match_Score', ascending=False).head(4)
                
                cols = st.columns(4)
                for idx, (index, row) in enumerate(top_gap_fillers.iterrows()):
                    with cols[idx]:
                        st.info(f"**{str(row['Food_items']).title()}**\n\n"
                                 f"🔥 {row['Calories']} kcal\n\n💪 {row['Proteins']}g P\n\n"
                                 f"*(Match: {row['Gap_Match_Score']*100:.1f}%)*")
            else:
                st.success("🎉 You have hit your daily calorie target! Great job!")