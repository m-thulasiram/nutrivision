const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

interface ApiResponse {
  status: string;
  [key: string]: unknown;
}

interface AuthResponse extends ApiResponse {
  token: string;
  user: { id: number; name: string; email: string };
}

interface ProgressResponse extends ApiResponse {
  progress: {
    date: string;
    user_id: number;
    targets: { calories: number; protein_g: number; carbs_g: number; fats_g: number };
    consumed: { calories: number; protein_g: number; carbs_g: number; fats_g: number };
    remaining: { calories: number; protein_g: number; carbs_g: number; fats_g: number };
    percentages: { calories: number; protein_g: number; carbs_g: number; fats_g: number };
    meals_today: Array<{
      id: number;
      timestamp: string;
      meal_time: string;
      detected_items: string;
      total_calories: number;
      total_protein_g: number;
      total_carbs_g: number;
      total_fats_g: number;
    }>;
    streak_days: number;
    health_score: number;
    alerts: string[];
  };
}

interface WeeklyProgressResponse extends ApiResponse {
  weekly_progress: ProgressResponse['progress'][];
}

interface AnalyzeResponse extends ApiResponse {
  status: string;
  scan_id: string | null;
  detected_foods: Array<{
    food_name: string;
    confidence: number;
    estimated_weight_g: number;
    nutrition: {
      calories: number;
      protein_g: number;
      carbs_g: number;
      fats_g: number;
    };
  }>;
  detections: Array<{
    class_name: string;
    confidence: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    estimated_weight_g: number;
  }>;
  meal_totals: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fats_g: number;
  };
  is_demo_mode: boolean;
}

interface UserResponse extends ApiResponse {
  user: {
    id: number;
    name: string;
    email: string;
    age: number;
    gender: string;
    height_cm: number;
    weight_kg: number;
    activity_level: string;
    goal: string;
    diet_type: string;
    bmr: number;
    tdee: number;
    target_calories: number;
    target_protein: number;
    target_carbs: number;
    target_fats: number;
    preferred_region: string;
    preferred_state: string;
  };
}

interface MealSuggestionResponse {
  remaining_calories: number;
  remaining_macros: { protein: number; carbs: number; fat: number };
  suggested_meals: Array<{
    food: string;
    calories: number;
    protein: number;
    match_score: number;
    explanation: string;
  }>;
  priority_focus?: string;
  priority_macro?: string;
}

interface FoodSearchResponse {
  foods: Array<{
    food_items: string;
    Calories: number;
    Proteins: number;
    Carbohydrates: number;
    Fats: number;
    Veg_Flag: number;
    region: string;
    state: string;
  }>;
}

export class ApiError extends Error {
  status: number;
  data?: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function clearAuth() {
  localStorage.removeItem("nv_user");
  localStorage.removeItem("nv_token");
  localStorage.removeItem("nv_profile");
  localStorage.removeItem("nv_meals");
}

function redirectToLogin() {
  clearAuth();
  window.location.href = "/";
}

async function apiRequest<T>(
  method: string,
  path: string,
  body?: Record<string, unknown> | FormData,
  timeoutMs = 30000,
): Promise<T> {
  if (!navigator.onLine) {
    throw new ApiError("You are offline. Please check your internet connection.", 0);
  }

  const token = localStorage.getItem("nv_token");
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      signal: controller.signal,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    clearTimeout(timeoutId);

    if (response.status === 401) {
      redirectToLogin();
      throw new ApiError("Session expired. Please sign in again.", 401);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new ApiError("Server unavailable. Please try again.", response.status);
    }

    const text = await response.text();
    if (!text.trim()) {
      throw new ApiError("Empty response from server.", response.status);
    }

    let data: unknown;
    try { data = JSON.parse(text); } catch {
      throw new ApiError("Invalid response from server.", response.status);
    }

    if (!response.ok) {
      const detail = (data as Record<string, unknown>)?.detail ||
        (data as Record<string, unknown>)?.message ||
        `Request failed (${response.status})`;
      throw new ApiError(String(detail), response.status, data);
    }

    return data as T;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new ApiError("Request timed out. Please try again.", 408);
    }
    throw new ApiError("Connection failed. Check your internet connection.", 0);
  }
}

