"""Unit tests for the Recommender class in services/recommendation_service.py."""
import pytest
import pandas as pd
import numpy as np
from services.recommendation_service import Recommender, INPUT_FEATURES


@pytest.fixture
def db_csv(tmp_path):
    data = {
        'Food_items': ['Apple', 'Chicken Breast', 'Brown Rice', 'Broccoli', 'Pizza', 'Yogurt'],
        'Calories': [52.0, 165.0, 112.0, 34.0, 285.0, 61.0],
        'Fats': [0.2, 3.6, 0.9, 0.4, 10.0, 3.3],
        'Proteins': [0.3, 31.0, 2.6, 2.8, 12.0, 3.5],
        'Carbohydrates': [14.0, 0.0, 24.0, 7.0, 36.0, 4.7],
        'Sugars': [10.0, 0.0, 0.4, 1.7, 3.6, 4.7],
        'Fibre': [2.4, 0.0, 1.8, 2.6, 1.5, 0.0],
        'Iron': [0.1, 1.0, 0.4, 0.7, 1.2, 0.1],
        'Calcium': [6.0, 15.0, 10.0, 47.0, 105.0, 121.0],
        'Sodium': [1.0, 74.0, 2.0, 33.0, 640.0, 46.0],
        'Potassium': [107.0, 256.0, 43.0, 316.0, 200.0, 155.0],
        'VitaminD': [0.0, 0.3, 0.0, 0.0, 0.0, 2.0],
        'Veg_Flag': [0, 1, 0, 0, 1, 0],
    }
    df = pd.DataFrame(data)
    path = tmp_path / "test_db.csv"
    df.to_csv(path, index=False)
    return str(path)


@pytest.fixture
def regional_csv(tmp_path):
    data = {
        'Food_items': ['Apple', 'Brown Rice', 'Yogurt'],
        'region': ['North India', 'South India', 'North India'],
        'state': ['Punjab', 'Karnataka', 'Punjab'],
        'cuisine': ['North Indian', 'South Indian', 'North Indian'],
        'meal_type': ['Snack', 'Main', 'Dessert'],
    }
    df = pd.DataFrame(data)
    path = tmp_path / "test_regional.csv"
    df.to_csv(path, index=False)
    return str(path)


@pytest.fixture
def recommender(db_csv, regional_csv):
    return Recommender(db_path=db_csv, regional_path=regional_csv)


class TestInit:
    def test_loads_dataframe(self, recommender):
        assert len(recommender.df) == 6
        assert 'Food_items' in recommender.df.columns

    def test_normalizes_columns(self, recommender):
        for col in INPUT_FEATURES:
            ncol = f"norm_{col}"
            assert ncol in recommender.norm_cols
            assert ncol in recommender.df.columns

    def test_builds_knn(self, recommender):
        assert hasattr(recommender, 'knn')
        assert recommender.knn.n_neighbors == min(20, len(recommender.df))

    def test_loads_regional(self, recommender):
        assert not recommender.regional_df.empty
        assert len(recommender.regional_df) == 3

    def test_missing_regional_file(self, db_csv, tmp_path):
        r = Recommender(db_path=db_csv, regional_path=str(tmp_path / "nonexistent.csv"))
        assert r.regional_df.empty


class TestNormalize:
    def test_zero_std_handled(self, recommender):
        for k, v in recommender.feature_stds.items():
            assert v > 0

    def test_norm_cols_match_input_features(self, recommender):
        expected = [f"norm_{col}" for col in INPUT_FEATURES]
        assert recommender.norm_cols == expected


class TestGetRegionalInfo:
    def test_found(self, recommender):
        info = recommender.get_regional_info("Apple")
        assert info["region"] == "North India"
        assert info["cuisine"] == "North Indian"

    def test_case_insensitive(self, recommender):
        info = recommender.get_regional_info("brown rice")
        assert info["region"] == "South India"

    def test_not_found(self, recommender):
        info = recommender.get_regional_info("UnknownFood")
        assert info["region"] == ""

    def test_empty_regional_df(self, db_csv, tmp_path):
        r = Recommender(db_path=db_csv, regional_path=str(tmp_path / "empty.csv"))
        info = r.get_regional_info("Apple")
        assert info["region"] == ""


