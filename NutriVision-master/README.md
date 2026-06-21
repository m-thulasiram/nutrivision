# NutriVision 2.0

## AI-Powered Indian Nutrition Intelligence Platform

NutriVision is an AI-driven nutrition platform that identifies Indian food from photos using YOLOv8, calculates personalized macro targets, and provides region-aware meal recommendations across all 28 Indian states.

---

## Key Features

- **YOLOv8 food detection** — 20 Indian food classes (idli, dosa, biryani, etc.)
- **Neuro-symbolic recommendation engine** — Autoencoder + KNN hybrid for meal suggestions
- **Regional Indian food intelligence** — 28 states, regional cuisine data, state-based filtering
- **Anti-Gravity mode** — Specialized nutrition tracking for microgravity environments
- **Workout Coach** — AI-generated weekly workout plans, exercise logging, and progress tracking
- **Smart Meal Recommendations** — Adaptive suggestions that detect your most deficient macro and prioritize accordingly
- **React Native mobile app** — Expo-based cross-platform mobile experience
- **FastAPI backend** — High-performance async Python REST API

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend framework | FastAPI (Python 3.11) |
| Mobile app | React Native + Expo |
| Web frontend | React + Vite + TypeScript |
| Computer vision | YOLOv8 (Ultralytics) |
| ML engine | PyTorch autoencoder + scikit-learn KNN |
| Database | SQLite (with WAL mode) |
| Auth | JWT (HS256) + bcrypt |
| Monitoring | Prometheus + Sentry |
| Containerization | Docker + docker-compose |
| CI/CD | GitHub Actions |

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Git

---

## Quick Start

### 1. Clone and setup backend

```bash
git clone <repo-url>
cd NutriVision-master
python -m venv .venv
.venv\Scripts\activate    # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your values (JWT secret, etc.)
```

### 2. Run backend

```bash
uvicorn api:app --reload --port 8000
```

Backend runs at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

### 3. Setup mobile app

```bash
cd nutrivision-mobile
npm install
npx expo start
```

Scan the QR code with Expo Go on your phone, or press `a` for Android emulator / `i` for iOS simulator.

### 4. Setup web frontend (optional)

```bash
cd nutrivision-ui
npm install
npm run dev
```

Opens at `http://localhost:5173`.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NUTRIVISION_ENV` | `development` | Runtime environment |
| `NUTRIVISION_JWT_SECRET` | (required) | JWT signing key (min 32 chars in production) |
| `NUTRIVISION_JWT_EXPIRATION_HOURS` | `24` | Token expiry in hours |
| `NUTRIVISION_DB_URL` | `./nutrivision.db` | SQLite database path |
| `NUTRIVISION_CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed CORS origins |
| `NUTRIVISION_SENTRY_DSN` | (optional) | Sentry error tracking DSN |
| `NUTRIVISION_YOLO_CONFIDENCE` | `0.60` | YOLO detection confidence threshold |

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check |
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login |
| POST | `/api/auth/logout` | No | Logout (client discards token) |
| GET | `/api/auth/me` | Yes | Get current user profile |
| POST | `/api/users/profile` | Yes | Create or update your profile |
| GET | `/api/users/{user_id}` | Yes | Get user by ID (own only) |
| GET | `/api/users/me/progress` | Yes | Get today's nutrition progress |
| GET | `/api/users/me/progress/weekly` | Yes | Get last 7 days progress |
| POST | `/api/analyze-meal` | Yes | Upload food photo for YOLO analysis |
| POST | `/api/recommend` | Yes | Get AI meal recommendations |
| GET | `/api/next-meal-suggestion/{user_id}` | Yes | Get next meal suggestion |
| GET | `/api/foods/regions` | No | List all regions |
| GET | `/api/foods/states` | No | List all states |
| GET | `/api/foods/by-region/{region}` | No | Foods by region |
| GET | `/api/foods/by-state/{state}` | No | Foods by state |

