import base64
import json
import re
import os
from pathlib import Path
import io
from PIL import Image
import pandas as pd
import httpx
from openai import AsyncOpenAI
import asyncio

# Choose the database file (support 504 foods if available, otherwise fallback)
if os.path.exists("expanded_food_database.csv"):
    DB_PATH = "expanded_food_database.csv"
elif os.path.exists("indian_diet.csv"):
    DB_PATH = "indian_diet.csv"
else:
    DB_PATH = None

if DB_PATH:
    FOOD_DB = pd.read_csv(DB_PATH)
    FOOD_DB.columns = FOOD_DB.columns.str.strip()
else:
    FOOD_DB = pd.DataFrame()

NUTRITION_COLUMNS = [
    "Food_items", "Calories", "Proteins", 
    "Carbohydrates", "Fats", "Fibre", 
    "Sugars", "Iron", "Calcium", "Sodium",
    "Potassium", "VitaminD", "VegNovVeg",
    "Breakfast", "Lunch", "Dinner"
]

def compress_image_for_api(
    image_bytes: bytes,
    max_size: int = 640,
    quality: int = 75
) -> bytes:
    """
    Compress image to max 640px and 75% quality before sending to VLM API.
    This reduces API latency, memory usage on the server, and risk of OOM crashes.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB (handles PNG with alpha)
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")
        
        # Resize to max 640px on longest side
        w, h = img.size
        if max(w, h) > max_size:
            if w > h:
                new_w = max_size
                new_h = int(h * max_size / w)
            else:
                new_h = max_size
                new_w = int(w * max_size / h)
            img = img.resize((new_w, new_h), Image.LANCZOS)
        
        # Save compressed
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        compressed = buf.getvalue()
        
        original_kb = len(image_bytes) / 1024
        compressed_kb = len(compressed) / 1024
        print(f"Image compressed: {original_kb:.0f}KB → {compressed_kb:.0f}KB")
        
        return compressed
        
    except Exception as e:
        print(f"Compression failed: {e}, using original")
        return image_bytes

def image_to_base64(image_bytes: bytes) -> str:
    """Convert image bytes to base64 string."""
    return base64.b64encode(image_bytes).decode("utf-8")

def normalize_db_row(row: dict) -> dict:
    """Normalize row from either database format to a standard structure."""
    # Food Name / Food_items
    food_name = row.get("Food Name") or row.get("Food_items") or row.get("Food") or ""
    food_name = str(food_name).strip()
    
    return {
        "Food_items": food_name,
        "Calories": float(row.get("Calories") if pd.notna(row.get("Calories")) else 0.0),
        "Proteins": float(row.get("Proteins") if pd.notna(row.get("Proteins")) else row.get("Protein") if pd.notna(row.get("Protein")) else 0.0),
        "Carbohydrates": float(row.get("Carbohydrates") if pd.notna(row.get("Carbohydrates")) else row.get("Carbs") if pd.notna(row.get("Carbs")) else 0.0),
        "Fats": float(row.get("Fats") if pd.notna(row.get("Fats")) else row.get("Fat") if pd.notna(row.get("Fat")) else 0.0),
        "Fibre": float(row.get("Fibre") if pd.notna(row.get("Fibre")) else row.get("Fiber") if pd.notna(row.get("Fiber")) else 0.0),
        "Sugars": float(row.get("Sugars") if pd.notna(row.get("Sugars")) else 0.0),
        "Iron": float(row.get("Iron") if pd.notna(row.get("Iron")) else 0.0),
        "Calcium": float(row.get("Calcium") if pd.notna(row.get("Calcium")) else 0.0),
        "Sodium": float(row.get("Sodium") if pd.notna(row.get("Sodium")) else 0.0),
        "Potassium": float(row.get("Potassium") if pd.notna(row.get("Potassium")) else 0.0),
        "VitaminD": float(row.get("VitaminD") if pd.notna(row.get("VitaminD")) else 0.0),
        "VegNovVeg": str(row.get("VegNovVeg") if pd.notna(row.get("VegNovVeg")) else "0").strip(),
    }

def find_food_in_db(food_name: str) -> dict | None:
    """
    Find food in database.
    Try exact match first, then fuzzy.
    """
    if FOOD_DB.empty:
        return None
        
    df = FOOD_DB.copy()
    name_lower = food_name.lower().strip()
    
    # Determine the name column
    name_col = "Food Name" if "Food Name" in df.columns else "Food_items"
    
    # Exact match
    mask = df[name_col].str.lower().str.strip() == name_lower
    if mask.any():
        row = df[mask].iloc[0]
        return normalize_db_row(row.to_dict())
    
    # Partial match
    mask = df[name_col].str.lower().str.contains(name_lower, na=False)
    if mask.any():
        row = df[mask].iloc[0]
        return normalize_db_row(row.to_dict())
    
    # Word-level match
    words = name_lower.split()
    for word in words:
        if len(word) < 4:
            continue
        mask = df[name_col].str.lower().str.contains(word, na=False)
        if mask.any():
            row = df[mask].iloc[0]
            return normalize_db_row(row.to_dict())
    
    return None

def scale_nutrition(db_row: dict, weight_g: float) -> dict:
    """Scale nutrition values by weight."""
    factor = weight_g / 100.0
    return {
        "food_name": db_row.get("Food_items", ""),
        "weight_g": weight_g,
        "calories": round(float(db_row.get("Calories", 0)) * factor, 1),
        "protein_g": round(float(db_row.get("Proteins", 0)) * factor, 1),
        "carbs_g": round(float(db_row.get("Carbohydrates", 0)) * factor, 1),
        "fats_g": round(float(db_row.get("Fats", 0)) * factor, 1),
        "fibre_g": round(float(db_row.get("Fibre", 0)) * factor, 1),
        "sugar_g": round(float(db_row.get("Sugars", 0)) * factor, 1),
        "iron_mg": round(float(db_row.get("Iron", 0)) * factor, 2),
        "calcium_mg": round(float(db_row.get("Calcium", 0)) * factor, 1),
        "sodium_mg": round(float(db_row.get("Sodium", 0)) * factor, 1),
        "potassium_mg": round(float(db_row.get("Potassium", 0)) * factor, 1),
        "vitamin_d_iu": round(float(db_row.get("VitaminD", 0)) * factor, 1),
        "is_veg": str(db_row.get("VegNovVeg", "0")) == "0",
        "per_100g": {
            "calories": float(db_row.get("Calories", 0)),
            "protein_g": float(db_row.get("Proteins", 0)),
            "carbs_g": float(db_row.get("Carbohydrates", 0)),
            "fats_g": float(db_row.get("Fats", 0)),
            "fibre_g": float(db_row.get("Fibre", 0)),
            "iron_mg": float(db_row.get("Iron", 0)),
            "calcium_mg": float(db_row.get("Calcium", 0)),
        }
    }

def get_similar_foods(food_name: str, diet_type: str, limit: int = 5) -> list:
    """Get similar foods from DB as suggestions."""
    if FOOD_DB.empty:
        return []
        
    df = FOOD_DB.copy()
    name_col = "Food Name" if "Food Name" in df.columns else "Food_items"
    
    if diet_type == "vegetarian":
        df = df[df["VegNovVeg"].astype(str).str.strip() == "0"]
    
    # Return top foods by calories as fallback
    suggestions = df.nlargest(limit, "Calories")[name_col].tolist()
    return suggestions

async def analyze_food_image_mock(
    image_bytes: bytes,
    user_state: str = "Tamil Nadu",
    diet_type: str = "vegetarian"
) -> dict:
    """
    Smart mock that runs the local YOLO model (with imgsz=256) on the image.
    If YOLO detects any of the 20 classes with confidence >= 0.25, it resolves them against the database.
    If no YOLO detections are found, it falls back to the regional state-based mock.
    Used when GPT-4o is unavailable or no valid key is present.
    """
    sample_foods = []
    is_yolo_detection = False
    
    try:
        from models import get_models
        from PIL import Image
        import io
        
        # Load image from bytes
        img = Image.open(io.BytesIO(image_bytes))
        
        # Get models and predict
        m = get_models()
        # Ensure we pass imgsz=256 as required by the ONNX model
        results = m.yolo_model(img, imgsz=256)
        
        if results and len(results) > 0:
            result = results[0]
            if hasattr(result, "boxes") and result.boxes:
                for box in result.boxes:
                    cls_id = int(box.cls[0].item())
                    conf = float(box.conf[0].item())
                    if conf >= 0.25:
                        class_name = m.yolo_model.names.get(cls_id)
                        if class_name:
                            # Map class name (e.g., 'Fruit_Salad') to db name (e.g., 'Fruit Salad')
                            db_name = class_name.replace("_", " ")
                            db_row = find_food_in_db(db_name)
                            
                            if db_row:
                                weight = 100.0
                                is_yolo_detection = True
                                
                                sample_foods.append({
                                    "status": "confident",
                                    "food_name": db_row["Food_items"],
                                    "detected_as": db_name,
                                    "confidence": conf,
                                    "count": 1,
                                    "description": f"1 serving ({int(weight)}g) — YOLO Local Detection",
                                    "estimated_weight_g": weight,
                                    "is_mock": False,
                                    "nutrition": scale_nutrition(db_row, weight),
                                    "portion_options": {
                                        "small": {"weight_g": 70, "label": "Small"},
                                        "medium": {"weight_g": 100, "label": "Medium"},
                                        "large": {"weight_g": 140, "label": "Large"}
                                    }
                                })
    except Exception as e:
        print(f"Local YOLO scanning failed or model not loaded: {e}")
        
    # Fallback to hardcoded state-based regional mock if no YOLO detections were found
    if not sample_foods:
        try:
            # Determine database path
            db_path = None
            if os.path.exists("expanded_food_database.csv"):
                db_path = "expanded_food_database.csv"
            elif os.path.exists("indian_diet.csv"):
                db_path = "indian_diet.csv"
                
            if not db_path:
                raise FileNotFoundError("No food database CSV file found.")
                
            db = pd.read_csv(db_path)
            db.columns = db.columns.str.strip()
            
            # Filter by diet type
            if diet_type == "vegetarian":
                db = db[db["VegNovVeg"].astype(str).str.strip() == "0"]
            
            # State to common foods mapping
            STATE_FOODS = {
                "Tamil Nadu": ["Idli", "Sambar", "Dosa"],
                "Kerala": ["Puttu", "Appam", "Avial"],
                "Punjab": ["Chole", "Paneer Tikka", "Dal Makhani"],
                "Maharashtra": ["Vada Pav", "Poha", "Misal Pav"],
                "Gujarat": ["Dhokla", "Thepla", "Khichdi"],
                "West Bengal": ["Dal Fry", "Rice", "Begun Bhaja"],
                "Rajasthan": ["Dal Baati", "Gatte", "Bajre ki Roti"],
                "Karnataka": ["Bisi Bele Bath", "Ragi Mudde", "Idli"],
            }
            
            regional_foods = STATE_FOODS.get(user_state, ["Idli", "Dal Fry", "Rice"])
            
            for food_name in regional_foods[:2]:
                row = db[db["Food_items"].str.strip().str.lower() == food_name.lower()]
                
                if row.empty:
                    # Fuzzy match
                    row = db[db["Food_items"].str.lower().str.contains(food_name.lower()[:4], na=False)]
                
                if not row.empty:
                    r = row.iloc[0]
                    weight = 100.0
                    
                    sample_foods.append({
                        "status": "confident",
                        "food_name": str(r["Food_items"]).strip(),
                        "detected_as": food_name,
                        "confidence": 0.85,
                        "count": 1,
                        "description": f"1 serving ({int(weight)}g) — Demo mode",
                        "estimated_weight_g": weight,
                        "is_mock": True,
                        "nutrition": scale_nutrition(normalize_db_row(r.to_dict()), weight),
                        "portion_options": {
                            "small": {"weight_g": 70, "label": "Small"},
                            "medium": {"weight_g": 100, "label": "Medium"},
                            "large": {"weight_g": 140, "label": "Large"}
                        }
                    })
        except Exception as e:
            print(f"Mock scanner DB load failed: {e}. Returning hardcoded fallback.")
            # Hardcoded high-quality fallback when DB is missing/corrupted
            sample_foods = [{
                "status": "confident",
                "food_name": "Idli",
                "detected_as": "Idli",
                "confidence": 0.85,
                "count": 1,
                "description": "1 serving (100g) — Demo mode (Fallback)",
                "estimated_weight_g": 100.0,
                "is_mock": True,
                "nutrition": {
                    "food_name": "Idli",
                    "weight_g": 100.0,
                    "calories": 156.0,
                    "protein_g": 5.0,
                    "carbs_g": 30.2,
                    "fats_g": 1.7,
                    "fibre_g": 2.1,
                    "sugar_g": 0.0,
                    "iron_mg": 0.7,
                    "calcium_mg": 4.0,
                    "sodium_mg": 10.0,
                    "potassium_mg": 50.0,
                    "vitamin_d_iu": 0.0,
                    "is_veg": True,
                    "per_100g": {
                        "calories": 156.0,
                        "protein_g": 5.0,
                        "carbs_g": 30.2,
                        "fats_g": 1.7,
                        "fibre_g": 2.1,
                        "iron_mg": 0.7,
                        "calcium_mg": 4.0,
                    }
                },
                "portion_options": {
                    "small": {"weight_g": 70, "label": "Small"},
                    "medium": {"weight_g": 100, "label": "Medium"},
                    "large": {"weight_g": 140, "label": "Large"}
                }
            }]
            
    # Prepare mock notice or detection info
    if is_yolo_detection:
        notice = "Local YOLO detection successful. Running offline."
        model_name = "yolo_local"
    else:
        notice = "Running in demo mode. Add OPENAI_API_KEY to .env for real food detection."
        model_name = "demo_mode"
        
    return {
        "success": True,
        "model": model_name,
        "is_mock": not is_yolo_detection,
        "mock_notice": notice,
        "meal_context": "Local food scanning" if is_yolo_detection else f"Demo — {user_state} regional foods",
        "detection_quality": "local" if is_yolo_detection else "demo",
        "detected_foods": sample_foods,
        "total_detected": len(sample_foods)
    }

async def _call_gpt4o_vision(
    image_bytes: bytes,
    user_state: str,
    diet_type: str
) -> dict:
    """Internal GPT-4o Vision call."""
    img_b64 = image_to_base64(image_bytes)
    
    client = AsyncOpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        timeout=40.0,  # Client-side timeout
    )
    
    prompt = f"""You are an expert Indian food nutritionist. Analyze this meal photo.

