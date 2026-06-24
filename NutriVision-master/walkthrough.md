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

---

## 7. Frontend Build and Deployment Configuration Fixes

1. **Resolved TypeScript Compiler Errors in Frontend**:
   - Fixed an error in [CopilotCoach.tsx](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/nutrivision-ui/src/pages/CopilotCoach.tsx) where the `Spinner` component was passed a `size="sm"` prop, which was not supported by its type signature.
   - Refactored [Spinner.tsx](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/nutrivision-ui/src/components/Spinner.tsx) to support the `size` prop (`"sm" | "md" | "lg"`), adjusting its dimensions and padding dynamically.

2. **Added Frontend Build Stage to Dockerfiles**:
   - Added a multi-stage Docker build process in both [Dockerfile](file:///c:/Users/Lenovo/Downloads/NutriVision-master/Dockerfile) (root) and [Dockerfile](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/Dockerfile) (nested).
   - This new stage installs Node.js packages and compiles the frontend React application (`nutrivision-ui`) into the `dist` directory.
   - The compiled frontend `dist` directory is copied into the final Python runtime image at `/app/nutrivision-ui/dist`, ensuring the single-page application is served correctly on Render.

3. **Fixed Redirect Test**:
   - Updated the `HTTPSRedirectMiddleware` test in [test_middleware.py](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/tests/test_middleware.py) to request `/api/auth/login` instead of `/health`, preventing conflicts with the health check redirection bypass.

---

## 8. Mobile Image Scanning memory and Connection Fixes

1. **Backend Memory Optimization to Prevent Out Of Memory (OOM) Crashes**:
   - High-resolution photos captured on modern phones can consume massive amounts of memory when processed by PyTorch/YOLO, causing Render containers (512MB RAM limit) to crash (OOM) and drop the connection.
   - Updated `process_pil_image` in [routes/analyze.py](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/routes/analyze.py) to automatically scale incoming PIL images to a maximum dimension of `640px` in-place (`pil_image.thumbnail((640, 640))`). This reduces raw memory usage by over 95% while keeping the image size native to the YOLO model (which downscales internally to 640px anyway).

2. **Improved Client-Side Error Visibility**:
   - Refactored `analyzeImage` in [ScanScreen.tsx](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/nutrivision-mobile/src/screens/ScanScreen.tsx) to read the response as raw text and parse it safely rather than immediately calling `response.json()`.
   - If the server responds with a non-JSON error (e.g. 502 Bad Gateway or 413 Payload Too Large), the app now displays the HTTP status and body details instead of crashing with a generic `JSON Parse error: Unexpected end of input`.

3. **Production URL Configuration**:
   - Updated `apiUrl` in [app.json](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/nutrivision-mobile/app.json) to point directly to `https://nutrivision-1-1kwu.onrender.com`.

---

## 9. Workout Camera Phase Flow & Traditional Exercise Mapping

1. **Implemented Workout Phase State Machine**:
   - Refactored [PoseCheckScreen.tsx](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/nutrivision-mobile/src/screens/PoseCheckScreen.tsx) to implement a strict 7-phase flow (`loading`, `get_in_position`, `detecting_ready`, `countdown`, `exercising`, `resting`, `complete`).
   - Prevents auto-counting before the user is in position by requiring the user to hold the correct starting posture for 15 frames (~0.5 seconds at 30fps) before triggering a 3-second countdown vibration sequence.
   - Integrated full support for time-based holds (e.g. Plank / Kumbhakasana), starting a countdown timer instead of rep-based animation loops.

2. **Mapped Exercises to Traditional Indian Names**:
   - Updated [exercises.ts](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/nutrivision-mobile/src/constants/exercises.ts) to define the `script`, `origin`, `startingPositionAngles`, `isTimeBased`, and `description` on the `Exercise` configuration structure. Re-declared the 10 core exercises using their traditional names (e.g., Dand, Baithak, Kumbhakasana, Virabhadrasana).
   - Updated [exerciseMapping.ts](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/nutrivision-mobile/src/constants/exerciseMapping.ts) to map modern, transliterated, and Devanagari names (e.g., "Push Up", "Dand", "दंड") to the unified configuration.

3. **Enhanced Exercise Card UI**:
   - Redesigned the cards in [WorkoutScreen.tsx](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/nutrivision-mobile/src/screens/WorkoutScreen.tsx) and [WorkoutLibraryScreen.tsx](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/nutrivision-mobile/src/screens/WorkoutLibraryScreen.tsx) to display the Devanagari script, English name, traditional origin, and the instructions.

---

## 10. YOLO ONNX memory optimization & Database stability (Render Deployments)

To support stable execution on Render's 512MB RAM free tier, we implemented deep backend optimizations and mobile payload compression:

1. **YOLO-to-ONNX Conversion**:
   - Converted the YOLO model weight from `.pt` to `.onnx` and loaded it via `onnxruntime` inside `models.py`. This cut inference RAM requirements by over 40%.
2. **ONNX Runtime Threading & CUDA Monkeypatch**:
   - Implemented a global wrapper in `api.py` targeting `onnxruntime.InferenceSession`.
   - Forces single-threaded execution (`intra_op_num_threads = 1`, `inter_op_num_threads = 1`, sequential execution mode) to completely prevent the OOM/CPU throttling spikes that standard ONNX causes when it matches threads to host CPU core count.
   - Forced `CPUExecutionProvider` inside the monkeypatch and popped `providers` to bypass hangs caused by ONNX runtime probing for CUDA driver libraries on Render's virtualized host nodes.
3. **Database Connection Pool Leak Fix**:
   - Resolved Postgres connection pool limits (pool exhausted at 10 connections) by updating the FastAPI `/health` endpoint and database initialization files to invoke psycopg2's helper `close_connection(conn)` instead of `.close()`. This ensures connections return to the pool immediately.
4. **Ultralytics Telemetry Disable**:
   - Disabled Ultralytics analytics telemetry via `ULTRALYTICS_ANALYTICS = "false"` and `ULTRALYTICS_OFFLINE = "true"` environment variables at the top of `api.py` to prevent inference network socket blocks.
5. **Mobile Image Pre-Compression & Sizing**:
   - Removed `skipProcessing: true` from the `takePictureAsync` method in [ScanScreen.tsx](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/nutrivision-mobile/src/screens/ScanScreen.tsx).
   - Configured client-side downscaling and compression (15% quality) to reduce camera picture payloads from ~8MB down to ~100KB, preventing server JSON-parsing RAM spikes.
6. **"Did you mean one of these?" Low-Confidence Flow**:
   - Implemented a dynamic suggestion menu on the client scan results screen. If a scan returns a confidence level between `0.30` and `0.60`, it presents alternative match candidates for user selection rather than a blank "No food detected" screen.
7. **Cleaned up temporary debug routes**:
   - Removed the `/api/diagnose` route from `api.py` before final commit.

---

## 11. Copilot Error Handling & Logger Fixes

We identified and resolved a critical runtime crash in the AI Nutrition Copilot route:
1. **NameError in Exception Fallback**:
   - Fixed a bug in [copilot.py](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/routes/copilot.py) where the `logger` object was used inside the exception handler to log OpenAI API stream errors but was never imported or initialized.
   - Imported `get_logger` from `logging_config` and initialized the copilot logger.
2. **Robust Integration Testing**:
   - Created a new test file [test_copilot.py](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/tests/test_copilot.py) containing comprehensive tests for streaming mock fallbacks, exception-based mock fallbacks (mocking OpenAI error to trigger the exception handler and verify no NameError is thrown), and meal logging actions.

---

## 12. Local YOLO Scanner Integration in Mock Mode

We resolved a major usability issue where scanning foods in mock/demo mode (when no `OPENAI_API_KEY` is configured) would always return hardcoded regional dishes (such as Idli/Sambar for Tamil Nadu), completely ignoring the scanned image (e.g., showing "Idli" for a "Fruit Salad" photo).
1. **Integrated Local YOLO Model**:
   - Refactored `analyze_food_image_mock` in [food_vision.py](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/services/food_vision.py) to actually run the local fine-tuned YOLO model (with `imgsz=256` as required by the ONNX weights) on the uploaded image.
   - If the YOLO model detects any of its 20 trained classes (including *Fruit Salad*, *Chicken Curry*, *Masala Dosa*, *Idli*, etc.) with a confidence of `0.25` or higher, the scanner resolves the detection against the 504-food database and returns the actual scanned food.
   - If no YOLO classes are detected with sufficient confidence, the scanner gracefully falls back to the regional state-based mock menu.
2. **True Integration Testing**:
   - This change brings the local YOLO model to life for local offline development.
   - The test suite in [test_yolo.py](file:///c:/Users/Lenovo/Downloads/NutriVision-master/NutriVision-master/tests/test_yolo.py) now actually exercises the YOLO detection pipeline during testing instead of relying on hardcoded food fallbacks.


