import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Vibration, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as tf from "@tensorflow/tfjs";
import { cameraWithTensors } from "@tensorflow/tfjs-react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import SkeletonOverlay from "../components/SkeletonOverlay";
import ReferenceSkeleton from "../components/ReferenceSkeleton";
import { 
  loadDetector, detectPose, scoreJoint,
  Keypoint, PoseResult 
} from "../utils/poseDetector";
import { initTF } from "../utils/tfSetup";
import type { Exercise } from "../constants/exercises";

const TensorCamera = cameraWithTensors(CameraView);
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// Camera preview dimensions
const CAM_W = SCREEN_W;
const CAM_H = SCREEN_H * 0.55;

type RouteParams = {
  exercise: Exercise;
};

export default function PoseCheckScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { exercise } = route.params as RouteParams;
  
  const [permission, requestPermission] = useCameraPermissions();
  const [tfReady, setTfReady] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Initialising AI...");
  
  const [keypoints, setKeypoints] = useState<Keypoint[]>([]);
  const [formScore, setFormScore] = useState(0);
  const [jointScores, setJointScores] = useState<Record<string, number>>({});
  const [repCount, setRepCount] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [phase, setPhase] = useState<"up" | "down">("up");
  const [isResting, setIsResting] = useState(false);
  const [restSeconds, setRestSeconds] = useState(60);
  const [isPaused, setIsPaused] = useState(false);
  const [tip, setTip] = useState("");
  
  // Fallback state machine if TF fails
  const [showFallback, setShowFallback] = useState(false);
  const [fallbackMsg, setFallbackMsg] = useState("");
  
  const frameCount = useRef(0);
  const lastScoreTime = useRef(0);
  const SCORE_INTERVAL_MS = 150;
  const restTimerRef = useRef<any>(null);
  
  // Rep tracking state
  const repPhase = useRef<"up"|"down">("up");
  const lastAngle = useRef(0);
  
  useEffect(() => {
    async function setup() {
      try {
        setLoadingMsg("Starting TensorFlow...");
        await initTF();
        setTfReady(true);
        
        setLoadingMsg("Loading pose model...");
        await loadDetector();
        setModelReady(true);
        setLoadingMsg("");
      } catch (e: any) {
        console.warn("TensorFlow initialization failed. Using manual fallback.", e);
        setFallbackMsg("AI model could not load. Using manual rep counting instead.");
        setShowFallback(true);
        setTfReady(false);
        setModelReady(true); // set to true so loading spinner clears
      }
    }
    setup();
    
    return () => {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
      }
    };
  }, []);
  
  // Handle incoming camera tensors
  const handleCameraStream = useCallback(
    (images: IterableIterator<tf.Tensor3D>) => {
      
      const loop = async () => {
        if (isPaused || showFallback) return;
        
        const next = images.next();
        if (next.done) return;
        
        const imageTensor = next.value;
        frameCount.current++;
        
        // Process every 2nd frame to save CPU
        if (frameCount.current % 2 === 0) {
          const now = Date.now();
          if (now - lastScoreTime.current > 
              SCORE_INTERVAL_MS) {
            
            try {
              const result = await detectPose(
                imageTensor
              );
              if (result) {
                processResult(result);
              }
            } catch (e) {
              // silently skip failed frames
            }
            
            lastScoreTime.current = now;
          }
        }
        
        tf.dispose(imageTensor);
        requestAnimationFrame(loop);
      };
      
      loop();
    },
    [isPaused, exercise, showFallback]
  );
  
  function processResult(result: PoseResult) {
    const kps = result.keypoints;
    setKeypoints(kps);
    
    // Calculate per-joint scores
    const scores: Record<string, number> = {};
    let total = 0;
    let count = 0;
    
    for (const [joint, target] of 
      Object.entries(exercise.referenceAngles)) {
      const score = scoreJoint(kps, joint, target);
      scores[joint] = score;
      total += score;
      count++;
    }
    
    setJointScores(scores);
    
    const overall = count > 0 
      ? Math.round(total / count) 
      : 0;
    setFormScore(overall);
    
    // Generate tip for worst joint
    const worst = Object.entries(scores)
      .sort((a, b) => a[1] - b[1])[0];
    if (worst && worst[1] < 60) {
      setTip(getTip(worst[0], kps, 
        exercise.referenceAngles[worst[0]] ?? 90));
    } else {
      setTip("");
    }
    
    // Rep counting
    countRep(kps);
  }
  
  function countRep(kps: Keypoint[]) {
    let angle = 180;
    
    if (exercise.id.includes("squat") || 
        exercise.id.includes("lunge")) {
      if (kps[13] && kps[11] && kps[15]) {
        angle = calculateAngleFromKps(
          kps[11], kps[13], kps[15]
        );
      }
    } else if (exercise.id.includes("push")) {
      if (kps[5] && kps[7] && kps[9]) {
        angle = calculateAngleFromKps(
          kps[5], kps[7], kps[9]
        );
      }
    }
    
    // State machine: detect down then up = 1 rep
    if (repPhase.current === "up" && angle < 110) {
      repPhase.current = "down";
    } else if (repPhase.current === "down" 
               && angle > 155) {
      repPhase.current = "up";
      const newCount = repCount + 1;
      setRepCount(newCount);
      Vibration.vibrate(50);
      
      // Check if set complete
      if (newCount >= exercise.reps) {
        handleSetComplete();
      }
    }
    
    lastAngle.current = angle;
  }
  
  const handleManualRep = useCallback(() => {
    const newCount = repCount + 1;
    setRepCount(newCount);
    Vibration.vibrate(50);
    
    if (newCount >= exercise.reps) {
      handleSetComplete();
    }
  }, [repCount, exercise]);
  
  function handleSetComplete() {
    Vibration.vibrate([0, 100, 50, 100]);
    setRepCount(0);
    
    if (currentSet >= exercise.sets) {
      // All sets done
      navigation.replace("WorkoutResult", {
        exercise,
        setsCompleted: currentSet,
        avgFormScore: formScore,
        caloriesBurned: Math.round(
          exercise.caloriesPerMin * 
          (exercise.durationSec / 60) * 
          exercise.sets
        ),
        durationSec: exercise.durationSec * 
          exercise.sets,
      });
    } else {
      // Rest between sets
      setIsResting(true);
      setRestSeconds(60);
      setCurrentSet(s => s + 1);
      
      if (restTimerRef.current) clearInterval(restTimerRef.current);
      restTimerRef.current = setInterval(() => {
        setRestSeconds(s => {
          if (s <= 1) {
            if (restTimerRef.current) {
              clearInterval(restTimerRef.current);
              restTimerRef.current = null;
            }
            setIsResting(false);
            return 60;
          }
          return s - 1;
        });
      }, 1000);
    }
  }
  
  function calculateAngleFromKps(
    a: Keypoint, b: Keypoint, c: Keypoint
  ): number {
    const ba = { x: a.x-b.x, y: a.y-b.y };
    const bc = { x: c.x-b.x, y: c.y-b.y };
    const dot = ba.x*bc.x + ba.y*bc.y;
    const mag = Math.sqrt(ba.x**2+ba.y**2) * 
      Math.sqrt(bc.x**2+bc.y**2);
    if (mag === 0) return 180;
    return Math.round(
      Math.acos(Math.max(-1,Math.min(1,dot/mag))) 
      * 180/Math.PI
    );
  }
  
  function getTip(joint: string, 
    kps: Keypoint[], target: number): string {
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
    return tips[joint] ?? "Adjust your form";
  }
  
  function scoreColor(score: number): string {
    if (score >= 75) return "#1D9E75";
    if (score >= 50) return "#BA7517";
    return "#E24B4A";
  }
  
  function scoreLabel(score: number): string {
    if (score >= 75) return "Great form";
    if (score >= 50) return "Getting there";
    return "Adjust form";
  }
  
  // Permission not yet determined
  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>
          Checking camera permission...
        </Text>
      </View>
    );
  }
  
  // Permission denied
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>
          Camera access needed
        </Text>
        <Text style={styles.subtitle}>
          NutriVision needs your camera to 
          check your exercise form in real time.
        </Text>
        <TouchableOpacity 
          style={styles.btn}
          onPress={requestPermission}
        >
          <Text style={styles.btnText}>
            Allow Camera Access
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.btnSecondary}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.btnSecondaryText}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Loading model
  if (!modelReady) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>
          {loadingMsg}
        </Text>
        <Text style={styles.loadingSubtext}>
          Loading AI model for the first time.
          This takes 10-20 seconds.
          Next time it will be instant.
        </Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      
      {/* REFERENCE SKELETON — top section */}
      <View style={styles.referenceSection}>
        <Text style={styles.referenceLabel}>
          Target form — {exercise.name}
        </Text>
        <ReferenceSkeleton
          exerciseId={exercise.id}
          width={SCREEN_W}
          height={SCREEN_H * 0.28}
          highlightJoints={exercise.keypoints}
        />
      </View>
      
      {/* STATS BAR */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <Text style={[styles.statNumber,
            { color: scoreColor(formScore) }]}>
            {formScore}%
          </Text>
          <Text style={styles.statLabel}>
            {scoreLabel(formScore)}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>
            {repCount}/{exercise.reps}
          </Text>
          <Text style={styles.statLabel}>
            Reps
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>
            {currentSet}/{exercise.sets}
          </Text>
          <Text style={styles.statLabel}>
            Sets
          </Text>
        </View>
      </View>
      
      {/* TIP */}
      {tip !== "" && (
        <View style={styles.tipBar}>
          <Text style={styles.tipText}>
            {tip}
          </Text>
        </View>
      )}
      
      {/* REST OVERLAY */}
      {isResting && (
        <View style={styles.restOverlay}>
          <Text style={styles.restTitle}>
            Rest
          </Text>
          <Text style={styles.restTimer}>
            {restSeconds}s
          </Text>
          <Text style={styles.restSubtitle}>
            Next: Set {currentSet} of {exercise.sets}
          </Text>
          <TouchableOpacity
            style={styles.skipRest}
            onPress={() => setIsResting(false)}
          >
            <Text style={styles.skipRestText}>
              Skip rest
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* LIVE CAMERA + SKELETON OVERLAY / FALLBACK */}
      <View style={styles.cameraSection}>
        {showFallback ? (
          <View style={styles.fallbackContainer}>
            <Text style={styles.fallbackTitle}>Pose detection unavailable</Text>
            <Text style={styles.fallbackSubtext}>
              {fallbackMsg || "AI model could not load. Using manual rep counting instead."}
            </Text>
            
            <View style={styles.fallbackTips}>
              <Text style={styles.fallbackTipHeader}>Tips for {exercise.name}:</Text>
              <Text style={styles.fallbackTipText}>• Focus on controlled, steady movements.</Text>
              <Text style={styles.fallbackTipText}>• Maintain a strong core and correct posture.</Text>
              <Text style={styles.fallbackTipText}>• Tap the "Rep done" button below to log each rep manually.</Text>
            </View>

            <TouchableOpacity
              style={styles.manualRepBtn}
              onPress={handleManualRep}
            >
              <Text style={styles.manualRepBtnText}>Rep done</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TensorCamera
              style={styles.camera}
              facing="front"
              onReady={handleCameraStream}
              resizeWidth={257}
              resizeHeight={193}
              resizeDepth={3}
              autorender={true}
              useCustomShadersToResize={false}
              cameraTextureWidth={1920}
              cameraTextureHeight={1080}
            />
            
            {/* Detected skeleton overlay */}
            {keypoints.length > 0 && (
              <SkeletonOverlay
                keypoints={keypoints.map(kp => ({
                  ...kp,
                  // Scale from model coords to screen
                  x: (kp.x / 257) * CAM_W,
                  y: (kp.y / 193) * CAM_H,
                }))}
                width={CAM_W}
                height={CAM_H}
                highlightJoints={exercise.keypoints}
              />
            )}
          </>
        )}
        
        {/* Pause overlay */}
        {isPaused && (
          <View style={styles.pauseOverlay}>
            <Text style={styles.pauseText}>
              Paused
            </Text>
          </View>
        )}
      </View>
      
      {/* CONTROLS */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => setIsPaused(p => !p)}
        >
          <Text style={styles.controlText}>
            {isPaused ? "Resume" : "Pause"}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={handleSetComplete}
        >
          <Text style={styles.controlText}>
            Skip set
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.controlBtn, 
            styles.exitBtn]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.controlText,
            { color: "#E24B4A" }]}>
            Exit
          </Text>
        </TouchableOpacity>
      </View>
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#0a0a0a" 
  },
  center: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center",
    padding: 32,
    backgroundColor: "#0a0a0a",
  },
  referenceSection: {
    height: SCREEN_H * 0.28,
    backgroundColor: "#111",
    borderBottomWidth: 0.5,
    borderBottomColor: "#333",
  },
  referenceLabel: {
    color: "#888",
    fontSize: 11,
    textAlign: "center",
    paddingTop: 8,
    paddingBottom: 4,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statsBar: {
    flexDirection: "row",
    backgroundColor: "#111",
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: "space-around",
    borderBottomWidth: 0.5,
    borderBottomColor: "#222",
  },
  stat: { alignItems: "center" },
  statNumber: { 
    fontSize: 22, 
    fontWeight: "500", 
    color: "#fff" 
  },
  statLabel: { 
    fontSize: 11, 
    color: "#888", 
    marginTop: 2 
  },
  tipBar: {
    backgroundColor: "#1a1400",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#333",
  },
  tipText: { 
    color: "#EF9F27", 
    fontSize: 13, 
    textAlign: "center" 
  },
  cameraSection: {
    flex: 1,
    position: "relative",
  },
  camera: { 
    flex: 1 
  },
  controls: {
    flexDirection: "row",
    backgroundColor: "#111",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 32,
  },
  controlBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "#333",
    alignItems: "center",
  },
  exitBtn: { borderColor: "#E24B4A22" },
  controlText: { 
    color: "#fff", 
    fontSize: 14, 
    fontWeight: "500" 
  },
  pauseOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  pauseText: { 
    color: "#fff", 
    fontSize: 32, 
    fontWeight: "500" 
  },
  restOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  restTitle: { 
    color: "#888", 
    fontSize: 16, 
    marginBottom: 8 
  },
  restTimer: { 
    color: "#1D9E75", 
    fontSize: 64, 
    fontWeight: "500" 
  },
  restSubtitle: { 
    color: "#888", 
    fontSize: 14, 
    marginTop: 8 
  },
  skipRest: { 
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#444",
  },
  skipRestText: { color: "#fff", fontSize: 14 },
  title: { 
    color: "#fff", 
    fontSize: 20, 
    fontWeight: "500",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: { 
    color: "#888", 
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
    color: "#fff", 
    fontSize: 15, 
    fontWeight: "500" 
  },
  btnSecondary: {
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  btnSecondaryText: { 
    color: "#888", 
    fontSize: 14 
  },
  loadingText: { 
    color: "#fff", 
    fontSize: 16,
    marginBottom: 12,
  },
  loadingSubtext: { 
    color: "#888", 
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  
  // Fallback UI Styles
  fallbackContainer: {
    flex: 1,
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  fallbackSubtext: {
    fontSize: 14,
    color: "#E24B4A",
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 20,
  },
  fallbackTips: {
    backgroundColor: "#1a1a1a",
    padding: 16,
    borderRadius: 10,
    marginBottom: 24,
    width: "100%",
  },
  fallbackTipHeader: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  fallbackTipText: {
    fontSize: 13,
    color: "#9CA3AF",
    lineHeight: 20,
    marginBottom: 4,
  },
  manualRepBtn: {
    backgroundColor: "#1D9E75",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    shadowColor: "#1D9E75",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  manualRepBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
