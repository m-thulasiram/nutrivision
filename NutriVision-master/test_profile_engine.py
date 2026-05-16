import requests
import os
import json

base_url = "http://localhost:8000"

print("--- 1. Testing User Profile Creation ---")
profile_data = {
    "name": "Alex",
    "age": 28,
    "gender": "Male",
    "height_cm": 180.0,
    "weight_kg": 75.0,
    "activity_level": "active",
    "goal": "muscle_gain"
}

r1 = requests.post(f"{base_url}/api/users/profile", json=profile_data)
if r1.status_code == 200:
    print("Profile Output:", json.dumps(r1.json(), indent=2))
else:
    print("Error:", r1.text)

print("\n--- 2. Testing User Progress (Before Meal) ---")
r2 = requests.get(f"{base_url}/api/users/1/progress")
if r2.status_code == 200:
    print("Progress Output:", json.dumps(r2.json(), indent=2))
else:
    print("Error:", r2.text)

print("\n--- 3. Testing Analyze Meal (Portion Scaling & DB Log) ---")
# Finding an image to test
import glob
test_img = None
valid_dir = "C:/Users/M Thulasiram/.cache/kagglehub/datasets/josephvettom/food-image-dataset/versions/2/dataset/dataset/images/valid"
files = glob.glob(valid_dir + "/*.jpg")
if files:
    test_img = files[0]

if test_img:
    with open(test_img, "rb") as f:
        r3 = requests.post(
            f"{base_url}/api/analyze-meal",
            params={"user_id": 1},
            files={"image": ("meal.jpg", f, "image/jpeg")}
        )
    if r3.status_code == 200:
        res = r3.json()
        print("Detections & Areas:", json.dumps(res.get("detections", []), indent=2))
        print("Alerts:", json.dumps(res.get("alerts", []), indent=2))
        print("Inference Time:", res.get("inference_time_ms"))
    else:
        print("Error:", r3.text)

print("\n--- 4. Testing Recommendations (Goal Shifted) ---")
rec_data = {
    "target_cals": 500,
    "target_pro": 40,
    "target_carb": 50,
    "target_fat": 15,
    "diet_type": "nonveg",
    "user_id": 1
}
r4 = requests.post(f"{base_url}/api/recommend", json=rec_data)
if r4.status_code == 200:
    print("Recommendations:", json.dumps(r4.json(), indent=2))
else:
    print("Error:", r4.text)