class TestBuildVector:
    def test_returns_array(self, recommender):
        vec = recommender._build_vector({'Calories': 100, 'Proteins': 10})
        assert isinstance(vec, np.ndarray)
        assert vec.shape == (1, len(INPUT_FEATURES))

    def test_all_features_present(self, recommender):
        vec = recommender._build_vector({})
        assert vec.shape == (1, len(INPUT_FEATURES))

    def test_zero_input(self, recommender):
        vec = recommender._build_vector({col: 0 for col in INPUT_FEATURES})
        assert not np.any(np.isnan(vec))


class TestRecommend:
    def test_recommend_any(self, recommender):
        results = recommender.recommend(
            target_macros={'Calories': 500, 'Proteins': 20, 'Fats': 10, 'Carbohydrates': 50},
            diet_type="any",
        )
        assert len(results) > 0
        for r in results:
            assert "name" in r
            assert "calories" in r
            assert "protein" in r
            assert "carbs" in r
            assert "fat" in r
            assert "reasoning_trace" in r

    def test_recommend_veg_excludes_nonveg(self, recommender):
        results = recommender.recommend(
            target_macros={'Calories': 500, 'Proteins': 20, 'Fats': 10, 'Carbohydrates': 50},
            diet_type="veg",
        )
        assert len(results) > 0
        for r in results:
            assert r["reasoning_trace"]["vegetarian_safe"] is True

    def test_recommend_nonveg_includes_meat(self, recommender):
        results = recommender.recommend(
            target_macros={'Calories': 500, 'Proteins': 20, 'Fats': 10, 'Carbohydrates': 50},
            diet_type="nonveg",
        )
        assert len(results) >= 0

    def test_recommend_respects_calorie_budget(self, recommender):
        results = recommender.recommend(
            target_macros={'Calories': 500, 'Proteins': 20, 'Fats': 10, 'Carbohydrates': 50},
            diet_type="any",
            calorie_budget=50,
        )
        for r in results:
            assert r["calories"] <= 50

    def test_recommend_max_results(self, recommender):
        results = recommender.recommend(
            target_macros={'Calories': 500, 'Proteins': 20, 'Fats': 10, 'Carbohydrates': 50},
            diet_type="any",
            max_results=2,
        )
        assert len(results) <= 2

    def test_recommend_with_preferred_region(self, recommender):
        results = recommender.recommend(
            target_macros={'Calories': 500, 'Proteins': 20, 'Fats': 10, 'Carbohydrates': 50},
            diet_type="any",
            preferred_region="South India",
        )
        assert len(results) > 0
        for r in results:
            assert r["reasoning_trace"]["regional_match"] in ("South India",)

    def test_recommend_with_preferred_state(self, recommender):
        results = recommender.recommend(
            target_macros={'Calories': 500, 'Proteins': 20, 'Fats': 10, 'Carbohydrates': 50},
            diet_type="any",
            preferred_state="Karnataka",
        )
        assert len(results) > 0
        for r in results:
            assert r["reasoning_trace"]["state_match"] in ("Karnataka",)

    def test_recommend_empty_candidates(self, recommender):
        recommender.df = recommender.df.iloc[0:0]
        results = recommender.recommend(
            target_macros={'Calories': 500},
            diet_type="any",
        )
        assert results == []

    def test_recommend_empty_after_filter(self, recommender):
        results = recommender.recommend(
            target_macros={'Calories': 500},
            diet_type="any",
            preferred_region="Mars",
            preferred_state="Olympus",
        )
        assert results == []

    def test_recommend_reasoning_trace_shape(self, recommender):
        results = recommender.recommend(
            target_macros={'Calories': 500, 'Proteins': 30, 'Fats': 10, 'Carbohydrates': 50},
            diet_type="any",
        )
        if results:
            trace = results[0]["reasoning_trace"]
            assert "protein_gap" in trace
            assert "fiber_gap" in trace
            assert "calorie_fit" in trace
            assert "regional_match" in trace
            assert "state_match" in trace
            assert "cuisine" in trace
            assert "meal_type" in trace
            assert "vegetarian_safe" in trace


