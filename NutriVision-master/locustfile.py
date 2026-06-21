"""Locust load test for NutriVision API.

Usage:
  locust -f locustfile.py --host http://localhost:8000
  locust -f locustfile.py --host http://localhost:8000 --users 500 --spawn-rate 50 --run-time 5m --headless --csv=results
"""
from locust import HttpUser, task, between, tag


class NutriVisionUser(HttpUser):
    wait_time = between(0.5, 2.0)
    token = None

    def on_start(self):
        self.register_and_login()

    def register_and_login(self):
        import uuid
        self.username = f"loadtest_{uuid.uuid4().hex[:8]}"
        self.password = "testpass123"
        with self.client.post("/api/auth/register", json={
            "name": self.username,
            "password": self.password,
            "age": 30,
            "gender": "male",
            "height_cm": 175,
            "weight_kg": 70,
            "activity_level": "moderate",
            "goal": "maintain"
        }, catch_response=True) as resp:
            if resp.status_code == 200:
                self.token = resp.json()["token"]
            elif resp.status_code == 409:
                self.login()

    def login(self):
        with self.client.post("/api/auth/login", json={
            "email": self.username,
            "password": self.password
        }, catch_response=True) as resp:
            if resp.status_code == 200:
                self.token = resp.json()["token"]

    @tag("health")
    @task(1)
    def health_check(self):
        self.client.get("/health")

    @tag("auth")
    @task(3)
    def get_profile(self):
        if not self.token:
            return
        self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {self.token}"})

    @tag("recommend")
    @task(5)
    def recommend(self):
        self.client.post("/api/recommend", json={
            "target_cals": 500,
            "target_pro": 25,
            "target_carb": 50,
            "target_fat": 15,
            "diet_type": "any"
        })

    @tag("recommend")
    @task(3)
    def next_meal_suggestion(self):
        if not self.token:
            return
        headers = {"Authorization": f"Bearer {self.token}"}
        self.client.get(f"/api/auth/me", headers=headers)

    @tag("foods")
    @task(2)
    def list_regions(self):
        self.client.get("/api/foods/regions")

    @tag("foods")
    @task(2)
    def list_states(self):
        self.client.get("/api/foods/states")

    @tag("foods")
    @task(1)
    def foods_by_region(self):
        self.client.get("/api/foods/by-region/South India")

    @tag("metrics")
    @task(1)
    def get_metrics(self):
        self.client.get("/metrics")
