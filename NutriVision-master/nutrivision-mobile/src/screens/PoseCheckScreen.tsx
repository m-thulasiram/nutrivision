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

// Connections for drawing skeleton bones
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

export default function PoseCheckScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { exercise } = route.params as RouteParams;

  const [permission, requestPermission] = useCameraPermissions();
  const [repCount, setRepCount] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [formScore, setFormScore] = useState(85);
  const [isResting, setIsResting] = useState(false);
  const [restSeconds, setRestSeconds] = useState(10);
  const [isPaused, setIsPaused] = useState(false);
  const [tip, setTip] = useState("Align your body in the frame");

  // Animation values for the simulated skeleton
  const animationProgress = useRef(new Animated.Value(0)).current;
  const [simulatedKps, setSimulatedKps] = useState<Record<string, [number, number]>>({});

  const restTimerRef = useRef<any>(null);

  // Initialize and run the simulation loop
  useEffect(() => {
    if (isPaused || isResting) {
      animationProgress.stopAnimation();
      return;
    }

    // Set up continuous loop: 0 (standing/start) -> 1 (flexion/mid-rep) -> 0 (finish rep)
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
        if (result.finished && !isPaused && !isResting) {
          // Increment rep
          setRepCount((prev) => {
            const next = prev + 1;
            Vibration.vibrate(60);
            if (next >= exercise.reps) {
              // Finish set after a tiny delay
              setTimeout(() => {
                handleSetComplete();
              }, 500);
              return 0;
            }
            return next;
          });
          runRepAnimation();
        }
      });
    };

    runRepAnimation();

    return () => {
      animationProgress.stopAnimation();
    };
  }, [isPaused, isResting, currentSet]);

  // Listener to compute simulated joint coordinates based on animation value
  useEffect(() => {
    const listenerId = animationProgress.addListener(({ value }) => {
      const isSquat = exercise.id.includes("squat") || exercise.id.includes("lunge");
      const isPushup = exercise.id.includes("push") || exercise.id.includes("dip");

      // Baseline standing/straight post keypoints relative to CAM_W and CAM_H
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
        // Lower hips, bend knees outwards, keep feet fixed
        const hipDrop = value * 0.15; // lower hips by 15% height
        const kneeOut = value * 0.05;  // push knees out by 5% width

        base.left_hip = [base.left_hip[0] - kneeOut, base.left_hip[1] + hipDrop];
        base.right_hip = [base.right_hip[0] + kneeOut, base.right_hip[1] + hipDrop];

        base.left_knee = [base.left_knee[0] - kneeOut * 1.5, base.left_knee[1] + hipDrop * 0.5];
        base.right_knee = [base.right_knee[0] + kneeOut * 1.5, base.right_knee[1] + hipDrop * 0.5];

        // Minor chest lean
        base.left_shoulder = [base.left_shoulder[0] - 0.01 * value, base.left_shoulder[1] + hipDrop * 0.8];
        base.right_shoulder = [base.right_shoulder[0] + 0.01 * value, base.right_shoulder[1] + hipDrop * 0.8];
        
        // Randomize form score slightly around 85-95%
        setFormScore(Math.round(88 + Math.sin(value * Math.PI) * 7));
        setTip(value > 0.6 ? "Excellent depth! Hold it." : "Keep chest up and knees out");
      } else if (isPushup) {
        // Keep body line straight, bend elbows outwards, wrist and feet fixed
        const drop = value * 0.12; // move shoulders/chest down
        const elbowBend = value * 0.08; // bend elbows out

        base.left_shoulder = [base.left_shoulder[0], base.left_shoulder[1] + drop];
        base.right_shoulder = [base.right_shoulder[0], base.right_shoulder[1] + drop];
        
        base.left_elbow = [base.left_elbow[0] - elbowBend, base.left_elbow[1] + drop * 0.5];
        base.right_elbow = [base.right_elbow[0] + elbowBend, base.right_elbow[1] + drop * 0.5];

        base.left_hip = [base.left_hip[0], base.left_hip[1] + drop * 0.8];
        base.right_hip = [base.right_hip[0], base.right_hip[1] + drop * 0.8];

        base.left_knee = [base.left_knee[0], base.left_knee[1] + drop * 0.5];
        base.right_knee = [base.right_knee[0], base.right_knee[1] + drop * 0.5];

        setFormScore(Math.round(84 + Math.sin(value * Math.PI) * 9));
        setTip(value > 0.6 ? "Lower all the way! Great." : "Keep body straight, core tight");
      } else {
        // Plank/other hold: simple minor breathing/shaking motion
        const shake = (Math.random() - 0.5) * 0.005;
        base.left_hip = [base.left_hip[0], base.left_hip[1] + shake];
        base.right_hip = [base.right_hip[0], base.right_hip[1] + shake];
        setFormScore(Math.round(92 + Math.sin(Date.now() / 200) * 3));
        setTip("Maintain rigid flat posture");
      }

      setSimulatedKps(base);
    });

    return () => {
      animationProgress.removeListener(listenerId);
    };
  }, [exercise, animationProgress]);

  const handleSetComplete = () => {
    Vibration.vibrate([0, 100, 50, 100]);
    animationProgress.setValue(0);
    setRepCount(0);

    if (currentSet >= exercise.sets) {
      // Complete workout session
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
      // Enter resting state
      setIsResting(true);
      setRestSeconds(10); // 10 seconds rest for fast dev/user experience
      setCurrentSet((s) => s + 1);

      if (restTimerRef.current) clearInterval(restTimerRef.current);
      restTimerRef.current = setInterval(() => {
        setRestSeconds((s) => {
          if (s <= 1) {
            if (restTimerRef.current) {
              clearInterval(restTimerRef.current);
              restTimerRef.current = null;
            }
            setIsResting(false);
            return 10;
          }
          return s - 1;
        });
      }, 1000);
    }
  };

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
            {repCount}/{exercise.reps}
          </Text>
          <Text style={styles.statLabel}>Reps</Text>
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
        <Text style={styles.tipText}>💡 {tip}</Text>
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

        {/* Pause Overlay */}
        {isPaused && (
          <View style={styles.pauseOverlay}>
            <Text style={styles.pauseText}>Paused</Text>
          </View>
        )}

        {/* Rest Overlay */}
        {isResting && (
          <View style={styles.restOverlay}>
            <Text style={styles.restTitle}>Rest Intermission</Text>
            <Text style={styles.restTimer}>{restSeconds}s</Text>
            <Text style={styles.restSubtitle}>
              Next: Set {currentSet} of {exercise.sets}
            </Text>
            <TouchableOpacity style={styles.skipRest} onPress={() => setIsResting(false)}>
              <Text style={styles.skipRestText}>Skip Rest</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Control Buttons */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlBtn} onPress={() => setIsPaused((p) => !p)}>
          <Text style={styles.controlText}>{isPaused ? "▶ Resume" : "⏸ Pause"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={handleSetComplete}>
          <Text style={styles.controlText}>⏭ Skip Set</Text>
        </TouchableOpacity>
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
    height: SCREEN_H * 0.26,
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
    backgroundColor: "#111111",
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
    ...StyleSheet.absoluteFill,
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
    ...StyleSheet.absoluteFill,
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
});
