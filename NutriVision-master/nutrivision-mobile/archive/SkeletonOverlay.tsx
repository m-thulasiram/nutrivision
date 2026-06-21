import React from "react";
import Svg, { Circle, Line } from "react-native-svg";
import { 
  Keypoint, 
  SKELETON_CONNECTIONS 
} from "../utils/poseDetector";

type Props = {
  keypoints: Keypoint[];
  width: number;
  height: number;
  highlightJoints?: string[];  // joints being scored
};

export default function SkeletonOverlay({
  keypoints,
  width,
  height,
  highlightJoints = [],
}: Props) {
  
  const MIN_SCORE = 0.3;  // hide low-confidence points
  
  const visibleKps = keypoints.filter(
    kp => kp.score >= MIN_SCORE
  );
  
  return (
    <Svg
      width={width}
      height={height}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      {/* Draw bones first (behind joints) */}
      {SKELETON_CONNECTIONS.map(([i, j], idx) => {
        const a = keypoints[i];
        const b = keypoints[j];
        
        if (!a || !b) return null;
        if (a.score < MIN_SCORE || 
            b.score < MIN_SCORE) return null;
        
        return (
          <Line
            key={`bone-${idx}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="rgba(255,255,255,0.7)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        );
      })}
      
      {/* Draw joints on top */}
      {visibleKps.map((kp, idx) => {
        const isHighlighted = 
          highlightJoints.some(h => 
            kp.name.includes(h.replace("left_","")
              .replace("right_",""))
          );
        
        return (
          <Circle
            key={`kp-${idx}`}
            cx={kp.x}
            cy={kp.y}
            r={isHighlighted ? 8 : 5}
            fill={isHighlighted 
              ? "#EF9F27" 
              : "rgba(29,158,117,0.9)"}
            stroke="white"
            strokeWidth={1.5}
          />
        );
      })}
    </Svg>
  );
}