export class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) localStorage.setItem("nv_token", token);
    else localStorage.removeItem("nv_token");
  }

  getToken(): string | null {
    return this.token || localStorage.getItem("nv_token");
  }

  private async request<T>(method: string, path: string, body?: Record<string, unknown> | FormData): Promise<T> {
    return apiRequest<T>(method, path, body);
  }

  register(data: {
    name: string;
    email: string;
    password: string;
    age: number;
    gender: string;
    height_cm: number;
    weight_kg: number;
    activity_level: string;
    goal: string;
    diet_type: string;
  }): Promise<AuthResponse> {
    return this.request<AuthResponse>('POST', '/auth/register', data as unknown as Record<string, unknown>);
  }

  login(data: { email: string; password: string }): Promise<AuthResponse> {
    return this.request<AuthResponse>('POST', '/auth/login', data);
  }

  logout(): Promise<ApiResponse> {
    return this.request<ApiResponse>('POST', '/auth/logout');
  }

  getMe(): Promise<UserResponse> {
    return this.request<UserResponse>('GET', '/auth/me');
  }

  updateProfile(data: {
    name: string;
    age: number;
    gender: string;
    height_cm: number;
    weight_kg: number;
    activity_level: string;
    goal: string;
    diet_type: string;
    preferred_region?: string;
    preferred_state?: string;
  }): Promise<UserResponse> {
    return this.request<UserResponse>('POST', '/users/profile', data as unknown as Record<string, unknown>);
  }

  getMyProfile(): Promise<UserResponse> {
    return this.request<UserResponse>('GET', '/users/me');
  }

  getDailyProgress(): Promise<ProgressResponse> {
    return this.request<ProgressResponse>('GET', '/users/me/progress');
  }

  getWeeklyProgress(): Promise<WeeklyProgressResponse> {
    return this.request<WeeklyProgressResponse>('GET', '/users/me/progress/weekly');
  }

  logMeal(data: {
    meal_time: string;
    detected_items: string;
    total_calories: number;
    total_protein: number;
    total_carbs: number;
    total_fats: number;
  }): Promise<ApiResponse> {
    return this.request<ApiResponse>('POST', '/users/me/meals', data as unknown as Record<string, unknown>);
  }

  analyzeMeal(image: File, mealTime: string): Promise<AnalyzeResponse> {
    const formData = new FormData();
    formData.append('image', image);
    formData.append('meal_time', mealTime);
    return this.request<AnalyzeResponse>('POST', '/analyze-meal', formData);
  }

  getNextMealSuggestion(userId: number, antiGravity = false): Promise<MealSuggestionResponse> {
    return this.request<MealSuggestionResponse>(
      'GET',
      `/next-meal-suggestion/${userId}?anti_gravity=${antiGravity}`,
    );
  }

  getSmartNextMealRecommendation(): Promise<MealSuggestionResponse> {
    return this.request<MealSuggestionResponse>('GET', '/users/me/next-meal-recommendation');
  }

  searchFoods(query: string): Promise<FoodSearchResponse> {
    return this.request<FoodSearchResponse>('GET', `/foods/search?q=${encodeURIComponent(query)}`);
  }

  getRegions(): Promise<{ regions: string[] }> {
    return this.request<{ regions: string[] }>('GET', '/foods/regions');
  }

  getStates(): Promise<{ states: string[] }> {
    return this.request<{ states: string[] }>('GET', '/foods/states');
  }

  forgotPassword(data: { email: string }): Promise<ApiResponse> {
    return this.request<ApiResponse>('POST', '/auth/forgot-password', data);
  }

  resetPassword(data: { token: string; password: string }): Promise<ApiResponse> {
    return this.request<ApiResponse>('POST', '/auth/reset-password', data as unknown as Record<string, unknown>);
  }
}

export const api = new ApiClient();
