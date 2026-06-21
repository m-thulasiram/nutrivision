import { COLORS } from "../constants";

export const Badge = ({ children, color = "emerald" }: { children: React.ReactNode; color?: string }) => (
  <span style={{ background: COLORS.emeraldLight, color: COLORS.emeraldDark, fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, letterSpacing: 0.5 }}>
    {children}
  </span>
);
