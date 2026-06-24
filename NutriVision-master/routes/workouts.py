import os
import json
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
import sqlite3
from database import get_db, get_connection, close_connection
from dependencies import require_user_id
from logging_config import get_logger

logger = get_logger("nutrivision.workouts")

router = APIRouter(prefix="/api/workouts", tags=["workouts"])

EXERCISE_LIBRARY = {
    "chest": [
        {"name": "Bench Press", "equipment": "gym", "muscle_group": "chest"},
        {"name": "Dumbbell Fly", "equipment": "gym", "muscle_group": "chest"},
        {"name": "Push Up", "equipment": "bodyweight", "muscle_group": "chest"},
        {"name": "Incline Bench Press", "equipment": "gym", "muscle_group": "chest"},
        {"name": "Cable Crossover", "equipment": "gym", "muscle_group": "chest"},
        {"name": "Decline Push Up", "equipment": "bodyweight", "muscle_group": "chest"},
    ],
    "back": [
        {"name": "Deadlift", "equipment": "gym", "muscle_group": "back"},
        {"name": "Pull Up", "equipment": "bodyweight", "muscle_group": "back"},
        {"name": "Bent Over Row", "equipment": "gym", "muscle_group": "back"},
        {"name": "Lat Pulldown", "equipment": "gym", "muscle_group": "back"},
        {"name": "Seated Cable Row", "equipment": "gym", "muscle_group": "back"},
        {"name": "Superman Hold", "equipment": "bodyweight", "muscle_group": "back"},
    ],
    "legs": [
        {"name": "Squat", "equipment": "gym", "muscle_group": "legs"},
        {"name": "Lunges", "equipment": "bodyweight", "muscle_group": "legs"},
        {"name": "Leg Press", "equipment": "gym", "muscle_group": "legs"},
        {"name": "Romanian Deadlift", "equipment": "gym", "muscle_group": "legs"},
        {"name": "Calf Raise", "equipment": "bodyweight", "muscle_group": "legs"},
        {"name": "Bulgarian Split Squat", "equipment": "bodyweight", "muscle_group": "legs"},
        {"name": "Leg Extension", "equipment": "gym", "muscle_group": "legs"},
        {"name": "Leg Curl", "equipment": "gym", "muscle_group": "legs"},
    ],
    "shoulders": [
        {"name": "Overhead Press", "equipment": "gym", "muscle_group": "shoulders"},
        {"name": "Lateral Raise", "equipment": "gym", "muscle_group": "shoulders"},
        {"name": "Front Raise", "equipment": "gym", "muscle_group": "shoulders"},
        {"name": "Reverse Fly", "equipment": "gym", "muscle_group": "shoulders"},
        {"name": "Pike Push Up", "equipment": "bodyweight", "muscle_group": "shoulders"},
        {"name": "Arnold Press", "equipment": "gym", "muscle_group": "shoulders"},
    ],
    "arms": [
        {"name": "Bicep Curl", "equipment": "gym", "muscle_group": "arms"},
        {"name": "Tricep Dip", "equipment": "bodyweight", "muscle_group": "arms"},
        {"name": "Hammer Curl", "equipment": "gym", "muscle_group": "arms"},
        {"name": "Skull Crusher", "equipment": "gym", "muscle_group": "arms"},
        {"name": "Tricep Pushdown", "equipment": "gym", "muscle_group": "arms"},
        {"name": "Chin Up", "equipment": "bodyweight", "muscle_group": "arms"},
        {"name": "Preacher Curl", "equipment": "gym", "muscle_group": "arms"},
    ],
    "core": [
        {"name": "Plank", "equipment": "bodyweight", "muscle_group": "core"},
        {"name": "Crunches", "equipment": "bodyweight", "muscle_group": "core"},
        {"name": "Russian Twist", "equipment": "bodyweight", "muscle_group": "core"},
        {"name": "Leg Raise", "equipment": "bodyweight", "muscle_group": "core"},
        {"name": "Bicycle Crunch", "equipment": "bodyweight", "muscle_group": "core"},
        {"name": "Mountain Climber", "equipment": "bodyweight", "muscle_group": "core"},
        {"name": "Cable Crunch", "equipment": "gym", "muscle_group": "core"},
    ],
    "full_body": [
        {"name": "Burpee", "equipment": "bodyweight", "muscle_group": "full_body"},
        {"name": "Clean and Press", "equipment": "gym", "muscle_group": "full_body"},
        {"name": "Kettlebell Swing", "equipment": "gym", "muscle_group": "full_body"},
        {"name": "Jumping Jack", "equipment": "bodyweight", "muscle_group": "full_body"},
        {"name": "Battle Ropes", "equipment": "gym", "muscle_group": "full_body"},
        {"name": "Box Jump", "equipment": "gym", "muscle_group": "full_body"},
    ],
}

