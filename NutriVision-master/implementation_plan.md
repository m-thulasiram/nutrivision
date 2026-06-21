# Implementation Plan - Hybrid Food Recognition System

We will build the Hybrid Food Recognition System to map broad YOLO scanner categories to precise regional dishes from our 504-food database. This plan covers mapping, candidate selection APIs, and RAG integrations.

## User Review Required

> [!IMPORTANT]
> - **Super-Category Mappings**: We have successfully generated `food_super_categories.json` and `category_mapping.csv` mapping all 504 foods to 12 categories (Rice Dish, Chicken Dish, Fish Dish, Egg Dish, Dosa Variant, Idli Variant, Bread/Roti, Dal, Curry, Dessert, Snack, Beverage).
> - **Heuristic Scoring Weight**: Candidate dishes are scored using:
>   - $+50$ points for matching User Preferred State.
>   - $+25$ points for matching current Meal Type (Breakfast/Lunch/Dinner/Snack) based on the current hour.
>   - $+15$ points for matching macronutrient/health targets (e.g. high-protein if remaining protein target is large).
>
> Please confirm if you approve these scoring heuristics or would like us to modify the weights.

## Open Questions

> [!WARNING]
> - **YOLO Integration**: Should the new hybrid match endpoint be registered under a new `/api/scanner/match` route, or should we directly inject the category matching inside the existing Copilot `/api/copilot/chat` endpoint? (We propose creating a dedicated `/api/scanner/match` POST endpoint).

## Proposed Changes

### Backend Core

#### [NEW] [food_super_categories.json](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/food_super_categories.json)
- Store the static mapping list of categories to foods.

#### [NEW] [category_mapping.csv](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/category_mapping.csv)
- Store lookup mapping of every food name in the database to its broad super-category.

#### [NEW] [services/hybrid_scanner_service.py](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/services/hybrid_scanner_service.py)
- Implement `get_hybrid_candidates(detected_class: str, user_state: str, diet_type: str, hour: int, remaining_protein: float) -> list`:
  - Map `detected_class` (from the 20 YOLO names) to its `Super Category`.
  - Filter `expanded_food_database.csv` on `Super Category` and `VegNovVeg` eligibility.
  - Calculate priority scores based on State, Meal Type, and remaining nutrient goals.
  - Return the top 5 candidates.

#### [NEW] [routes/scanner.py](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/routes/scanner.py)
- Create `/api/scanner/match` endpoint:
  - Takes `detected_class` from the client scan.
  - Uses `require_user_id` to load user metrics, state, and diet type.
  - Passes user context to `hybrid_scanner_service` and returns the top 5 candidate foods.

#### [MODIFY] [services/copilot_service.py](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/services/copilot_service.py)
- Update RAG query logic to utilize the super-categories when a general category is mentioned in text (e.g. if user says "I ate a rice dish", match foods in "Rice Dish" rather than searching just for the word "dish").

#### [MODIFY] [api.py](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/api.py)
- Include the new `scanner_router`.

---

## Verification Plan

### Automated Tests
- Create `tests/test_hybrid_scanner.py` with mock client queries testing:
  - Scenario 1: Detected `Chicken_Curry` with state `Tamil Nadu` returns `Chicken Chettinad` as the top candidate.
  - Scenario 2: Detected `Masala_Dosa` with state `Karnataka` returns `Neer Dosa Karnataka` or local dosa variants.
  - Scenario 3: Hour-based priority changes (e.g., matching breakfast items in the morning).

### Manual Verification
- Deploy and execute mock API calls via Postman or `curl`:
  ```bash
  curl -X POST http://localhost:8000/api/scanner/match \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <TOKEN>" \
    -d '{"detected_class": "Chicken_Curry"}'
  ```
- Verify the candidate array returns exactly 5 entries sorted by priority score.
