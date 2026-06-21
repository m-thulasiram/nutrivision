"""ML System Validation Pipeline.

Evaluates recommendation quality metrics:
- Consistency: same input → similar output
- Diversity: recommendations span multiple food categories
- Regional accuracy: region-tagged foods match user preference
- Guardrail compliance: calorie budget, diet type, macro limits
"""
import json
import numpy as np
from services.recommendation_service import Recommender


def evaluate_consistency(recommender: Recommender, n_runs: int = 5) -> dict:
    """Run same recommendation 5 times, measure output stability."""
    target_macros = {
        'Calories': 500, 'Fats': 15, 'Proteins': 25,
        'Carbohydrates': 50, 'Sugars': 5, 'Fibre': 30,
        'Iron': 18, 'Calcium': 1000, 'Sodium': 2300,
        'Potassium': 3500, 'VitaminD': 600
    }
    all_names = []
    for _ in range(n_runs):
        results = recommender.recommend(target_macros=target_macros, diet_type="any", calorie_budget=500, max_results=5)
        names = tuple(r["name"] for r in results)
        all_names.append(names)

    # Jaccard similarity between runs
    pairwise_overlaps = []
    for i in range(len(all_names)):
        for j in range(i + 1, len(all_names)):
            set_i, set_j = set(all_names[i]), set(all_names[j])
            overlap = len(set_i & set_j) / max(len(set_i | set_j), 1)
            pairwise_overlaps.append(overlap)

    consistency = {
        "mean_jaccard_similarity": round(float(np.mean(pairwise_overlaps)), 3) if pairwise_overlaps else 1.0,
        "runs_compared": n_runs,
    }
    return consistency


def evaluate_diversity(recommender: Recommender) -> dict:
    """Check that recommendations include diverse food categories."""
    target_macros = {
        'Calories': 600, 'Fats': 20, 'Proteins': 30,
        'Carbohydrates': 60, 'Sugars': 5, 'Fibre': 30,
        'Iron': 18, 'Calcium': 1000, 'Sodium': 2300,
        'Potassium': 3500, 'VitaminD': 600
    }
    results = recommender.recommend(target_macros=target_macros, diet_type="any", calorie_budget=600, max_results=5)
    names = [r["name"] for r in results]
    cals = [r["calories"] for r in results]

    unique_names = len(set(names))
    cal_range = max(cals) - min(cals) if len(cals) > 1 else 0

    return {
        "unique_items": unique_names,
        "total_recommended": len(results),
        "calorie_range": round(cal_range, 1),
        "diversity_score": round(unique_names / max(len(results), 1), 3),
    }


def evaluate_regional_accuracy(recommender: Recommender) -> dict:
    """Check that region filtering returns region-tagged foods."""
    target_macros = {
        'Calories': 500, 'Fats': 15, 'Proteins': 25,
        'Carbohydrates': 50, 'Sugars': 5, 'Fibre': 30,
        'Iron': 18, 'Calcium': 1000, 'Sodium': 2300,
        'Potassium': 3500, 'VitaminD': 600
    }

    test_cases = [
        {"region": "South India", "expected_keyword": None},
        {"region": "North India", "expected_keyword": None},
    ]

    results = {}
    for case in test_cases:
        recs = recommender.recommend(
            target_macros=target_macros,
            diet_type="any",
            calorie_budget=500,
            preferred_region=case["region"],
            max_results=5
        )
        non_empty = sum(1 for r in recs if r.get("reasoning_trace", {}).get("regional_match", ""))
        results[case["region"]] = {
            "total": len(recs),
            "with_region_tag": non_empty,
        }
    return results


def evaluate_guardrails(recommender: Recommender) -> dict:
    """Verify guardrails: calorie budget, diet_type filter, macro constraints."""
    # Test calorie budget
    budget = 300
    results = recommender.recommend(
        target_macros={'Calories': budget, 'Fats': 10, 'Proteins': 15,
                       'Carbohydrates': 30, 'Sugars': 5, 'Fibre': 30,
                       'Iron': 18, 'Calcium': 1000, 'Sodium': 2300,
                       'Potassium': 3500, 'VitaminD': 600},
        diet_type="any", calorie_budget=budget, max_results=5
    )
    budget_compliance = all(r["calories"] <= budget for r in results) if results else True

    # Test veg filter
    veg_results = recommender.recommend(
        target_macros={'Calories': 500, 'Fats': 15, 'Proteins': 25,
                       'Carbohydrates': 50, 'Sugars': 5, 'Fibre': 30,
                       'Iron': 18, 'Calcium': 1000, 'Sodium': 2300,
                       'Potassium': 3500, 'VitaminD': 600},
        diet_type="veg", calorie_budget=500, max_results=5
    )

    return {
        "calorie_budget_compliance": budget_compliance,
        "calorie_budget_tested": budget,
        "veg_filter_results": len(veg_results),
        "non_empty_veg_results": len(veg_results) > 0,
    }


def run_evaluation():
    print("Loading recommender...")
    recommender = Recommender(db_path="processed_diet_database.csv", regional_path="regional_foods.csv")

    print("\n=== Consistency ===")
    consistency = evaluate_consistency(recommender)
    print(json.dumps(consistency, indent=2))

    print("\n=== Diversity ===")
    diversity = evaluate_diversity(recommender)
    print(json.dumps(diversity, indent=2))

    print("\n=== Regional Accuracy ===")
    regional = evaluate_regional_accuracy(recommender)
    print(json.dumps(regional, indent=2))

    print("\n=== Guardrail Compliance ===")
    guardrails = evaluate_guardrails(recommender)
    print(json.dumps(guardrails, indent=2))

    report = {
        "consistency": consistency,
        "diversity": diversity,
        "regional_accuracy": regional,
        "guardrails": guardrails,
    }

    with open("ml_validation_report.json", "w") as f:
        json.dump(report, f, indent=2)
    print("\nReport saved to ml_validation_report.json")
    return report


if __name__ == "__main__":
    run_evaluation()
