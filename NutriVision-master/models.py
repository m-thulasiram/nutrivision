from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="Astronaut")
    age = Column(Integer, default=30)
    gender = Column(String, default="Male") # Male/Female
    height_cm = Column(Float, default=175.0)
    weight_kg = Column(Float, default=70.0)
    activity_level = Column(String, default="moderate") # sedentary, light, moderate, active, very_active
    goal = Column(String, default="maintain") # maintain, weight_loss, muscle_gain
    
    # Computed Daily Targets
    bmr = Column(Float, default=0.0)
    tdee = Column(Float, default=0.0)
    target_calories = Column(Float, default=0.0)
    target_protein = Column(Float, default=0.0)
    target_carbs = Column(Float, default=0.0)
    target_fats = Column(Float, default=0.0)

    meal_logs = relationship("MealLog", back_populates="owner")
    daily_logs = relationship("DailyLog", back_populates="owner")

class MealLog(Base):
    __tablename__ = "meal_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    # JSON string or comma separated for simplicity in SQLite 
    detected_items = Column(String) 
    
    total_calories = Column(Float, default=0.0)
    total_protein = Column(Float, default=0.0)
    total_carbs = Column(Float, default=0.0)
    total_fats = Column(Float, default=0.0)

    owner = relationship("User", back_populates="meal_logs")

class DailyLog(Base):
    __tablename__ = "daily_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(String) # YYYY-MM-DD format for easy querying
    
    consumed_calories = Column(Float, default=0.0)
    consumed_protein = Column(Float, default=0.0)
    consumed_carbs = Column(Float, default=0.0)
    consumed_fats = Column(Float, default=0.0)
    
    owner = relationship("User", back_populates="daily_logs")
