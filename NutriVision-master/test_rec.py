import requests
import json

request_data = {
    "target_cals": 500,
    "target_pro": 25,
    "target_carb": 50,
    "target_fat": 15,
    "diet_type": "veg"
}

response = requests.post("http://localhost:8000/api/recommend", json=request_data)
print("Status Code:", response.status_code)
try:
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(response.text)
