import { COLORS } from "../constants";
import type { SelectProps } from "../types";

export const Select = ({ label, value, onChange, options }: SelectProps) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {label && <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</label>}
    <select value={value} onChange={onChange}
      style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10,
        padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none",
        appearance: "none", cursor: "pointer",
      }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);
