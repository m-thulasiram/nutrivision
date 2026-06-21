import { COLORS } from "../constants";
import type { InputProps } from "../types";

export const Input = ({ label, type = "text", value, onChange, placeholder, required }: InputProps) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {label && <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</label>}
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
      style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10,
        padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none",
        transition: "border-color 0.2s",
      }}
      onFocus={(e) => (e.target.style.borderColor = COLORS.emerald)}
      onBlur={(e) => (e.target.style.borderColor = COLORS.border)}
    />
  </div>
);
