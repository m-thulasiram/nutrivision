import pytest
from services.health_calculator import calculate_bmr, calculate_tdee, calculate_targets

# --- BMR Tests ---
def test_bmr_male():
    """Mifflin-St Jeor: 10*70 + 6.25*175 - 5*30 + 5 = 700 + 1093.75 - 150 + 5 = 1648.75"""
    bmr = calculate_bmr(70, 175, 30, "male")
    assert bmr == pytest.approx(1648.75, rel=1e-9)

def test_bmr_female():
    """10*60 + 6.25*165 - 5*28 - 161 = 600 + 1031.25 - 140 - 161 = 1330.25"""
    bmr = calculate_bmr(60, 165, 28, "female")
    assert bmr == pytest.approx(1330.25, rel=1e-9)

def test_bmr_case_insensitive():
    assert calculate_bmr(70, 175, 30, "MALE") == calculate_bmr(70, 175, 30, "male")
    assert calculate_bmr(70, 175, 30, "Female") == calculate_bmr(70, 175, 30, "female")

def test_bmr_extreme_values():
    """Should not crash with edge values."""
    assert calculate_bmr(300, 220, 100, "male") > 0
    assert calculate_bmr(20, 100, 12, "female") > 0

# --- TDEE Tests ---
def test_tdee_sedentary():
    assert calculate_tdee(1648.75, "sedentary") == pytest.approx(1978.5, rel=1e-9)

def test_tdee_light():
    assert calculate_tdee(1648.75, "light") == pytest.approx(2267.03125, rel=1e-9)

def test_tdee_moderate():
    assert calculate_tdee(1648.75, "moderate") == pytest.approx(2555.5625, rel=1e-9)

def test_tdee_active():
    assert calculate_tdee(1648.75, "active") == pytest.approx(2844.09375, rel=1e-9)

def test_tdee_very_active():
    assert calculate_tdee(1648.75, "very_active") == pytest.approx(3132.625, rel=1e-9)

def test_tdee_case_insensitive():
    assert calculate_tdee(1648.75, "SEDENTARY") == calculate_tdee(1648.75, "sedentary")

def test_tdee_unknown_level_defaults_to_sedentary():
    """Unknown activity level defaults to 1.2 (sedentary)."""
    assert calculate_tdee(1648.75, "unknown_level") == pytest.approx(1978.5, rel=1e-9)

# --- Target Tests ---
def test_targets_maintain():
    """Maintain: 30% Pro, 40% Carbs, 30% Fats"""
    tdee = 2000.0
    targets = calculate_targets(tdee, "maintain", 70.0)
    assert targets["target_calories"] == 2000.0
    assert targets["target_protein"] == pytest.approx(150.0, rel=1e-9)  # 2000*0.3/4
    assert targets["target_carbs"] == pytest.approx(200.0, rel=1e-9)   # 2000*0.4/4
    assert targets["target_fats"] == pytest.approx(66.67, rel=1e-2)    # 2000*0.3/9

def test_targets_weight_loss():
    """Weight loss: -500 cal, 40% Pro, 30% Carbs, 30% Fats"""
    tdee = 2000.0
    targets = calculate_targets(tdee, "weight_loss", 80.0)
    assert targets["target_calories"] == 1500.0
    assert targets["target_protein"] == pytest.approx(150.0, rel=1e-9)  # 1500*0.4/4
    assert targets["target_carbs"] == pytest.approx(112.5, rel=1e-9)   # 1500*0.3/4
    assert targets["target_fats"] == pytest.approx(50.0, rel=1e-9)     # 1500*0.3/9

def test_targets_muscle_gain():
    """Muscle gain: +500 cal, 40% Pro, 40% Carbs, 20% Fats"""
    tdee = 2000.0
    targets = calculate_targets(tdee, "muscle_gain", 70.0)
    assert targets["target_calories"] == 2500.0
    assert targets["target_protein"] == pytest.approx(250.0, rel=1e-9)  # 2500*0.4/4
    assert targets["target_carbs"] == pytest.approx(250.0, rel=1e-9)   # 2500*0.4/4
    assert targets["target_fats"] == pytest.approx(55.56, rel=1e-2)    # 2500*0.2/9

def test_targets_case_insensitive():
    assert calculate_targets(2000, "WEIGHT_LOSS", 70)["target_calories"] < 2000
    assert calculate_targets(2000, "MAINTAIN", 70)["target_calories"] == 2000

def test_targets_returns_rounded_values():
    targets = calculate_targets(1999.99, "maintain", 70.0)
    assert isinstance(targets["target_calories"], float)
    # All values should be rounded to 2 decimal places
    for v in targets.values():
        parts = str(v).split(".")
        if len(parts) > 1:
            assert len(parts[1]) <= 2 or v == round(v, 2)
