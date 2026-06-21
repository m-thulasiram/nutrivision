export type Landmark = {
  x: number;
  y: number;
  z: number;
  visibility: number;
};

export type Exercise = {
  id: string;
  name: string;
  muscle: string;
  sets: number;
  reps: number;
  durationSec: number;
  caloriesPerMin: number;
  keypoints: string[];
  referenceAngles: Record<string, number>;
  goalTags: string[];
};

export const EXERCISES: Exercise[] = [
  {
    id: "squat",
    name: "Squat",
    muscle: "Quads + Glutes",
    sets: 4, reps: 12, durationSec: 60,
    caloriesPerMin: 5,
    keypoints: ["left_knee","right_knee",
                "left_hip","right_hip"],
    referenceAngles: { 
      left_knee: 90, right_knee: 90,
      left_hip: 90, right_hip: 90 
    },
    goalTags: ["muscle_gain","weight_loss"],
  },
  {
    id: "push_up",
    name: "Push Up",
    muscle: "Chest + Triceps",
    sets: 4, reps: 15, durationSec: 45,
    caloriesPerMin: 6,
    keypoints: ["left_elbow","right_elbow"],
    referenceAngles: { 
      left_elbow: 90, right_elbow: 90 
    },
    goalTags: ["muscle_gain"],
  },
  {
    id: "jumping_jacks",
    name: "Jumping Jacks",
    muscle: "Full body",
    sets: 3, reps: 30, durationSec: 45,
    caloriesPerMin: 8,
    keypoints: ["left_knee","right_knee",
                "left_shoulder","right_shoulder"],
    referenceAngles: { 
      left_knee: 160, right_knee: 160,
      left_shoulder: 80, right_shoulder: 80 
    },
    goalTags: ["weight_loss","heart_health"],
  },
  {
    id: "plank",
    name: "Plank Hold",
    muscle: "Core",
    sets: 3, reps: 1, durationSec: 60,
    caloriesPerMin: 3,
    keypoints: ["left_hip","right_hip",
                "left_elbow","right_elbow"],
    referenceAngles: { 
      left_hip: 180, right_hip: 180 
    },
    goalTags: ["muscle_gain","weight_loss","senior"],
  },
];

export type GoalCategory = 'weight_loss' | 'muscle_gain' | 'heart_health' | 'senior';

export const REFERENCE_SKELETON: Record<string, [number, number]> = {
  head: [0.5, 0.05],
  left_shoulder: [0.35, 0.25],
  right_shoulder: [0.65, 0.25],
  left_elbow: [0.25, 0.45],
  right_elbow: [0.75, 0.45],
  left_wrist: [0.18, 0.62],
  right_wrist: [0.82, 0.62],
  left_hip: [0.38, 0.55],
  right_hip: [0.62, 0.55],
  left_knee: [0.35, 0.75],
  right_knee: [0.65, 0.75],
  left_ankle: [0.33, 0.95],
  right_ankle: [0.67, 0.95],
};

export const SKELETON_BONES: [string, string][] = [
  ['head', 'left_shoulder'],
  ['head', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_shoulder', 'right_hip'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
  ['left_hip', 'right_hip'],
  ['left_shoulder', 'right_shoulder'],
];

export const JOINT_LABELS: Record<string, string> = {
  left_elbow: 'Left Elbow',
  right_elbow: 'Right Elbow',
  left_knee: 'Left Knee',
  right_knee: 'Right Knee',
  left_hip: 'Left Hip',
  right_hip: 'Right Hip',
  left_shoulder: 'Left Shoulder',
  right_shoulder: 'Right Shoulder',
  left_wrist: 'Left Wrist',
  right_wrist: 'Right Wrist',
  left_ankle: 'Left Ankle',
  right_ankle: 'Right Ankle',
};

export function getGoalFromUser(userStr: string | null): GoalCategory {
  if (!userStr) return 'weight_loss';
  try {
    const user = JSON.parse(userStr);
    const goal = (user.goal || '').toLowerCase();
    if (goal.includes('gain') || goal.includes('muscle')) return 'muscle_gain';
    if (goal.includes('heart') || goal.includes('cardio')) return 'heart_health';
    if (goal.includes('senior') || goal.includes('flexibility')) return 'senior';
    return 'weight_loss';
  } catch {
    return 'weight_loss';
  }
}

export function getGoalLabel(goal: GoalCategory): string {
  switch (goal) {
    case 'weight_loss': return 'Weight Loss';
    case 'muscle_gain': return 'Muscle Gain';
    case 'heart_health': return 'Heart Health';
    case 'senior': return 'Senior Fitness';
  }
}
