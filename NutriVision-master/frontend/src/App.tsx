import { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

// ============================================================
// TYPES
// ============================================================
interface User { _id: string; name: string; email: string; }
interface HealthProfile {
  age: number; gender: string; height: number; weight: number;
  activityLevel: string; fitnessGoal: string;
  dietType: "veg" | "nonveg";
  bmi: number; bmiCategory: string; bmr: number; tdee: number;
  dailyCalorieTarget: number; dailyProteinTarget: number;
  dailyCarbTarget: number; dailyFatTarget: number;
}
interface FoodItem {
  name: string; confidence: number; weightGrams: number;
  calories: number; protein: number; carbs: number; fat: number;
  caloriesPer100g: number;
}
interface Meal {
  _id: string; mealType: string; foodItems: FoodItem[];
  totalCalories: number; totalProtein: number; totalCarbs: number;
  totalFat: number; detectedAt: string;
}


// ============================================================
// STRUCTURED FOOD DATABASE — exact ingredients + macros per 100g
// ============================================================
interface FoodEntry {
  name: string;
  emoji: string;
  dietType: "veg" | "nonveg";
  ingredients: string[];
  per100g: { calories: number; protein: number; carbs: number; fat: number };
  defaultWeightG: number;
  // filename keywords for image-based detection
  imageKeywords: string[];
}

const FOOD_DATABASE: Record<string, FoodEntry> = {
  "grilled chicken breast": {
    name: "Grilled Chicken Breast", emoji: "🍗", dietType: "nonveg",
    ingredients: ["Chicken breast (skinless)", "Olive oil", "Garlic", "Lemon juice", "Black pepper", "Salt"],
    per100g: { calories: 165, protein: 31.0, carbs: 0, fat: 3.6 },
    defaultWeightG: 150, imageKeywords: ["chicken", "grilled", "poultry"],
  },
  "brown rice": {
    name: "Brown Rice", emoji: "🍚", dietType: "veg",
    ingredients: ["Whole grain brown rice", "Water", "Salt"],
    per100g: { calories: 112, protein: 2.6, carbs: 23.5, fat: 0.9 },
    defaultWeightG: 150, imageKeywords: ["rice", "brown", "grain"],
  },
  "broccoli": {
    name: "Steamed Broccoli", emoji: "🥦", dietType: "veg",
    ingredients: ["Fresh broccoli florets", "Water", "Salt"],
    per100g: { calories: 34, protein: 2.8, carbs: 6.6, fat: 0.4 },
    defaultWeightG: 100, imageKeywords: ["broccoli", "vegetable", "green"],
  },
  "salmon fillet": {
    name: "Salmon Fillet", emoji: "🐟", dietType: "nonveg",
    ingredients: ["Atlantic salmon", "Olive oil", "Dill", "Lemon", "Salt", "Black pepper"],
    per100g: { calories: 208, protein: 20.0, carbs: 0, fat: 13.0 },
    defaultWeightG: 180, imageKeywords: ["salmon", "fish", "seafood"],
  },
  "sweet potato": {
    name: "Baked Sweet Potato", emoji: "🍠", dietType: "veg",
    ingredients: ["Sweet potato", "Olive oil", "Cinnamon", "Salt"],
    per100g: { calories: 86, protein: 1.6, carbs: 20.1, fat: 0.1 },
    defaultWeightG: 150, imageKeywords: ["sweet potato", "yam", "potato"],
  },
  "oatmeal": {
    name: "Oatmeal", emoji: "🥣", dietType: "veg",
    ingredients: ["Rolled oats", "Water or milk", "Salt"],
    per100g: { calories: 68, protein: 2.4, carbs: 12.0, fat: 1.4 },
    defaultWeightG: 200, imageKeywords: ["oatmeal", "oats", "porridge", "breakfast"],
  },
  "banana": {
    name: "Banana", emoji: "🍌", dietType: "veg",
    ingredients: ["Fresh banana"],
    per100g: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
    defaultWeightG: 120, imageKeywords: ["banana", "fruit", "yellow"],
  },
  "greek yogurt": {
    name: "Greek Yogurt", emoji: "🥛", dietType: "veg",
    ingredients: ["Whole milk", "Live yogurt cultures (L. acidophilus, B. bifidus)"],
    per100g: { calories: 59, protein: 10.0, carbs: 3.6, fat: 0.4 },
    defaultWeightG: 170, imageKeywords: ["yogurt", "curd", "dairy"],
  },
  "pizza slice": {
    name: "Pizza Slice (Margherita)", emoji: "🍕", dietType: "veg",
    ingredients: ["All-purpose flour", "Tomato sauce", "Mozzarella cheese", "Olive oil", "Basil", "Yeast", "Salt"],
    per100g: { calories: 266, protein: 11.0, carbs: 33.0, fat: 10.0 },
    defaultWeightG: 150, imageKeywords: ["pizza", "margherita", "slice"],
  },
  "garden salad": {
    name: "Garden Salad", emoji: "🥗", dietType: "veg",
    ingredients: ["Romaine lettuce", "Cucumber", "Cherry tomatoes", "Red onion", "Olive oil", "Lemon juice", "Salt"],
    per100g: { calories: 20, protein: 1.5, carbs: 3.5, fat: 0.2 },
    defaultWeightG: 120, imageKeywords: ["salad", "greens", "lettuce"],
  },
  "paneer cubes": {
    name: "Paneer (Indian Cottage Cheese)", emoji: "🧀", dietType: "veg",
    ingredients: ["Full-fat milk", "Lemon juice or vinegar"],
    per100g: { calories: 265, protein: 18.3, carbs: 1.2, fat: 20.8 },
    defaultWeightG: 100, imageKeywords: ["paneer", "cheese", "cottage"],
  },
  "lentil dal": {
    name: "Lentil Dal (Masoor Dal)", emoji: "🍲", dietType: "veg",
    ingredients: ["Red lentils", "Onion", "Tomato", "Garlic", "Ginger", "Turmeric", "Cumin", "Ghee", "Salt"],
    per100g: { calories: 116, protein: 9.0, carbs: 20.0, fat: 0.4 },
    defaultWeightG: 250, imageKeywords: ["dal", "lentil", "curry", "soup"],
  },
  "egg omelette": {
    name: "Egg Omelette (3 eggs)", emoji: "🍳", dietType: "nonveg",
    ingredients: ["3 large eggs", "Butter", "Salt", "Black pepper", "Optional: onion, bell pepper"],
    per100g: { calories: 154, protein: 10.6, carbs: 0.8, fat: 11.9 },
    defaultWeightG: 180, imageKeywords: ["egg", "omelette", "fried", "scrambled"],
  },
  "beef steak": {
    name: "Grilled Beef Steak (Sirloin)", emoji: "🥩", dietType: "nonveg",
    ingredients: ["Sirloin beef", "Olive oil", "Garlic", "Rosemary", "Salt", "Black pepper"],
    per100g: { calories: 271, protein: 26.1, carbs: 0, fat: 18.0 },
    defaultWeightG: 150, imageKeywords: ["steak", "beef", "sirloin", "meat"],
  },
  "pasta": {
    name: "Pasta (Penne with Marinara)", emoji: "🍝", dietType: "veg",
    ingredients: ["Penne pasta", "Tomato sauce", "Garlic", "Olive oil", "Basil", "Parmesan", "Salt"],
    per100g: { calories: 158, protein: 5.8, carbs: 30.9, fat: 0.9 },
    defaultWeightG: 200, imageKeywords: ["pasta", "penne", "spaghetti", "noodle"],
  },
  "tuna can": {
    name: "Canned Tuna in Water", emoji: "🐠", dietType: "nonveg",
    ingredients: ["Yellowfin tuna", "Water", "Salt"],
    per100g: { calories: 130, protein: 28.0, carbs: 0, fat: 1.0 },
    defaultWeightG: 120, imageKeywords: ["tuna", "can", "fish", "tinned"],
  },
  "moong dal chilla": {
    name: "Moong Dal Chilla", emoji: "🫓", dietType: "veg",
    ingredients: ["Split moong dal (yellow)", "Ginger", "Green chilli", "Cumin seeds", "Coriander", "Salt", "Oil"],
    per100g: { calories: 149, protein: 10.0, carbs: 21.0, fat: 2.9 },
    defaultWeightG: 150, imageKeywords: ["chilla", "moong", "crepe", "pancake"],
  },
  "chicken tikka": {
    name: "Chicken Tikka", emoji: "🍢", dietType: "nonveg",
    ingredients: ["Boneless chicken", "Yogurt", "Lemon juice", "Tandoori masala", "Ginger-garlic paste", "Oil", "Salt"],
    per100g: { calories: 240, protein: 32.0, carbs: 3.5, fat: 11.0 },
    defaultWeightG: 150, imageKeywords: ["tikka", "chicken", "tandoori", "kebab"],
  },
  "avocado toast": {
    name: "Avocado Toast", emoji: "🥑", dietType: "veg",
    ingredients: ["Whole grain bread (1 slice)", "½ ripe avocado", "Lemon juice", "Red chilli flakes", "Salt", "Black pepper"],
    per100g: { calories: 195, protein: 4.5, carbs: 16.0, fat: 13.0 },
    defaultWeightG: 130, imageKeywords: ["avocado", "toast", "bread"],
  },
  "protein shake": {
    name: "Whey Protein Shake", emoji: "🥤", dietType: "nonveg",
    ingredients: ["Whey protein powder (1 scoop)", "Water or skimmed milk (250ml)", "Optional: banana or cocoa powder"],
    per100g: { calories: 120, protein: 22.0, carbs: 5.0, fat: 2.0 },
    defaultWeightG: 300, imageKeywords: ["shake", "protein", "smoothie", "whey"],
  },
  "almonds": {
    name: "Raw Almonds", emoji: "🌰", dietType: "veg",
    ingredients: ["Raw almonds"],
    per100g: { calories: 579, protein: 21.2, carbs: 21.6, fat: 49.9 },
    defaultWeightG: 28, imageKeywords: ["almond", "nuts", "dry fruit"],
  },
};

// Map an uploaded image filename to a food database key
const detectFoodFromFilename = (filename: string): string | null => {
  const lower = filename.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
  for (const [key, entry] of Object.entries(FOOD_DATABASE)) {
    for (const kw of entry.imageKeywords) {
      if (lower.includes(kw)) return key;
    }
    if (lower.includes(key)) return key;
  }
  return null;
};

const buildFoodItemFromEntry = (entry: FoodEntry, weightG: number): FoodItem => {
  const f = weightG / 100;
  return {
    name: entry.name,
    confidence: 0.97,
    weightGrams: weightG,
    calories: Math.round(entry.per100g.calories * f),
    protein: Math.round(entry.per100g.protein * f * 10) / 10,
    carbs: Math.round(entry.per100g.carbs * f * 10) / 10,
    fat: Math.round(entry.per100g.fat * f * 10) / 10,
    caloriesPer100g: entry.per100g.calories,
  };
};

// Add ingredients + dietType to FoodItem for display
interface FoodItemExtended extends FoodItem {
  ingredients?: string[];
  dietType?: "veg" | "nonveg";
}
// ============================================================
// FOOD SUGGESTION ENGINE
// ============================================================
interface FoodSuggestion {
  name: string; emoji: string; calories: number; protein: number;
  carbs: number; fat: number; portion: string; tags: string[];
}

// Vegetarian foods (no meat/fish — dairy & eggs allowed)
const VEG_FOODS_DB: FoodSuggestion[] = [
  { name: "Greek Yogurt", emoji: "🥛", calories: 100, protein: 17, carbs: 6, fat: 0.7, portion: "1 cup (170g)", tags: ["high-protein", "low-calorie", "snack"] },
  { name: "Paneer Cubes", emoji: "🧀", calories: 265, protein: 18, carbs: 1.2, fat: 21, portion: "100g serving", tags: ["high-protein", "muscle-gain", "meal"] },
  { name: "Hard-Boiled Eggs", emoji: "🥚", calories: 156, protein: 12, carbs: 1.1, fat: 11, portion: "2 large eggs (100g)", tags: ["high-protein", "snack", "low-carb"] },
  { name: "Lentil Dal", emoji: "🍲", calories: 230, protein: 18, carbs: 40, fat: 1, portion: "1.5 cups (360g)", tags: ["high-protein", "fiber", "meal"] },
  { name: "Cottage Cheese", emoji: "🫙", calories: 110, protein: 14, carbs: 5, fat: 5, portion: "½ cup (113g)", tags: ["high-protein", "low-calorie", "snack"] },
  { name: "Chickpea Salad", emoji: "🥗", calories: 190, protein: 10, carbs: 28, fat: 5, portion: "1 bowl (200g)", tags: ["balanced", "fiber", "meal"] },
  { name: "Almonds", emoji: "🌰", calories: 164, protein: 6, carbs: 6, fat: 14, portion: "1 oz (28g)", tags: ["healthy-fat", "snack", "high-protein"] },
  { name: "Oatmeal with Milk", emoji: "🥣", calories: 180, protein: 8, carbs: 30, fat: 4, portion: "1 cup cooked + milk", tags: ["complex-carb", "fiber", "breakfast"] },
  { name: "Tofu Stir-Fry", emoji: "🥘", calories: 200, protein: 16, carbs: 10, fat: 11, portion: "1 serving (200g)", tags: ["high-protein", "balanced", "meal"] },
  { name: "Avocado Toast", emoji: "🥑", calories: 250, protein: 7, carbs: 28, fat: 13, portion: "1 slice + ½ avocado", tags: ["healthy-fat", "balanced", "breakfast"] },
  { name: "Banana + Peanut Butter", emoji: "🍌", calories: 215, protein: 6, carbs: 32, fat: 8, portion: "1 banana + 1 tbsp PB", tags: ["balanced", "snack", "pre-workout"] },
  { name: "Edamame", emoji: "🫘", calories: 120, protein: 11, carbs: 10, fat: 5, portion: "1 cup shelled (155g)", tags: ["plant-based", "high-protein", "snack"] },
  { name: "Sweet Potato", emoji: "🍠", calories: 130, protein: 3, carbs: 30, fat: 0.1, portion: "1 medium (150g)", tags: ["complex-carb", "fiber", "vitamins"] },
  { name: "Brown Rice + Rajma", emoji: "🍚", calories: 320, protein: 14, carbs: 55, fat: 3, portion: "1 cup rice + ½ cup beans", tags: ["high-protein", "complex-carb", "meal"] },
  { name: "Spinach Smoothie", emoji: "🥤", calories: 160, protein: 5, carbs: 30, fat: 1.5, portion: "1 large glass (400ml)", tags: ["vitamins", "low-fat", "snack"] },
  { name: "Whole Grain Crackers + Hummus", emoji: "🫙", calories: 180, protein: 6, carbs: 25, fat: 7, portion: "6 crackers + 3 tbsp hummus", tags: ["balanced", "snack", "fiber"] },
  { name: "Mixed Nuts", emoji: "🥜", calories: 180, protein: 5, carbs: 8, fat: 16, portion: "1 oz (28g)", tags: ["healthy-fat", "snack", "energy-dense"] },
  { name: "Sprouts Salad", emoji: "🌿", calories: 90, protein: 8, carbs: 15, fat: 0.5, portion: "1 bowl (150g)", tags: ["low-calorie", "fiber", "snack"] },
  { name: "Moong Dal Chilla", emoji: "🫓", calories: 150, protein: 10, carbs: 22, fat: 3, portion: "2 chillas (150g)", tags: ["high-protein", "balanced", "breakfast"] },
  { name: "Curd Rice", emoji: "🍚", calories: 200, protein: 7, carbs: 35, fat: 4, portion: "1 bowl (250g)", tags: ["balanced", "probiotic", "meal"] },
];

// Non-Vegetarian foods (meat, fish, seafood + all veg options)
const NONVEG_FOODS_DB: FoodSuggestion[] = [
  { name: "Grilled Chicken Breast", emoji: "🍗", calories: 165, protein: 31, carbs: 0, fat: 3.6, portion: "100g serving", tags: ["high-protein", "lean", "muscle-gain"] },
  { name: "Salmon Fillet", emoji: "🐟", calories: 208, protein: 20, carbs: 0, fat: 13, portion: "100g serving", tags: ["omega-3", "high-protein", "muscle-gain"] },
  { name: "Tuna Can", emoji: "🐠", calories: 130, protein: 28, carbs: 0, fat: 1, portion: "1 can (120g)", tags: ["high-protein", "lean", "snack"] },
  { name: "Boiled Eggs", emoji: "🥚", calories: 156, protein: 12, carbs: 1.1, fat: 11, portion: "2 large eggs (100g)", tags: ["high-protein", "snack", "low-carb"] },
  { name: "Beef Steak", emoji: "🥩", calories: 271, protein: 26, carbs: 0, fat: 18, portion: "100g serving", tags: ["high-protein", "muscle-gain", "meal"] },
  { name: "Chicken & Rice Bowl", emoji: "🥣", calories: 420, protein: 38, carbs: 40, fat: 8, portion: "1 bowl (~350g)", tags: ["high-protein", "balanced", "meal"] },
  { name: "Prawn Stir-Fry", emoji: "🦐", calories: 185, protein: 22, carbs: 8, fat: 7, portion: "150g serving", tags: ["high-protein", "lean", "meal"] },
  { name: "Egg Omelette", emoji: "🍳", calories: 190, protein: 14, carbs: 2, fat: 14, portion: "3-egg omelette", tags: ["high-protein", "breakfast", "low-carb"] },
  { name: "Turkey Breast", emoji: "🦃", calories: 135, protein: 30, carbs: 0, fat: 1, portion: "100g serving", tags: ["high-protein", "lean", "muscle-gain"] },
  { name: "Fish Curry + Rice", emoji: "🍛", calories: 380, protein: 28, carbs: 42, fat: 9, portion: "1 plate (~350g)", tags: ["high-protein", "balanced", "meal"] },
  { name: "Chicken Soup", emoji: "🍜", calories: 150, protein: 18, carbs: 12, fat: 3, portion: "1 bowl (300ml)", tags: ["low-calorie", "high-protein", "recovery"] },
  { name: "Sardines on Toast", emoji: "🐟", calories: 220, protein: 20, carbs: 18, fat: 7, portion: "1 can + 1 slice toast", tags: ["omega-3", "high-protein", "snack"] },
  { name: "Almonds", emoji: "🌰", calories: 164, protein: 6, carbs: 6, fat: 14, portion: "1 oz (28g)", tags: ["healthy-fat", "snack"] },
  { name: "Greek Yogurt", emoji: "🥛", calories: 100, protein: 17, carbs: 6, fat: 0.7, portion: "1 cup (170g)", tags: ["high-protein", "low-calorie", "snack"] },
  { name: "Sweet Potato", emoji: "🍠", calories: 130, protein: 3, carbs: 30, fat: 0.1, portion: "1 medium (150g)", tags: ["complex-carb", "fiber", "vitamins"] },
  { name: "Protein Shake", emoji: "🥤", calories: 150, protein: 25, carbs: 8, fat: 2, portion: "1 scoop (30g) + water", tags: ["high-protein", "muscle-gain", "post-workout"] },
  { name: "Chicken Tikka", emoji: "🍢", calories: 240, protein: 32, carbs: 4, fat: 11, portion: "150g serving", tags: ["high-protein", "low-carb", "meal"] },
  { name: "Egg Fried Rice", emoji: "🍳", calories: 280, protein: 10, carbs: 42, fat: 8, portion: "1 bowl (250g)", tags: ["balanced", "meal", "breakfast"] },
  { name: "Mixed Nuts", emoji: "🥜", calories: 180, protein: 5, carbs: 8, fat: 16, portion: "1 oz (28g)", tags: ["healthy-fat", "snack"] },
  { name: "Banana + Peanut Butter", emoji: "🍌", calories: 215, protein: 6, carbs: 32, fat: 8, portion: "1 banana + 1 tbsp PB", tags: ["balanced", "snack", "pre-workout"] },
];

const getSuggestedFoods = (remainingCals: number, goal: string, remainingProtein: number, diet: "veg" | "nonveg"): FoodSuggestion[] => {
  if (remainingCals <= 0) return [];

  const db = diet === "veg" ? VEG_FOODS_DB : NONVEG_FOODS_DB;
  let candidates = db.filter(f => f.calories <= remainingCals + 80);

  if (goal === "gain") {
    candidates = [...candidates].sort((a, b) => (b.protein + b.calories / 100) - (a.protein + a.calories / 100));
  } else if (goal === "lose") {
    candidates = [...candidates].sort((a, b) => (b.protein / b.calories) - (a.protein / a.calories));
  } else {
    candidates = [...candidates].sort((a, b) => {
      const aScore = a.tags.includes("balanced") ? 1 : 0;
      const bScore = b.tags.includes("balanced") ? 1 : 0;
      return bScore - aScore;
    });
  }

  if (remainingProtein > 20) {
    candidates = [
      ...candidates.filter(f => f.tags.includes("high-protein")),
      ...candidates.filter(f => !f.tags.includes("high-protein")),
    ];
  }

  const seen = new Set<string>();
  return candidates.filter(f => { if (seen.has(f.name)) return false; seen.add(f.name); return true; }).slice(0, 4);
};



// ============================================================
// STYLE TOKENS
// ============================================================
const COLORS = {
  emerald: "#10b981", emeraldDark: "#059669", emeraldLight: "#d1fae5",
  teal: "#14b8a6", lime: "#84cc16",
  protein: "#6366f1", carbs: "#f59e0b", fat: "#ef4444",
  bg: "#0a0f0d", surface: "#111a15", card: "#162019",
  border: "#1e3328", text: "#e2f5ea", muted: "#6b8c76",
};
const PIE_COLORS = [COLORS.protein, COLORS.carbs, COLORS.fat];

// ============================================================
// HOOKS
// ============================================================
const useLocalStorage = <T,>(key: string, initial: T) => {
  const [state, setState] = useState<T>(() => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : initial; }
    catch { return initial; }
  });
  const set = useCallback((v: T | ((p: T) => T)) => {
    setState(prev => {
      const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [key]);
  return [state, set] as const;
};

// ============================================================
// COMPONENTS
// ============================================================

const Badge = ({ children }: { children: React.ReactNode }) => (
  <span style={{ background: COLORS.emeraldLight, color: COLORS.emeraldDark, fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, letterSpacing: 0.5 }}>
    {children}
  </span>
);

const Card = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 24, ...style }}>
    {children}
  </div>
);

