import type { ChangeEvent } from "react";

export interface User { id: number; name: string; }

export interface HealthProfile {
  age: number; gender: string; height: number; weight: number;
  activityLevel: string; fitnessGoal: string;
  dietType: "veg" | "nonveg" | "eggetarian" | "both";
  bmi: number; bmiCategory: string; bmr: number; tdee: number;
  dailyCalorieTarget: number; dailyProteinTarget: number;
  dailyCarbTarget: number; dailyFatTarget: number;
  preferredRegion?: string; preferredState?: string;
}

export interface FoodItem {
  name: string; confidence: number; weightGrams: number;
  calories: number; protein: number; carbs: number; fat: number;
  caloriesPer100g: number;
}

export interface Meal {
  _id: string; mealType: string; foodItems: FoodItem[];
  totalCalories: number; totalProtein: number; totalCarbs: number;
  totalFat: number; detectedAt: string;
}

export interface Recommendation { type: string; title: string; message: string; }

export interface DashboardData {
  profile: HealthProfile | null;
  todayStats: { totalCalories: number; totalProtein: number; totalCarbs: number; totalFat: number; mealCount: number; };
  todayMeals: Meal[];
  weeklyData: { date: string; calories: number; protein: number; carbs: number; fat: number; }[];
  calorieIntelligence: { dailyTarget: number; consumed: number; remaining: number; percentConsumed: number; statement: string; } | null;
  recommendations: Recommendation[];
}

export interface BackendMeal {
  id?: number;
  meal_time?: string;
  detected_items?: string;
  total_calories?: number;
  total_protein_g?: number;
  total_carbs_g?: number;
  total_fats_g?: number;
  timestamp?: string;
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
  detectedAt?: string;
  mealType?: string;
  foodItems?: FoodItem[];
  _id?: string;
}

export interface DailyProgress {
  consumed: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fats_g: number;
  };
  targets: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fats_g: number;
  };
  percentages: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
  health_score: number | null;
  streak_days: number | null;
  alerts: string[];
  meals_today: BackendMeal[];
}

export interface WeeklyProgressItem {
  date: string;
  consumed?: { calories: number };
  targets?: { calories: number };
}

export interface Suggestion {
  food: string;
  match_score?: number;
  explanation: string;
  reasoning_trace?: {
    regional_match?: string;
    cuisine?: string;
    vegetarian_safe?: boolean;
  };
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface BackendAnalysisResult {
  status: string;
  detected_items: string[];
  confidence_scores: number[];
  top3_predictions: { label: string; prob: number }[];
  macro_distribution: { calories: number; protein: number; carbs: number; fat: number };
  uncertain: boolean;
  microgravity_priority_score: number;
  alerts: string[];
  detections: { label: string; prob: number }[];
}

export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "default";
  size?: "sm" | "md" | "lg";
  style?: React.CSSProperties;
}

export interface InputProps {
  label?: string;
  type?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  options: SelectOption[];
}
