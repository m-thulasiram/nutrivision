import requests
import base64
import io
import time
from PIL import Image
import random

BASE_URL = "https://nutrivision-1-1kwu.onrender.com"

# 1. Register a test user
email = f"test_{random.randint(1000, 9999)}@example.com"
print(f"Registering user: {email}...")
reg_resp = requests.post(f"{BASE_URL}/api/auth/register", json={
    "name": "DiagUser",
    "email": email,
    "password": "diagpassword123",
    "age": 25,
    "gender": "Female",
    "height_cm": 165,
    "weight_kg": 55,
    "activity_level": "light",
    "goal": "maintain",
    "diet_type": "any"
})

if reg_resp.status_code != 200:
    print(f"Registration failed: {reg_resp.status_code} - {reg_resp.text}")
    exit(1)

token = reg_resp.json()["token"]
headers = {"Authorization": f"Bearer {token}"}
print("Registration success! Token acquired.")

# 2. Compress biryani.jpg and convert to base64
img = Image.open("biryani.jpg")
img.thumbnail((256, 256))
buf = io.BytesIO()
img.save(buf, format="JPEG", quality=75)
b64_data = base64.b64encode(buf.getvalue()).decode("utf-8")
print(f"Compressed image size: {len(buf.getvalue()) / 1024:.2f} KB")

# 3. Call analyze endpoint
print("Sending scan request to Render backend...")
start_time = time.time()
scan_resp = requests.post(f"{BASE_URL}/api/analyze-meal-b64", json={
    "image_base64": b64_data
}, headers=headers)
duration = time.time() - start_time

print(f"Response Status: {scan_resp.status_code}")
print(f"Latency: {duration:.2f} seconds")
print("Response Body:")
print(scan_resp.text)
