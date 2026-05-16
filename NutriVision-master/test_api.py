import requests
import io
from PIL import Image

image = Image.new('RGB', (224, 224), color = (73, 109, 137))
img_byte_arr = io.BytesIO()
image.save(img_byte_arr, format='JPEG')
img_byte_arr.seek(0)

print("Sending request to /api/analyze-meal...")
response = requests.post(
    "http://localhost:8000/api/analyze-meal", 
    files={"image": ("test.jpg", img_byte_arr, "image/jpeg")}
)

print("Status Code:", response.status_code)
try:
    print("Response JSON:", response.json())
except Exception as e:
    print("Response Text:", response.text)
