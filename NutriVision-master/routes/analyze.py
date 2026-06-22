import time
import io
import math
import base64
import difflib
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Request
from pydantic import BaseModel
from PIL import Image
import sqlite3
from database import get_db
import crud
from models import get_models, YOLO_CONFIDENCE_THRESHOLD
from logging_config import get_logger
from metrics import yolo_inference_latency
from middleware import correlation_id
from dependencies import get_soft_user_id

router = APIRouter(tags=["analyze"])

MAX_UPLOAD_SIZE = 10 * 1024 * 1024
ALLOWED_IMAGE_FORMATS = {"image/jpeg", "image/png", "image/webp"}

logger = get_logger("nutrivision.analyze")

from rate_limiter import rate_limit as _rate_limit


def process_pil_image(pil_image: Image.Image, user_id: int, db: sqlite3.Connection, start_time: float, cid: str):
    m = get_models()
    yolo_model = m.yolo_model
    df = m.df

    if yolo_model is None:
        logger.error("YOLO model not loaded", extra={"user_id": user_id})
        raise HTTPException(status_code=500, detail="YOLO model is not loaded")

    try:
        # Resize image in-place to max 640px to prevent PyTorch memory spikes (OOM) on Render
        pil_image.thumbnail((640, 640))

        detections = []
        top3_predictions = []

        def _get_food_column(df):
            if 'Food_items' in df.columns:
                return 'Food_items'
            elif 'Food' in df.columns:
                return 'Food'
            return df.columns[0]

        def map_to_nutrition_db(predicted_label: str):
            normalized_label = predicted_label.replace("_", " ").strip().lower()
            match_col = _get_food_column(df)

            exact = df[df['food_normalized'] == normalized_label]
            if not exact.empty:
                row = exact.iloc[0]
                logger.info("YOLO exact DB match", extra={"predicted_label": predicted_label, "match": row[match_col]})
                return {
                    "name": row[match_col],
                    "calories": float(row.get('Calories', 0)),
                    "protein": float(row.get('Proteins', 0)),
                    "carbs": float(row.get('Carbohydrates', 0)),
                    "fat": float(row.get('Fats', 0))
                }

            candidates = df['food_normalized'].tolist()
            fuzzy = difflib.get_close_matches(normalized_label, candidates, n=1, cutoff=0.75)
            if fuzzy:
                match = df[df['food_normalized'] == fuzzy[0]]
                if not match.empty:
                    row = match.iloc[0]
                    logger.info("YOLO fuzzy DB match", extra={"predicted_label": predicted_label, "match": row[match_col], "fuzzy": fuzzy[0]})
                    return {
                        "name": row[match_col],
                        "calories": float(row.get('Calories', 0)),
                        "protein": float(row.get('Proteins', 0)),
                        "carbs": float(row.get('Carbohydrates', 0)),
                        "fat": float(row.get('Fats', 0))
                    }

            logger.warning("YOLO no DB match", extra={"predicted_label": predicted_label})
            return None

        yolo_start = time.time()
        results = yolo_model(pil_image)
        yolo_duration = time.time() - yolo_start
        yolo_inference_latency.observe(yolo_duration)

        for r in results:
            if len(r.boxes) == 0:
                continue
            boxes_data = []
            for box in r.boxes:
                xyxyn = box.xyxyn[0]
                area = float(xyxyn[2] - xyxyn[0]) * float(xyxyn[3] - xyxyn[1])
                boxes_data.append({
                    "cls": int(box.cls[0].item() if hasattr(box.cls[0], 'item') else box.cls[0]),
                    "conf": float(box.conf[0].item() if hasattr(box.conf[0], 'item') else box.conf[0]),
                    "area": area
                })
            boxes_sorted = sorted(boxes_data, key=lambda x: x["conf"], reverse=True)
            for index, box in enumerate(boxes_sorted):
                cls_name = yolo_model.names[box["cls"]]
                conf = box["conf"]
                area = box["area"]
                if index < 3:
                    top3_predictions.append({"label": cls_name, "prob": conf})
                if conf < YOLO_CONFIDENCE_THRESHOLD:
                    logger.info("Skipping below threshold", extra={"class": cls_name, "confidence": conf, "threshold": YOLO_CONFIDENCE_THRESHOLD})
                    continue
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

        if not detections:
            max_conf = max([p["prob"] for p in top3_predictions]) if top3_predictions else 0.0
            logger.info("No detections above threshold", extra={"user_id": user_id, "max_confidence": max_conf})
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

        detected_items_names = [d["class_name"] for d in detections]
        total_pro = sum(d['protein'] for d in detections)
        total_cal = sum(d['calories'] for d in detections)
        total_carb = sum(d['carbs'] for d in detections)
        total_fat = sum(d['fat'] for d in detections)

        alerts = []
        score = 100

        if total_cal > 0:
            protein_cal = total_pro * 4
            if protein_cal / total_cal < 0.20:
                alerts.append("Critical: Protein intake is below the 20% microgravity threshold for preventing muscle atrophy.")
                score -= 15
            else:
                alerts.append("Sufficient protein for muscle retention.")
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

        if total_cal > 0:
            user = crud.get_user(db, user_id)
            crud.create_meal_log(db, {
                "user_id": user_id,
                "detected_items": ", ".join(detected_items_names),
                "total_calories": total_cal,
                "total_protein": total_pro,
                "total_carbs": total_carb,
                "total_fats": total_fat
            })
            daily_log = crud.create_or_update_daily_log(
                db, user_id, crud.get_today_str(),
                total_cal, total_pro, total_carb, total_fat
            )
            if user and user["target_calories"] > 0:
                pct_consumed = (daily_log["consumed_calories"] / user["target_calories"]) * 100
                rem_cals = max(0, user["target_calories"] - daily_log["consumed_calories"])
                alerts.append(f"You have consumed {pct_consumed:.1f}% of your daily requirement.")
                if rem_cals > 0:
                    alerts.append(f"You need {int(rem_cals)} calories more today.")
                else:
                    alerts.append(f"You have exceeded your calorie target by {int(abs(user['target_calories'] - daily_log['consumed_calories']))} calories.")

        inference_time_ms = round((time.time() - start_time) * 1000, 2)
        logger.info("Analyze complete", extra={
            "user_id": user_id,
            "items_detected": len(detections),
            "total_calories": total_cal,
            "yolo_latency_ms": round(yolo_duration * 1000, 2),
            "total_latency_ms": inference_time_ms,
            "correlation_id": cid
        })

        return {
            "status": "success",
            "detected_items": detected_items_names,
            "confidence_scores": [round(d["confidence"], 2) for d in detections],
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Analyze meal failed", extra={"user_id": user_id, "error": str(e)}, exc_info=True)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/analyze-meal")
@_rate_limit("30/minute")
async def analyze_meal(request: Request, image: UploadFile = File(...), user_id: int = Depends(get_soft_user_id), db: sqlite3.Connection = Depends(get_db)):
    start_time = time.time()
    cid = correlation_id.get()

    if image.content_type and image.content_type not in ALLOWED_IMAGE_FORMATS:
        logger.warning("Unsupported image format", extra={"content_type": image.content_type, "user_id": user_id})
        raise HTTPException(status_code=400, detail=f"Unsupported image format: {image.content_type}")

    contents = await image.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        logger.warning("Image too large", extra={"size": len(contents), "user_id": user_id})
        raise HTTPException(status_code=413, detail="Image too large (max 10 MB)")

    Image.MAX_IMAGE_PIXELS = 50_000_000
    try:
        pil_image = Image.open(io.BytesIO(contents)).convert('RGB')
    except Image.DecompressionBombError:
        logger.warning("Image decompression bomb", extra={"user_id": user_id, "size": len(contents)})
        raise HTTPException(status_code=413, detail="Image too large (decompression bomb)")
    except Exception as e:
        logger.warning("Invalid image file format", extra={"error": str(e), "user_id": user_id})
        raise HTTPException(status_code=400, detail="Invalid image file data")

    return process_pil_image(pil_image, user_id, db, start_time, cid)


