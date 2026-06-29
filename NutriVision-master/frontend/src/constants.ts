import type { FoodEntry, FoodSuggestion } from "./types";

export const COLORS = {
  emerald: "#10b981", emeraldDark: "#059669", emeraldLight: "#d1fae5",
  teal: "#14b8a6", lime: "#84cc16",
  protein: "#6366f1", carbs: "#f59e0b", fat: "#ef4444",
  bg: "#0a0f0d", surface: "#111a15", card: "#162019",
  border: "#1e3328", text: "#e2f5ea", muted: "#6b8c76",
};

export const PIE_COLORS = [COLORS.protein, COLORS.carbs, COLORS.fat];

export const FOOD_DATABASE: Record<string, FoodEntry> = {
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
    ingredients: ["Whole milk", "Live yogurt cultures"],
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
    ingredients: ["3 large eggs", "Butter", "Salt", "Black pepper"],
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
    ingredients: ["Whole grain bread (1 slice)", "½ ripe avocado", "Lemon juice", "Red chilli flakes", "Salt"],
    per100g: { calories: 195, protein: 4.5, carbs: 16.0, fat: 13.0 },
    defaultWeightG: 130, imageKeywords: ["avocado", "toast", "bread"],
  },
  "protein shake": {
    name: "Whey Protein Shake", emoji: "🥤", dietType: "nonveg",
    ingredients: ["Whey protein powder (1 scoop)", "Water or skimmed milk (250ml)"],
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

export const VEG_FOODS_DB: FoodSuggestion[] = [
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

export const NONVEG_FOODS_DB: FoodSuggestion[] = [
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

export const getSuggestedFoods = (remainingCals: number, goal: string, remainingProtein: number, diet: "veg" | "nonveg"): FoodSuggestion[] => {
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

export const detectFoodFromFilename = (filename: string): string | null => {
  const lower = filename.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
  for (const [key, entry] of Object.entries(FOOD_DATABASE)) {
    for (const kw of entry.imageKeywords) {
      if (lower.includes(kw)) return key;
    }
    if (lower.includes(key)) return key;
  }
  return null;
};

export const buildFoodItemFromEntry = (entry: FoodEntry, weightG: number) => {
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
