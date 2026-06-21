def calculate_bmr(weight_kg: float, height_cm: float, age: int, gender: str) -> float:
    """Calculate BMR using the Mifflin-St Jeor Equation."""
    if gender.lower() == "male":
        return 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    else:
        return 10 * weight_kg + 6.25 * height_cm - 5 * age - 161

def calculate_tdee(bmr: float, activity_level: str) -> float:
    """Calculate TDEE based on activity level."""
    activity_multipliers = {
        "sedentary": 1.2,        # little or no exercise
        "light": 1.375,          # light exercise/sports 1-3 days/week
        "moderate": 1.55,        # moderate exercise/sports 3-5 days/week
        "active": 1.725,         # hard exercise/sports 6-7 days/week
        "very_active": 1.9       # very hard exercise/physical job
    }
    multiplier = activity_multipliers.get(activity_level.lower(), 1.2)
    return bmr * multiplier

def calculate_targets(tdee: float, goal: str, weight_kg: float) -> dict:
    """Calculate ideal calorie and macro targets based on fitness goal."""

    # Base calories
    target_calories = tdee
    if goal.lower() == "weight_loss":
        target_calories -= 500  # Default 500 deficit
    elif goal.lower() == "muscle_gain":
        target_calories += 500  # Default 500 surplus

    # Macros Breakdown
    if goal.lower() == "weight_loss":
        # 40% Protein, 30% Carbs, 30% Fats
        p_pct, c_pct, f_pct = 0.40, 0.30, 0.30
    elif goal.lower() == "muscle_gain":
        # High Protein for muscle synthesis: 40% Pro, 40% Carbs, 20% Fats
        p_pct, c_pct, f_pct = 0.40, 0.40, 0.20
    else: # maintain
        # Balanced: 30% Pro, 40% Carbs, 30% Fats
        p_pct, c_pct, f_pct = 0.30, 0.40, 0.30

    # 1g Protein = 4 kcal, 1g Carb = 4 kcal, 1g Fat = 9 kcal
    target_protein = (target_calories * p_pct) / 4
    target_carbs = (target_calories * c_pct) / 4
    target_fats = (target_calories * f_pct) / 9

    return {
        "target_calories": round(target_calories, 2),
        "target_protein": round(target_protein, 2),
        "target_carbs": round(target_carbs, 2),
        "target_fats": round(target_fats, 2)
    }