User region: {user_state}
Diet: {diet_type}

Identify ALL food items visible.
Respond ONLY with valid JSON:
{{
  "detected_foods": [
    {{
      "food_name": "Idli",
      "confidence": 0.95,
      "estimated_weight_g": 80,
      "count": 2,
      "description": "2 medium idlis"
    }}
  ],
  "meal_context": "South Indian breakfast",
  "detection_quality": "high"
}}

Be specific with Indian food names.
Estimate realistic portion weights."""

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{img_b64}",
                        "detail": "low"  # low details = faster + cheaper
                    }
                },
                {"type": "text", "text": prompt}
            ]
        }],
        max_tokens=600,
        temperature=0.1,
    )
    
    raw = response.choices[0].message.content
    
    json_match = re.search(r'\{[\s\S]*\}', raw)
    if not json_match:
        raise ValueError("No JSON in GPT-4o response")
        
    result = json.loads(json_match.group())
    
    # Enrich with database lookup
    return await _enrich_with_database(result, user_state, diet_type, model_used="gpt-4o")

async def _enrich_with_database(result: dict, user_state: str, diet_type: str, model_used: str = "gpt-4o") -> dict:
    """Enrich the LLM-detected food items with real database information."""
    enriched_foods = []
    for food in result.get("detected_foods", []):
        food_name = food.get("food_name") or food.get("detected_as") or ""
        weight_g = food.get("estimated_weight_g", 100)
        confidence = food.get("confidence", 0.8)
        
        # Look up in database
        db_row = find_food_in_db(food_name)
        
        if db_row:
            nutrition = scale_nutrition(db_row, weight_g)
            enriched_foods.append({
                "status": "confident",
                "food_name": nutrition["food_name"],
                "detected_as": food_name,
                "confidence": confidence,
                "count": food.get("count", 1),
                "description": food.get("description", ""),
                "estimated_weight_g": weight_g,
                "nutrition": nutrition,
                "portion_options": {
                    "small": {
                        "weight_g": round(weight_g * 0.7),
                        "label": "Small"
                    },
                    "medium": {
                        "weight_g": weight_g,
                        "label": "Medium"
                    },
                    "large": {
                        "weight_g": round(weight_g * 1.4),
                        "label": "Large"
                    },
                }
            })
        else:
            # Food detected but not in DB
            enriched_foods.append({
                "status": "detected_not_in_db",
                "food_name": food_name,
                "confidence": confidence,
                "estimated_weight_g": weight_g,
                "description": food.get("description", ""),
                "nutrition": None,
                "message": f"{food_name} detected but not in our database. Please enter nutrition manually or select the closest match.",
                "suggestions": get_similar_foods(food_name, diet_type)
            })
            
    return {
        "success": True,
        "model": model_used,
        "meal_context": result.get("meal_context", ""),
        "detection_quality": result.get("detection_quality", "medium"),
        "detected_foods": enriched_foods,
        "total_detected": len(enriched_foods)
    }

async def analyze_food_image(
    image_bytes: bytes,
    user_state: str = "Tamil Nadu",
    diet_type: str = "vegetarian"
) -> dict:
    """
    Core entrypoint for food image analysis.
    Uses Pillow to compress the image payload, checks the OpenAI key, and calls GPT-4o with a 45s timeout.
    Falls back gracefully to the smart mock scanner on failure, timeout, or missing keys.
    """
    # Step 1: Compress image first
    image_bytes = compress_image_for_api(image_bytes)
    
    # Step 2: Check if OpenAI key exists
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key or api_key in ["your_key_here", "sk-placeholder", ""]:
        print("No valid OPENAI_API_KEY — using mock scanner")
        return await analyze_food_image_mock(
            image_bytes, 
            user_state=user_state,
            diet_type=diet_type
        )
        
    # Step 3: Try GPT-4o with timeout
    try:
        result = await asyncio.wait_for(
            _call_gpt4o_vision(image_bytes, user_state, diet_type),
            timeout=45.0  # 45 second timeout
        )
        return result
        
    except asyncio.TimeoutError:
        print("GPT-4o timeout after 45s — falling back to mock")
        return await analyze_food_image_mock(
            image_bytes,
            user_state=user_state,
            diet_type=diet_type
        )
        
    except Exception as e:
        print(f"GPT-4o error: {e} — falling back to mock")
        return await analyze_food_image_mock(
            image_bytes,
            user_state=user_state,
            diet_type=diet_type
        )