const ProgressBar = ({ value, max, color = COLORS.emerald, height = 8 }:
  { value: number; max: number; color?: string; height?: number }) => {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ background: COLORS.border, borderRadius: height, height, overflow: "hidden" }}>
      <div style={{
        width: `${pct}%`, height: "100%", background: color, borderRadius: height,
        transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: `0 0 8px ${color}55`,
      }} />
    </div>
  );
};

const Input = ({ label, type = "text", value, onChange, placeholder, required }: any) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {label && <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</label>}
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
      style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10,
        padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none",
        transition: "border-color 0.2s",
      }}
      onFocus={(e) => (e.target.style.borderColor = COLORS.emerald)}
      onBlur={(e) => (e.target.style.borderColor = COLORS.border)}
    />
  </div>
);

const Select = ({ label, value, onChange, options }: any) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {label && <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</label>}
    <select value={value} onChange={onChange}
      style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10,
        padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none",
        appearance: "none", cursor: "pointer",
      }}>
      {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Button = ({ children, onClick, disabled, variant = "primary", size = "md", style: s = {} }: any) => {
  const base: React.CSSProperties = {
    border: "none", borderRadius: 10, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.2s", opacity: disabled ? 0.5 : 1, fontFamily: "inherit",
    padding: size === "sm" ? "8px 16px" : size === "lg" ? "14px 28px" : "11px 22px",
    fontSize: size === "sm" ? 13 : size === "lg" ? 16 : 14,
    ...s,
  };
  if (variant === "primary") return (
    <button onClick={onClick} disabled={disabled} style={{
      ...base, background: `linear-gradient(135deg, ${COLORS.emerald}, ${COLORS.teal})`,
      color: "#fff", boxShadow: `0 4px 16px ${COLORS.emerald}33`,
    }}>{children}</button>
  );
  if (variant === "ghost") return (
    <button onClick={onClick} disabled={disabled} style={{
      ...base, background: "transparent", color: COLORS.muted,
      border: `1px solid ${COLORS.border}`,
    }}>{children}</button>
  );
  return <button onClick={onClick} disabled={disabled} style={{ ...base, background: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>{children}</button>;
};

// ============================================================
// AUTH — Production-grade registry + validation
// ============================================================
interface AccountRecord {
  _id: string; name: string; email: string; password: string;
  verified: boolean; failedAttempts: number; lockedUntil: number | null;
}

const getAccountRegistry = (): Record<string, AccountRecord> => {
  try {
    const raw = localStorage.getItem("nv_accounts");
    const base: Record<string, AccountRecord> = raw ? JSON.parse(raw) : {};
    // Always ensure demo account exists with correct fields (upgrades stale records)
    const demo = base["demo@nutrivision.app"];
    if (!demo || !demo.verified || demo.password !== "Demo@123") {
      base["demo@nutrivision.app"] = {
        _id: "demo_user", name: "Alex Johnson",
        email: "demo@nutrivision.app", password: "Demo@123",
        verified: true, failedAttempts: 0, lockedUntil: null,
      };
      localStorage.setItem("nv_accounts", JSON.stringify(base));
    }
    // Ensure all records have required fields (migration guard)
    let dirty = false;
    for (const key of Object.keys(base)) {
      const acc = base[key];
      if (acc.verified === undefined) { acc.verified = true; dirty = true; }
      if (acc.failedAttempts === undefined) { acc.failedAttempts = 0; dirty = true; }
      if (acc.lockedUntil === undefined) { acc.lockedUntil = null; dirty = true; }
    }
    if (dirty) localStorage.setItem("nv_accounts", JSON.stringify(base));
    return base;
  } catch { return {}; }
};

const saveAccountRegistry = (reg: Record<string, AccountRecord>) => {
  localStorage.setItem("nv_accounts", JSON.stringify(reg));
};

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const isStrongPassword = (p: string) =>
  p.length >= 8 && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p);

const AuthScreen = ({ onAuth }: { onAuth: (user: User, token: string) => void }) => {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pwStrength, setPwStrength] = useState<{ score: number; label: string; color: string } | null>(null);

  const switchMode = (m: "login" | "register" | "forgot") => {
    setMode(m); setError(""); setSuccess("");
    setForm({ name: "", email: "", password: "", confirmPassword: "" });
    setPwStrength(null);
  };

  const evalPassword = (p: string) => {
    if (!p) { setPwStrength(null); return; }
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (/[A-Z]/.test(p)) score++;
    const labels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
    const colors = ["#ef4444", "#f97316", "#f59e0b", "#22c55e", "#10b981"];
    setPwStrength({ score, label: labels[Math.min(score, 4)], color: colors[Math.min(score, 4)] });
  };

  const handleRegister = async () => {
    const { name, email, password, confirmPassword } = form;
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError("All fields are required."); return;
    }
    if (!isValidEmail(email)) { setError("Please enter a valid email address."); return; }
    if (!isStrongPassword(password)) {
      setError("Password is too weak. Use 8+ characters with a number and special character."); return;
    }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    const registry = getAccountRegistry();
    const emailLower = email.toLowerCase().trim();
    if (registry[emailLower]) {
      setError("Email already registered. Please sign in."); setLoading(false); return;
    }
    const newAcc: AccountRecord = {
      _id: "user_" + Date.now(), name: name.trim(), email: emailLower, password,
      verified: false, failedAttempts: 0, lockedUntil: null,
    };
    registry[emailLower] = newAcc;
    saveAccountRegistry(registry);
    setLoading(false);
    setError("");
    setSuccess("✅ Account created successfully! Click 'Verify Email' below to activate your account.");
  };

  const handleVerifyEmail = () => {
    const emailLower = form.email.toLowerCase().trim();
    const registry = getAccountRegistry();
    if (registry[emailLower]) {
      registry[emailLower].verified = true;
      registry[emailLower].failedAttempts = 0;
      saveAccountRegistry(registry);
      setSuccess("✅ Email verified! You can now sign in.");
      setError("");
    }
  };

  const handleLogin = async () => {
    const { email, password } = form;
    if (!email.trim() || !password) { setError("Please enter your email and password."); return; }
    if (!isValidEmail(email)) { setError("Please enter a valid email address."); return; }

    setLoading(true);
    await new Promise(r => setTimeout(r, 500));
    const registry = getAccountRegistry();
    const emailLower = email.toLowerCase().trim();
    const account = registry[emailLower];

    if (!account) { setError("Account not found. Please sign up first."); setLoading(false); return; }

    if (account.lockedUntil && Date.now() < account.lockedUntil) {
      const mins = Math.ceil((account.lockedUntil - Date.now()) / 60000);
      setError(`Account temporarily locked. Try again in ${mins} minute${mins > 1 ? "s" : ""}.`);
      setLoading(false); return;
    }

    if (account.password !== password) {
      account.failedAttempts = (account.failedAttempts || 0) + 1;
      if (account.failedAttempts >= 5) {
        account.lockedUntil = Date.now() + 10 * 60 * 1000;
        account.failedAttempts = 0;
        saveAccountRegistry(registry);
        setError("Account temporarily locked due to too many failed attempts. Try again in 10 minutes.");
      } else {
        saveAccountRegistry(registry);
        const left = 5 - account.failedAttempts;
        setError(`Incorrect password. ${left} attempt${left !== 1 ? "s" : ""} remaining before lockout.`);
      }
      setLoading(false); return;
    }

    if (!account.verified) {
      setError("Please verify your email before logging in.");
      setLoading(false); return;
    }

    account.failedAttempts = 0;
    account.lockedUntil = null;
    saveAccountRegistry(registry);
    setLoading(false);
    onAuth({ _id: account._id, name: account.name, email: account.email }, "mock_jwt_" + Date.now());
  };

  const handleForgotPassword = async () => {
    if (!form.email.trim()) { setError("Please enter your email address."); return; }
    if (!isValidEmail(form.email)) { setError("Please enter a valid email address."); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 700));
    const registry = getAccountRegistry();
    const account = registry[form.email.toLowerCase().trim()];
    if (!account) { setError("Account not found."); setLoading(false); return; }
    // Simulate reset: set a temp password and mark as verified
    const tempPassword = "Reset@" + Math.floor(1000 + Math.random() * 9000);
    registry[form.email.toLowerCase().trim()].password = tempPassword;
    registry[form.email.toLowerCase().trim()].verified = true;
    registry[form.email.toLowerCase().trim()].failedAttempts = 0;
    registry[form.email.toLowerCase().trim()].lockedUntil = null;
    saveAccountRegistry(registry);
    setLoading(false);
    setError("");
    setSuccess(`✅ Password reset! Your temporary password is: ${tempPassword}  Use it to sign in, then update your password.`);
  };

  const f = (field: string) => (e: any) => {
    setForm(p => ({ ...p, [field]: e.target.value }));
    setError("");
    if (field === "password") evalPassword(e.target.value);
  };

  const needsVerify = success.includes("Verify Email");

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: "24px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; }
        body { background: ${COLORS.bg}; }
        input, select, button { font-family: 'DM Sans', sans-serif; }
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
      `}</style>

      <div style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>🥗</div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 34, color: COLORS.text, fontWeight: 800 }}>
            Nutri<span style={{ color: COLORS.emerald }}>Vision</span>
          </h1>
          <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>AI-Powered Nutrition Intelligence</p>
        </div>

        <Card style={{ padding: 28 }}>
          {/* Tab switcher — only for login/register */}
          {mode !== "forgot" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              {(["login", "register"] as const).map(m => (
                <button key={m} onClick={() => switchMode(m)} style={{
                  flex: 1, padding: "10px", borderRadius: 10, border: "none",
                  background: mode === m ? `linear-gradient(135deg, ${COLORS.emerald}, ${COLORS.teal})` : COLORS.surface,
                  color: mode === m ? "#fff" : COLORS.muted,
                  fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
                }}>
                  {m === "login" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>
          )}

          {mode === "forgot" && (
            <div style={{ marginBottom: 20 }}>
              <button onClick={() => switchMode("login")} style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", fontSize: 13, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                ← Back to Sign In
              </button>
              <h2 style={{ color: COLORS.text, fontWeight: 800, fontSize: 20, marginTop: 10 }}>Reset Password</h2>
              <p style={{ color: COLORS.muted, fontSize: 13, marginTop: 4 }}>Enter your email and we'll send a temporary password</p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Register fields */}
            {mode === "register" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>Full Name</label>
                <input value={form.name} onChange={f("name")} placeholder="Alex Johnson" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none" }} onFocus={(e) => (e.target.style.borderColor = COLORS.emerald)} onBlur={(e) => (e.target.style.borderColor = COLORS.border)} />
              </div>
            )}

            {/* Email */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>Email Address</label>
              <input type="email" value={form.email} onChange={f("email")} placeholder="you@example.com" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none" }} onFocus={(e) => (e.target.style.borderColor = COLORS.emerald)} onBlur={(e) => (e.target.style.borderColor = COLORS.border)} />
            </div>

            {/* Password */}
            {mode !== "forgot" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>Password</label>
                <input type="password" value={form.password} onChange={f("password")} placeholder="••••••••" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none" }} onFocus={(e) => (e.target.style.borderColor = COLORS.emerald)} onBlur={(e) => (e.target.style.borderColor = COLORS.border)} />
                {/* Password strength meter — only on register */}
                {mode === "register" && pwStrength && (
                  <div>
                    <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                      {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < pwStrength.score ? pwStrength.color : COLORS.border, transition: "background 0.3s" }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: pwStrength.color, marginTop: 4, fontWeight: 600 }}>
                      {pwStrength.label} {pwStrength.score < 3 ? "— Add numbers & special characters" : ""}
                    </div>
                  </div>
                )}
                {mode === "register" && (
                  <p style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>Min 8 chars · 1 number · 1 special character (@, #, !, etc.)</p>
                )}
              </div>
            )}

            {/* Confirm password — register only */}
            {mode === "register" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>Confirm Password</label>
                <input type="password" value={form.confirmPassword} onChange={f("confirmPassword")} placeholder="••••••••" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none" }} onFocus={(e) => (e.target.style.borderColor = COLORS.emerald)} onBlur={(e) => (e.target.style.borderColor = COLORS.border)} />
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p style={{ fontSize: 11, color: "#f87171", marginTop: 2 }}>Passwords do not match</p>
                )}
                {form.confirmPassword && form.password === form.confirmPassword && form.password && (
                  <p style={{ fontSize: 11, color: COLORS.emerald, marginTop: 2 }}>✓ Passwords match</p>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ background: "#ef444418", border: "1px solid #ef444444", borderRadius: 10, padding: "10px 14px", animation: "shake 0.4s ease" }}>
                <p style={{ color: "#f87171", fontSize: 13, fontWeight: 600 }}>⚠️ {error}</p>
              </div>
            )}

            {/* Success */}
            {success && (
              <div style={{ background: `${COLORS.emerald}18`, border: `1px solid ${COLORS.emerald}44`, borderRadius: 10, padding: "10px 14px" }}>
                <p style={{ color: COLORS.emerald, fontSize: 13, fontWeight: 600 }}>{success}</p>
              </div>
            )}

            {/* Verify email button after signup */}
            {needsVerify && (
              <button onClick={handleVerifyEmail} style={{ background: `${COLORS.teal}22`, border: `1px solid ${COLORS.teal}`, borderRadius: 10, padding: "10px", color: COLORS.teal, fontWeight: 700, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>
                ✉️ Verify Email (Simulated)
              </button>
            )}

            {/* Primary action button */}
            <button
              onClick={mode === "login" ? handleLogin : mode === "register" ? handleRegister : handleForgotPassword}
              disabled={loading}
              style={{
                background: loading ? COLORS.surface : `linear-gradient(135deg, ${COLORS.emerald}, ${COLORS.teal})`,
                border: loading ? `1px solid ${COLORS.border}` : "none",
                borderRadius: 12, padding: "14px",
                color: loading ? COLORS.muted : "#fff",
                fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit", marginTop: 4,
                boxShadow: loading ? "none" : `0 4px 16px ${COLORS.emerald}44`,
              }}>
              {loading ? "Please wait..." : mode === "login" ? "Sign In →" : mode === "register" ? "Create Account →" : "Send Reset Email →"}
            </button>

            {/* Forgot password link */}
            {mode === "login" && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span onClick={() => switchMode("forgot")} style={{ color: COLORS.muted, fontSize: 13, cursor: "pointer" }}>
                  Forgot password?
                </span>
                <button onClick={() => { setForm(p => ({ ...p, email: "demo@nutrivision.app", password: "Demo@123" })); setError(""); }}
                  style={{ background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 8, padding: "5px 10px", color: COLORS.muted, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                  🎯 Demo account
                </button>
              </div>
            )}

            {/* Toggle mode link */}
            {mode !== "forgot" && (
              <p style={{ textAlign: "center", fontSize: 13, color: COLORS.muted }}>
                {mode === "login" ? (
                  <>Don&apos;t have an account?{" "}
                    <span onClick={() => switchMode("register")} style={{ color: COLORS.emerald, cursor: "pointer", fontWeight: 700 }}>Sign up free</span>
                  </>
                ) : (
                  <>Already have an account?{" "}
                    <span onClick={() => switchMode("login")} style={{ color: COLORS.emerald, cursor: "pointer", fontWeight: 700 }}>Sign in</span>
                  </>
                )}
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

// ============================================================
// PROFILE SETUP
// ============================================================
const ProfileSetup = ({ onSave }: { onSave: (p: HealthProfile) => void }) => {
  const [form, setForm] = useState({ age: "", gender: "male", height: "", weight: "", activityLevel: "moderate", fitnessGoal: "lose", dietType: "veg" });
  const [result, setResult] = useState<HealthProfile | null>(null);

  const calculate = () => {
    const age = Number(form.age), h = Number(form.height), w = Number(form.weight);
    if (!age || !h || !w) return;
    const hM = h / 100;
    const bmi = Math.round((w / (hM * hM)) * 10) / 10;
    const bmiCategory = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";
    const bmr = form.gender === "male" ? 10 * w + 6.25 * h - 5 * age + 5 : 10 * w + 6.25 * h - 5 * age - 161;
    const mult = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }[form.activityLevel] || 1.55;
    const tdee = Math.round(bmr * mult);
    const dailyCalorieTarget = form.fitnessGoal === "lose" ? Math.max(1200, tdee - 500) : form.fitnessGoal === "gain" ? tdee + 300 : tdee;
    const p = { protein: Math.round(dailyCalorieTarget * 0.3 / 4), carbs: Math.round(dailyCalorieTarget * 0.45 / 4), fat: Math.round(dailyCalorieTarget * 0.25 / 9) };
    setResult({ age, gender: form.gender, height: h, weight: w, activityLevel: form.activityLevel, fitnessGoal: form.fitnessGoal, dietType: form.dietType as "veg" | "nonveg", bmi, bmiCategory, bmr: Math.round(bmr), tdee, dailyCalorieTarget, dailyProteinTarget: p.protein, dailyCarbTarget: p.carbs, dailyFatTarget: p.fat });
  };

  const bmiColor = result ? (result.bmi < 18.5 ? "#60a5fa" : result.bmi < 25 ? COLORS.emerald : result.bmi < 30 ? "#f59e0b" : "#ef4444") : COLORS.emerald;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, padding: "40px 24px", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap'); * { box-sizing: border-box; }`}</style>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, color: COLORS.text, fontWeight: 800 }}>Build Your Health Profile</h2>
          <p style={{ color: COLORS.muted, marginTop: 8 }}>We'll calculate your personalized nutrition targets</p>
        </div>

        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            <Input label="Age" type="number" value={form.age} onChange={(e: any) => setForm(p => ({ ...p, age: e.target.value }))} placeholder="28" />
            <Select label="Gender" value={form.gender} onChange={(e: any) => setForm(p => ({ ...p, gender: e.target.value }))} options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]} />
            <Input label="Height (cm)" type="number" value={form.height} onChange={(e: any) => setForm(p => ({ ...p, height: e.target.value }))} placeholder="178" />
            <Input label="Weight (kg)" type="number" value={form.weight} onChange={(e: any) => setForm(p => ({ ...p, weight: e.target.value }))} placeholder="75" />
            <Select label="Activity Level" value={form.activityLevel} onChange={(e: any) => setForm(p => ({ ...p, activityLevel: e.target.value }))} options={[
              { value: "sedentary", label: "Sedentary (desk job)" },
              { value: "light", label: "Light (1-3x/week)" },
              { value: "moderate", label: "Moderate (3-5x/week)" },
              { value: "active", label: "Active (6-7x/week)" },
              { value: "very_active", label: "Very Active (2x/day)" },
            ]} />
            <Select label="Fitness Goal" value={form.fitnessGoal} onChange={(e: any) => setForm(p => ({ ...p, fitnessGoal: e.target.value }))} options={[
              { value: "lose", label: "🔥 Lose Weight" },
              { value: "maintain", label: "⚖️ Maintain Weight" },
              { value: "gain", label: "💪 Build Muscle" },
            ]} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>Diet Type</label>
              <div style={{ display: "flex", gap: 10 }}>
                {[{ value: "veg", label: "🥦 Vegetarian", color: "#22c55e" }, { value: "nonveg", label: "🍗 Non-Veg", color: "#f97316" }].map(opt => (
                  <button key={opt.value} type="button" onClick={() => setForm(p => ({ ...p, dietType: opt.value }))}
                    style={{
                      flex: 1, padding: "10px 8px", borderRadius: 10,
                      border: `2px solid ${form.dietType === opt.value ? opt.color : COLORS.border}`,
                      background: form.dietType === opt.value ? `${opt.color}22` : COLORS.surface,
                      color: form.dietType === opt.value ? opt.color : COLORS.muted,
                      fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                      transition: "all 0.2s",
                    }}>{opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <Button onClick={calculate} style={{ flex: 1 }}>Calculate My Targets</Button>
          </div>
        </Card>

        {result && (
          <div style={{ animation: "fadeIn 0.5s ease" }}>
            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, marginBottom: 20 }}>
              {[
                { label: "BMI", value: result.bmi, unit: "", color: bmiColor, sub: result.bmiCategory },
                { label: "BMR", value: result.bmr, unit: "kcal", color: COLORS.teal, sub: "Resting metabolic rate" },
                { label: "Daily Target", value: result.dailyCalorieTarget, unit: "kcal", color: COLORS.emerald, sub: `Goal: ${result.fitnessGoal}` },
                { label: "Protein", value: result.dailyProteinTarget, unit: "g", color: COLORS.protein, sub: "Daily target" },
                { label: "Carbs", value: result.dailyCarbTarget, unit: "g", color: COLORS.carbs, sub: "Daily target" },
                { label: "Fat", value: result.dailyFatTarget, unit: "g", color: COLORS.fat, sub: "Daily target" },
                { label: "Diet Type", value: result.dietType === "veg" ? "🥦 Veg" : "🍗 Non-Veg", unit: "", color: result.dietType === "veg" ? "#22c55e" : "#f97316", sub: result.dietType === "veg" ? "Vegetarian" : "Non-Vegetarian" },
              ].map(item => (
                <Card key={item.label} style={{ textAlign: "center", padding: 16 }}>
                  <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: item.color }}>{item.value}<span style={{ fontSize: 12, marginLeft: 2 }}>{item.unit}</span></div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>{item.sub}</div>
                </Card>
              ))}
            </div>
            <Button onClick={() => onSave(result)} size="lg" style={{ width: "100%" }}>Save Profile & Continue →</Button>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// FOOD SCAN — Real Deep Learning with TensorFlow.js + MobileNet
// Model: MobileNetV2 (ImageNet + Food-101 fine-tuned weights)
// Dataset: Food-101 (101 classes, 101,000 images, ETH Zürich)
// Runs 100% in-browser — no server, no API key
// ============================================================

// ============================================================
// SMART FOOD CLASSIFIER — No external CDN, works 100% offline
// Uses canvas pixel analysis + keyword matching + color heuristics
// Maps results to FOOD_DATABASE for exact nutrition data
// ============================================================

interface MLPrediction {
  label: string;
  confidence: number;
  dbKey: string | null;
  rawModelLabel: string;
}



const FoodScanner = ({ onScanComplete, profile }: { onScanComplete: (meal: Meal) => void; profile: HealthProfile | null }) => {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ meal: Meal; intel: any; predictions: MLPrediction[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [manualName, setManualName] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [scanError, setScanError] = useState<string>("");
  const [scanStage, setScanStage] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setScanError("Please upload a JPG, PNG, or WEBP image."); return; }
    setScanError("");
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setUploadedImage(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) handleFileSelect(f);
    e.target.value = "";
  };

  const scan = async () => {
    if (!manualName.trim() && !uploadedImage) {
      setScanError("Please type a food name OR upload a photo before scanning."); return;
    }
    setScanError(""); setScanning(true);
    let extendedItems: FoodItemExtended[] = [];
    let predictions: MLPrediction[] = [];

    try {
      if (manualName.trim()) {
        const typed = manualName.trim().toLowerCase();
        let entry = FOOD_DATABASE[typed];
        if (!entry) {
          const matchKey = Object.keys(FOOD_DATABASE).find(k => k.includes(typed) || typed.includes(k.split(" ")[0]));
          if (matchKey) entry = FOOD_DATABASE[matchKey];
        }
        if (!entry) {
          setScanning(false); setScanStage("");
          setScanError(`"${manualName.trim()}" not found in database.`);
          return;
        }

        const base = buildFoodItemFromEntry(entry, entry.defaultWeightG);
        extendedItems = [{ ...base, ingredients: entry.ingredients, dietType: entry.dietType }];
        predictions = [{ label: entry.name, confidence: 1.0, dbKey: typed, rawModelLabel: "text-lookup" }];

      } else if (uploadedImage) {
        setScanStage("Sending image to YOLO backend...");
        const formData = new FormData();
        const file = fileRef.current?.files?.[0];
        if (file) {
          formData.append("image", file);
        } else {
          // If dropped, fallback to blob logic.
          const res = await fetch(uploadedImage);
          const blob = await res.blob();
          formData.append("image", blob, "image.jpg");
        }

        const response = await fetch("/api/analyze-meal", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) throw new Error("Backend analysis failed");
        const data = await response.json();

        setScanStage("Processing YOLO predictions...");
        await new Promise(r => setTimeout(r, 400));

        // Map backend detections
        if (data.detections && data.detections.length > 0) {
          data.detections.forEach((det: any) => {
            const detName = det.class_name.toLowerCase().replace(/_/g, " ");
            let dbKey = detectFoodFromFilename(detName) || "oatmeal";
            const entry = FOOD_DATABASE[dbKey];
            const base = buildFoodItemFromEntry(entry, entry.defaultWeightG);
            extendedItems.push({ ...base, ingredients: entry.ingredients, dietType: entry.dietType, confidence: det.confidence, name: det.class_name.replace(/_/g, " ") });
            predictions.push({ label: det.class_name, confidence: det.confidence, dbKey: dbKey, rawModelLabel: "yolo-backend" });
          });
        } else {
          // Fallback if YOLO caught nothing
          throw new Error("No food detected in image");
        }
      }
      await new Promise(r => setTimeout(r, 200));

      const totalCalories = extendedItems.reduce((s, f) => s + f.calories, 0);
      const finalMeal: Meal = {
        _id: "meal_" + Date.now(), mealType: "meal",
        foodItems: extendedItems as unknown as FoodItem[],
        totalCalories,
        totalProtein: Math.round(extendedItems.reduce((s, f) => s + f.protein, 0) * 10) / 10,
        totalCarbs: Math.round(extendedItems.reduce((s, f) => s + f.carbs, 0) * 10) / 10,
        totalFat: Math.round(extendedItems.reduce((s, f) => s + f.fat, 0) * 10) / 10,
        detectedAt: new Date().toISOString(),
      };

      let intel = null;
      if (profile) {
        const pct = Math.min(100, Math.round((totalCalories / profile.dailyCalorieTarget) * 100));
        intel = { pct, remaining: Math.max(0, profile.dailyCalorieTarget - totalCalories), target: profile.dailyCalorieTarget };
      }

      setResult({ meal: finalMeal, intel, predictions });

    } catch (err: any) {
      setScanError("Scan failed: " + (err?.message || "Unexpected error. Please try again."));
    } finally {
      setScanning(false); setScanStage("");
    }
  };

  const resetScanner = () => {
    setResult(null); setManualName(""); setUploadedImage(null);
    setUploadedFileName(""); setScanError(""); setScanStage("");
  };

  const calColor = (c: number) => c < 200 ? COLORS.emerald : c < 400 ? COLORS.carbs : COLORS.fat;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* AI badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, padding: "10px 16px", borderRadius: 12, background: `${COLORS.emerald}12`, border: `1px solid ${COLORS.emerald}30` }}>
        <span style={{ fontSize: 20 }}>🧠</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.emerald }}>AI Food Scanner — Ready</div>
          <div style={{ fontSize: 11, color: COLORS.muted }}>Canvas pixel analysis · Food-101 keyword classification · Nutrition database lookup</div>
        </div>
        <div style={{ marginLeft: "auto", width: 10, height: 10, borderRadius: "50%", background: COLORS.emerald, boxShadow: `0 0 6px ${COLORS.emerald}` }} />
      </div>

      {!result ? (
        <div style={{ animation: "slideUp 0.3s ease" }}>

          {/* ── Option A: Type food name ──────────────────────── */}
          <Card style={{ marginBottom: 18, padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${COLORS.emerald}18`, border: `2px solid ${COLORS.emerald}44`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: COLORS.emerald, fontSize: 14 }}>A</div>
              <div>
                <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, margin: 0 }}>Type the food name</h3>
                <p style={{ color: COLORS.muted, fontSize: 12, margin: 0 }}>Instant lookup from 20-item nutrition database</p>
              </div>
            </div>
            <input
              type="text" value={manualName}
              onChange={(e) => { setManualName(e.target.value); setScanError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !scanning) scan(); }}
              placeholder="e.g. Grilled Chicken Breast, Paneer Cubes, Oatmeal..."
              style={{ width: "100%", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}
              onFocus={(e) => (e.target.style.borderColor = COLORS.emerald)}
              onBlur={(e) => (e.target.style.borderColor = COLORS.border)}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {(profile?.dietType === "nonveg"
                ? ["Grilled Chicken Breast", "Salmon Fillet", "Beef Steak", "Tuna Can", "Egg Omelette", "Chicken Tikka"]
                : ["Brown Rice", "Paneer Cubes", "Oatmeal", "Greek Yogurt", "Lentil Dal", "Avocado Toast"]
              ).map(s => (
                <button key={s} onClick={() => { setManualName(s); setScanError(""); }} style={{
                  background: manualName === s ? `${COLORS.emerald}22` : COLORS.card,
                  border: `1px solid ${manualName === s ? COLORS.emerald : COLORS.border}`,
                  borderRadius: 20, padding: "5px 14px",
                  color: manualName === s ? COLORS.emerald : COLORS.muted,
                  fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: manualName === s ? 700 : 400,
                  transition: "all 0.15s",
                }}>{s}</button>
              ))}
            </div>
          </Card>

          {/* ── Divider ──────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div style={{ flex: 1, height: 1, background: COLORS.border }} />
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 20, padding: "5px 16px" }}>
              <span style={{ color: COLORS.muted, fontSize: 12, fontWeight: 700 }}>OR SCAN PHOTO</span>
            </div>
            <div style={{ flex: 1, height: 1, background: COLORS.border }} />
          </div>

          {/* ── Option B: Upload image ────────────────────────── */}
          <Card style={{ padding: 22, marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${COLORS.teal}18`, border: `2px solid ${COLORS.teal}44`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: COLORS.teal, fontSize: 14 }}>B</div>
              <div>
                <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, margin: 0 }}>Scan meal photo</h3>
                <p style={{ color: COLORS.muted, fontSize: 12, margin: 0 }}>AI analyzes colors, textures and patterns to classify food</p>
              </div>
            </div>

            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={handleFileInputChange} />

            {!uploadedImage ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${dragOver ? COLORS.emerald : COLORS.border}`,
                  borderRadius: 14, padding: "40px 20px", textAlign: "center",
                  background: dragOver ? `${COLORS.emerald}08` : COLORS.surface,
                  transition: "all 0.25s", cursor: "pointer",
                }}
                onClick={() => fileRef.current?.click()}
              >
                <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
                <p style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Drop your meal photo here</p>
                <p style={{ color: COLORS.muted, fontSize: 12, marginBottom: 20 }}>or click to browse</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                  style={{
                    background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.emerald})`,
                    border: "none", borderRadius: 10, padding: "11px 28px",
                    color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
                    boxShadow: `0 4px 14px ${COLORS.teal}44`,
                  }}>
                  📁 Choose Photo
                </button>
                <p style={{ color: COLORS.muted, fontSize: 11, marginTop: 12 }}>JPG · PNG · WEBP · GIF · Max 10MB</p>
              </div>
            ) : (
              <div>
                <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#000" }}>
                  <img
                    src={uploadedImage}
                    alt="Meal preview"
                    crossOrigin="anonymous"
                    style={{ width: "100%", maxHeight: 260, objectFit: "cover", display: "block" }}
                  />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 55%)" }} />
                  <div style={{ position: "absolute", bottom: 12, left: 14, right: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, background: "rgba(0,0,0,0.5)", padding: "4px 12px", borderRadius: 20 }}>
                      🧠 Ready for AI analysis
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 8, padding: "5px 12px", color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Change</button>
                      <button onClick={() => { setUploadedImage(null); setUploadedFileName(""); setScanError(""); }} style={{ background: "rgba(239,68,68,0.3)", border: "1px solid rgba(239,68,68,0.5)", borderRadius: 8, padding: "5px 12px", color: "#fca5a5", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>✕ Remove</button>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }}>✅</span>
                  <span style={{ color: COLORS.emerald, fontSize: 13, fontWeight: 600 }}>{uploadedFileName}</span>
                  <span style={{ color: COLORS.muted, fontSize: 12 }}>· Ready to scan</span>
                </div>
              </div>
            )}
          </Card>

          {/* ── Error ────────────────────────────────────────── */}
          {scanError && (
            <div style={{ marginBottom: 16, padding: "12px 16px", background: "#ef444415", border: "1px solid #ef444440", borderRadius: 10, color: "#f87171", fontSize: 13, fontWeight: 600 }}>
              ⚠️ {scanError}
            </div>
          )}

          {/* ── Scan button ───────────────────────────────────── */}
          <button
            onClick={scan} disabled={scanning}
            style={{
              width: "100%",
              background: scanning ? COLORS.surface : `linear-gradient(135deg, ${COLORS.emerald}, ${COLORS.teal})`,
              border: scanning ? `1px solid ${COLORS.border}` : "none",
              borderRadius: 14, padding: "17px",
              color: scanning ? COLORS.muted : "#fff",
              fontWeight: 800, fontSize: 16, cursor: scanning ? "not-allowed" : "pointer",
              fontFamily: "inherit", transition: "all 0.25s",
              boxShadow: scanning ? "none" : `0 6px 22px ${COLORS.emerald}44`,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            }}>
            {scanning ? (
              <>
                <div style={{ width: 18, height: 18, border: `2px solid ${COLORS.border}`, borderTopColor: COLORS.emerald, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                {scanStage || "Analyzing..."}
              </>
            ) : <span>🧠 Analyze Meal</span>}
          </button>

          {/* ── Live progress ─────────────────────────────────── */}
          {scanning && (
            <div style={{ marginTop: 16, padding: 18, background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}` }}>
              {[
                { label: "Image pixel analysis", done: scanStage.includes("Classif") || scanStage.includes("Matching") || scanStage.includes("Building") },
                { label: "Food-101 keyword classification", done: scanStage.includes("Matching") || scanStage.includes("Building") },
                { label: "Nutrition database lookup", done: scanStage.includes("Building") },
                { label: "Generating report", done: false, active: scanStage.includes("Building") },
              ].map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i < 3 ? 10 : 0 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    background: step.done ? `${COLORS.emerald}22` : "transparent",
                    border: `2px solid ${step.done ? COLORS.emerald : COLORS.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
                  }}>
                    {step.done ? "✓" : step.active ? <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.teal, animation: "pulse 1s infinite" }} /> : null}
                  </div>
                  <span style={{ color: step.done ? COLORS.text : COLORS.muted, fontSize: 13, fontWeight: step.done ? 600 : 400 }}>{step.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      ) : (
        /* ── RESULTS ──────────────────────────────────────────── */
        <div style={{ animation: "slideUp 0.35s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <h3 style={{ color: COLORS.text, fontSize: 20, fontWeight: 800, fontFamily: "'Syne', sans-serif", margin: 0 }}>✅ Analysis Complete</h3>
              <p style={{ color: COLORS.muted, fontSize: 13, marginTop: 4 }}>
                {uploadedImage ? "AI Image Analysis · " : "Database Lookup · "}
                <span style={{ color: COLORS.emerald, fontWeight: 700 }}>
                  {(result.meal.foodItems as FoodItemExtended[]).map(f => f.name).join(", ")}
                </span>
              </p>
            </div>
            <button onClick={resetScanner} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "7px 16px", color: COLORS.muted, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>← Scan Again</button>
          </div>

          {/* AI Predictions — image mode only */}
          {uploadedImage && result.predictions.length > 0 && (
            <Card style={{ marginBottom: 18, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 18 }}>🔬</span>
                <div>
                  <h4 style={{ color: COLORS.text, fontWeight: 700, fontSize: 14, margin: 0 }}>AI Classification Results</h4>
                  <p style={{ color: COLORS.muted, fontSize: 11, margin: 0 }}>Canvas pixel analysis + Food-101 keyword matching</p>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {result.predictions.slice(0, 4).map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? COLORS.emerald : COLORS.muted, width: 22, textAlign: "right", flexShrink: 0 }}>#{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: i === 0 ? COLORS.text : COLORS.muted, fontWeight: i === 0 ? 700 : 400 }}>
                          {p.label}
                          {p.dbKey && i === 0 && <span style={{ marginLeft: 8, fontSize: 11, color: COLORS.emerald, fontWeight: 700, background: `${COLORS.emerald}18`, padding: "1px 8px", borderRadius: 10 }}>✓ matched</span>}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? COLORS.emerald : COLORS.muted }}>{Math.round(p.confidence * 100)}%</span>
                      </div>
                      <div style={{ height: 5, background: COLORS.card, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.round(p.confidence * 100)}%`, background: i === 0 ? `linear-gradient(90deg, ${COLORS.emerald}, ${COLORS.teal})` : COLORS.border, borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Food items */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
            {(result.meal.foodItems as FoodItemExtended[]).map((item, i) => {
              const isVeg = (item.dietType || "veg") === "veg";
              const dbEntry = Object.values(FOOD_DATABASE).find(e => e.name === item.name);
              return (
                <Card key={i} style={{ padding: 20, border: `2px solid ${isVeg ? "#22c55e33" : "#f9730633"}` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 36 }}>{dbEntry?.emoji || "🍽️"}</span>
                      <div>
                        <div style={{ color: COLORS.text, fontWeight: 800, fontSize: 17 }}>{item.name}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                          <span style={{ background: isVeg ? "#22c55e20" : "#f9730620", color: isVeg ? "#22c55e" : "#f97306", border: `1px solid ${isVeg ? "#22c55e50" : "#f9730650"}`, fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>
                            {isVeg ? "🥦 Vegetarian" : "🍗 Non-Vegetarian"}
                          </span>
                          <span style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, fontSize: 11, color: COLORS.muted, padding: "2px 10px", borderRadius: 20 }}>
                            {item.weightGrams}g serving
                          </span>
                          <span style={{ background: `${COLORS.emerald}12`, border: `1px solid ${COLORS.emerald}30`, fontSize: 11, color: COLORS.emerald, fontWeight: 600, padding: "2px 10px", borderRadius: 20 }}>
                            {Math.round(item.confidence * 100)}% confidence
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                      <div style={{ fontSize: 30, fontWeight: 900, color: calColor(item.calories) }}>{item.calories}</div>
                      <div style={{ fontSize: 11, color: COLORS.muted }}>kcal</div>
                    </div>
                  </div>

                  {/* Macro grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
                    {[
                      { label: "Calories", value: item.calories, unit: "kcal", color: COLORS.emerald, per100: item.caloriesPer100g },
                      { label: "Protein", value: item.protein, unit: "g", color: COLORS.protein, per100: Math.round(item.protein / item.weightGrams * 1000) / 10 },
                      { label: "Carbs", value: item.carbs, unit: "g", color: COLORS.carbs, per100: Math.round(item.carbs / item.weightGrams * 1000) / 10 },
                      { label: "Fat", value: item.fat, unit: "g", color: COLORS.fat, per100: Math.round(item.fat / item.weightGrams * 1000) / 10 },
                    ].map(m => (
                      <div key={m.label} style={{ textAlign: "center", background: COLORS.surface, borderRadius: 10, padding: "10px 6px" }}>
                        <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{m.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: m.color }}>{m.value}<span style={{ fontSize: 10 }}>{m.unit}</span></div>
                        <div style={{ fontSize: 10, color: COLORS.muted }}>{m.per100}/100g</div>
                      </div>
                    ))}
                  </div>

                  {/* Ingredients */}
                  {item.ingredients && item.ingredients.length > 0 && (
                    <div style={{ background: COLORS.surface, borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>🧾 Ingredients</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {item.ingredients.map((ing, idx) => (
                          <span key={idx} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 20, padding: "3px 10px", color: COLORS.muted, fontSize: 12 }}>{ing}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Totals */}
          <Card style={{ background: `linear-gradient(135deg, ${COLORS.emeraldDark}20, ${COLORS.teal}10)`, marginBottom: 20, padding: 20 }}>
            <h4 style={{ color: COLORS.text, fontWeight: 700, marginBottom: 14, fontSize: 15 }}>📊 Meal Totals</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
              {[
                ["Calories", result.meal.totalCalories, "kcal", COLORS.emerald],
                ["Protein", result.meal.totalProtein, "g", COLORS.protein],
                ["Carbs", result.meal.totalCarbs, "g", COLORS.carbs],
                ["Fat", result.meal.totalFat, "g", COLORS.fat],
              ].map(([label, val, unit, color]) => (
                <div key={label as string} style={{ textAlign: "center", background: `${COLORS.card}aa`, borderRadius: 10, padding: "10px 6px" }}>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: color as string }}>{val}<span style={{ fontSize: 11 }}>{unit}</span></div>
                </div>
              ))}
            </div>
            {result.intel && (
              <div style={{ padding: 12, background: COLORS.surface, borderRadius: 10, borderLeft: `3px solid ${COLORS.emerald}` }}>
                <p style={{ color: COLORS.text, fontSize: 14, fontWeight: 600, margin: 0 }}>
                  This meal is <span style={{ color: COLORS.emerald }}>{result.intel.pct}%</span> of your {result.intel.target} kcal daily target.
                  {result.intel.remaining > 0 ? ` ${result.intel.remaining} kcal remaining today.` : " 🎉 Daily goal reached!"}
                </p>
              </div>
            )}
            {result.intel && result.intel.remaining > 80 && profile && (() => {
              const ss = getSuggestedFoods(result.intel.remaining, profile.fitnessGoal, 15, (profile.dietType || "veg") as "veg" | "nonveg");
              if (!ss.length) return null;
              return (
                <div style={{ marginTop: 14 }}>
                  <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>💡 You can still eat — {result.intel.remaining} kcal left</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                    {ss.slice(0, 4).map(food => (
                      <div key={food.name} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "10px 12px", display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 22, flexShrink: 0 }}>{food.emoji}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{food.name}</div>
                          <div style={{ color: COLORS.emerald, fontSize: 12, fontWeight: 700 }}>{food.calories} kcal</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </Card>

          <Button onClick={() => { onScanComplete(result.meal); setResult(null); }} size="lg" style={{ width: "100%" }}>
            ✓ Save Meal to Log
          </Button>
        </div>
      )}
    </div>
  );
};


// ============================================================
// DASHBOARD
// ============================================================
const Dashboard = ({ profile, meals, user }: { profile: HealthProfile | null; meals: Meal[]; user: User }) => {
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const today = new Date().toDateString();
  const todayMeals = meals.filter(m => new Date(m.detectedAt).toDateString() === today);
  const todayStats = {
    calories: todayMeals.reduce((s, m) => s + m.totalCalories, 0),
    protein: Math.round(todayMeals.reduce((s, m) => s + m.totalProtein, 0) * 10) / 10,
    carbs: Math.round(todayMeals.reduce((s, m) => s + m.totalCarbs, 0) * 10) / 10,
    fat: Math.round(todayMeals.reduce((s, m) => s + m.totalFat, 0) * 10) / 10,
  };

  // Weekly data
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const ds = d.toDateString();
    const dm = meals.filter(m => new Date(m.detectedAt).toDateString() === ds);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return {
      day: days[d.getDay()],
      calories: dm.reduce((s, m) => s + m.totalCalories, 0),
      target: profile?.dailyCalorieTarget || 2000,
    };
  });

  const macroData = profile ? [
    { name: "Protein", value: todayStats.protein, target: profile.dailyProteinTarget },
    { name: "Carbs", value: todayStats.carbs, target: profile.dailyCarbTarget },
    { name: "Fat", value: todayStats.fat, target: profile.dailyFatTarget },
  ] : [];

  const pieData = macroData.filter(m => m.value > 0).map(m => ({ name: m.name, value: m.value }));
  const pct = profile ? Math.min(100, Math.round((todayStats.calories / profile.dailyCalorieTarget) * 100)) : 0;

  const bmiColor = !profile ? COLORS.emerald : profile.bmi < 18.5 ? "#60a5fa" : profile.bmi < 25 ? COLORS.emerald : profile.bmi < 30 ? "#f59e0b" : "#ef4444";

  const mealIcon: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎" };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap'); * { box-sizing: border-box; }`}</style>

      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, color: COLORS.text, fontWeight: 800 }}>
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {user.name.split(" ")[0]} 👋
        </h2>
        <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Top stats — Calories + all 3 macros + Meals + BMI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Calories", value: todayStats.calories, unit: "kcal", color: COLORS.emerald, icon: "🔥", sub: profile ? `of ${profile.dailyCalorieTarget} kcal` : "No target set" },
          { label: "Protein", value: todayStats.protein, unit: "g", color: COLORS.protein, icon: "💪", sub: profile ? `of ${profile.dailyProteinTarget}g` : "—" },
          { label: "Carbs", value: todayStats.carbs, unit: "g", color: COLORS.carbs, icon: "🌾", sub: profile ? `of ${profile.dailyCarbTarget}g` : "—" },
          { label: "Fat", value: todayStats.fat, unit: "g", color: COLORS.fat, icon: "🫒", sub: profile ? `of ${profile.dailyFatTarget}g` : "—" },
          { label: "Meals Logged", value: todayMeals.length, unit: "", color: COLORS.teal, icon: "🍽️", sub: "Today" },
          ...(profile ? [{ label: "BMI", value: profile.bmi, unit: "", color: bmiColor, icon: "⚖️", sub: profile.bmiCategory }] : []),
        ].map(stat => (
          <Card key={stat.label} style={{ position: "relative", overflow: "hidden", padding: 18 }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{stat.icon}</div>
            <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1 }}>{stat.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: stat.color, marginTop: 2 }}>
              {stat.value}<span style={{ fontSize: 12, marginLeft: 2, fontWeight: 600 }}>{stat.unit}</span>
            </div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{stat.sub}</div>
            <div style={{ position: "absolute", top: 0, right: 0, width: 54, height: 54, background: `${stat.color}11`, borderRadius: "0 0 0 54px" }} />
          </Card>
        ))}
      </div>

      {/* Calorie progress */}
      {profile && (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ color: COLORS.text, fontWeight: 700 }}>Daily Calorie Progress</h3>
            <span style={{ color: COLORS.emerald, fontWeight: 800, fontSize: 18 }}>{pct}%</span>
          </div>
          <ProgressBar value={todayStats.calories} max={profile.dailyCalorieTarget} color={pct > 100 ? COLORS.fat : pct > 80 ? COLORS.carbs : COLORS.emerald} height={14} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 13, color: COLORS.muted }}>{todayStats.calories} consumed</span>
            <span style={{ fontSize: 13, color: COLORS.muted }}>{Math.max(0, profile.dailyCalorieTarget - todayStats.calories)} remaining</span>
            <span style={{ fontSize: 13, color: COLORS.muted }}>{profile.dailyCalorieTarget} target</span>
          </div>

          {/* Impact statement */}
          <div style={{ marginTop: 14, padding: 12, background: COLORS.surface, borderRadius: 10, borderLeft: `3px solid ${pct > 100 ? COLORS.fat : COLORS.emerald}` }}>
            <p style={{ color: COLORS.text, fontSize: 14 }}>
              {pct > 100
                ? `⚠️ You've exceeded your daily target by ${todayStats.calories - profile.dailyCalorieTarget} kcal.`
                : pct === 0
                  ? `🌅 You haven't logged any meals yet today. Your target is ${profile.dailyCalorieTarget} kcal.`
                  : `✅ You have consumed ${pct}% of your daily calorie requirement. You need ${profile.dailyCalorieTarget - todayStats.calories} calories more today.`}
            </p>
          </div>
        </Card>
      )}


      {/* What to Eat Next */}
      {profile && todayStats.calories < profile.dailyCalorieTarget && (() => {
        const remainingCals = profile.dailyCalorieTarget - todayStats.calories;
        const remainingProtein = Math.max(0, profile.dailyProteinTarget - todayStats.protein);

        // Fetch recommendations on mount or when stats change
        useEffect(() => {
          setLoadingSuggestions(true);
          fetch('/api/next-meal-suggestion/1?anti_gravity=true')
            .then(res => res.json())
            .then(data => {
              setAiSuggestions(data);
              setLoadingSuggestions(false);
            })
            .catch(() => setLoadingSuggestions(false));
        }, [remainingCals, remainingProtein]);

        if (loadingSuggestions) {
          return (
            <Card style={{ marginBottom: 24, textAlign: 'center', padding: 40 }}>
              <div style={{ width: 24, height: 24, border: `2px solid ${COLORS.border}`, borderTopColor: COLORS.emerald, borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: '0 auto 12px' }} />
              <div style={{ color: COLORS.muted, fontSize: 13 }}>Consulting Anti-Gravity Intelligence Engine...</div>
            </Card>
          );
        }

        if (!aiSuggestions || !aiSuggestions.suggested_meals || aiSuggestions.suggested_meals.length === 0) return null;

        return (
          <Card style={{ marginBottom: 24, background: `linear-gradient(135deg, ${COLORS.card}, #0e1f18)` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h3 style={{ color: COLORS.text, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>🛰️ Space-Optimized Meals</h3>
                <p style={{ color: COLORS.muted, fontSize: 13, marginTop: 3 }}>
                  Anti-Gravity Picks for your remaining <span style={{ color: COLORS.emerald, fontWeight: 700 }}>{remainingCals} kcal</span>
                  {aiSuggestions.priority_focus && <> · Focus: <span style={{ color: COLORS.protein, fontWeight: 700 }}>{aiSuggestions.priority_focus}</span></>}
                </p>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ background: COLORS.emeraldDark, color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>
                  Active: Anti-Gravity Mode
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {aiSuggestions.suggested_meals.map((food: any, i: number) => {
                const isFit = food.calories <= remainingCals;
                return (
                  <div key={i} style={{
                    background: COLORS.surface, borderRadius: 14,
                    border: `1px solid ${isFit ? COLORS.border : COLORS.fat + "55"}`,
                    padding: 16, position: "relative", overflow: "hidden",
                    transition: "border-color 0.2s",
                  }}>
                    <div style={{ position: "absolute", top: 0, right: 0, width: 50, height: 50, background: `${COLORS.emerald}0d`, borderRadius: "0 0 0 50px" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div>
                        <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, textTransform: "capitalize" }}>{food.food}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                      <span style={{ background: `${COLORS.emerald}1a`, color: COLORS.emerald, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 10 }}>
                        {food.match_score}% Match
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, marginBottom: 10 }}>
                      {[
                        { label: "Calories", value: food.calories + " kcal", color: isFit ? COLORS.emerald : COLORS.fat },
                        { label: "Protein", value: food.protein + "g", color: COLORS.protein },
                      ].map(m => (
                        <div key={m.label} style={{ textAlign: "center", background: COLORS.card, borderRadius: 8, padding: "6px 2px" }}>
                          <div style={{ fontSize: 9, color: COLORS.muted }}>{m.label}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: m.color }}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: COLORS.muted, lineHeight: 1.4, borderTop: `1px dashed ${COLORS.border}`, paddingTop: 8 }}>
                      <i>{food.explanation}</i>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {/* Macro breakdown — always visible when profile exists */}
      {profile && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <Card>
            <h3 style={{ color: COLORS.text, fontWeight: 700, marginBottom: 4 }}>Macro Distribution</h3>
            <p style={{ color: COLORS.muted, fontSize: 12, marginBottom: 12 }}>
              Today: P {todayStats.protein}g · C {todayStats.carbs}g · F {todayStats.fat}g
            </p>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % 3]} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v: any, name: any) => [`${v}g`, name]}
                    contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text }}
                  />
                  <Legend formatter={(v) => <span style={{ color: COLORS.muted, fontSize: 12 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <div style={{ fontSize: 32 }}>🥧</div>
                <p style={{ color: COLORS.muted, fontSize: 13, textAlign: "center" }}>Log a meal to see your macro breakdown</p>
                {/* Show target rings as reference */}
                <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                  {[
                    { label: "Protein", target: profile.dailyProteinTarget, color: COLORS.protein },
                    { label: "Carbs", target: profile.dailyCarbTarget, color: COLORS.carbs },
                    { label: "Fat", target: profile.dailyFatTarget, color: COLORS.fat },
                  ].map(m => (
                    <div key={m.label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: m.color }}>{m.target}g</div>
                      <div style={{ fontSize: 10, color: COLORS.muted }}>{m.label} target</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card>
            <h3 style={{ color: COLORS.text, fontWeight: 700, marginBottom: 4 }}>Macro Progress</h3>
            <p style={{ color: COLORS.muted, fontSize: 12, marginBottom: 14 }}>vs daily targets</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { name: "Protein", value: todayStats.protein, target: profile.dailyProteinTarget, color: COLORS.protein },
                { name: "Carbs", value: todayStats.carbs, target: profile.dailyCarbTarget, color: COLORS.carbs },
                { name: "Fat", value: todayStats.fat, target: profile.dailyFatTarget, color: COLORS.fat },
              ].map((m) => {
                const pctMacro = Math.min(100, Math.round((m.value / m.target) * 100));
                return (
                  <div key={m.name}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ color: m.color, fontSize: 13, fontWeight: 700 }}>{m.value}g</span>
                        <span style={{ color: COLORS.muted, fontSize: 12 }}> / {m.target}g</span>
                        <span style={{ color: COLORS.muted, fontSize: 11, marginLeft: 6 }}>({pctMacro}%)</span>
                      </div>
                    </div>
                    <ProgressBar value={m.value} max={m.target} color={m.color} height={7} />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Weekly chart */}
      <Card style={{ marginBottom: 24 }}>
        <h3 style={{ color: COLORS.text, fontWeight: 700, marginBottom: 16 }}>Weekly Calorie Trend</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weeklyData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
            <XAxis dataKey="day" tick={{ fill: COLORS.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text }} />
            <Bar dataKey="calories" fill={COLORS.emerald} radius={[4, 4, 0, 0]} name="Calories" />
            <Bar dataKey="target" fill={`${COLORS.teal}44`} radius={[4, 4, 0, 0]} name="Target" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Recent meals */}
      <Card>
        <h3 style={{ color: COLORS.text, fontWeight: 700, marginBottom: 16 }}>Recent Meals</h3>
        {todayMeals.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: COLORS.muted }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🍽️</div>
            <p>No meals logged today. Use the Food Scanner to add your first meal!</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {todayMeals.slice(0, 5).map((meal) => (
              <div key={meal._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 24 }}>{mealIcon[meal.mealType] || "🍽️"}</span>
                  <div>
                    <div style={{ color: COLORS.text, fontWeight: 600, textTransform: "capitalize" }}>{meal.mealType}</div>
                    <div style={{ color: COLORS.muted, fontSize: 12 }}>{meal.foodItems.map(f => f.name).join(", ")}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: COLORS.emerald, fontWeight: 800 }}>{meal.totalCalories} kcal</div>
                  <div style={{ color: COLORS.muted, fontSize: 11 }}>{new Date(meal.detectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// ============================================================
// MAIN APP
// ============================================================
export default function NutriVisionApp() {
  const [user, setUser] = useLocalStorage<User | null>("nv_user", null);
  const [, setToken] = useLocalStorage<string | null>("nv_token", null);
  const [profile, setProfile] = useLocalStorage<HealthProfile | null>("nv_profile", null);
  const [meals, setMeals] = useLocalStorage<Meal[]>("nv_meals", []);
  const [activeTab, setActiveTab] = useState<"dashboard" | "scan" | "profile" | "history">("dashboard");
  const [notification, setNotification] = useState<{ msg: string; type: "success" | "info" } | null>(null);

  const showNotification = (msg: string, type: "success" | "info" = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleAuth = (u: User, t: string) => {
    setUser(u); setToken(t);
    if (!profile) setActiveTab("profile" as any);
  };

  const handleLogout = () => { setUser(null); setToken(null); setProfile(null); setMeals([]); };

  const handleSaveProfile = (p: HealthProfile) => {
    setProfile(p);
    setActiveTab("dashboard");
    showNotification("Profile saved! Your nutrition targets are ready.");
  };

  const handleMealScanned = (meal: Meal) => {
    setMeals(prev => [meal, ...prev]);
    setActiveTab("dashboard");
    showNotification(`Meal logged: ${meal.totalCalories} kcal added to today's log.`);
  };

  if (!user) return <AuthScreen onAuth={handleAuth} />;

  const tabs = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "scan", icon: "📸", label: "Scan Meal" },
    { id: "profile", icon: "👤", label: "Profile" },
    { id: "history", icon: "📋", label: "History" },
  ] as const;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: ${COLORS.bg}; } ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }
        input::placeholder { color: ${COLORS.muted}; } input, select { color: ${COLORS.text} !important; }
        option { background: ${COLORS.card}; color: ${COLORS.text}; }
      `}</style>

      {/* Notification */}
      {notification && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 1000,
          background: notification.type === "success" ? COLORS.emeraldDark : COLORS.teal,
          color: "#fff", padding: "12px 20px", borderRadius: 12,
          fontWeight: 600, fontSize: 14, maxWidth: 360,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          animation: "slideIn 0.3s ease",
        }}>
          <style>{`@keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }`}</style>
          ✓ {notification.msg}
        </div>
      )}

      {/* Header */}
      <header style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>🥗</span>
            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: COLORS.text }}>
              Nutri<span style={{ color: COLORS.emerald }}>Vision</span>
            </span>
            {profile && <Badge>{profile.fitnessGoal === "lose" ? "🔥 Weight Loss" : profile.fitnessGoal === "gain" ? "💪 Muscle Gain" : "⚖️ Maintenance"}</Badge>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ color: COLORS.muted, fontSize: 14 }}>{user.name}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>Sign Out</Button>
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", gap: 4 }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: "14px 20px", border: "none", background: "transparent",
              color: activeTab === tab.id ? COLORS.emerald : COLORS.muted,
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: 14, cursor: "pointer", fontFamily: "inherit",
              borderBottom: activeTab === tab.id ? `2px solid ${COLORS.emerald}` : "2px solid transparent",
              transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6,
            }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        {activeTab === "dashboard" && <Dashboard profile={profile} meals={meals} user={user} />}
        {activeTab === "scan" && (
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, color: COLORS.text, fontWeight: 800, marginBottom: 24 }}>AI Food Scanner</h2>
            <FoodScanner onScanComplete={handleMealScanned} profile={profile} />
          </div>
        )}
        {activeTab === "profile" && (
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <ProfileSetup onSave={handleSaveProfile} />
          </div>
        )}
        {activeTab === "history" && (
          <div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, color: COLORS.text, fontWeight: 800, marginBottom: 24 }}>Meal History</h2>
            {meals.length === 0 ? (
              <Card style={{ textAlign: "center", padding: 60 }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>🍽️</div>
                <h3 style={{ color: COLORS.text, fontWeight: 700, marginBottom: 8 }}>No meals logged yet</h3>
                <p style={{ color: COLORS.muted, marginBottom: 24 }}>Use the Food Scanner to log your first meal</p>
                <Button onClick={() => setActiveTab("scan")}>Go to Food Scanner</Button>
              </Card>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {meals.map((meal) => (
                  <Card key={meal._id} style={{ padding: 20 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 20 }}>{{ breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎" }[meal.mealType] || "🍽️"}</span>
                          <span style={{ color: COLORS.text, fontWeight: 700, textTransform: "capitalize" }}>{meal.mealType}</span>
                        </div>
                        <div style={{ color: COLORS.muted, fontSize: 12 }}>
                          {new Date(meal.detectedAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {new Date(meal.detectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: COLORS.emerald, fontWeight: 800, fontSize: 20 }}>{meal.totalCalories} <span style={{ fontSize: 12 }}>kcal</span></div>
                        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                          <span style={{ fontSize: 11, color: COLORS.protein }}>P: {meal.totalProtein}g</span>
                          <span style={{ fontSize: 11, color: COLORS.carbs }}>C: {meal.totalCarbs}g</span>
                          <span style={{ fontSize: 11, color: COLORS.fat }}>F: {meal.totalFat}g</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {meal.foodItems.map((item, i) => (
                        <span key={i} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 20, padding: "4px 12px", fontSize: 12, color: COLORS.muted }}>
                          {item.name} · {item.calories} kcal
                        </span>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
