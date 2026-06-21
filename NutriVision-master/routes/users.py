from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
import sqlite3
from database import get_db
import crud
from services.health_calculator import calculate_bmr, calculate_tdee, calculate_targets
from schemas import UserProfileCreate, DailyProgress, MealEntry
from dependencies import require_user_id
from routes.auth import get_current_user


class LogMealRequest(BaseModel):
    meal_time: str = "meal"
    detected_items: str = ""
    total_calories: float = Field(default=0, ge=0)
    total_protein: float = Field(default=0, ge=0)
    total_carbs: float = Field(default=0, ge=0)
    total_fats: float = Field(default=0, ge=0)

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("")
def list_users(page: int = 1, per_page: int = 50, db: sqlite3.Connection = Depends(get_db)):
    users = crud.get_all_users(db, page=page, per_page=per_page)
    return {"status": "success", "users": users}

@router.get("/me/progress")
def get_my_progress(db: sqlite3.Connection = Depends(get_db), current_user_id: int = Depends(require_user_id)):
    return _build_daily_progress(db, current_user_id)

@router.get("/me/progress/weekly")
def get_weekly_progress(db: sqlite3.Connection = Depends(get_db), current_user_id: int = Depends(require_user_id)):
    today = datetime.utcnow()
    results = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        date_str = day.strftime("%Y-%m-%d")
        results.append(_build_daily_progress(db, current_user_id, date_str))
    return {"status": "success", "weekly_progress": results}

@router.post("/me/meals")
def log_meal(meal: LogMealRequest, db: sqlite3.Connection = Depends(get_db), current_user_id: int = Depends(require_user_id)):
    crud.create_meal_log(db, {
        "user_id": current_user_id,
        "meal_time": meal.meal_time,
        "detected_items": meal.detected_items,
        "total_calories": meal.total_calories,
        "total_protein": meal.total_protein,
        "total_carbs": meal.total_carbs,
        "total_fats": meal.total_fats,
    })
    crud.create_or_update_daily_log(db, current_user_id, crud.get_today_str(),
                                    meal.total_calories, meal.total_protein,
                                    meal.total_carbs, meal.total_fats)
    return {"status": "success", "message": "Meal logged"}

