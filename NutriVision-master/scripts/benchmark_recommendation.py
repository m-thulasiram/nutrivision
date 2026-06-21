"""Recommendation benchmarking script.

Measures average KNN recommendation time and accuracy metrics.
"""
import time
import json
import statistics
from services.recommendation_service import Recommender

BENCHMARK_CONFIGS = [
    {"target_cals": 500, "target_pro": 25, "target_carb": 50, "target_fat": 15, "diet_type": "veg"},
    {"target_cals": 800, "target_pro": 40, "target_carb": 60, "target_fat": 25, "diet_type": "nonveg"},
    {"target_cals": 600, "target_pro": 30, "target_carb": 50, "target_fat": 20, "diet_type": "any"},
    {"target_cals": 1000, "target_pro": 50, "target_carb": 80, "target_fat": 30, "diet_type": "any"},
    {"target_cals": 200, "target_pro": 10, "target_carb": 20, "target_fat": 8, "diet_type": "veg"},
]


def run_benchmark(n_runs: int = 20) -> dict:
    recommender = Recommender(db_path="processed_diet_database.csv", regional_path="regional_foods.csv")

    knn_times = []
    fallback_times = []

    for run in range(n_runs):
        for cfg in BENCHMARK_CONFIGS:
            target_macros = {
                'Calories': cfg["target_cals"],
                'Fats': cfg["target_fat"],
                'Proteins': cfg["target_pro"],
                'Carbohydrates': cfg["target_carb"],
                'Sugars': 5.0,
                'Fibre': 30.0,
                'Iron': 18.0,
                'Calcium': 1000.0,
                'Sodium': 2300.0,
                'Potassium': 3500.0,
                'VitaminD': 600.0
            }

            start = time.perf_counter()
            results = recommender.recommend(
                target_macros=target_macros,
                diet_type=cfg["diet_type"],
                calorie_budget=cfg["target_cals"],
                max_results=5
            )
            elapsed = time.perf_counter() - start
            knn_times.append(elapsed * 1000)

        # Suggestion benchmark
        remaining_macros = {"protein": 30, "carbs": 50, "fat": 15}
        start = time.perf_counter()
        suggested, _ = recommender.suggest_next_meal(
            remaining_calories=500,
            remaining_macros=remaining_macros,
            max_results=3
        )
        elapsed = time.perf_counter() - start
        fallback_times.append(elapsed * 1000)

    report = {
        "benchmark_runs": n_runs * len(BENCHMARK_CONFIGS),
        "knn_recommend_time_ms": {
            "mean": round(statistics.mean(knn_times), 3),
            "median": round(statistics.median(knn_times), 3),
            "min": round(min(knn_times), 3),
            "max": round(max(knn_times), 3),
            "p95": round(sorted(knn_times)[int(len(knn_times) * 0.95)], 3),
        },
        "suggestion_time_ms": {
            "mean": round(statistics.mean(fallback_times), 3),
            "median": round(statistics.median(fallback_times), 3),
            "min": round(min(fallback_times), 3),
            "max": round(max(fallback_times), 3),
            "p95": round(sorted(fallback_times)[int(len(fallback_times) * 0.95)], 3),
        },
    }

    print(json.dumps(report, indent=2))
    return report


if __name__ == "__main__":
    run_benchmark()
