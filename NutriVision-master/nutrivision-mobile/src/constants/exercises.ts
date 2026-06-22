export type Landmark = {
  x: number;
  y: number;
  z: number;
  visibility: number;
};

export type Exercise = {
  id: string;
  name: string;
  script?: string;
  origin?: string;
  muscle: string;
  sets: number;
  reps: number;
  durationSec: number;
  caloriesPerMin: number;
  keypoints: string[];
  referenceAngles: Record<string, number>;
  startingPositionAngles?: Record<string, [number, number]>;
  isTimeBased?: boolean;
  description?: string;
  goalTags: string[];
};

export const EXERCISES: Exercise[] = [
  {
    id: "dand",
    name: "Dand (Indian Push Up)",
    script: "दंड",
    origin: "Traditional Indian Push-up",
    muscle: "Chest + Shoulders + Core",
    sets: 3, reps: 15, durationSec: 45,
    caloriesPerMin: 7,
    keypoints: ["left_elbow", "right_elbow"],
    referenceAngles: {
      left_elbow: 90, right_elbow: 90
    },
    startingPositionAngles: {
      left_elbow: [160, 180], right_elbow: [160, 180]
    },
    description: "Start in high plank. Lower your chest down and forward, arching up into cobra pose, then lift your hips back up.",
    goalTags: ["muscle_gain"]
  },
  {
    id: "baithak",
    name: "Baithak (Indian Squat)",
    script: "बैठक",
    origin: "Traditional Indian Squat",
    muscle: "Quads + Glutes + Calves",
    sets: 4, reps: 15, durationSec: 60,
    caloriesPerMin: 6,
    keypoints: ["left_knee", "right_knee", "left_hip", "right_hip"],
    referenceAngles: {
      left_knee: 80, right_knee: 80,
      left_hip: 85, right_hip: 85
    },
    startingPositionAngles: {
      left_knee: [160, 180], right_knee: [160, 180]
    },
    description: "Stand with feet shoulder-width apart. Deeply squat down while keeping torso upright, then return to standing.",
    goalTags: ["muscle_gain", "weight_loss"]
  },
  {
    id: "kumbhakasana",
    name: "Kumbhakasana (Plank)",
    script: "कुम्भकासन",
    origin: "Yogic Plank Hold",
    muscle: "Core + Shoulders",
    sets: 3, reps: 1, durationSec: 60,
    caloriesPerMin: 4,
    keypoints: ["left_hip", "right_hip", "left_elbow", "right_elbow"],
    referenceAngles: {
      left_hip: 175, right_hip: 175
    },
    startingPositionAngles: {
      left_hip: [170, 180], right_hip: [170, 180]
    },
    description: "Hold a straight-line body position on hands or elbows, pulling core in tight. Do not let hips sag.",
    goalTags: ["muscle_gain", "weight_loss", "senior"],
    isTimeBased: true
  },
  {
    id: "virabhadrasana",
    name: "Virabhadrasana (Lunges)",
    script: "वीरभद्रासन",
    origin: "Warrior Pose Lunge",
    muscle: "Quads + Glutes + Core",
    sets: 3, reps: 12, durationSec: 45,
    caloriesPerMin: 5,
    keypoints: ["left_knee", "right_knee", "left_hip", "right_hip"],
    referenceAngles: {
      left_knee: 90, right_knee: 90
    },
    startingPositionAngles: {
      left_knee: [160, 180], right_knee: [160, 180]
    },
    description: "Step one foot back, lowering hips until front knee is bent to 90 degrees. Alternate legs.",
    goalTags: ["weight_loss", "muscle_gain"]
  },
  {
    id: "uth_baith",
    name: "Uth Baith (Burpee)",
    script: "उठ-बैठ",
    origin: "Traditional Indian Burpee",
    muscle: "Full Body Cardiorespiratory",
    sets: 3, reps: 10, durationSec: 60,
    caloriesPerMin: 10,
    keypoints: ["left_knee", "right_knee", "left_elbow", "right_elbow"],
    referenceAngles: {
      left_knee: 90, right_knee: 90
    },
    startingPositionAngles: {
      left_knee: [160, 180], right_knee: [160, 180]
    },
    description: "Squat down, drop hands to floor, jump feet back to plank, do a pushup, jump forward and leap into the air.",
    goalTags: ["weight_loss"]
  },
  {
    id: "surya_namaskar",
    name: "Surya Namaskar (Sun Salutation)",
    script: "सूर्य नमस्कार",
    origin: "Yogic Sun Salutation Flow",
    muscle: "Full Body Flexibility + Cardio",
    sets: 3, reps: 6, durationSec: 60,
    caloriesPerMin: 8,
    keypoints: ["left_knee", "right_knee", "left_shoulder", "right_shoulder"],
    referenceAngles: {
      left_knee: 160, right_knee: 160,
      left_shoulder: 160, right_shoulder: 160
    },
    startingPositionAngles: {
      left_knee: [165, 180], right_knee: [165, 180]
    },
    description: "A continuous fluid transition through 12 poses coordinating movement with inhalation and exhalation.",
    goalTags: ["weight_loss", "heart_health"]
  },
  {
    id: "vakrasana_twist",
    name: "Vakrasana Twist (Russian Twist)",
    script: "वक्रासन ट्विस्ट",
    origin: "Seated Oblique Twist",
    muscle: "Core + Obliques",
    sets: 4, reps: 15, durationSec: 45,
    caloriesPerMin: 4,
    keypoints: ["left_shoulder", "right_shoulder", "left_hip", "right_hip"],
    referenceAngles: {
      left_hip: 90, right_hip: 90
    },
    startingPositionAngles: {
      left_hip: [80, 100], right_hip: [80, 100]
    },
    description: "Sit with knees bent, lean torso back at 45 degrees, and rotate shoulders side to side.",
    goalTags: ["weight_loss", "muscle_gain"]
  },
  {
    id: "tadasana_rise",
    name: "Tadasana Rise (Calf Raise)",
    script: "ताड़ासन राइज़",
    origin: "Palm Tree Pose Rise",
    muscle: "Calves + Balance",
    sets: 3, reps: 15, durationSec: 30,
    caloriesPerMin: 3,
    keypoints: ["left_ankle", "right_ankle", "left_knee", "right_knee"],
    referenceAngles: {
      left_knee: 175, right_knee: 175
    },
    startingPositionAngles: {
      left_knee: [165, 180], right_knee: [165, 180]
    },
    description: "Stand straight, reach hands overhead, and raise up onto the balls of your feet to work calves.",
    goalTags: ["muscle_gain", "senior"]
  },
  {
    id: "shalabhasana",
    name: "Shalabhasana (Locust Hold)",
    script: "शलभासन",
    origin: "Yogic Locust Pose Hold",
    muscle: "Lower Back + Glutes",
    sets: 4, reps: 12, durationSec: 30,
    caloriesPerMin: 3,
    keypoints: ["left_hip", "right_hip", "left_shoulder", "right_shoulder"],
    referenceAngles: {
      left_hip: 170, right_hip: 170
    },
    startingPositionAngles: {
      left_hip: [170, 180], right_hip: [170, 180]
    },
    description: "Lie face down, contract your back muscles to lift your chest, arms, and legs off the ground.",
    goalTags: ["muscle_gain"]
  },
  {
    id: "chaturanga",
    name: "Chaturanga (Low Plank)",
    script: "चतुरंग",
    origin: "Four-Limbed Staff Pose",
    muscle: "Triceps + Shoulders + Core",
    sets: 3, reps: 12, durationSec: 45,
    caloriesPerMin: 6,
    keypoints: ["left_elbow", "right_elbow"],
    referenceAngles: {
      left_elbow: 90, right_elbow: 90
    },
    startingPositionAngles: {
      left_elbow: [160, 180], right_elbow: [160, 180]
    },
    description: "From high plank, lower body down until elbows are bent to 90 degrees, tucked close to ribs.",
    goalTags: ["muscle_gain"]
  }
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