class Base64AnalyzeRequest(BaseModel):
    image_base64: str


@router.post("/api/analyze-meal-b64")
@_rate_limit("30/minute")
async def analyze_meal_b64(request: Request, payload: Base64AnalyzeRequest, user_id: int = Depends(get_soft_user_id), db: sqlite3.Connection = Depends(get_db)):
    start_time = time.time()
    cid = correlation_id.get()

    try:
        b64_str = payload.image_base64
        if "," in b64_str:
            b64_str = b64_str.split(",")[1]
        contents = base64.b64decode(b64_str)
    except Exception as e:
        logger.warning("Invalid base64 payload", extra={"error": str(e), "user_id": user_id})
        raise HTTPException(status_code=400, detail="Invalid base64 encoded image data")

    if len(contents) > MAX_UPLOAD_SIZE:
        logger.warning("Image too large from base64", extra={"size": len(contents), "user_id": user_id})
        raise HTTPException(status_code=413, detail="Image too large (max 10 MB)")

    Image.MAX_IMAGE_PIXELS = 50_000_000
    try:
        pil_image = Image.open(io.BytesIO(contents)).convert('RGB')
    except Exception as e:
        logger.warning("Failed to open decoded base64 image", extra={"error": str(e), "user_id": user_id})
        raise HTTPException(status_code=400, detail="Invalid image file data")

    return process_pil_image(pil_image, user_id, db, start_time, cid)