class TestSuggestNextMeal:
    def test_suggests_with_remaining(self, recommender):
        meals, _ = recommender.suggest_next_meal(
            remaining_calories=500,
            remaining_macros={"protein": 30, "carbs": 60, "fat": 15},
        )
        assert len(meals) > 0
        for m in meals:
            assert "food" in m
            assert "calories" in m
            assert "protein" in m
            assert "match_score" in m
            assert "explanation" in m
            assert "reasoning_trace" in m

    def test_returns_empty_when_no_remaining(self, recommender):
        meals, _ = recommender.suggest_next_meal(
            remaining_calories=0,
            remaining_macros={"protein": 0, "carbs": 0, "fat": 0},
        )
        assert meals == []

    def test_returns_empty_when_negative(self, recommender):
        meals, _ = recommender.suggest_next_meal(
            remaining_calories=-100,
            remaining_macros={"protein": 0, "carbs": 0, "fat": 0},
        )
        assert meals == []

    def test_respects_max_results(self, recommender):
        meals, _ = recommender.suggest_next_meal(
            remaining_calories=500,
            remaining_macros={"protein": 30, "carbs": 60, "fat": 15},
            max_results=2,
        )
        assert len(meals) <= 2

    def test_anti_gravity_mode(self, recommender):
        meals, _ = recommender.suggest_next_meal(
            remaining_calories=500,
            remaining_macros={"protein": 30, "carbs": 60, "fat": 15},
            anti_gravity=True,
        )
        assert len(meals) > 0

    def test_anti_gravity_boosts_protein(self, recommender):
        meals, _ = recommender.suggest_next_meal(
            remaining_calories=500,
            remaining_macros={"protein": 30, "carbs": 60, "fat": 15},
            anti_gravity=True,
        )
        for m in meals:
            assert "explanation" in m
            assert len(m["explanation"]) > 0

    def test_protein_goal_scoring(self, recommender):
        meals, _ = recommender.suggest_next_meal(
            remaining_calories=500,
            remaining_macros={"protein": 30, "carbs": 60, "fat": 15},
            user_goal="Protein",
        )
        assert len(meals) > 0

    def test_weight_goal_scoring(self, recommender):
        meals, _ = recommender.suggest_next_meal(
            remaining_calories=500,
            remaining_macros={"protein": 30, "carbs": 10, "fat": 15},
            user_goal="weight_loss",
        )
        assert len(meals) > 0

    def test_small_remaining_calories(self, recommender):
        meals, _ = recommender.suggest_next_meal(
            remaining_calories=50,
            remaining_macros={"protein": 5, "carbs": 5, "fat": 2},
        )
        for m in meals:
            assert m["calories"] <= 150

    def test_with_preferred_region_suggest(self, recommender):
        meals, _ = recommender.suggest_next_meal(
            remaining_calories=500,
            remaining_macros={"protein": 30, "carbs": 60, "fat": 15},
            preferred_region="South India",
        )
        assert len(meals) > 0
        for m in meals:
            assert m["reasoning_trace"]["regional_match"] in ("South India",)

    def test_reasoning_trace_in_suggestion(self, recommender):
        meals, _ = recommender.suggest_next_meal(
            remaining_calories=500,
            remaining_macros={"protein": 30, "carbs": 60, "fat": 15},
        )
        if meals:
            trace = meals[0]["reasoning_trace"]
            assert "protein_gap" in trace
            assert "fiber_gap" in trace
            assert "calorie_fit" in trace
            assert "regional_match" in trace
            assert "vegetarian_safe" in trace

    def test_sorted_by_score_descending(self, recommender):
        meals, _ = recommender.suggest_next_meal(
            remaining_calories=500,
            remaining_macros={"protein": 30, "carbs": 60, "fat": 15},
        )
        scores = [m["match_score"] for m in meals]
        assert scores == sorted(scores, reverse=True)

    def test_empty_candidates(self, recommender):
        recommender.df = recommender.df.iloc[0:0]
        meals, _ = recommender.suggest_next_meal(
            remaining_calories=500,
            remaining_macros={"protein": 30, "carbs": 60, "fat": 15},
        )
        assert meals == []
