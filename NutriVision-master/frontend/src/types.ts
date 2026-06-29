export interface User { _id: string; name: string; email: string; }

export interface HealthProfile {
  age: number; gender: string; height: number; weight: number;
  activityLevel: string; fitnessGoal: string;
  dietType: "veg" | "nonveg";
  bmi: number; bmiCategory: string; bmr: number; tdee: number;
  dailyCalorieTarget: number; dailyProteinTarget: number;
  dailyCarbTarget: number; dailyFatTarget: number;
  region?: string;
  state?: string;
}

export interface FoodItem {
  name: string; confidence: number; weightGrams: number;
  calories: number; protein: number; carbs: number; fat: number;
  caloriesPer100g: number;
}

export interface FoodItemExtended extends FoodItem {
  ingredients?: string[];
  dietType?: "veg" | "nonveg";
}

export interface Meal {
  _id: string; mealType: string; foodItems: FoodItem[];
  totalCalories: number; totalProtein: number; totalCarbs: number;
  totalFat: number; detectedAt: string;
}

export interface FoodEntry {
  name: string;
  emoji: string;
  dietType: "veg" | "nonveg";
  ingredients: string[];
  per100g: { calories: number; protein: number; carbs: number; fat: number };
  defaultWeightG: number;
  imageKeywords: string[];
}

export interface FoodSuggestion {
  name: string; emoji: string; calories: number; protein: number;
  carbs: number; fat: number; portion: string; tags: string[];
}

export interface MLPrediction {
  label: string;
  confidence: number;
  dbKey: string | null;
  rawModelLabel: string;
}
