import { COLORS } from "../constants";
import type { ButtonProps } from "../types";

export const Button = ({ children, onClick, disabled, variant = "primary", size = "md", style: s = {} }: ButtonProps) => {
  const base: React.CSSProperties = {
    border: "none", borderRadius: 10, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.2s", opacity: disabled ? 0.5 : 1, fontFamily: "inherit",
    padding: size === "sm" ? "8px 16px" : size === "lg" ? "14px 28px" : "11px 22px",
    fontSize: size === "sm" ? 13 : size === "lg" ? 16 : 14,
    ...s,
  };
  if (variant === "primary") return (
    <button onClick={onClick} disabled={disabled} style={{
      ...base, background: `linear-gradient(135deg, ${COLORS.emerald}, ${COLORS.teal})`,
      color: "#fff", boxShadow: `0 4px 16px ${COLORS.emerald}33`,
    }}>{children}</button>
  );
  if (variant === "ghost") return (
    <button onClick={onClick} disabled={disabled} style={{
      ...base, background: "transparent", color: COLORS.muted,
      border: `1px solid ${COLORS.border}`,
    }}>{children}</button>
  );
  return <button onClick={onClick} disabled={disabled} style={{ ...base, background: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>{children}</button>;
};
