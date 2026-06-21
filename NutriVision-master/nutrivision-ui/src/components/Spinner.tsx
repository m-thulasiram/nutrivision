import { COLORS } from "../constants";

export const Spinner = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
    <div style={{
      width: 36, height: 36, border: `3px solid ${COLORS.border}`,
      borderTopColor: COLORS.emerald, borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);