---

## Project Structure

```
NutriVision-master/
├── api.py                      # FastAPI app entry point
├── config.py                   # Environment config loader
├── database.py                 # SQLite connection + init
├── models.py                   # ML model loader (YOLO, autoencoder, KNN)
├── schemas.py                  # Pydantic request/response schemas
├── crud.py                     # Database CRUD operations
├── dependencies.py             # FastAPI dependencies (auth)
├── migrations.py               # Database migrations
├── middleware.py               # Observability + security middleware
├── rate_limiter.py             # Rate limiting (slowapi)
├── metrics.py                  # Prometheus metrics
├── logging_config.py           # Structured logging setup
│
├── routes/                     # API route handlers
│   ├── auth.py                 # Authentication endpoints
│   ├── users.py                # User profile + progress endpoints
│   ├── foods.py                # Regional food database endpoints
│   ├── analyze.py              # YOLO meal analysis endpoint
│   └── recommend.py            # Recommendation endpoints
│
├── services/                   # Business logic
│   ├── auth_service.py         # JWT + bcrypt auth
│   ├── health_calculator.py    # BMR/TDEE/macro calculations
│   └── recommendation_service.py # KNN recommender engine
│
├── nutrivision-mobile/         # React Native Expo mobile app
│   └── src/
│       ├── screens/            # Mobile screens
│       ├── components/         # Reusable UI components
│       ├── navigation/         # React Navigation setup
│       └── utils/              # API + auth utilities
│
├── nutrivision-ui/             # React + Vite web frontend
│
├── tests/                      # Pytest test suite (124 tests)
│
├── models/                     # ML model weights
│   ├── diet_model.pth          # Autoencoder weights
│   ├── scaling_params.pkl      # Feature scaling params
│   └── yolov8n.pt              # YOLOv8 base weights
│
├── runs/                       # Training outputs
│   └── detect/train2/weights/best.pt  # Fine-tuned YOLOv8
│
├── requirements.txt            # Python dependencies
├── docker-compose.yml          # Docker setup
└── Dockerfile                  # Backend Docker image
```

---

## Running Tests

```bash
cd tests
pytest --cov=. --cov-report=term-missing
```

Tests enforce 85%+ code coverage. CI runs tests on every push.

---

## Model Training

### YOLO food detection
```bash
python train_model.py
# Output in runs/detect/train/weights/best.pt
```

### Autoencoder + KNN recommender
```bash
python train_recommender.py
# Output: diet_model.pth, scaling_params.pkl
```

---

## Diet Types

| Type | Description |
|------|-------------|
| 🥦 **Vegetarian** | Plant-based foods only |
| 🍗 **Non-Veg** | Includes meat-based foods |
| 🥚 **Eggetarian** | Vegetarian + eggs |
| 🍽️ **Both** | Flexible (no dietary restriction) |

---

## API Endpoints

### Workout Coach
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/workouts/exercises` | Search exercise library by muscle group & equipment |
| `GET` | `/api/workouts/plans` | Get current weekly workout plan |
| `POST` | `/api/workouts/plans` | Generate/regenerate weekly workout plan |
| `POST` | `/api/workouts/log` | Log a completed workout |
| `GET` | `/api/workouts/logs` | Get paginated workout history |

### Smart Recommendations
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users/me/next-meal-recommendation` | Adaptive meal suggestion based on macro deficit analysis |

---

## Known Issues

- Mobile app requires Expo dev server origin to be added to CORS origins in `.env`
- SQLite database (not suitable for multi-server production)
- YOLO model trained on 20 Indian food classes — limited coverage
- No email verification

---

## Roadmap

**Phase 1** — Indian regional food database (complete)  
**Phase 2** — AI nutrition copilot with meal logging (complete)  
**Phase 3** — Workout Coach + Smart Recommendations (complete)  
**Phase 4** — Wearable device sync + voice logging (planned)
