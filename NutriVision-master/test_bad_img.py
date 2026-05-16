import requests
import json

print("\n--- Testing Bad Image (OOD Image Fallback) ---")
try:
    with open("bad_image.jpg", "rb") as f:
        res = requests.post(
            "http://localhost:8000/api/analyze-meal",
            params={"user_id": 1},
            files={"image": ("bad.jpg", f, "image/jpeg")}
        )
    print("Status Code:", res.status_code)
    print("Response JSON:")
    print(json.dumps(res.json(), indent=2))
except Exception as e:
    print("Error:", e)
