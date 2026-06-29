import React from "react";
import { COLORS } from "../constants";

export const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={className} style={{ background: COLORS.emeraldLight, color: COLORS.emeraldDark, fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, letterSpacing: 0.5 }}>
    {children}
  </span>
);

export const Card = ({ children, className, style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
  <div className={className} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 24, ...style }}>
    {children}
  </div>
);

export const ProgressBar = ({ value, max, color = COLORS.emerald, height = 8, ariaLabel }:
  { value: number; max: number; color?: string; height?: number; ariaLabel?: string }) => {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={ariaLabel || `${value} of ${max}`} style={{ background: COLORS.border, borderRadius: height, height, overflow: "hidden" }}>
      <div style={{
        width: `${pct}%`, height: "100%", background: color, borderRadius: height,
        transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: `0 0 8px ${color}55`,
      }} />
    </div>
  );
};

interface InputProps { label?: string; type?: string; value?: string | number; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; required?: boolean; }
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

interface SelectProps { label?: string; value?: string; onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: { value: string; label: string }[]; }
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

interface ButtonProps { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: "primary" | "ghost" | "secondary"; size?: "sm" | "md" | "lg"; style?: React.CSSProperties; className?: string; }
export const Button = ({ children, onClick, disabled, variant = "primary", size = "md", style: s = {}, className }: ButtonProps) => {
  const base: React.CSSProperties = {
    border: "none", borderRadius: 10, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.2s", opacity: disabled ? 0.5 : 1, fontFamily: "inherit",
    padding: size === "sm" ? "8px 16px" : size === "lg" ? "14px 28px" : "11px 22px",
    fontSize: size === "sm" ? 13 : size === "lg" ? 16 : 14,
    ...s,
  };
  const shared = { onClick, disabled, className };
  if (variant === "primary") return (
    <button {...shared} style={{
      ...base, background: `linear-gradient(135deg, ${COLORS.emerald}, ${COLORS.teal})`,
      color: "#fff", boxShadow: `0 4px 16px ${COLORS.emerald}33`,
    }}>{children}</button>
  );
  if (variant === "ghost") return (
    <button {...shared} style={{
      ...base, background: "transparent", color: COLORS.muted,
      border: `1px solid ${COLORS.border}`,
    }}>{children}</button>
  );
  return <button {...shared} style={{ ...base, background: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>{children}</button>;
};
