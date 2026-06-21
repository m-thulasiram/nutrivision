from pydantic import BaseModel, field_validator, Field

ALLOWED_GENDERS = {"male", "female"}
ALLOWED_ACTIVITY_LEVELS = {"sedentary", "light", "moderate", "active", "very_active"}
ALLOWED_GOALS = {"maintain", "weight_loss", "muscle_gain"}
ALLOWED_DIET_TYPES = {"veg", "nonveg", "eggetarian", "both", "any"}


class HealthBase(BaseModel):
    age: int = Field(default=30, ge=0, le=150)
    gender: str = "Male"
    height_cm: float = Field(default=175.0, gt=0, le=300)
    weight_kg: float = Field(default=70.0, gt=0, le=700)
    activity_level: str = "moderate"
    goal: str = "maintain"

    @field_validator("gender")
    @classmethod
    def valid_gender(cls, v):
        if v.lower() not in ALLOWED_GENDERS:
            raise ValueError(f"must be one of {ALLOWED_GENDERS}")
        return v.lower()

    @field_validator("activity_level")
    @classmethod
    def valid_activity(cls, v):
        if v.lower() not in ALLOWED_ACTIVITY_LEVELS:
            raise ValueError(f"must be one of {ALLOWED_ACTIVITY_LEVELS}")
        return v.lower()

    @field_validator("goal")
    @classmethod
    def valid_goal(cls, v):
        if v.lower() not in ALLOWED_GOALS:
            raise ValueError(f"must be one of {ALLOWED_GOALS}")
        return v.lower()


class MacroRequest(BaseModel):
    target_cals: float
    target_pro: float
    target_carb: float
    target_fat: float
    diet_type: str
    preferred_region: str = ""
    preferred_state: str = ""

    @field_validator("target_cals", "target_pro", "target_carb", "target_fat")
    @classmethod
    def non_negative(cls, v):
        if v < 0:
            raise ValueError("must be non-negative")
        return v

    @field_validator("diet_type")
    @classmethod
    def valid_diet(cls, v):
        if v.lower() not in ALLOWED_DIET_TYPES:
            raise ValueError(f"must be one of {ALLOWED_DIET_TYPES}")
        return v.lower()


class UserProfileCreate(HealthBase):
    name: str = "Astronaut"
    preferred_region: str = ""
    preferred_state: str = ""
    diet_type: str = "any"


class RegisterRequest(HealthBase):
    name: str
    email: str
    password: str
    diet_type: str = "any"

    @field_validator("email")
    @classmethod
    def valid_email(cls, v):
        if not v or "@" not in v or "." not in v:
            raise ValueError("Invalid email address")
        return v.strip().lower()

    @field_validator("password")
    @classmethod
    def password_length(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

    @field_validator("diet_type")
    @classmethod
    def valid_diet_type(cls, v):
        if v.lower() not in ALLOWED_DIET_TYPES:
            raise ValueError(f"must be one of {ALLOWED_DIET_TYPES}")
        return v.lower()

class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def valid_email(cls, v):
        if not v or "@" not in v or "." not in v:
            raise ValueError("Invalid email address")
        return v.strip().lower()

class ResetPasswordRequest(BaseModel):
    token: str
    password: str

    @field_validator("password")
    @classmethod
    def password_length(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

class AuthResponse(BaseModel):
    status: str
    token: str
    user: dict

class MealEntry(BaseModel):
    id: int
    timestamp: str
    meal_time: str
    detected_items: str
    total_calories: float
    total_protein_g: float
    total_carbs_g: float
    total_fats_g: float

class DailyProgress(BaseModel):
    date: str
    user_id: int
    targets: dict
    consumed: dict
    remaining: dict
    percentages: dict
    meals_today: list[MealEntry]
    streak_days: int
    health_score: int
    alerts: list[str]
