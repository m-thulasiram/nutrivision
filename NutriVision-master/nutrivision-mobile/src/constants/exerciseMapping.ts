import { Exercise, EXERCISES } from "./exercises";

// Maps workout plan exercise names to 
// Exercise objects with pose detection config
export const EXERCISE_MAP: 
  Record<string, Exercise> = {
  
  // Old name → Indian exercise
  "Push Up":          EXERCISES.find(e => e.id === "dand")!,
  "Dand":             EXERCISES.find(e => e.id === "dand")!,
  "दंड":              EXERCISES.find(e => e.id === "dand")!,
  
  "Squat":            EXERCISES.find(e => e.id === "baithak")!,
  "Baithak":          EXERCISES.find(e => e.id === "baithak")!,
  "बैठक":             EXERCISES.find(e => e.id === "baithak")!,
  
  "Plank":            EXERCISES.find(e => e.id === "kumbhakasana")!,
  "Kumbhakasana":     EXERCISES.find(e => e.id === "kumbhakasana")!,
  
  "Lunges":           EXERCISES.find(e => e.id === "virabhadrasana")!,
  "Virabhadrasana":   EXERCISES.find(e => e.id === "virabhadrasana")!,
  
  "Burpee":           EXERCISES.find(e => e.id === "uth_baith")!,
  "Uth Baith":        EXERCISES.find(e => e.id === "uth_baith")!,
  
  "Jumping Jack":     EXERCISES.find(e => e.id === "surya_namaskar")!,
  "Jumping Jacks":    EXERCISES.find(e => e.id === "surya_namaskar")!,
  "Surya Namaskar":   EXERCISES.find(e => e.id === "surya_namaskar")!,
  
  "Crunches":         EXERCISES.find(e => e.id === "vakrasana_twist")!,
  "Russian Twist":    EXERCISES.find(e => e.id === "vakrasana_twist")!,
  
  "Calf Raise":       EXERCISES.find(e => e.id === "tadasana_rise")!,
  "Tadasana":         EXERCISES.find(e => e.id === "tadasana_rise")!,
  
  "Superman Hold":    EXERCISES.find(e => e.id === "shalabhasana")!,
  "Shalabhasana":     EXERCISES.find(e => e.id === "shalabhasana")!,
  
  "Tricep Dip":       EXERCISES.find(e => e.id === "chaturanga")!,
  "Chaturanga":       EXERCISES.find(e => e.id === "chaturanga")!,
};

// Helper: get exercise object from name
// Falls back to generic config if not mapped
export function getExerciseConfig(
  name: string,
  sets: number,
  reps: number
): Exercise {
  const mapped = EXERCISE_MAP[name];
  if (mapped) {
    return { ...mapped, sets, reps };
  }
  
  // Generic fallback for unmapped exercises
  return {
    id: name.toLowerCase().replace(/\s+/g, "_"),
    name,
    muscle: "General",
    sets,
    reps,
    durationSec: 45,
    caloriesPerMin: 5,
    keypoints: ["left_knee", "right_knee"],
    referenceAngles: { 
      left_knee: 90, right_knee: 90 
    },
    goalTags: [],
  };
}

