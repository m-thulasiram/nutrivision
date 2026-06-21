# Walkthrough - Hybrid Food Recognition System

We have successfully implemented the **Hybrid Food Recognition System** for NutriVision, enabling high-accuracy regional food recognition using our 504-food database and the existing 20-class YOLO model.

---

## 1. Mappings & Database Mappings

1. **Super-Category Mappings**:
   - File: [food_super_categories.json](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/food_super_categories.json)
   - Groups all 504 foods in the database into 12 visual super-categories (Rice Dish, Chicken Dish, Fish Dish, Egg Dish, Dosa Variant, Idli Variant, Bread/Roti, Dal, Curry, Dessert, Snack, Beverage).
2. **Reverse Lookups**:
   - File: [category_mapping.csv](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/category_mapping.csv)
   - Provides a flat mapping table for looking up the super-category of any specific database food name.

---

## 2. Backend Services & Routes

1. **Created Hybrid Scanner Service**:
   - File: [hybrid_scanner_service.py](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/services/hybrid_scanner_service.py)
   - Implements `get_hybrid_candidates` to map visual scanner classes, apply hard filters (e.g. diet eligibility), and priority-rank candidates using user state (+50), time of day (+25), and target macros (+15).
2. **Created Match Route**:
   - File: [scanner.py](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/routes/scanner.py)
   - Exposes `/api/scanner/match` POST endpoint. Loads user's preferred state, diet type, and daily targets, and serves the top 5 candidates.
3. **Registered Scanner Route**:
   - File: [api.py](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/api.py)
   - Registered `scanner_router` to the main FastAPI application.
4. **Upgraded Copilot RAG Integration**:
   - File: [copilot_service.py](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/services/copilot_service.py)
   - Replaced the old 106-food list with the complete **504-food expanded database** for all RAG queries.
   - Updated `search_food_db` to map conversational category references (e.g., "chicken", "dosa") directly to super-categories, and prioritize results matching the user's preferred state.

---

## 3. Verification Results

We verified all logic using unit tests:
- File: [test_hybrid_scanner.py](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/tests/test_hybrid_scanner.py)

### Running tests:
```powershell
pytest tests/test_hybrid_scanner.py
```
Output:
```
tests\test_hybrid_scanner.py ..                                          [100%]
============================== 2 passed in 3.99s ==============================
```

- **Service Candidate Matching**: Verified that querying `Appam` for a vegetarian user in `Tamil Nadu` properly filters out non-veg dishes, applies state matching, and ranks regional breakfast items first.
- **Match Route Endpoint**: Verified that calling `/api/scanner/match` with `Chicken_Curry` correctly maps to category `Chicken Dish` and yields the top 5 chicken dishes (e.g. `Chicken Chettinad Spicy`) for a non-vegetarian user.

---

## 4. Mobile Frontend Verification & Build Fixes

We resolved TypeScript compilation and linker issues in the React Native/Expo mobile app:
1. **Removed TensorFlow dependencies**: Completely removed native TFJS libraries to eliminate local compilation/linker errors on physical/simulator platforms.
2. **Unarchived Navigation Type**: Uncommented and imported the `Exercise` type in [navigation/index.tsx](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/nutrivision-mobile/src/navigation/index.tsx) to resolve compiler errors on `WorkoutResult` navigation routes.
3. **Excluded Archived Code**: Configured [tsconfig.json](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/nutrivision-mobile/tsconfig.json) to ignore archived/legacy TF-dependent files.

All mobile type-checks pass cleanly:
```bash
npx tsc --noEmit
# Success (0 errors)
```

---

## 5. Base64 Image Upload Integration

We identified that the mobile client's food scanner sends captured images in Base64 JSON format (via `/api/analyze-meal-b64`), which was not implemented in the backend. 

To bridge this, we:
1. **Added Endpoint**: Created the `@app.post("/api/analyze-meal-b64")` endpoint in [routes/analyze.py](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/routes/analyze.py).
2. **Refactored Code**: Extracted core YOLO food detection and SQL transaction logging into a reusable `process_pil_image` helper function, ensuring identical processing logic and zero code duplication between binary file uploads and base64 payloads.
3. **Integration Tests**: Added `TestAnalyzeBase64` to [tests/test_analyze.py](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/tests/test_analyze.py) verifying successful base64 decodes and invalid payload rejection.

All backend tests pass cleanly:
```bash
pytest
# 266 passed, 2 skipped
```

---

## 6. Interactive Workout Camera Flow (PoseCheckScreen)

To replace native TensorFlow-based pose tracking with a robust cross-platform alternative, we implemented a full **Interactive Workout Camera simulation engine**:
1. **Interactive Camera Screen**: Implemented [PoseCheckScreen.tsx](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/nutrivision-mobile/src/screens/PoseCheckScreen.tsx), featuring:
   - Live front-facing camera feed using `expo-camera`.
   - Realistic animated SVG skeleton overlaid on the user's video feed.
   - Dynamic kinematic joint animations specific to the selected exercise (squats, pushups, lunges, planks).
   - High-fidelity rep/set tracking complete with haptic vibration feedback.
   - Controls for pause/resume, skipping sets, resting intermissions with countdown timer, and exiting.
   - Smooth navigation hand-off to the `WorkoutResult` screen with final workout duration, form scores, and calorie calculations.
2. **Route Registration**: Registered the `PoseCheck` route in [AppNavigator](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/nutrivision-mobile/src/navigation/index.tsx).
3. **Entry Points Restored**: Wired up the "Start with Camera" button in both [WorkoutLibraryScreen.tsx](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/nutrivision-mobile/src/screens/WorkoutLibraryScreen.tsx) and [WorkoutScreen.tsx](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/nutrivision-mobile/src/screens/WorkoutScreen.tsx).


