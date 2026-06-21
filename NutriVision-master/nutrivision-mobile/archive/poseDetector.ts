import * as poseDetection from "@tensorflow-models/pose-detection";
import * as tf from "@tensorflow/tfjs";

export type Keypoint = {
  name: string;
  x: number;        // pixel coords
  y: number;
  score: number;    // confidence 0-1
};

export type PoseResult = {
  keypoints: Keypoint[];
  score: number;
};

let detector: poseDetection.PoseDetector | null = null;
let isLoading = false;

export async function loadDetector(): Promise<poseDetection.PoseDetector> {
  if (detector) return detector;
  if (isLoading) {
    // wait for existing load
    while (isLoading) {
      await new Promise(r => setTimeout(r, 100));
    }
    return detector!;
  }
  
  isLoading = true;
  try {
    await tf.ready();
    
    detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        // LIGHTNING = faster, lower accuracy
        // THUNDER = slower, higher accuracy
        // Use LIGHTNING for real-time (>20fps)
      }
    );
    
    return detector;
  } finally {
    isLoading = false;
  }
}

// USE MoveNet NOT BlazePose
// Reason: MoveNet LIGHTNING runs at 30fps on 
// mobile. BlazePose is too slow for real-time
// on mid-range Android devices.
// MoveNet gives 17 keypoints — enough for
// exercise form detection.

// MoveNet 17 keypoints:
// 0:  nose
// 1:  left_eye    2:  right_eye
// 3:  left_ear    4:  right_ear
// 5:  left_shoulder   6:  right_shoulder
// 7:  left_elbow      8:  right_elbow
// 9:  left_wrist      10: right_wrist
// 11: left_hip        12: right_hip
// 13: left_knee       14: right_knee
// 15: left_ankle      16: right_ankle

export const KEYPOINT_NAMES = [
  "nose",
  "left_eye", "right_eye",
  "left_ear", "right_ear",
  "left_shoulder", "right_shoulder",
  "left_elbow", "right_elbow",
  "left_wrist", "right_wrist",
  "left_hip", "right_hip",
  "left_knee", "right_knee",
  "left_ankle", "right_ankle",
];

export const SKELETON_CONNECTIONS: [number, number][] = [
  [0, 1], [0, 2],             // nose → eyes
  [1, 3], [2, 4],             // eyes → ears
  [5, 6],                     // shoulders
  [5, 7], [7, 9],             // left arm
  [6, 8], [8, 10],            // right arm
  [5, 11], [6, 12],           // body
  [11, 12],                   // hips
  [11, 13], [13, 15],         // left leg
  [12, 14], [14, 16],         // right leg
];

export async function detectPose(
  imageTensor: tf.Tensor3D
): Promise<PoseResult | null> {
  const det = await loadDetector();
  
  const poses = await det.estimatePoses(
    imageTensor,
    { flipHorizontal: false }
  );
  
  if (!poses || poses.length === 0) return null;
  
  const pose = poses[0];
  
  return {
    keypoints: pose.keypoints.map(kp => ({
      name: kp.name ?? "",
      x: kp.x,
      y: kp.y,
      score: kp.score ?? 0,
    })),
    score: pose.score ?? 0,
  };
}

export function calculateAngle(
  a: Keypoint,
  b: Keypoint,  // joint being measured
  c: Keypoint
): number {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  
  const dot = ba.x * bc.x + ba.y * bc.y;
  const magA = Math.sqrt(ba.x ** 2 + ba.y ** 2);
  const magB = Math.sqrt(bc.x ** 2 + bc.y ** 2);
  
  if (magA === 0 || magB === 0) return 0;
  
  const cosAngle = Math.max(-1, Math.min(1, dot / (magA * magB)));
  
  return Math.round(
    Math.acos(cosAngle) * (180 / Math.PI)
  );
}

// JOINT TRIPLETS for angle measurement
// Format: [joint_a_idx, joint_b_idx, joint_c_idx]
// Angle is measured AT joint_b
export const JOINT_TRIPLETS: Record<string, [number, number, number]> = {
  left_elbow:    [5,  7,  9],   // shoulder-elbow-wrist
  right_elbow:   [6,  8,  10],
  left_shoulder: [11, 5,  7],   // hip-shoulder-elbow
  right_shoulder:[12, 6,  8],
  left_hip:      [5,  11, 13],  // shoulder-hip-knee
  right_hip:     [6,  12, 14],
  left_knee:     [11, 13, 15],  // hip-knee-ankle
  right_knee:    [12, 14, 16],
};

export function scoreJoint(
  keypoints: Keypoint[],
  jointName: string,
  targetAngle: number,
  tolerance: number = 20
): number {
  const triplet = JOINT_TRIPLETS[jointName];
  if (!triplet) return 0;
  
  const [ai, bi, ci] = triplet;
  const a = keypoints[ai];
  const b = keypoints[bi];
  const c = keypoints[ci];
  
  // Skip if any keypoint not visible
  if (!a || !b || !c) return 0;
  if (a.score < 0.3 || b.score < 0.3 || c.score < 0.3) return 0;
  
  const actual = calculateAngle(a, b, c);
  const diff = Math.abs(actual - targetAngle);
  
  if (diff <= tolerance) return 100;
  if (diff >= tolerance * 3) return 0;
  
  return Math.round(
    100 * (1 - (diff - tolerance) / (tolerance * 2))
  );
}