@router.get("/me")
def get_my_profile(db: sqlite3.Connection = Depends(get_db), current_user_id: int = Depends(require_user_id)):
    user = crud.get_user(db, current_user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    safe = {k: v for k, v in user.items() if k != "password_hash"}
    return {"status": "success", "user": safe}

@router.post("/profile")
def create_or_update_profile(profile: UserProfileCreate, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    bmr = calculate_bmr(profile.weight_kg, profile.height_cm, profile.age, profile.gender)
    tdee = calculate_tdee(bmr, profile.activity_level)
    targets = calculate_targets(tdee, profile.goal, profile.weight_kg)
    user_data = profile.model_dump()
    user_data["bmr"] = bmr
    user_data["tdee"] = tdee
    user_data.update(targets)
    del user_data["name"]
    user = crud.update_user(db, current_user["id"], user_data)
    safe = {k: v for k, v in user.items() if k != "password_hash"}
    return {"status": "success", "user": safe}

@router.get("/{user_id}")
def get_user_profile(user_id: int, db: sqlite3.Connection = Depends(get_db), current_user_id: int = Depends(require_user_id)):
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only view your own profile")
    user = crud.get_user(db, current_user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "success", "user": user}

@router.get("/{user_id}/progress")
def get_user_progress(user_id: int, db: sqlite3.Connection = Depends(get_db), current_user_id: int = Depends(require_user_id)):
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only view your own progress")
    return _build_daily_progress(db, current_user_id)


def _build_daily_progress(db: sqlite3.Connection, user_id: int, date_str: str = None):
    if date_str is None:
        date_str = crud.get_today_str()

    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    daily_log = crud.get_daily_log(db, user_id, date_str)
    meal_logs = crud.get_meal_logs_for_user(db, user_id, date_str)

    target_cals = user.get("target_calories", 2000.0) or 2000.0
    target_pro = user.get("target_protein", 50.0) or 50.0
    target_carbs = user.get("target_carbs", 250.0) or 250.0
    target_fats = user.get("target_fats", 70.0) or 70.0

    consumed_cals = daily_log["consumed_calories"] if daily_log else 0.0
    consumed_pro = daily_log["consumed_protein"] if daily_log else 0.0
    consumed_carbs = daily_log["consumed_carbs"] if daily_log else 0.0
    consumed_fats = daily_log["consumed_fats"] if daily_log else 0.0

    rem_cals = max(0.0, target_cals - consumed_cals)
    rem_pro = max(0.0, target_pro - consumed_pro)
    rem_carbs = max(0.0, target_carbs - consumed_carbs)
    rem_fats = max(0.0, target_fats - consumed_fats)

    pct_cals = min(consumed_cals / target_cals, 1.0) if target_cals > 0 else 0.0
    pct_pro = min(consumed_pro / target_pro, 1.0) if target_pro > 0 else 0.0
    pct_carbs = min(consumed_carbs / target_carbs, 1.0) if target_carbs > 0 else 0.0
    pct_fats = min(consumed_fats / target_fats, 1.0) if target_fats > 0 else 0.0

    health_score = 50
    if pct_pro >= 0.8:
        health_score += 15
    if 0.85 <= pct_cals <= 1.05:
        health_score += 15
    if pct_carbs <= 1.0:
        health_score += 10
    if pct_fats <= 1.0:
        health_score += 10
    health_score = min(100, health_score)

    streak_days = 0
    check_date = datetime.utcnow()
    for _ in range(60):
        ds = check_date.strftime("%Y-%m-%d")
        ld = crud.get_daily_log(db, user_id, ds)
        if ld and ld["consumed_calories"] > 0:
            ld_user = user
            ld_target = ld_user.get("target_calories", 2000.0) or 2000.0
            if ld_target > 0 and ld["consumed_calories"] >= ld_target * 0.8:
                streak_days += 1
                check_date -= timedelta(days=1)
                continue
        break

    meals_today = []
    for ml in meal_logs:
        meals_today.append(MealEntry(
            id=ml["id"],
            timestamp=str(ml.get("timestamp", "")),
            meal_time=str(ml.get("meal_time", "meal")),
            detected_items=str(ml.get("detected_items", "")),
            total_calories=float(ml.get("total_calories", 0)),
            total_protein_g=float(ml.get("total_protein", 0)),
            total_carbs_g=float(ml.get("total_carbs", 0)),
            total_fats_g=float(ml.get("total_fats", 0)),
        ))

    alerts = []
    if rem_pro > 0:
        alerts.append(f"Protein deficit: {int(rem_pro)}g remaining")
    else:
        alerts.append("Great job — protein goal hit!")
    if pct_carbs >= 1.0:
        alerts.append("Great job — carb goal hit!")
    if consumed_cals > target_cals:
        alerts.append(f"Calorie surplus: {int(consumed_cals - target_cals)}kcal over target")

    progress = DailyProgress(
        date=date_str,
        user_id=user_id,
        targets={"calories": target_cals, "protein_g": target_pro, "carbs_g": target_carbs, "fats_g": target_fats},
        consumed={"calories": consumed_cals, "protein_g": consumed_pro, "carbs_g": consumed_carbs, "fats_g": consumed_fats},
        remaining={"calories": rem_cals, "protein_g": rem_pro, "carbs_g": rem_carbs, "fats_g": rem_fats},
        percentages={"calories": round(pct_cals, 2), "protein_g": round(pct_pro, 2), "carbs_g": round(pct_carbs, 2), "fats_g": round(pct_fats, 2)},
        meals_today=meals_today,
        streak_days=streak_days,
        health_score=health_score,
        alerts=alerts,
    )
    return {"status": "success", "progress": progress.model_dump()}
