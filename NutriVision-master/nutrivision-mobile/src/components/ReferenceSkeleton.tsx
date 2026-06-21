import React from "react";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";

type ReferenceSkeletonProps = {
  exerciseId: string;
  width: number;
  height: number;
  highlightJoints: string[];
};

// Normalised reference positions [x%, y%]
// Scaled to actual width/height at render time
const REFERENCE_POSITIONS: Record<string, [number, number]> = {
  nose:            [0.50, 0.06],
  left_eye:        [0.46, 0.04],
  right_eye:       [0.54, 0.04],
  left_ear:        [0.42, 0.06],
  right_ear:       [0.58, 0.06],
  left_shoulder:   [0.36, 0.22],
  right_shoulder:  [0.64, 0.22],
  left_elbow:      [0.24, 0.40],
  right_elbow:     [0.76, 0.40],
  left_wrist:      [0.16, 0.58],
  right_wrist:     [0.84, 0.58],
  left_hip:        [0.38, 0.52],
  right_hip:       [0.62, 0.52],
  left_knee:       [0.36, 0.72],
  right_knee:      [0.64, 0.72],
  left_ankle:      [0.34, 0.92],
  right_ankle:     [0.66, 0.92],
};

// Exercise-specific overrides
const EXERCISE_POSITIONS: Record<string, Partial<Record<string, [number, number]>>> = {
  squat: {
    left_hip:   [0.38, 0.52],
    right_hip:  [0.62, 0.52],
    left_knee:  [0.30, 0.72],
    right_knee: [0.70, 0.72],
    left_ankle: [0.28, 0.92],
    right_ankle:[0.72, 0.92],
  },
  push_up: {
    left_shoulder:  [0.28, 0.30],
    right_shoulder: [0.72, 0.30],
    left_elbow:     [0.22, 0.48],
    right_elbow:    [0.78, 0.48],
    left_hip:       [0.36, 0.50],
    right_hip:      [0.64, 0.50],
    left_knee:      [0.36, 0.70],
    right_knee:     [0.64, 0.70],
  },
  plank: {
    left_shoulder:  [0.26, 0.32],
    right_shoulder: [0.74, 0.32],
    left_elbow:     [0.22, 0.50],
    right_elbow:    [0.78, 0.50],
    left_hip:       [0.38, 0.48],
    right_hip:      [0.62, 0.48],
  },
};

const CONNECTIONS: [string, string][] = [
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

export default function ReferenceSkeleton({
  exerciseId,
  width,
  height,
  highlightJoints,
}: ReferenceSkeletonProps) {
  
  const overrides = EXERCISE_POSITIONS[exerciseId] 
    ?? {};
  
  const positions = { ...REFERENCE_POSITIONS, ...overrides } as Record<string, [number, number]>;
  
  const px = (name: string) => ({
    x: (positions[name]?.[0] ?? 0.5) * width,
    y: (positions[name]?.[1] ?? 0.5) * height,
  });
  
  return (
    <Svg width={width} height={height}>
      {CONNECTIONS.map(([a, b], i) => {
        const pa = px(a);
        const pb = px(b);
        return (
          <Line
            key={`ref-${i}`}
            x1={pa.x} y1={pa.y}
            x2={pb.x} y2={pb.y}
            stroke="rgba(255,255,255,0.5)"
            strokeWidth={2}
            strokeDasharray="4 4"
          />
        );
      })}
      
      {Object.entries(positions).map(
        ([name, [nx, ny]]) => {
          const isHL = highlightJoints
            .some(h => name.includes(
              h.replace("left_","")
               .replace("right_","")
            ));
          return (
            <Circle
              key={name}
              cx={nx * width}
              cy={ny * height}
              r={isHL ? 9 : 6}
              fill={isHL 
                ? "rgba(239,159,39,0.85)" 
                : "rgba(255,255,255,0.4)"}
              stroke="white"
              strokeWidth={1}
            />
          );
        }
      )}
    </Svg>
  );
}
