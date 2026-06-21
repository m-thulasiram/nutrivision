import { COLORS } from "../constants";

export const ProgressBar = ({ value, max, color = COLORS.emerald, height = 8, animated = false }:
  { value: number; max: number; color?: string; height?: number; animated?: boolean }) => {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ background: COLORS.border, borderRadius: height, height, overflow: "hidden" }}>
      <div style={{
        width: `${pct}%`, height: "100%", background: color, borderRadius: height,
        transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: `0 0 8px ${color}55`,
      }} />
    </div>
  );
};
