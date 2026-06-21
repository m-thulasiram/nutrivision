import type { Exercise } from "./exercises";

// Maps workout plan exercise names to 
// Exercise objects with pose detection config
export const EXERCISE_MAP: 
  Record<string, Exercise> = {

  "Push Up": {
    id: "push_up",
    name: "Push Up",
    muscle: "Chest + Triceps",
    sets: 3, reps: 15, durationSec: 45,
    caloriesPerMin: 6,
    keypoints: ["left_elbow","right_elbow"],
    referenceAngles: { 
      left_elbow: 90, right_elbow: 90 
    },
    goalTags: ["muscle_gain"],
  },

  "Decline Push Up": {
    id: "decline_push_up",
    name: "Decline Push Up",
    muscle: "Upper Chest",
    sets: 3, reps: 15, durationSec: 45,
    caloriesPerMin: 6,
    keypoints: ["left_elbow","right_elbow",
                "left_shoulder","right_shoulder"],
    referenceAngles: { 
      left_elbow: 90, right_elbow: 90,
      left_shoulder: 60, right_shoulder: 60,
    },
    goalTags: ["muscle_gain"],
  },

  "Pull Up": {
    id: "pull_up",
    name: "Pull Up",
    muscle: "Back + Biceps",
    sets: 4, reps: 15, durationSec: 60,
    caloriesPerMin: 7,
    keypoints: ["left_elbow","right_elbow",
                "left_shoulder","right_shoulder"],
    referenceAngles: { 
      left_elbow: 45, right_elbow: 45,
    },
    goalTags: ["muscle_gain"],
  },

  "Superman Hold": {
    id: "superman_hold",
    name: "Superman Hold",
    muscle: "Lower Back",
    sets: 4, reps: 15, durationSec: 30,
    caloriesPerMin: 3,
    keypoints: ["left_hip","right_hip",
                "left_shoulder","right_shoulder"],
    referenceAngles: { 
      left_hip: 170, right_hip: 170,
    },
    goalTags: ["muscle_gain"],
  },

  "Lunges": {
    id: "lunges",
    name: "Lunges",
    muscle: "Quads + Glutes",
    sets: 3, reps: 15, durationSec: 45,
    caloriesPerMin: 5,
    keypoints: ["left_knee","right_knee",
                "left_hip","right_hip"],
    referenceAngles: { 
      left_knee: 90, right_knee: 90,
      left_hip: 90, right_hip: 90,
    },
    goalTags: ["weight_loss","muscle_gain"],
  },

  "Calf Raise": {
    id: "calf_raise",
    name: "Calf Raise",
    muscle: "Calves",
    sets: 3, reps: 15, durationSec: 30,
    caloriesPerMin: 3,
    keypoints: ["left_ankle","right_ankle",
                "left_knee","right_knee"],
    referenceAngles: { 
      left_knee: 175, right_knee: 175,
    },
    goalTags: ["muscle_gain"],
  },

  "Bulgarian Split Squat": {
    id: "bulgarian_split_squat",
    name: "Bulgarian Split Squat",
    muscle: "Quads + Glutes",
    sets: 3, reps: 15, durationSec: 60,
    caloriesPerMin: 6,
    keypoints: ["left_knee","right_knee",
                "left_hip","right_hip"],
    referenceAngles: { 
      left_knee: 90, right_knee: 150,
      left_hip: 90,
    },
    goalTags: ["muscle_gain"],
  },

  "Pike Push Up": {
    id: "pike_push_up",
    name: "Pike Push Up",
    muscle: "Shoulders",
    sets: 4, reps: 15, durationSec: 45,
    caloriesPerMin: 5,
    keypoints: ["left_elbow","right_elbow",
                "left_shoulder","right_shoulder"],
    referenceAngles: { 
      left_elbow: 90, right_elbow: 90,
      left_shoulder: 45, right_shoulder: 45,
    },
    goalTags: ["muscle_gain"],
  },

  "Tricep Dip": {
    id: "tricep_dip",
    name: "Tricep Dip",
    muscle: "Triceps",
    sets: 3, reps: 15, durationSec: 45,
    caloriesPerMin: 5,
    keypoints: ["left_elbow","right_elbow"],
    referenceAngles: { 
      left_elbow: 90, right_elbow: 90,
    },
    goalTags: ["muscle_gain"],
  },

  "Chin Up": {
    id: "chin_up",
    name: "Chin Up",
    muscle: "Biceps + Back",
    sets: 3, reps: 15, durationSec: 45,
    caloriesPerMin: 6,
    keypoints: ["left_elbow","right_elbow"],
    referenceAngles: { 
      left_elbow: 45, right_elbow: 45,
    },
    goalTags: ["muscle_gain"],
  },

  "Plank": {
    id: "plank",
    name: "Plank Hold",
    muscle: "Core",
    sets: 4, reps: 1, durationSec: 60,
    caloriesPerMin: 3,
    keypoints: ["left_hip","right_hip",
                "left_elbow","right_elbow"],
    referenceAngles: { 
      left_hip: 180, right_hip: 180,
    },
    goalTags: ["muscle_gain","weight_loss"],
  },

  "Crunches": {
    id: "crunches",
    name: "Crunches",
    muscle: "Abs",
    sets: 4, reps: 15, durationSec: 45,
    caloriesPerMin: 4,
    keypoints: ["left_hip","right_hip",
                "left_shoulder","right_shoulder"],
    referenceAngles: { 
      left_hip: 90, right_hip: 90,
    },
    goalTags: ["weight_loss","muscle_gain"],
  },

  "Russian Twist": {
    id: "russian_twist",
    name: "Russian Twist",
    muscle: "Obliques",
    sets: 4, reps: 15, durationSec: 45,
    caloriesPerMin: 4,
    keypoints: ["left_shoulder","right_shoulder",
                "left_hip","right_hip"],
    referenceAngles: { 
      left_hip: 90, right_hip: 90,
    },
    goalTags: ["weight_loss"],
  },

  "Burpee": {
    id: "burpees",
    name: "Burpees",
    muscle: "Full Body",
    sets: 3, reps: 15, durationSec: 60,
    caloriesPerMin: 10,
    keypoints: ["left_knee","right_knee",
                "left_elbow","right_elbow"],
    referenceAngles: { 
      left_knee: 90, right_knee: 90,
      left_elbow: 90, right_elbow: 90,
    },
    goalTags: ["weight_loss"],
  },

  "Jumping Jack": {
    id: "jumping_jacks",
    name: "Jumping Jacks",
    muscle: "Full Body",
    sets: 3, reps: 15, durationSec: 45,
    caloriesPerMin: 8,
    keypoints: ["left_knee","right_knee",
                "left_shoulder","right_shoulder"],
    referenceAngles: { 
      left_knee: 160, right_knee: 160,
      left_shoulder: 80, right_shoulder: 80,
    },
    goalTags: ["weight_loss","heart_health"],
  },

  "Squat": {
    id: "squat",
    name: "Squat",
    muscle: "Quads + Glutes",
    sets: 4, reps: 12, durationSec: 60,
    caloriesPerMin: 5,
    keypoints: ["left_knee","right_knee",
                "left_hip","right_hip"],
    referenceAngles: { 
      left_knee: 90, right_knee: 90,
      left_hip: 90, right_hip: 90,
    },
    goalTags: ["muscle_gain","weight_loss"],
  },

  "High Knees": {
    id: "high_knees",
    name: "High Knees",
    muscle: "Core + Legs",
    sets: 3, reps: 20, durationSec: 30,
    caloriesPerMin: 9,
    keypoints: ["left_knee","right_knee"],
    referenceAngles: { 
      left_knee: 90, right_knee: 90,
    },
    goalTags: ["weight_loss"],
  },
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
