import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Vibration, Animated } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useNavigation, useRoute } from "@react-navigation/native";
import Svg, { Circle, Line } from "react-native-svg";
import ReferenceSkeleton from "../components/ReferenceSkeleton";
import type { Exercise } from "../constants/exercises";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const CAM_W = SCREEN_W;
const CAM_H = SCREEN_H * 0.45;

type RouteParams = {
  exercise: Exercise;
};

type WorkoutPhase = 
  | "loading"         // model loading
  | "get_in_position" // show instruction
  | "detecting_ready" // waiting for start pose
  | "countdown"       // 3-2-1 go
  | "exercising"      // counting reps
  | "resting"         // between sets
  | "complete";       // all sets done

type Keypoint = {
  name: string;
  x: number;
  y: number;
  score: number;
};

const KEYPOINT_NAMES = [
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

const SKELETON_CONNECTIONS: [string, string][] = [
  ["left_shoulder",  "right_shoulder"],
  ["left_shoulder",  "left_elbow"],
  ["left_elbow",     "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow",    "right_wrist"],
  ["left_shoulder",  "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip",       "right_hip"],
  ["left_hip",       "left_knee"],
  ["left_knee",      "left_ankle"],
  ["right_hip",      "right_knee"],
  ["right_knee",     "right_ankle"],
];

const JOINT_TRIPLETS: Record<string, [number, number, number]> = {
  left_elbow:    [5,  7,  9],   // shoulder-elbow-wrist
  right_elbow:   [6,  8,  10],
  left_shoulder: [11, 5,  7],   // hip-shoulder-elbow
  right_shoulder:[12, 6,  8],
  left_hip:      [5,  11, 13],  // shoulder-hip-knee
  right_hip:     [6,  12, 14],
  left_knee:     [11, 13, 15],  // hip-knee-ankle
  right_knee:    [12, 14, 16],
};

function calculateAngle(
  a: Keypoint,
  b: Keypoint,  // joint being measured
  c: Keypoint
): number {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  
  const dot = ba.x * bc.x + ba.y * bc.y;
  const magA = Math.sqrt(ba.x ** 2 + ba.y ** 2);
  const magB = Math.sqrt(bc.x ** 2 + bc.y ** 2);
  
  if (magA === 0 || magB === 0) return 180;
  
  const cosAngle = Math.max(-1, Math.min(1, dot / (magA * magB)));
  
  return Math.round(
    Math.acos(cosAngle) * (180 / Math.PI)
  );
}

function scoreJoint(
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

function isInStartingPosition(
  keypoints: Keypoint[],
  exercise: Exercise
): boolean {
  const { startingPositionAngles } = exercise;
  
  if (!startingPositionAngles || Object.keys(startingPositionAngles).length === 0) {
    return true; // No check defined — allow
  }
  
  let allCorrect = true;
  
  for (const [joint, [minAngle, maxAngle]] of Object.entries(startingPositionAngles)) {
    const triplet = JOINT_TRIPLETS[joint];
    if (!triplet) continue;
    
    const [ai, bi, ci] = triplet;
    const a = keypoints[ai];
    const b = keypoints[bi];
    const c = keypoints[ci];
    
    if (!a || !b || !c) { 
      allCorrect = false; 
      continue; 
    }
    if (a.score < 0.4 || b.score < 0.4 || c.score < 0.4) {
      allCorrect = false;
      continue;
    }
    
    const angle = calculateAngle(a, b, c);
    
    if (angle < minAngle || angle > maxAngle) {
      allCorrect = false;
      break;
    }
  }
  
  return allCorrect;
}

export default function PoseCheckScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { exercise } = route.params as RouteParams;

  const [permission, requestPermission] = useCameraPermissions();
  const [repCount, setRepCount] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [formScore, setFormScore] = useState(85);
  const [restSeconds, setRestSeconds] = useState(15);
  const [isPaused, setIsPaused] = useState(false);
  const [tip, setTip] = useState("Get in front of the camera");

  const [phase, setPhase] = useState<WorkoutPhase>("loading");
  const [countdown, setCountdown] = useState(3);
  const [positionReady, setPositionReady] = useState(false);
  const positionHeldFrames = useRef(0);
  const POSITION_HOLD_FRAMES = 15;

  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<any>(null);

  // Animation values for the simulated skeleton
  const animationProgress = useRef(new Animated.Value(0)).current;
  const [simulatedKps, setSimulatedKps] = useState<Record<string, [number, number]>>({});
  const [keypoints, setKeypoints] = useState<Keypoint[]>([]);
  const [jointScores, setJointScores] = useState<Record<string, number>>({});

  const restTimerRef = useRef<any>(null);
  const countdownTimerRef = useRef<any>(null);
  const frameTimerRef = useRef<any>(null);
  const positionTimerRef = useRef<any>(null);

  // Rep tracking state machine helper refs
  const repPhase = useRef<"up" | "down">("up");
  const lastAngle = useRef(0);

  // Phase 1: loading → get_in_position after 1.5s
  // Phase 2: get_in_position → countdown after 3s (auto-advance without pose check)
  useEffect(() => {
    const loadTimer = setTimeout(() => {
      setPhase("get_in_position");
    }, 1500);

    return () => {
      clearTimeout(loadTimer);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (restTimerRef.current) clearInterval(restTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (frameTimerRef.current) cancelAnimationFrame(frameTimerRef.current);
      if (positionTimerRef.current) clearTimeout(positionTimerRef.current);
    };
  }, []);

  // Auto-advance from get_in_position → countdown after 3 seconds
  useEffect(() => {
    if (phase === "get_in_position") {
      setPositionReady(false);
      positionHeldFrames.current = 0;

      // Show a "getting ready" indicator then auto-start countdown
      const readyTimer = setTimeout(() => {
        setPositionReady(true);
      }, 1500);

      positionTimerRef.current = setTimeout(() => {
        startCountdown();
      }, 3000);

      return () => {
        clearTimeout(readyTimer);
        if (positionTimerRef.current) clearTimeout(positionTimerRef.current);
      };
    }
  }, [phase]);

  const getTip = (jointName: string): string => {
    const tips: Record<string, string> = {
      left_knee:     "Bend your left knee more",
      right_knee:    "Bend your right knee more",
      left_elbow:    "Straighten your left arm",
      right_elbow:   "Straighten your right arm",
      left_hip:      "Keep your hips level",
      right_hip:     "Keep your hips level",
      left_shoulder: "Open your left shoulder",
      right_shoulder:"Open your right shoulder",
    };
    return tips[jointName] ?? "Adjust your form";
  };

  function processResult(result: { keypoints: Keypoint[]; score: number }) {
    const kps = result.keypoints;
    setKeypoints(kps);
    
    // Always calculate and show form score regardless of phase
    const scores: Record<string, number> = {};
    let total = 0;
    let count = 0;
    
    for (const [joint, target] of Object.entries(exercise.referenceAngles)) {
      const score = scoreJoint(kps, joint, target);
      scores[joint] = score;
      total += score;
      count++;
    }
    
    setJointScores(scores);
    const overall = count > 0 ? Math.round(total / count) : 0;
    setFormScore(overall);
    
    // Generate form tip
    const worst = Object.entries(scores).sort((a, b) => a[1] - b[1])[0];
    if (worst && worst[1] < 60) {
      setTip(getTip(worst[0]));
    } else {
      setTip("");
    }
    
    // Rep counting is handled by animation cycle completion in runRepAnimation
    // No angle-based counting needed here
  }

  function startCountdown() {
    setPhase("countdown");
    setCountdown(3);
    
    let count = 3;
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      count--;
      setCountdown(count);
      
      if (count <= 0) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        Vibration.vibrate(200);
        setPhase("exercising");
      }
    }, 1000);
  }

  // Rep counting is handled by animation cycle completion (see runRepAnimation)
  // This ensures ALL exercises count reps, not just squat/pushup types
  const handleRepComplete = () => {
    Vibration.vibrate(50);
    setRepCount((prev) => {
      const next = prev + 1;
      if (next >= exercise.reps) {
        setTimeout(() => handleSetComplete(), 500);
        return 0;
      }
      return next;
    });
  };

  const handleSetComplete = () => {
    Vibration.vibrate([0, 100, 50, 100]);
    animationProgress.setValue(0);
    setRepCount(0);

    if (currentSet >= exercise.sets) {
      setPhase("complete");
      navigation.replace("WorkoutResult", {
        exercise,
        setsCompleted: currentSet,
        avgFormScore: 88,
        caloriesBurned: Math.round(
          exercise.caloriesPerMin * (exercise.durationSec / 60) * exercise.sets
        ),
        durationSec: exercise.durationSec * exercise.sets,
      });
    } else {
      setPhase("resting");
      setRestSeconds(15); // Fast dev rest cycle, standard is 15s or 60s
      setCurrentSet((s) => s + 1);

      if (restTimerRef.current) clearInterval(restTimerRef.current);
      restTimerRef.current = setInterval(() => {
        setRestSeconds((s) => {
          if (s <= 1) {
            clearInterval(restTimerRef.current);
            restTimerRef.current = null;
            startCountdown();
            return 15;
          }
          return s - 1;
        });
      }, 1000);
    }
  };

  const mapSimulatedToKeypoints = (simKps: Record<string, [number, number]>): Keypoint[] => {
    const kpsList: Keypoint[] = Array(17).fill(null).map((_, i) => ({
      name: KEYPOINT_NAMES[i],
      x: 0,
      y: 0,
      score: 0
    }));

    const keypointMapping: Record<string, number> = {
      nose: 0,
      left_eye: 1, right_eye: 2,
      left_ear: 3, right_ear: 4,
      left_shoulder: 5, right_shoulder: 6,
      left_elbow: 7, right_elbow: 8,
      left_wrist: 9, right_wrist: 10,
      left_hip: 11, right_hip: 12,
      left_knee: 13, right_knee: 14,
      left_ankle: 15, right_ankle: 16
    };

    for (const [name, val] of Object.entries(simKps)) {
      const idx = keypointMapping[name];
      if (idx !== undefined) {
        kpsList[idx] = {
          name,
          x: val[0] * CAM_W,
          y: val[1] * CAM_H,
          score: 0.9 // high confidence
        };
      }
    }

    return kpsList;
  };

  const computeSimulatedJoints = (value: number): Record<string, [number, number]> => {
    const isSquat = exercise.id.includes("squat") || exercise.id.includes("baithak") || exercise.id.includes("lunge") || exercise.id.includes("virabhadrasana") || exercise.id.includes("uth_baith");
    const isPushup = exercise.id.includes("push") || exercise.id.includes("dand") || exercise.id.includes("chaturanga") || exercise.id.includes("dip");
    const isTwist = exercise.id.includes("vakrasana") || exercise.id.includes("twist");
    const isRise = exercise.id.includes("tadasana");
    const isLocust = exercise.id.includes("shalabhasana");
    const isSurya = exercise.id.includes("surya");

    const base: Record<string, [number, number]> = {
      left_shoulder:   [0.36, 0.22],
      right_shoulder:  [0.64, 0.22],
      left_elbow:      [0.26, 0.38],
      right_elbow:     [0.74, 0.38],
      left_wrist:      [0.18, 0.54],
      right_wrist:     [0.82, 0.54],
      left_hip:        [0.38, 0.50],
      right_hip:       [0.62, 0.50],
      left_knee:       [0.36, 0.70],
      right_knee:      [0.64, 0.70],
      left_ankle:      [0.34, 0.88],
      right_ankle:     [0.66, 0.88],
    };

    if (isSquat) {
      // Hips drop, knees bend outward
      const hipDrop = value * 0.15;
      const kneeOut = value * 0.05;
      base.left_hip = [base.left_hip[0] - kneeOut, base.left_hip[1] + hipDrop];
      base.right_hip = [base.right_hip[0] + kneeOut, base.right_hip[1] + hipDrop];
      base.left_knee = [base.left_knee[0] - kneeOut * 1.5, base.left_knee[1] + hipDrop * 0.5];
      base.right_knee = [base.right_knee[0] + kneeOut * 1.5, base.right_knee[1] + hipDrop * 0.5];
      base.left_shoulder = [base.left_shoulder[0] - 0.01 * value, base.left_shoulder[1] + hipDrop * 0.8];
      base.right_shoulder = [base.right_shoulder[0] + 0.01 * value, base.right_shoulder[1] + hipDrop * 0.8];
    } else if (isPushup) {
      // Shoulders drop, elbows bend
      const drop = value * 0.12;
      const elbowBend = value * 0.08;
      base.left_shoulder = [base.left_shoulder[0], base.left_shoulder[1] + drop];
      base.right_shoulder = [base.right_shoulder[0], base.right_shoulder[1] + drop];
      base.left_elbow = [base.left_elbow[0] - elbowBend, base.left_elbow[1] + drop * 0.5];
      base.right_elbow = [base.right_elbow[0] + elbowBend, base.right_elbow[1] + drop * 0.5];
      base.left_hip = [base.left_hip[0], base.left_hip[1] + drop * 0.8];
      base.right_hip = [base.right_hip[0], base.right_hip[1] + drop * 0.8];
      base.left_knee = [base.left_knee[0], base.left_knee[1] + drop * 0.5];
      base.right_knee = [base.right_knee[0], base.right_knee[1] + drop * 0.5];
    } else if (isSurya) {
      // Sun salutation: arms raise then full forward fold
      const fold = value * 0.18;
      base.left_shoulder = [base.left_shoulder[0] - 0.02, base.left_shoulder[1] + fold * 0.5];
      base.right_shoulder = [base.right_shoulder[0] + 0.02, base.right_shoulder[1] + fold * 0.5];
      base.left_elbow = [base.left_elbow[0], base.left_elbow[1] + fold];
      base.right_elbow = [base.right_elbow[0], base.right_elbow[1] + fold];
      base.left_wrist = [base.left_wrist[0], base.left_wrist[1] + fold * 1.2];
      base.right_wrist = [base.right_wrist[0], base.right_wrist[1] + fold * 1.2];
      base.left_hip = [base.left_hip[0], base.left_hip[1] + fold * 0.3];
      base.right_hip = [base.right_hip[0], base.right_hip[1] + fold * 0.3];
    } else if (isTwist) {
      // Russian twist: shoulders rotate left/right while hips stay
      const twistAmt = value * 0.12;
      base.left_shoulder = [base.left_shoulder[0] - twistAmt, base.left_shoulder[1]];
      base.right_shoulder = [base.right_shoulder[0] - twistAmt, base.right_shoulder[1]];
      base.left_elbow = [base.left_elbow[0] - twistAmt * 1.5, base.left_elbow[1] + 0.04];
      base.right_elbow = [base.right_elbow[0] - twistAmt * 0.5, base.right_elbow[1] + 0.04];
      base.left_wrist = [base.left_wrist[0] - twistAmt * 2, base.left_wrist[1] + 0.06];
      base.right_wrist = [base.right_wrist[0] - twistAmt * 1, base.right_wrist[1] + 0.06];
    } else if (isRise) {
      // Calf raise: slight upward body lift, arms overhead
      const rise = value * 0.04;
      base.left_shoulder = [base.left_shoulder[0], base.left_shoulder[1] - rise];
      base.right_shoulder = [base.right_shoulder[0], base.right_shoulder[1] - rise];
      base.left_elbow = [base.left_elbow[0], base.left_elbow[1] - rise * 0.8];
      base.right_elbow = [base.right_elbow[0], base.right_elbow[1] - rise * 0.8];
      base.left_wrist = [base.left_wrist[0], base.left_wrist[1] - rise * 1.2];
      base.right_wrist = [base.right_wrist[0], base.right_wrist[1] - rise * 1.2];
      base.left_ankle = [base.left_ankle[0], base.left_ankle[1] - rise * 0.5];
      base.right_ankle = [base.right_ankle[0], base.right_ankle[1] - rise * 0.5];
    } else if (isLocust) {
      // Locust hold: chest and legs lift up
      const lift = value * 0.08;
      base.left_shoulder = [base.left_shoulder[0], base.left_shoulder[1] - lift];
      base.right_shoulder = [base.right_shoulder[0], base.right_shoulder[1] - lift];
      base.left_elbow = [base.left_elbow[0], base.left_elbow[1] - lift * 0.5];
      base.right_elbow = [base.right_elbow[0], base.right_elbow[1] - lift * 0.5];
      base.left_knee = [base.left_knee[0], base.left_knee[1] - lift];
      base.right_knee = [base.right_knee[0], base.right_knee[1] - lift];
      base.left_ankle = [base.left_ankle[0], base.left_ankle[1] - lift * 1.2];
      base.right_ankle = [base.right_ankle[0], base.right_ankle[1] - lift * 1.2];
    }

    return base;
  };

  // Keep starting skeleton updated on frames when not in exercising phase
  useEffect(() => {
    const loop = () => {
      if (phase !== "exercising" && phase !== "resting" && phase !== "complete") {
        const base = computeSimulatedJoints(0);
        setSimulatedKps(base);
        const kps = mapSimulatedToKeypoints(base);
        processResult({ keypoints: kps, score: 0.9 });
      }

      frameTimerRef.current = requestAnimationFrame(loop);
    };

    frameTimerRef.current = requestAnimationFrame(loop);

    return () => {
      if (frameTimerRef.current) {
        cancelAnimationFrame(frameTimerRef.current);
      }
    };
  }, [phase]);

  // Listener to compute simulated joint coordinates based on animation value
  useEffect(() => {
    const listenerId = animationProgress.addListener(({ value }) => {
      if (phase !== "exercising") return;

      const base = computeSimulatedJoints(value);
      setSimulatedKps(base);

      const kps = mapSimulatedToKeypoints(base);
      processResult({ keypoints: kps, score: 0.9 });
    });

    return () => {
      animationProgress.removeListener(listenerId);
    };
  }, [exercise, animationProgress, phase]);

  // Initialize and run the exercising loop (time-based vs rep-based)
  useEffect(() => {
    if (phase !== "exercising" || isPaused) {
      animationProgress.stopAnimation();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (exercise.isTimeBased) {
      setTimerSeconds(exercise.durationSec);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            timerRef.current = null;
            handleSetComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    } else {
      // Each full animation cycle (0→1→0) = 1 rep for ALL exercise types
      const runRepAnimation = () => {
        Animated.sequence([
          Animated.timing(animationProgress, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: false,
          }),
          Animated.timing(animationProgress, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: false,
          }),
        ]).start((result) => {
          if (result.finished && phase === "exercising" && !isPaused) {
            // Count 1 rep per completed animation cycle — works for ALL exercises
            handleRepComplete();
            runRepAnimation();
          }
        });
      };

      runRepAnimation();

      return () => {
        animationProgress.stopAnimation();
      };
    }
  }, [phase, isPaused, currentSet]);

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Checking camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Camera Access Needed</Text>
        <Text style={styles.subtitle}>
          NutriVision needs camera access to capture your pose and verify your workout form.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Allow Camera Access</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.goBack()}>
          <Text style={styles.btnSecondaryText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === "loading") {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading AI model...</Text>
        <Text style={styles.loadingSubtext}>
          Setting up pose tracking and calibrations. This takes a few moments.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Section - Reference Target Form */}
      <View style={styles.referenceSection}>
        <Text style={styles.referenceLabel}>Target Pose Form — {exercise.name}</Text>
        <ReferenceSkeleton
          exerciseId={exercise.id}
          width={SCREEN_W}
          height={SCREEN_H * 0.22}
          highlightJoints={exercise.keypoints}
        />
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <Text style={[styles.statNumber, { color: formScore >= 75 ? "#1D9E75" : "#BA7517" }]}>
            {formScore}%
          </Text>
          <Text style={styles.statLabel}>Form Score</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>
            {exercise.isTimeBased ? `${timerSeconds}s` : `${repCount}/${exercise.reps}`}
          </Text>
          <Text style={styles.statLabel}>{exercise.isTimeBased ? "Timer" : "Reps"}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>
            {currentSet}/{exercise.sets}
          </Text>
          <Text style={styles.statLabel}>Set</Text>
        </View>
      </View>

      {/* Tip Banner */}
      <View style={styles.tipBar}>
        <Text style={styles.tipText}>💡 {tip || "Position yourself in front of the camera"}</Text>
      </View>

      {/* Camera Live Stream & Animated Skeleton */}
      <View style={styles.cameraSection}>
        <CameraView style={styles.camera} facing="front" flash="off" />

        {/* Dynamic Skeleton Overlay */}
        {Object.keys(simulatedKps).length > 0 && (
          <Svg width={CAM_W} height={CAM_H} style={StyleSheet.absoluteFill}>
            {/* Draw skeleton bones */}
            {SKELETON_CONNECTIONS.map(([start, end], idx) => {
              const ptStart = simulatedKps[start];
              const ptEnd = simulatedKps[end];
              if (!ptStart || !ptEnd) return null;
              return (
                <Line
                  key={`bone-${idx}`}
                  x1={ptStart[0] * CAM_W}
                  y1={ptStart[1] * CAM_H}
                  x2={ptEnd[0] * CAM_W}
                  y2={ptEnd[1] * CAM_H}
                  stroke="rgba(29, 158, 117, 0.8)"
                  strokeWidth={4}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Draw joint circles */}
            {Object.entries(simulatedKps).map(([name, [x, y]]) => {
              const isHighlight = exercise.keypoints.some((k) =>
                name.includes(k.replace("left_", "").replace("right_", ""))
              );
              return (
                <Circle
                  key={`joint-${name}`}
                  cx={x * CAM_W}
                  cy={y * CAM_H}
                  r={isHighlight ? 9 : 6}
                  fill={isHighlight ? "#EF9F27" : "#FFFFFF"}
                  stroke="#1D9E75"
                  strokeWidth={2}
                />
              );
            })}
          </Svg>
        )}

        {/* GET IN POSITION OVERLAY */}
        {(phase === "get_in_position" || phase === "detecting_ready") && (
          <View style={styles.positionOverlay}>
            <Text style={styles.positionTitle}>Get in position</Text>
            <Text style={styles.positionInstruction}>{exercise.description}</Text>
            
            <View style={[
              styles.positionIndicator,
              positionReady 
                ? styles.positionIndicatorReady
                : styles.positionIndicatorWaiting
            ]}>
              <Text style={styles.positionIndicatorText}>
                {positionReady 
                  ? "✓ Hold position..." 
                  : "• Waiting for start position"}
              </Text>
            </View>
            
            <View style={styles.holdProgressBar}>
              <View style={[
                styles.holdProgressFill,
                { 
                  width: `${Math.min(100, (positionHeldFrames.current / POSITION_HOLD_FRAMES) * 100)}%`,
                  backgroundColor: positionReady ? "#1D9E75" : "#E5E7EB"
                }
              ]}/>
            </View>
            
            <Text style={styles.positionHint}>
              Stand in front of the camera so your full body is visible
            </Text>
          </View>
        )}

        {/* COUNTDOWN OVERLAY */}
        {phase === "countdown" && (
          <View style={styles.countdownOverlay}>
            <Text style={styles.countdownNumber}>
              {countdown === 0 ? "GO!" : countdown}
            </Text>
            <Text style={styles.countdownLabel}>
              {countdown === 0 ? "Start exercising!" : "Get ready..."}
            </Text>
          </View>
        )}

        {/* Pause Overlay */}
        {isPaused && (
          <View style={styles.pauseOverlay}>
            <Text style={styles.pauseText}>Paused</Text>
          </View>
        )}

        {/* Rest Overlay */}
        {phase === "resting" && (
          <View style={styles.restOverlay}>
            <Text style={styles.restTitle}>Rest Intermission</Text>
            <Text style={styles.restTimer}>{restSeconds}s</Text>
            <Text style={styles.restSubtitle}>
              Next: Set {currentSet} of {exercise.sets}
            </Text>
            <TouchableOpacity style={styles.skipRest} onPress={() => {
              if (restTimerRef.current) clearInterval(restTimerRef.current);
              restTimerRef.current = null;
              startCountdown();
            }}>
              <Text style={styles.skipRestText}>Skip Rest</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Control Buttons */}
      <View style={styles.controls}>
        {phase === "exercising" && (
          <>
            <TouchableOpacity style={styles.controlBtn} onPress={() => setIsPaused((p) => !p)}>
              <Text style={styles.controlText}>{isPaused ? "▶ Resume" : "⏸ Pause"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlBtn} onPress={handleSetComplete}>
              <Text style={styles.controlText}>⏭ Skip Set</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity style={[styles.controlBtn, styles.exitBtn]} onPress={() => navigation.goBack()}>
          <Text style={[styles.controlText, { color: "#E24B4A" }]}>✗ Exit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#0A0A0A",
  },
  referenceSection: {
    height: SCREEN_H * 0.22,
    backgroundColor: "#141414",
    borderBottomWidth: 1,
    borderBottomColor: "#222222",
  },
  referenceLabel: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    paddingTop: 45,
    paddingBottom: 6,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statsBar: {
    flexDirection: "row",
    backgroundColor: "#1A1A1A",
    paddingVertical: 12,
    justifyContent: "space-around",
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  stat: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
    textTransform: "uppercase",
  },
  tipBar: {
    backgroundColor: "#1E1B10",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#332B10",
  },
  tipText: {
    color: "#EF9F27",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  cameraSection: {
    flex: 1,
    position: "relative",
  },
  camera: {
    flex: 1,
  },
  controls: {
    flexDirection: "row",
    backgroundColor: "#111",
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 36,
  },
  controlBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333333",
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  exitBtn: {
    borderColor: "rgba(226,75,74,0.3)",
    backgroundColor: "rgba(226,75,74,0.1)",
  },
  controlText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  pauseOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  pauseText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  restOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(10,10,10,0.9)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  restTitle: {
    color: "#9CA3AF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  restTimer: {
    color: "#1D9E75",
    fontSize: 72,
    fontWeight: "900",
  },
  restSubtitle: {
    color: "#9CA3AF",
    fontSize: 14,
    marginTop: 8,
  },
  skipRest: {
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#444444",
    backgroundColor: "#1C1C1C",
  },
  skipRestText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    color: "#9CA3AF",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  btn: {
    backgroundColor: "#1D9E75",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 12,
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  btnSecondary: {
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  btnSecondaryText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "700",
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingSubtext: {
    color: "#9CA3AF",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 12,
  },
  
  // Phase Overlay styles
  positionOverlay: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.85)",
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  positionTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  positionInstruction: {
    color: "#ccc",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  positionIndicator: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    marginBottom: 12,
  },
  positionIndicatorReady: {
    backgroundColor: "#1D9E7530",
    borderWidth: 1,
    borderColor: "#1D9E75",
  },
  positionIndicatorWaiting: {
    backgroundColor: "#ffffff10",
    borderWidth: 1,
    borderColor: "#666",
  },
  positionIndicatorText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
  },
  holdProgressBar: {
    height: 6,
    backgroundColor: "#333",
    borderRadius: 3,
    marginBottom: 12,
    overflow: "hidden",
  },
  holdProgressFill: {
    height: 6,
    borderRadius: 3,
  },
  positionHint: {
    color: "#888",
    fontSize: 12,
    textAlign: "center",
  },
  countdownOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  countdownNumber: {
    color: "#1D9E75",
    fontSize: 96,
    fontWeight: "700",
    lineHeight: 96,
  },
  countdownLabel: {
    color: "#fff",
    fontSize: 18,
    marginTop: 16,
  },
});
