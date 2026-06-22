import { COLORS } from "../constants";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
}

export const Spinner = ({ size = "md" }: SpinnerProps) => {
  const dimensions = {
    sm: { width: 16, height: 16, border: 2, padding: 0 },
    md: { width: 36, height: 36, border: 3, padding: 40 },
    lg: { width: 56, height: 56, border: 4, padding: 60 },
  }[size];

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: dimensions.padding }}>
      <div style={{
        width: dimensions.width,
        height: dimensions.height,
        border: `${dimensions.border}px solid ${COLORS.border}`,
        borderTopColor: COLORS.emerald,
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

