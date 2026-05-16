import requests
import os

# Test with a real image from validation set
valid_dir = "C:/Users/M Thulasiram/.cache/kagglehub/datasets/josephvettom/food-image-dataset/versions/2/dataset/dataset/images/valid"

# Try to find a chicken curry image
test_img = None
for root, dirs, files in os.walk(valid_dir):
    for f in files:
        if f.endswith(".jpg"):
            test_img = os.path.join(root, f)
            break
    if test_img:
        break

if test_img:
    print(f"Testing with image: {test_img}")
    with open(test_img, "rb") as f:
        response = requests.post(
            "http://localhost:8000/api/analyze-meal", 
            files={"image": ("test.jpg", f, "image/jpeg")}
        )
    print("Status:", response.status_code)
    try:
        print("JSON Output:", response.json())
    except:
        print("Text Output:", response.text)
else:
    print("Error: Could not find any test images.")