ALL_EXERCISES = [ex for group in EXERCISE_LIBRARY.values() for ex in group]


def _ensure_workout_tables():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS workout_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            week_start_date TEXT NOT NULL,
            plan_json TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS workout_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            exercise_name TEXT NOT NULL,
            sets INTEGER DEFAULT 0,
            reps INTEGER DEFAULT 0,
            weight_kg REAL DEFAULT 0.0,
            duration_minutes INTEGER DEFAULT 0,
            calories_burned INTEGER DEFAULT 0,
            notes TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)
    conn.commit()
    close_connection(conn)


_ensure_workout_tables()

# Static Workout Plans Database
PLANS_DB = {
    # ─── BODYWEIGHT PLANS ─────────────────────────────────────────────────────
    ("bodyweight", "muscle_gain"): [
        {
            "day": "Monday",
            "focus": "chest",
            "exercises": [
                {"name": "Dand (Push-up)", "sets": 4, "reps": "10-12", "rest_seconds": 60},
                {"name": "Wide Dand", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Diamond Dand", "sets": 3, "reps": "10", "rest_seconds": 60},
                {"name": "Chaturanga Dip", "sets": 3, "reps": "12", "rest_seconds": 60},
            ]
        },
        {
            "day": "Tuesday",
            "focus": "back",
            "exercises": [
                {"name": "Pull-ups", "sets": 4, "reps": "8", "rest_seconds": 60},
                {"name": "Inverted Row", "sets": 3, "reps": "10", "rest_seconds": 60},
                {"name": "Superman Hold", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Chin-ups", "sets": 3, "reps": "8", "rest_seconds": 60},
            ]
        },
        {"day": "Wednesday", "focus": "core", "exercises": []}, # Rest
        {
            "day": "Thursday",
            "focus": "legs",
            "exercises": [
                {"name": "Baithak (Squat)", "sets": 4, "reps": "15", "rest_seconds": 60},
                {"name": "Virabhadrasana Lunge", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Single Leg Baithak", "sets": 3, "reps": "10", "rest_seconds": 60},
                {"name": "Tadasana Rise", "sets": 4, "reps": "20", "rest_seconds": 60},
            ]
        },
        {
            "day": "Friday",
            "focus": "shoulders",
            "exercises": [
                {"name": "Pike Dand", "sets": 4, "reps": "10", "rest_seconds": 60},
                {"name": "Hasta Vistaar", "sets": 3, "reps": "15", "rest_seconds": 60},
                {"name": "Lateral Arm Raise", "sets": 3, "reps": "15", "rest_seconds": 60},
            ]
        },
        {
            "day": "Saturday",
            "focus": "full_body",
            "exercises": [
                {"name": "Uth Baith", "sets": 3, "reps": "15", "rest_seconds": 60},
                {"name": "Dand", "sets": 3, "reps": "15", "rest_seconds": 60},
                {"name": "Pull-ups", "sets": 3, "reps": "8", "rest_seconds": 60},
                {"name": "Kumbhakasana", "sets": 3, "reps": "45sec", "rest_seconds": 60},
            ]
        },
        {"day": "Sunday", "focus": "core", "exercises": []} # Rest
    ],
    ("bodyweight", "maintain"): [
        {
            "day": "Monday",
            "focus": "chest",
            "exercises": [
                {"name": "Dand (Push-up)", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Wide Dand", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Chaturanga Dip", "sets": 3, "reps": "12", "rest_seconds": 60},
            ]
        },
        {
            "day": "Tuesday",
            "focus": "back",
            "exercises": [
                {"name": "Pull-ups", "sets": 3, "reps": "10", "rest_seconds": 60},
                {"name": "Inverted Row", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Chin-ups", "sets": 3, "reps": "10", "rest_seconds": 60},
            ]
        },
        {
            "day": "Wednesday",
            "focus": "core",
            "exercises": [
                {"name": "Jumping Jacks", "sets": 3, "reps": "45sec", "rest_seconds": 60},
                {"name": "Mountain Climbers", "sets": 3, "reps": "40sec", "rest_seconds": 60},
                {"name": "Plank Hold", "sets": 3, "reps": "60sec", "rest_seconds": 60},
            ]
        },
        {
            "day": "Thursday",
            "focus": "legs",
            "exercises": [
                {"name": "Baithak (Squat)", "sets": 3, "reps": "15", "rest_seconds": 60},
                {"name": "Virabhadrasana Lunge", "sets": 3, "reps": "15", "rest_seconds": 60},
                {"name": "Tadasana Rise", "sets": 3, "reps": "20", "rest_seconds": 60},
            ]
        },
        {
            "day": "Friday",
            "focus": "shoulders",
            "exercises": [
                {"name": "Pike Dand", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Hasta Vistaar", "sets": 3, "reps": "15", "rest_seconds": 60},
                {"name": "Burpees", "sets": 3, "reps": "10", "rest_seconds": 60},
            ]
        },
        {
            "day": "Saturday",
            "focus": "full_body",
            "exercises": [
                {"name": "Uth Baith", "sets": 3, "reps": "15", "rest_seconds": 60},
                {"name": "Dand", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Jumping Jacks", "sets": 3, "reps": "60sec", "rest_seconds": 60},
                {"name": "Kumbhakasana (Plank)", "sets": 3, "reps": "45sec", "rest_seconds": 60},
            ]
        },
        {"day": "Sunday", "focus": "core", "exercises": []} # Rest
    ],
    ("bodyweight", "weight_loss"): [
        {
            "day": "Monday",
            "focus": "chest",
            "exercises": [
                {"name": "Dand (Push-up)", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Wide Dand", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Diamond Dand", "sets": 3, "reps": "12", "rest_seconds": 45},
                {"name": "Chaturanga Dip", "sets": 3, "reps": "15", "rest_seconds": 45},
            ]
        },
        {
            "day": "Tuesday",
            "focus": "back",
            "exercises": [
                {"name": "Pull-ups", "sets": 3, "reps": "10", "rest_seconds": 45},
                {"name": "Inverted Row", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Superman Hold", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Chin-ups", "sets": 3, "reps": "10", "rest_seconds": 45},
            ]
        },
        {
            "day": "Wednesday",
            "focus": "core",
            "exercises": [
                {"name": "Burpees", "sets": 4, "reps": "12", "rest_seconds": 45},
                {"name": "Jumping Jacks", "sets": 4, "reps": "45sec", "rest_seconds": 45},
                {"name": "Mountain Climbers", "sets": 4, "reps": "45sec", "rest_seconds": 45},
            ]
        },
        {
            "day": "Thursday",
            "focus": "legs",
            "exercises": [
                {"name": "Baithak (Squat)", "sets": 3, "reps": "20", "rest_seconds": 45},
                {"name": "Virabhadrasana Lunge", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Single Leg Baithak", "sets": 3, "reps": "12", "rest_seconds": 45},
                {"name": "Tadasana Rise", "sets": 3, "reps": "20", "rest_seconds": 45},
            ]
        },
        {
            "day": "Friday",
            "focus": "shoulders",
            "exercises": [
                {"name": "Pike Dand", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Hasta Vistaar", "sets": 3, "reps": "20", "rest_seconds": 45},
                {"name": "Lateral Arm Raise", "sets": 3, "reps": "20", "rest_seconds": 45},
            ]
        },
        {
            "day": "Saturday",
            "focus": "full_body",
            "exercises": [
                {"name": "Uth Baith", "sets": 3, "reps": "20", "rest_seconds": 45},
                {"name": "Dand", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Pull-ups", "sets": 3, "reps": "10", "rest_seconds": 45},
                {"name": "Kumbhakasana (Plank)", "sets": 3, "reps": "60sec", "rest_seconds": 45},
            ]
        },
        {"day": "Sunday", "focus": "core", "exercises": []} # Rest
    ],

    # ─── GYM PLANS ────────────────────────────────────────────────────────────
    ("gym", "muscle_gain"): [
        {
            "day": "Monday",
            "focus": "chest",
            "exercises": [
                {"name": "Bench Press", "sets": 4, "reps": "8-10", "rest_seconds": 60},
                {"name": "Incline Dumbbell Press", "sets": 3, "reps": "10", "rest_seconds": 60},
                {"name": "Push-ups", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Tricep Dips", "sets": 3, "reps": "10", "rest_seconds": 60},
                {"name": "Tricep Pushdown", "sets": 3, "reps": "12", "rest_seconds": 60},
            ]
        },
        {
            "day": "Tuesday",
            "focus": "back",
            "exercises": [
                {"name": "Pull-ups", "sets": 4, "reps": "8", "rest_seconds": 60},
                {"name": "Barbell Rows", "sets": 4, "reps": "10", "rest_seconds": 60},
                {"name": "Lat Pulldown", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Barbell Curls", "sets": 3, "reps": "10", "rest_seconds": 60},
                {"name": "Hammer Curls", "sets": 3, "reps": "12", "rest_seconds": 60},
            ]
        },
        {"day": "Wednesday", "focus": "core", "exercises": []}, # Rest
        {
            "day": "Thursday",
            "focus": "legs",
            "exercises": [
                {"name": "Squats", "sets": 4, "reps": "8", "rest_seconds": 60},
                {"name": "Leg Press", "sets": 3, "reps": "10", "rest_seconds": 60},
                {"name": "Lunges", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Leg Curls", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Calf Raises", "sets": 4, "reps": "15", "rest_seconds": 60},
            ]
        },
        {
            "day": "Friday",
            "focus": "shoulders",
            "exercises": [
                {"name": "Overhead Press", "sets": 4, "reps": "8", "rest_seconds": 60},
                {"name": "Lateral Raises", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Front Raises", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Shrugs", "sets": 3, "reps": "15", "rest_seconds": 60},
            ]
        },
        {
            "day": "Saturday",
            "focus": "full_body",
            "exercises": [
                {"name": "Deadlift", "sets": 4, "reps": "6", "rest_seconds": 60},
                {"name": "Push-ups", "sets": 3, "reps": "15", "rest_seconds": 60},
                {"name": "Pull-ups", "sets": 3, "reps": "8", "rest_seconds": 60},
                {"name": "Squats", "sets": 3, "reps": "12", "rest_seconds": 60},
            ]
        },
        {"day": "Sunday", "focus": "core", "exercises": []} # Rest
    ],
    ("gym", "maintain"): [
        {
            "day": "Monday",
            "focus": "chest",
            "exercises": [
                {"name": "Bench Press", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Incline Dumbbell Press", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Tricep Pushdown", "sets": 3, "reps": "12", "rest_seconds": 60},
            ]
        },
        {
            "day": "Tuesday",
            "focus": "back",
            "exercises": [
                {"name": "Lat Pulldown", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Barbell Rows", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Barbell Curls", "sets": 3, "reps": "12", "rest_seconds": 60},
            ]
        },
        {
            "day": "Wednesday",
            "focus": "core",
            "exercises": [
                {"name": "Treadmill Run", "sets": 1, "reps": "20min", "rest_seconds": 60},
                {"name": "Cable Crunch", "sets": 3, "reps": "15", "rest_seconds": 60},
                {"name": "Hanging Leg Raise", "sets": 3, "reps": "12", "rest_seconds": 60},
            ]
        },
        {
            "day": "Thursday",
            "focus": "legs",
            "exercises": [
                {"name": "Squats", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Leg Press", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Calf Raises", "sets": 3, "reps": "15", "rest_seconds": 60},
            ]
        },
        {
            "day": "Friday",
            "focus": "shoulders",
            "exercises": [
                {"name": "Overhead Press", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Lateral Raises", "sets": 3, "reps": "15", "rest_seconds": 60},
                {"name": "Elliptical Trainer", "sets": 1, "reps": "15min", "rest_seconds": 60},
            ]
        },
        {
            "day": "Saturday",
            "focus": "full_body",
            "exercises": [
                {"name": "Kettlebell Swings", "sets": 3, "reps": "15", "rest_seconds": 60},
                {"name": "Rowing Machine", "sets": 1, "reps": "10min", "rest_seconds": 60},
                {"name": "Push-ups", "sets": 3, "reps": "15", "rest_seconds": 60},
                {"name": "Dumbbell Thrusters", "sets": 3, "reps": "12", "rest_seconds": 60},
            ]
        },
        {"day": "Sunday", "focus": "core", "exercises": []} # Rest
    ],
    ("gym", "weight_loss"): [
        {
            "day": "Monday",
            "focus": "chest",
            "exercises": [
                {"name": "Bench Press", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Incline Dumbbell Press", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Push-ups", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Tricep Dips", "sets": 3, "reps": "12", "rest_seconds": 45},
            ]
        },
        {
            "day": "Tuesday",
            "focus": "back",
            "exercises": [
                {"name": "Pull-ups", "sets": 3, "reps": "10", "rest_seconds": 45},
                {"name": "Barbell Rows", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Lat Pulldown", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Barbell Curls", "sets": 3, "reps": "15", "rest_seconds": 45},
            ]
        },
        {
            "day": "Wednesday",
            "focus": "core",
            "exercises": [
                {"name": "Kettlebell Swings", "sets": 4, "reps": "20", "rest_seconds": 45},
                {"name": "Rowing Machine HIIT", "sets": 4, "reps": "2min", "rest_seconds": 45},
                {"name": "Box Jumps", "sets": 4, "reps": "15", "rest_seconds": 45},
            ]
        },
        {
            "day": "Thursday",
            "focus": "legs",
            "exercises": [
                {"name": "Squats", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Leg Press", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Lunges", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Leg Curls", "sets": 3, "reps": "15", "rest_seconds": 45},
            ]
        },
        {
            "day": "Friday",
            "focus": "shoulders",
            "exercises": [
                {"name": "Overhead Press", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Lateral Raises", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Front Raises", "sets": 3, "reps": "15", "rest_seconds": 45},
            ]
        },
        {
            "day": "Saturday",
            "focus": "full_body",
            "exercises": [
                {"name": "Deadlift", "sets": 3, "reps": "10", "rest_seconds": 45},
                {"name": "Push-ups", "sets": 3, "reps": "20", "rest_seconds": 45},
                {"name": "Kettlebell Swings", "sets": 3, "reps": "20", "rest_seconds": 45},
                {"name": "Dumbbell Thrusters", "sets": 3, "reps": "15", "rest_seconds": 45},
            ]
        },
        {"day": "Sunday", "focus": "core", "exercises": []} # Rest
    ],

    # ─── MINIMAL PLANS ────────────────────────────────────────────────────────
    ("minimal", "muscle_gain"): [
        {
            "day": "Monday",
            "focus": "chest",
            "exercises": [
                {"name": "Dumbbell Press", "sets": 4, "reps": "10", "rest_seconds": 60},
                {"name": "Dumbbell Flyes", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Push-ups", "sets": 3, "reps": "15", "rest_seconds": 60},
                {"name": "Dumbbell Tricep Kickback", "sets": 3, "reps": "12", "rest_seconds": 60},
            ]
        },
        {
            "day": "Tuesday",
            "focus": "back",
            "exercises": [
                {"name": "Dumbbell Row", "sets": 4, "reps": "10", "rest_seconds": 60},
                {"name": "Pull-ups", "sets": 3, "reps": "8", "rest_seconds": 60},
                {"name": "Dumbbell Curl", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Hammer Curl", "sets": 3, "reps": "12", "rest_seconds": 60},
            ]
        },
        {"day": "Wednesday", "focus": "core", "exercises": []}, # Rest
        {
            "day": "Thursday",
            "focus": "legs",
            "exercises": [
                {"name": "Dumbbell Squat", "sets": 4, "reps": "12", "rest_seconds": 60},
                {"name": "Dumbbell Lunge", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Dumbbell RDL", "sets": 3, "reps": "10", "rest_seconds": 60},
                {"name": "Calf Raises", "sets": 4, "reps": "15", "rest_seconds": 60},
            ]
        },
        {
            "day": "Friday",
            "focus": "shoulders",
            "exercises": [
                {"name": "Dumbbell Shoulder Press", "sets": 4, "reps": "10", "rest_seconds": 60},
                {"name": "Lateral Raise", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Front Raise", "sets": 3, "reps": "12", "rest_seconds": 60},
            ]
        },
        {
            "day": "Saturday",
            "focus": "full_body",
            "exercises": [
                {"name": "Dumbbell Thruster", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Renegade Row", "sets": 3, "reps": "10", "rest_seconds": 60},
                {"name": "Dumbbell Squat", "sets": 3, "reps": "15", "rest_seconds": 60},
                {"name": "Plank", "sets": 3, "reps": "45sec", "rest_seconds": 60},
            ]
        },
        {"day": "Sunday", "focus": "core", "exercises": []} # Rest
    ],
    ("minimal", "maintain"): [
        {
            "day": "Monday",
            "focus": "chest",
            "exercises": [
                {"name": "Dumbbell Press", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Dumbbell Flyes", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Dumbbell Tricep Kickback", "sets": 3, "reps": "12", "rest_seconds": 60},
            ]
        },
        {
            "day": "Tuesday",
            "focus": "back",
            "exercises": [
                {"name": "Dumbbell Row", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Dumbbell Curl", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Hammer Curl", "sets": 3, "reps": "12", "rest_seconds": 60},
            ]
        },
        {
            "day": "Wednesday",
            "focus": "core",
            "exercises": [
                {"name": "Shadow Boxing", "sets": 3, "reps": "3min", "rest_seconds": 60},
                {"name": "Mountain Climbers", "sets": 3, "reps": "45sec", "rest_seconds": 60},
                {"name": "Plank", "sets": 3, "reps": "60sec", "rest_seconds": 60},
            ]
        },
        {
            "day": "Thursday",
            "focus": "legs",
            "exercises": [
                {"name": "Dumbbell Squat", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Dumbbell Lunge", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Calf Raises", "sets": 3, "reps": "15", "rest_seconds": 60},
            ]
        },
        {
            "day": "Friday",
            "focus": "shoulders",
            "exercises": [
                {"name": "Dumbbell Shoulder Press", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Lateral Raise", "sets": 3, "reps": "15", "rest_seconds": 60},
                {"name": "Dumbbell Jacks", "sets": 3, "reps": "45sec", "rest_seconds": 60},
            ]
        },
        {
            "day": "Saturday",
            "focus": "full_body",
            "exercises": [
                {"name": "Dumbbell Thruster", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Renegade Row", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Dumbbell Squat", "sets": 3, "reps": "12", "rest_seconds": 60},
                {"name": "Plank", "sets": 3, "reps": "45sec", "rest_seconds": 60},
            ]
        },
        {"day": "Sunday", "focus": "core", "exercises": []} # Rest
    ],
    ("minimal", "weight_loss"): [
        {
            "day": "Monday",
            "focus": "chest",
            "exercises": [
                {"name": "Dumbbell Press", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Dumbbell Flyes", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Push-ups", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Dumbbell Tricep Kickback", "sets": 3, "reps": "15", "rest_seconds": 45},
            ]
        },
        {
            "day": "Tuesday",
            "focus": "back",
            "exercises": [
                {"name": "Dumbbell Row", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Pull-ups", "sets": 3, "reps": "10", "rest_seconds": 45},
                {"name": "Dumbbell Curl", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Hammer Curl", "sets": 3, "reps": "15", "rest_seconds": 45},
            ]
        },
        {
            "day": "Wednesday",
            "focus": "core",
            "exercises": [
                {"name": "Dumbbell Thruster", "sets": 4, "reps": "15", "rest_seconds": 45},
                {"name": "Renegade Row", "sets": 4, "reps": "12", "rest_seconds": 45},
                {"name": "Dumbbell Jacks", "sets": 4, "reps": "45sec", "rest_seconds": 45},
            ]
        },
        {
            "day": "Thursday",
            "focus": "legs",
            "exercises": [
                {"name": "Dumbbell Squat", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Dumbbell Lunge", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Dumbbell RDL", "sets": 3, "reps": "12", "rest_seconds": 45},
                {"name": "Calf Raises", "sets": 3, "reps": "20", "rest_seconds": 45},
            ]
        },
        {
            "day": "Friday",
            "focus": "shoulders",
            "exercises": [
                {"name": "Dumbbell Shoulder Press", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Lateral Raise", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Front Raise", "sets": 3, "reps": "15", "rest_seconds": 45},
            ]
        },
        {
            "day": "Saturday",
            "focus": "full_body",
            "exercises": [
                {"name": "Dumbbell Thruster", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Renegade Row", "sets": 3, "reps": "12", "rest_seconds": 45},
                {"name": "Dumbbell Squat", "sets": 3, "reps": "15", "rest_seconds": 45},
                {"name": "Plank", "sets": 3, "reps": "60sec", "rest_seconds": 45},
            ]
        },
        {"day": "Sunday", "focus": "core", "exercises": []} # Rest
    ]
}


def _generate_plan(goal: str, activity_level: str, equipment: str) -> list:
    """Look up plan in PLANS_DB, normalizing parameters."""
    eq = equipment.lower().strip()
    g = goal.lower().strip()
    
    # Normalize synonyms
    if g == "weight_gain":
        g = "muscle_gain"
    elif g == "fat_loss":
        g = "weight_loss"
        
    return PLANS_DB.get((eq, g), PLANS_DB[("bodyweight", "maintain")])


class WorkoutPlanRequest(BaseModel):
    equipment: str = "bodyweight"


class WorkoutLogRequest(BaseModel):
    exercise_name: str
    date: str = ""
    sets: int = Field(default=0, ge=0)
    reps: int = Field(default=0, ge=0)
    weight_kg: float = Field(default=0.0, ge=0.0)
    duration_minutes: int = Field(default=0, ge=0)
    calories_burned: int = Field(default=0, ge=0)
    notes: str = ""
    avg_form_score: float = Field(default=0.0, ge=0.0, le=100.0)


@router.get("/exercises")
def get_exercises(muscle_group: str = "", equipment: str = ""):
    results = ALL_EXERCISES
    if muscle_group:
        results = [ex for ex in results if ex["muscle_group"] == muscle_group]
    if equipment:
        results = [ex for ex in results if ex["equipment"] == equipment]
    return {"status": "success", "exercises": results}


@router.get("/plans")
def get_workout_plan(current_user_id: int = Depends(require_user_id), db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute(
        "SELECT * FROM workout_plans WHERE user_id = ? ORDER BY week_start_date DESC LIMIT 1",
        (current_user_id,),
    )
    row = cursor.fetchone()
    if not row:
        return {"status": "success", "plan": None}
    return {"status": "success", "plan": dict(row)}


@router.post("/plans")
def generate_workout_plan(req: WorkoutPlanRequest, current_user_id: int = Depends(require_user_id), db: sqlite3.Connection = Depends(get_db)):
    from crud import get_user

    user = get_user(db, current_user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    goal = user.get("goal", "maintain")
    activity_level = user.get("activity_level", "moderate")

    today = datetime.utcnow()
    monday = today - timedelta(days=today.weekday())
    week_start = monday.strftime("%Y-%m-%d")

    plan = _generate_plan(goal, activity_level, req.equipment)

    cursor = db.cursor()
    cursor.execute(
        "DELETE FROM workout_plans WHERE user_id = ? AND week_start_date = ?",
        (current_user_id, week_start),
    )
    cursor.execute(
        "INSERT INTO workout_plans (user_id, week_start_date, plan_json) VALUES (?, ?, ?)",
        (current_user_id, week_start, json.dumps(plan)),
    )
    db.commit()

    return {"status": "success", "plan": {"plan_json": json.dumps(plan), "week_start_date": week_start}}


@router.get("/plan")
def get_single_workout_plan(
    equipment: str = Query("bodyweight"),
    goal: str = Query("maintain"),
    current_user_id: int = Depends(require_user_id)
):
    """
    Get a specific workout plan based on BOTH equipment and goal parameters.
    """
    eq = equipment.lower().strip()
    g = goal.lower().strip()
    
    # Normalize synonyms
    if g == "weight_gain":
        g = "muscle_gain"
    elif g == "fat_loss":
        g = "weight_loss"
        
    plan = PLANS_DB.get((eq, g), None)
    if not plan:
        raise HTTPException(
            status_code=404, 
            detail=f"Workout plan not found for equipment '{equipment}' and goal '{goal}'"
        )
        
    return {"status": "success", "plan": plan}


class WorkoutLogEntry(BaseModel):
    id: int
    date: str
    exercise_name: str
    sets: int
    reps: int
    weight_kg: float
    duration_minutes: int
    calories_burned: int
    notes: str
    created_at: str


def _get_post_workout_foods(diet_type: str, preferred_state: str) -> list[dict]:
    """Return 3 post-workout food suggestions based on user diet and region."""
    suggestions = []

    if diet_type in ("veg", "eggetarian", "any", "both"):
        veg_options = [
            {"name": "Curd Rice", "calories": 320, "protein": 12, "carbs": 45, "fat": 8},
            {"name": "Peanut Chutney + Idli", "calories": 280, "protein": 10, "carbs": 42, "fat": 6},
            {"name": "Buttermilk + Banana", "calories": 180, "protein": 6, "carbs": 35, "fat": 2},
            {"name": "Paneer Wrap", "calories": 380, "protein": 22, "carbs": 28, "fat": 18},
            {"name": "Soybean Curry + Rice", "calories": 350, "protein": 20, "carbs": 40, "fat": 10},
            {"name": "Egg Curry + Roti", "calories": 340, "protein": 18, "carbs": 32, "fat": 14},
        ]

        state_options = {
            "Tamil Nadu": [
                {"name": "Curd Rice with Pomegranate", "calories": 340, "protein": 14, "carbs": 48, "fat": 8},
                {"name": "Ragi Porridge with Nuts", "calories": 290, "protein": 10, "carbs": 50, "fat": 6},
            ],
            "Kerala": [
                {"name": "Banana + Coconut Milk", "calories": 260, "protein": 4, "carbs": 40, "fat": 12},
                {"name": "Puttu + Kadala Curry", "calories": 380, "protein": 16, "carbs": 52, "fat": 10},
            ],
            "Punjab": [
                {"name": "Chana Masala + Rice", "calories": 400, "protein": 18, "carbs": 55, "fat": 10},
                {"name": "Lassi + Paratha", "calories": 420, "protein": 14, "carbs": 48, "fat": 18},
            ],
            "Maharashtra": [
                {"name": "Poha with Peanuts", "calories": 310, "protein": 8, "carbs": 48, "fat": 10},
                {"name": "Sabudana Khichdi", "calories": 350, "protein": 6, "carbs": 52, "fat": 12},
            ],
        }

        if preferred_state and preferred_state in state_options:
            suggestions.extend(state_options[preferred_state])

        while len(suggestions) < 3:
            for opt in veg_options:
                if opt not in suggestions:
                    suggestions.append(opt)
                    if len(suggestions) >= 3:
                        break

    else:
        nonveg_options = [
            {"name": "Grilled Chicken Wrap", "calories": 420, "protein": 35, "carbs": 30, "fat": 14},
            {"name": "Fish Curry + Rice", "calories": 380, "protein": 28, "carbs": 42, "fat": 10},
            {"name": "Egg Omelette + Toast", "calories": 310, "protein": 24, "carbs": 20, "fat": 16},
            {"name": "Chicken Salad", "calories": 290, "protein": 30, "carbs": 12, "fat": 12},
        ]
        suggestions = nonveg_options[:3]

    return suggestions[:3]


@router.post("/log")
def log_workout(log: WorkoutLogRequest, current_user_id: int = Depends(require_user_id), db: sqlite3.Connection = Depends(get_db)):
    from crud import get_user

    date_str = log.date or datetime.utcnow().strftime("%Y-%m-%d")
    cursor = db.cursor()
    cursor.execute(
        "INSERT INTO workout_logs (user_id, date, exercise_name, sets, reps, weight_kg, duration_minutes, calories_burned, notes) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (current_user_id, date_str, log.exercise_name, log.sets, log.reps,
         log.weight_kg, log.duration_minutes, log.calories_burned, log.notes),
    )
    db.commit()

    user = get_user(db, current_user_id)
    diet_type = user.get("diet_type", "any") if user else "any"
    preferred_state = user.get("preferred_state", "") if user else ""

    foods = _get_post_workout_foods(diet_type, preferred_state)

    extra_calories = log.calories_burned
    extra_protein = max(10, log.calories_burned // 30)

    return {
        "status": "success",
        "message": "Workout logged",
        "id": cursor.lastrowid,
        "post_workout_foods": foods,
        "extra_calories": extra_calories,
        "extra_protein": extra_protein,
    }


@router.get("/logs")
def get_workout_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    start_date: str = "",
    end_date: str = "",
    current_user_id: int = Depends(require_user_id),
    db: sqlite3.Connection = Depends(get_db),
):
    cursor = db.cursor()
    conditions = ["user_id = ?"]
    params: list = [current_user_id]
    if start_date:
        conditions.append("date >= ?")
        params.append(start_date)
    if end_date:
        conditions.append("date <= ?")
        params.append(end_date)
    where = " AND ".join(conditions)
    offset = (page - 1) * per_page

    cursor.execute(f"SELECT COUNT(*) AS cnt FROM workout_logs WHERE {where}", params)
    total = cursor.fetchone()["cnt"]

    cursor.execute(
        f"SELECT * FROM workout_logs WHERE {where} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?",
        params + [per_page, offset],
    )
    logs = [dict(row) for row in cursor.fetchall()]

    return {
        "status": "success",
        "logs": logs,
        "total": total,
        "page": page,
        "per_page": per_page,
    }
