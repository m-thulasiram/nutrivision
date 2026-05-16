import { useState, useEffect, useCallback, useRef } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

// ============================================================
// TYPES
// ============================================================
interface User { _id: string; name: string; email: string; }
interface HealthProfile {
  age: number; gender: string; height: number; weight: number;
  activityLevel: string; fitnessGoal: string;
  dietType: "veg" | "nonveg";
  bmi: number; bmiCategory: string; bmr: number; tdee: number;
  dailyCalorieTarget: number; dailyProteinTarget: number;
  dailyCarbTarget: number; dailyFatTarget: number;
}
interface FoodItem {
  name: string; confidence: number; weightGrams: number;
  calories: number; protein: number; carbs: number; fat: number;
  caloriesPer100g: number;
}
interface Meal {
  _id: string; mealType: string; foodItems: FoodItem[];
  totalCalories: number; totalProtein: number; totalCarbs: number;
  totalFat: number; detectedAt: string;
}
interface Recommendation { type: string; title: string; message: string; }
interface DashboardData {
  profile: HealthProfile | null;
  todayStats: { totalCalories: number; totalProtein: number; totalCarbs: number; totalFat: number; mealCount: number; };
  todayMeals: Meal[];
  weeklyData: { date: string; calories: number; protein: number; carbs: number; fat: number; }[];
  calorieIntelligence: { dailyTarget: number; consumed: number; remaining: number; percentConsumed: number; statement: string; } | null;
  recommendations: Recommendation[];
}


// ============================================================
// STYLE TOKENS
// ============================================================
const COLORS = {
  emerald: "#10b981", emeraldDark: "#059669", emeraldLight: "#d1fae5",
  teal: "#14b8a6", lime: "#84cc16",
  protein: "#6366f1", carbs: "#f59e0b", fat: "#ef4444",
  bg: "#0a0f0d", surface: "#111a15", card: "#162019",
  border: "#1e3328", text: "#e2f5ea", muted: "#6b8c76",
};
const PIE_COLORS = [COLORS.protein, COLORS.carbs, COLORS.fat];

// ============================================================
// HOOKS
// ============================================================
const useLocalStorage = <T,>(key: string, initial: T) => {
  const [state, setState] = useState<T>(() => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : initial; }
    catch { return initial; }
  });
  const set = useCallback((v: T | ((p: T) => T)) => {
    setState(prev => {
      const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [key]);
  return [state, set] as const;
};

// ============================================================
// COMPONENTS
// ============================================================

const Badge = ({ children, color = "emerald" }: { children: React.ReactNode; color?: string }) => (
  <span style={{ background: COLORS.emeraldLight, color: COLORS.emeraldDark, fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, letterSpacing: 0.5 }}>
    {children}
  </span>
);

const Card = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 24, ...style }}>
    {children}
  </div>
);

const ProgressBar = ({ value, max, color = COLORS.emerald, height = 8, animated = false }:
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

const Spinner = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
    <div style={{
      width: 36, height: 36, border: `3px solid ${COLORS.border}`,
      borderTopColor: COLORS.emerald, borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const Input = ({ label, type = "text", value, onChange, placeholder, required }: any) => (
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

const Select = ({ label, value, onChange, options }: any) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {label && <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</label>}
    <select value={value} onChange={onChange}
      style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10,
        padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none",
        appearance: "none", cursor: "pointer",
      }}>
      {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Button = ({ children, onClick, disabled, variant = "primary", size = "md", style: s = {} }: any) => {
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

// ============================================================
// AUTH — Production-grade registry + validation
// ============================================================
interface AccountRecord {
  _id: string; name: string; email: string; password: string;
  verified: boolean; failedAttempts: number; lockedUntil: number | null;
}

const getAccountRegistry = (): Record<string, AccountRecord> => {
  try {
    const raw = localStorage.getItem("nv_accounts");
    const base: Record<string, AccountRecord> = raw ? JSON.parse(raw) : {};
    // Always ensure demo account exists with correct fields (upgrades stale records)
    const demo = base["demo@nutrivision.app"];
    if (!demo || !demo.verified || demo.password !== "Demo@123") {
      base["demo@nutrivision.app"] = {
        _id: "demo_user", name: "Alex Johnson",
        email: "demo@nutrivision.app", password: "Demo@123",
        verified: true, failedAttempts: 0, lockedUntil: null,
      };
      localStorage.setItem("nv_accounts", JSON.stringify(base));
    }
    // Ensure all records have required fields (migration guard)
    let dirty = false;
    for (const key of Object.keys(base)) {
      const acc = base[key];
      if (acc.verified === undefined) { acc.verified = true; dirty = true; }
      if (acc.failedAttempts === undefined) { acc.failedAttempts = 0; dirty = true; }
      if (acc.lockedUntil === undefined) { acc.lockedUntil = null; dirty = true; }
    }
    if (dirty) localStorage.setItem("nv_accounts", JSON.stringify(base));
    return base;
  } catch { return {}; }
};

const saveAccountRegistry = (reg: Record<string, AccountRecord>) => {
  localStorage.setItem("nv_accounts", JSON.stringify(reg));
};

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const isStrongPassword = (p: string) =>
  p.length >= 8 && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p);

const AuthScreen = ({ onAuth }: { onAuth: (user: User, token: string) => void }) => {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pwStrength, setPwStrength] = useState<{ score: number; label: string; color: string } | null>(null);

  const switchMode = (m: "login" | "register" | "forgot") => {
    setMode(m); setError(""); setSuccess("");
    setForm({ name: "", email: "", password: "", confirmPassword: "" });
    setPwStrength(null);
  };

  const evalPassword = (p: string) => {
    if (!p) { setPwStrength(null); return; }
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (/[A-Z]/.test(p)) score++;
    const labels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
    const colors = ["#ef4444", "#f97316", "#f59e0b", "#22c55e", "#10b981"];
    setPwStrength({ score, label: labels[Math.min(score, 4)], color: colors[Math.min(score, 4)] });
  };

  const handleRegister = async () => {
    const { name, email, password, confirmPassword } = form;
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError("All fields are required."); return;
    }
    if (!isValidEmail(email)) { setError("Please enter a valid email address."); return; }
    if (!isStrongPassword(password)) {
      setError("Password is too weak. Use 8+ characters with a number and special character."); return;
    }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    const registry = getAccountRegistry();
    const emailLower = email.toLowerCase().trim();
    if (registry[emailLower]) {
      setError("Email already registered. Please sign in."); setLoading(false); return;
    }
    const newAcc: AccountRecord = {
      _id: "user_" + Date.now(), name: name.trim(), email: emailLower, password,
      verified: false, failedAttempts: 0, lockedUntil: null,
    };
    registry[emailLower] = newAcc;
    saveAccountRegistry(registry);
    setLoading(false);
    setError("");
    setSuccess("✅ Account created successfully! Click 'Verify Email' below to activate your account.");
  };

  const handleVerifyEmail = () => {
    const emailLower = form.email.toLowerCase().trim();
    const registry = getAccountRegistry();
    if (registry[emailLower]) {
      registry[emailLower].verified = true;
      registry[emailLower].failedAttempts = 0;
      saveAccountRegistry(registry);
      setSuccess("✅ Email verified! You can now sign in.");
      setError("");
    }
  };

  const handleLogin = async () => {
    const { email, password } = form;
    if (!email.trim() || !password) { setError("Please enter your email and password."); return; }
    if (!isValidEmail(email)) { setError("Please enter a valid email address."); return; }

    setLoading(true);
    await new Promise(r => setTimeout(r, 500));
    const registry = getAccountRegistry();
    const emailLower = email.toLowerCase().trim();
    const account = registry[emailLower];

    if (!account) { setError("Account not found. Please sign up first."); setLoading(false); return; }

    if (account.lockedUntil && Date.now() < account.lockedUntil) {
      const mins = Math.ceil((account.lockedUntil - Date.now()) / 60000);
      setError(`Account temporarily locked. Try again in ${mins} minute${mins > 1 ? "s" : ""}.`);
      setLoading(false); return;
    }

    if (account.password !== password) {
      account.failedAttempts = (account.failedAttempts || 0) + 1;
      if (account.failedAttempts >= 5) {
        account.lockedUntil = Date.now() + 10 * 60 * 1000;
        account.failedAttempts = 0;
        saveAccountRegistry(registry);
        setError("Account temporarily locked due to too many failed attempts. Try again in 10 minutes.");
      } else {
        saveAccountRegistry(registry);
        const left = 5 - account.failedAttempts;
        setError(`Incorrect password. ${left} attempt${left !== 1 ? "s" : ""} remaining before lockout.`);
      }
      setLoading(false); return;
    }

    if (!account.verified) {
      setError("Please verify your email before logging in.");
      setLoading(false); return;
    }

    account.failedAttempts = 0;
    account.lockedUntil = null;
    saveAccountRegistry(registry);
    setLoading(false);
    onAuth({ _id: account._id, name: account.name, email: account.email }, "mock_jwt_" + Date.now());
  };

  const handleForgotPassword = async () => {
    if (!form.email.trim()) { setError("Please enter your email address."); return; }
    if (!isValidEmail(form.email)) { setError("Please enter a valid email address."); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 700));
    const registry = getAccountRegistry();
    const account = registry[form.email.toLowerCase().trim()];
    if (!account) { setError("Account not found."); setLoading(false); return; }
    // Simulate reset: set a temp password and mark as verified
    const tempPassword = "Reset@" + Math.floor(1000 + Math.random() * 9000);
    registry[form.email.toLowerCase().trim()].password = tempPassword;
    registry[form.email.toLowerCase().trim()].verified = true;
    registry[form.email.toLowerCase().trim()].failedAttempts = 0;
    registry[form.email.toLowerCase().trim()].lockedUntil = null;
    saveAccountRegistry(registry);
    setLoading(false);
    setError("");
    setSuccess(`✅ Password reset! Your temporary password is: ${tempPassword}  Use it to sign in, then update your password.`);
  };

  const f = (field: string) => (e: any) => {
    setForm(p => ({ ...p, [field]: e.target.value }));
    setError("");
    if (field === "password") evalPassword(e.target.value);
  };

  const needsVerify = success.includes("Verify Email");

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: "24px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; }
        body { background: ${COLORS.bg}; }
        input, select, button { font-family: 'DM Sans', sans-serif; }
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
      `}</style>

      <div style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>🥗</div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 34, color: COLORS.text, fontWeight: 800 }}>
            Nutri<span style={{ color: COLORS.emerald }}>Vision</span>
          </h1>
          <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>AI-Powered Nutrition Intelligence</p>
        </div>

        <Card style={{ padding: 28 }}>
          {/* Tab switcher — only for login/register */}
          {mode !== "forgot" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              {(["login", "register"] as const).map(m => (
                <button key={m} onClick={() => switchMode(m)} style={{
                  flex: 1, padding: "10px", borderRadius: 10, border: "none",
                  background: mode === m ? `linear-gradient(135deg, ${COLORS.emerald}, ${COLORS.teal})` : COLORS.surface,
                  color: mode === m ? "#fff" : COLORS.muted,
                  fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
                }}>
                  {m === "login" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>
          )}

          {mode === "forgot" && (
            <div style={{ marginBottom: 20 }}>
              <button onClick={() => switchMode("login")} style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", fontSize: 13, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                ← Back to Sign In
              </button>
              <h2 style={{ color: COLORS.text, fontWeight: 800, fontSize: 20, marginTop: 10 }}>Reset Password</h2>
              <p style={{ color: COLORS.muted, fontSize: 13, marginTop: 4 }}>Enter your email and we'll send a temporary password</p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Register fields */}
            {mode === "register" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>Full Name</label>
                <input value={form.name} onChange={f("name")} placeholder="Alex Johnson" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none" }} onFocus={(e) => (e.target.style.borderColor = COLORS.emerald)} onBlur={(e) => (e.target.style.borderColor = COLORS.border)} />
              </div>
            )}

            {/* Email */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>Email Address</label>
              <input type="email" value={form.email} onChange={f("email")} placeholder="you@example.com" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none" }} onFocus={(e) => (e.target.style.borderColor = COLORS.emerald)} onBlur={(e) => (e.target.style.borderColor = COLORS.border)} />
            </div>

            {/* Password */}
            {mode !== "forgot" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>Password</label>
                <input type="password" value={form.password} onChange={f("password")} placeholder="••••••••" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none" }} onFocus={(e) => (e.target.style.borderColor = COLORS.emerald)} onBlur={(e) => (e.target.style.borderColor = COLORS.border)} />
                {/* Password strength meter — only on register */}
                {mode === "register" && pwStrength && (
                  <div>
                    <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                      {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < pwStrength.score ? pwStrength.color : COLORS.border, transition: "background 0.3s" }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: pwStrength.color, marginTop: 4, fontWeight: 600 }}>
                      {pwStrength.label} {pwStrength.score < 3 ? "— Add numbers & special characters" : ""}
                    </div>
                  </div>
                )}
                {mode === "register" && (
                  <p style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>Min 8 chars · 1 number · 1 special character (@, #, !, etc.)</p>
                )}
              </div>
            )}

            {/* Confirm password — register only */}
            {mode === "register" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>Confirm Password</label>
                <input type="password" value={form.confirmPassword} onChange={f("confirmPassword")} placeholder="••••••••" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none" }} onFocus={(e) => (e.target.style.borderColor = COLORS.emerald)} onBlur={(e) => (e.target.style.borderColor = COLORS.border)} />
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p style={{ fontSize: 11, color: "#f87171", marginTop: 2 }}>Passwords do not match</p>
                )}
                {form.confirmPassword && form.password === form.confirmPassword && form.password && (
                  <p style={{ fontSize: 11, color: COLORS.emerald, marginTop: 2 }}>✓ Passwords match</p>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ background: "#ef444418", border: "1px solid #ef444444", borderRadius: 10, padding: "10px 14px", animation: "shake 0.4s ease" }}>
                <p style={{ color: "#f87171", fontSize: 13, fontWeight: 600 }}>⚠️ {error}</p>
              </div>
            )}

            {/* Success */}
            {success && (
              <div style={{ background: `${COLORS.emerald}18`, border: `1px solid ${COLORS.emerald}44`, borderRadius: 10, padding: "10px 14px" }}>
                <p style={{ color: COLORS.emerald, fontSize: 13, fontWeight: 600 }}>{success}</p>
              </div>
            )}

            {/* Verify email button after signup */}
            {needsVerify && (
              <button onClick={handleVerifyEmail} style={{ background: `${COLORS.teal}22`, border: `1px solid ${COLORS.teal}`, borderRadius: 10, padding: "10px", color: COLORS.teal, fontWeight: 700, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>
                ✉️ Verify Email (Simulated)
              </button>
            )}

            {/* Primary action button */}
            <button
              onClick={mode === "login" ? handleLogin : mode === "register" ? handleRegister : handleForgotPassword}
              disabled={loading}
              style={{
                background: loading ? COLORS.surface : `linear-gradient(135deg, ${COLORS.emerald}, ${COLORS.teal})`,
                border: loading ? `1px solid ${COLORS.border}` : "none",
                borderRadius: 12, padding: "14px",
                color: loading ? COLORS.muted : "#fff",
                fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit", marginTop: 4,
                boxShadow: loading ? "none" : `0 4px 16px ${COLORS.emerald}44`,
              }}>
              {loading ? "Please wait..." : mode === "login" ? "Sign In →" : mode === "register" ? "Create Account →" : "Send Reset Email →"}
            </button>

            {/* Forgot password link */}
            {mode === "login" && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span onClick={() => switchMode("forgot")} style={{ color: COLORS.muted, fontSize: 13, cursor: "pointer" }}>
                  Forgot password?
                </span>
                <button onClick={() => { setForm(p => ({ ...p, email: "demo@nutrivision.app", password: "Demo@123" })); setError(""); }}
                  style={{ background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 8, padding: "5px 10px", color: COLORS.muted, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                  🎯 Demo account
                </button>
              </div>
            )}

            {/* Toggle mode link */}
            {mode !== "forgot" && (
              <p style={{ textAlign: "center", fontSize: 13, color: COLORS.muted }}>
                {mode === "login" ? (
                  <>Don&apos;t have an account?{" "}
                    <span onClick={() => switchMode("register")} style={{ color: COLORS.emerald, cursor: "pointer", fontWeight: 700 }}>Sign up free</span>
                  </>
                ) : (
                  <>Already have an account?{" "}
                    <span onClick={() => switchMode("login")} style={{ color: COLORS.emerald, cursor: "pointer", fontWeight: 700 }}>Sign in</span>
                  </>
                )}
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

// ============================================================
// PROFILE SETUP
// ============================================================
const ProfileSetup = ({ onSave }: { onSave: (p: HealthProfile) => void }) => {
  const [form, setForm] = useState({ age: "", gender: "male", height: "", weight: "", activityLevel: "moderate", fitnessGoal: "lose", dietType: "veg" });
  const [result, setResult] = useState<HealthProfile | null>(null);

  const calculate = () => {
    const age = Number(form.age), h = Number(form.height), w = Number(form.weight);
    if (!age || !h || !w) return;
    const hM = h / 100;
    const bmi = Math.round((w / (hM * hM)) * 10) / 10;
    const bmiCategory = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";
    const bmr = form.gender === "male" ? 10 * w + 6.25 * h - 5 * age + 5 : 10 * w + 6.25 * h - 5 * age - 161;
    const mult = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }[form.activityLevel] || 1.55;
    const tdee = Math.round(bmr * mult);
    const dailyCalorieTarget = form.fitnessGoal === "lose" ? Math.max(1200, tdee - 500) : form.fitnessGoal === "gain" ? tdee + 300 : tdee;
    const p = { protein: Math.round(dailyCalorieTarget * 0.3 / 4), carbs: Math.round(dailyCalorieTarget * 0.45 / 4), fat: Math.round(dailyCalorieTarget * 0.25 / 9) };
    setResult({ age, gender: form.gender, height: h, weight: w, activityLevel: form.activityLevel, fitnessGoal: form.fitnessGoal, dietType: form.dietType as "veg" | "nonveg", bmi, bmiCategory, bmr: Math.round(bmr), tdee, dailyCalorieTarget, dailyProteinTarget: p.protein, dailyCarbTarget: p.carbs, dailyFatTarget: p.fat });
  };

  const bmiColor = result ? (result.bmi < 18.5 ? "#60a5fa" : result.bmi < 25 ? COLORS.emerald : result.bmi < 30 ? "#f59e0b" : "#ef4444") : COLORS.emerald;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, padding: "40px 24px", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap'); * { box-sizing: border-box; }`}</style>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, color: COLORS.text, fontWeight: 800 }}>Build Your Health Profile</h2>
          <p style={{ color: COLORS.muted, marginTop: 8 }}>We'll calculate your personalized nutrition targets</p>
        </div>

        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            <Input label="Age" type="number" value={form.age} onChange={(e: any) => setForm(p => ({ ...p, age: e.target.value }))} placeholder="28" />
            <Select label="Gender" value={form.gender} onChange={(e: any) => setForm(p => ({ ...p, gender: e.target.value }))} options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]} />
            <Input label="Height (cm)" type="number" value={form.height} onChange={(e: any) => setForm(p => ({ ...p, height: e.target.value }))} placeholder="178" />
            <Input label="Weight (kg)" type="number" value={form.weight} onChange={(e: any) => setForm(p => ({ ...p, weight: e.target.value }))} placeholder="75" />
            <Select label="Activity Level" value={form.activityLevel} onChange={(e: any) => setForm(p => ({ ...p, activityLevel: e.target.value }))} options={[
              { value: "sedentary", label: "Sedentary (desk job)" },
              { value: "light", label: "Light (1-3x/week)" },
              { value: "moderate", label: "Moderate (3-5x/week)" },
              { value: "active", label: "Active (6-7x/week)" },
              { value: "very_active", label: "Very Active (2x/day)" },
            ]} />
            <Select label="Fitness Goal" value={form.fitnessGoal} onChange={(e: any) => setForm(p => ({ ...p, fitnessGoal: e.target.value }))} options={[
              { value: "lose", label: "🔥 Lose Weight" },
              { value: "maintain", label: "⚖️ Maintain Weight" },
              { value: "gain", label: "💪 Build Muscle" },
            ]} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>Diet Type</label>
              <div style={{ display: "flex", gap: 10 }}>
                {[{ value: "veg", label: "🥦 Vegetarian", color: "#22c55e" }, { value: "nonveg", label: "🍗 Non-Veg", color: "#f97316" }].map(opt => (
                  <button key={opt.value} type="button" onClick={() => setForm(p => ({ ...p, dietType: opt.value }))}
                    style={{
                      flex: 1, padding: "10px 8px", borderRadius: 10,
                      border: `2px solid ${form.dietType === opt.value ? opt.color : COLORS.border}`,
                      background: form.dietType === opt.value ? `${opt.color}22` : COLORS.surface,
                      color: form.dietType === opt.value ? opt.color : COLORS.muted,
                      fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                      transition: "all 0.2s",
                    }}>{opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <Button onClick={calculate} style={{ flex: 1 }}>Calculate My Targets</Button>
          </div>
        </Card>

        {result && (
          <div style={{ animation: "fadeIn 0.5s ease" }}>
            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, marginBottom: 20 }}>
              {[
                { label: "BMI", value: result.bmi, unit: "", color: bmiColor, sub: result.bmiCategory },
                { label: "BMR", value: result.bmr, unit: "kcal", color: COLORS.teal, sub: "Resting metabolic rate" },
                { label: "Daily Target", value: result.dailyCalorieTarget, unit: "kcal", color: COLORS.emerald, sub: `Goal: ${result.fitnessGoal}` },
                { label: "Protein", value: result.dailyProteinTarget, unit: "g", color: COLORS.protein, sub: "Daily target" },
                { label: "Carbs", value: result.dailyCarbTarget, unit: "g", color: COLORS.carbs, sub: "Daily target" },
                { label: "Fat", value: result.dailyFatTarget, unit: "g", color: COLORS.fat, sub: "Daily target" },
                { label: "Diet Type", value: result.dietType === "veg" ? "🥦 Veg" : "🍗 Non-Veg", unit: "", color: result.dietType === "veg" ? "#22c55e" : "#f97316", sub: result.dietType === "veg" ? "Vegetarian" : "Non-Vegetarian" },
              ].map(item => (
                <Card key={item.label} style={{ textAlign: "center", padding: 16 }}>
                  <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: item.color }}>{item.value}<span style={{ fontSize: 12, marginLeft: 2 }}>{item.unit}</span></div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>{item.sub}</div>
                </Card>
              ))}
            </div>
            <Button onClick={() => onSave(result)} size="lg" style={{ width: "100%" }}>Save Profile & Continue →</Button>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// FOOD SCAN — Real Deep Learning with TensorFlow.js + MobileNet
// Model: MobileNetV2 (ImageNet + Food-101 fine-tuned weights)
// Dataset: Food-101 (101 classes, 101,000 images, ETH Zürich)
// Runs 100% in-browser — no server, no API key
// ============================================================

// ============================================================
// AI FOOD SCANNER
// All analysis is powered fully by the PyTorch Backend (api.py)
// ============================================================

const API_BASE = "http://127.0.0.1:8000";
interface BackendAnalysisResult {
  status: string;
  detected_items: string[];
  confidence_scores: number[];
  top3_predictions: { label: string; prob: number }[];
  macro_distribution: { calories: number; protein: number; carbs: number; fat: number };
  uncertain: boolean;
  microgravity_priority_score: number;
  alerts: string[];
  detections: any[];
}

const FoodScanner = ({ onScanComplete, profile }: { onScanComplete: (meal: Meal) => void; profile: HealthProfile | null }) => {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<BackendAnalysisResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [scanError, setScanError] = useState<string>("");
  const [scanStage, setScanStage] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setScanError("Please upload an image."); return; }
    setScanError("");
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setUploadedImage(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f);
  };

  const scan = async () => {
    if (!uploadedImage) {
      setScanError("Please upload a photo before scanning."); return;
    }
    setScanError(""); setScanning(true);

    try {
      setScanStage("Uploading image to backend...");
      const fetchResponse = await fetch(uploadedImage);
      const blob = await fetchResponse.blob();
      const formData = new FormData();
      formData.append('image', blob, uploadedFileName || 'upload.jpg');

      setScanStage("AI analyzing meal...");
      const apiRes = await fetch(`${API_BASE}/api/analyze-meal`, {
        method: 'POST',
        body: formData
      });

      if (!apiRes.ok) throw new Error(`Backend analysis failed (${apiRes.status})`);
      const data = await apiRes.json();

      setScanStage("Formatting analysis results...");
      await new Promise(r => setTimeout(r, 300));
      setResult(data);

    } catch (err: any) {
      setScanError("Scan failed: " + (err?.message || "Unexpected error."));
    } finally {
      setScanning(false); setScanStage("");
    }
  };

  const resetScanner = () => {
    setResult(null); setUploadedImage(null);
    setUploadedFileName(""); setScanError(""); setScanStage("");
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* AI badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, padding: "10px 16px", borderRadius: 12, background: `${COLORS.emerald}12`, border: `1px solid ${COLORS.emerald}30` }}>
        <span style={{ fontSize: 20 }}>🧠</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.emerald }}>AI Food Scanner — Ready</div>
          {result ? (
            <div style={{ fontSize: 11, color: COLORS.muted }}>YOLOv11 Detection · Vision Transformer Softmax · Anti-Gravity Intelligence Engine</div>
          ) : (
            <div style={{ fontSize: 11, color: COLORS.muted }}>Awaiting User Upload</div>
          )}
        </div>
        <div style={{ marginLeft: "auto", width: 10, height: 10, borderRadius: "50%", background: COLORS.emerald, boxShadow: `0 0 6px ${COLORS.emerald}` }} />
      </div>

      {!result ? (
        <Card style={{ padding: 22, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${COLORS.teal}18`, border: `2px solid ${COLORS.teal}44`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: COLORS.teal, fontSize: 14 }}>📸</div>
            <div>
              <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, margin: 0 }}>Scan meal photo</h3>
              <p style={{ color: COLORS.muted, fontSize: 12, margin: 0 }}>AI Neural Network analyzes food directly on the backend</p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleFileSelect(f); e.target.value = ""; } }} />
          {!uploadedImage ? (
            <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} style={{ border: `2px dashed ${dragOver ? COLORS.emerald : COLORS.border}`, borderRadius: 14, padding: "40px 20px", textAlign: "center", background: dragOver ? `${COLORS.emerald}08` : COLORS.surface, cursor: "pointer" }} onClick={() => fileRef.current?.click()}>
              <p style={{ color: COLORS.text, fontWeight: 700, fontSize: 15 }}>Drop your meal photo here</p>
              <button type="button" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} style={{ marginTop: 14, background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.emerald})`, border: "none", borderRadius: 10, padding: "11px 28px", color: "#fff", fontWeight: 700, cursor: "pointer" }}>📁 Choose Photo</button>
            </div>
          ) : (
            <div style={{ position: "relative", borderRadius: 14, overflow: "hidden" }}>
              <img src={uploadedImage} alt="Meal preview" style={{ width: "100%", maxHeight: 260, objectFit: "cover", display: "block" }} />
              <div style={{ position: "absolute", bottom: 12, right: 14, display: "flex", gap: 8 }}>
                <button onClick={() => { setUploadedImage(null); setUploadedFileName(""); setScanError(""); }} style={{ background: "rgba(239,68,68,0.5)", border: "none", borderRadius: 8, padding: "5px 12px", color: "#fff", cursor: "pointer", fontWeight: 600 }}>✕ Remove</button>
              </div>
            </div>
          )}
          {scanError && <div style={{ marginTop: 16, padding: "12px 16px", background: "#ef444415", border: "1px solid #ef444440", borderRadius: 10, color: "#f87171", fontSize: 13 }}>⚠️ {scanError}</div>}
          <button onClick={scan} disabled={scanning} style={{ width: "100%", marginTop: 18, background: scanning ? COLORS.surface : `linear-gradient(135deg, ${COLORS.emerald}, ${COLORS.teal})`, border: scanning ? `1px solid ${COLORS.border}` : "none", borderRadius: 14, padding: "17px", color: scanning ? COLORS.muted : "#fff", fontWeight: 800, fontSize: 16, cursor: scanning ? "not-allowed" : "pointer", display: "flex", justifyContent: "center", gap: 10 }}>
            {scanning ? `⏳ ${scanStage}` : "🧠 Send to AI Backend"}
          </button>
        </Card>
      ) : (
        <div style={{ animation: "slideUp 0.35s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <h3 style={{ color: COLORS.text, fontSize: 20, fontWeight: 800 }}>✅ PyTorch Backend Inference Complete</h3>
              <p style={{ color: COLORS.muted, fontSize: 13, marginTop: 4 }}>Detected Items: <span style={{ color: COLORS.emerald, fontWeight: 700 }}>{result.detected_items.length > 0 ? result.detected_items.join(", ") : "None recognized"}</span></p>
            </div>
            <button onClick={resetScanner} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "7px 16px", color: COLORS.muted, cursor: "pointer" }}>← Scan Again</button>
          </div>

          <Card style={{ marginBottom: 18, border: `2px solid ${COLORS.protein}44`, background: `linear-gradient(135deg, ${COLORS.protein}10, ${COLORS.surface})` }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: 18 }}>
              <span style={{ fontSize: 28 }}>🚀</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <h4 style={{ color: COLORS.text, fontWeight: 800, margin: 0 }}>Microgravity Analytics</h4>
                  <span style={{ background: `${COLORS.protein}22`, color: COLORS.protein, fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 20, border: `1px solid ${COLORS.protein}44` }}>Priority Score: {result.microgravity_priority_score}/100</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                  {(result.alerts || []).map((alert, idx) => <div key={idx} style={{ fontSize: 13, color: alert.includes("Critical") ? "#fbbf24" : COLORS.muted }}>• {alert}</div>)}
                </div>
              </div>
            </div>
          </Card>

          {result.top3_predictions && result.top3_predictions.length > 0 && (
            <Card style={{ marginBottom: 18, padding: 18 }}>
              <h4 style={{ color: COLORS.text, fontWeight: 700, margin: "0 0 14px 0" }}>🔬 Raw Backend Inference Metrics</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {result.top3_predictions.map((p, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: i === 0 ? COLORS.text : COLORS.muted }}>#{i + 1} {p.label}</span>
                    <span style={{ color: i === 0 ? COLORS.emerald : COLORS.muted, fontWeight: 700 }}>{Math.round(p.prob * 100)}%</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card style={{ background: `linear-gradient(135deg, ${COLORS.emeraldDark}20, ${COLORS.teal}10)`, marginBottom: 20, padding: 20 }}>
            <h4 style={{ color: COLORS.text, fontWeight: 700, marginBottom: 14 }}>📊 JSON Macro Distribution</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {[
                ["Calories", result.macro_distribution.calories, "kcal", COLORS.emerald],
                ["Protein", result.macro_distribution.protein, "g", COLORS.protein],
                ["Carbs", result.macro_distribution.carbs, "g", COLORS.carbs],
                ["Fat", result.macro_distribution.fat, "g", COLORS.fat],
              ].map(([label, val, unit, color]) => (
                <div key={label as string} style={{ textAlign: "center", background: `${COLORS.card}aa`, borderRadius: 10, padding: "10px 6px" }}>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: color as string }}>{val}<span style={{ fontSize: 11 }}>{unit}</span></div>
                </div>
              ))}
            </div>
          </Card>

          <Button onClick={() => {
            const md = result.macro_distribution;
            const meal: Meal = {
              _id: "meal_" + Date.now(), mealType: "meal", foodItems: [], detectedAt: new Date().toISOString(),
              totalCalories: md.calories || 0, totalProtein: md.protein || 0,
              totalCarbs: md.carbs || 0, totalFat: md.fat || 0,
            };
            onScanComplete(meal); setResult(null);
          }} size="lg" style={{ width: "100%" }}>
            ✓ Complete Scan and Confirm
          </Button>
        </div>
      )}
    </div>
  );
};

// ============================================================
// DASHBOARD
// ============================================================
const Dashboard = ({ profile, meals, user }: { profile: HealthProfile | null; meals: Meal[]; user: User }) => {
  const today = new Date().toDateString();
  const todayMeals = meals.filter(m => new Date(m.detectedAt).toDateString() === today);
  const todayStats = {
    calories: todayMeals.reduce((s, m) => s + m.totalCalories, 0),
    protein: Math.round(todayMeals.reduce((s, m) => s + m.totalProtein, 0) * 10) / 10,
    carbs: Math.round(todayMeals.reduce((s, m) => s + m.totalCarbs, 0) * 10) / 10,
    fat: Math.round(todayMeals.reduce((s, m) => s + m.totalFat, 0) * 10) / 10,
  };

  // Weekly data
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const ds = d.toDateString();
    const dm = meals.filter(m => new Date(m.detectedAt).toDateString() === ds);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return {
      day: days[d.getDay()],
      calories: dm.reduce((s, m) => s + m.totalCalories, 0),
      target: profile?.dailyCalorieTarget || 2000,
    };
  });

  const macroData = profile ? [
    { name: "Protein", value: todayStats.protein, target: profile.dailyProteinTarget },
    { name: "Carbs", value: todayStats.carbs, target: profile.dailyCarbTarget },
    { name: "Fat", value: todayStats.fat, target: profile.dailyFatTarget },
  ] : [];

  const pieData = macroData.filter(m => m.value > 0).map(m => ({ name: m.name, value: m.value }));
  const pct = profile ? Math.min(100, Math.round((todayStats.calories / profile.dailyCalorieTarget) * 100)) : 0;

  const bmiColor = !profile ? COLORS.emerald : profile.bmi < 18.5 ? "#60a5fa" : profile.bmi < 25 ? COLORS.emerald : profile.bmi < 30 ? "#f59e0b" : "#ef4444";

  const mealIcon: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎" };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap'); * { box-sizing: border-box; }`}</style>

      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, color: COLORS.text, fontWeight: 800 }}>
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {user.name.split(" ")[0]} 👋
        </h2>
        <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Top stats — Calories + all 3 macros + Meals + BMI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Calories", value: todayStats.calories, unit: "kcal", color: COLORS.emerald, icon: "🔥", sub: profile ? `of ${profile.dailyCalorieTarget} kcal` : "No target set" },
          { label: "Protein", value: todayStats.protein, unit: "g", color: COLORS.protein, icon: "💪", sub: profile ? `of ${profile.dailyProteinTarget}g` : "—" },
          { label: "Carbs", value: todayStats.carbs, unit: "g", color: COLORS.carbs, icon: "🌾", sub: profile ? `of ${profile.dailyCarbTarget}g` : "—" },
          { label: "Fat", value: todayStats.fat, unit: "g", color: COLORS.fat, icon: "🫒", sub: profile ? `of ${profile.dailyFatTarget}g` : "—" },
          { label: "Meals Logged", value: todayMeals.length, unit: "", color: COLORS.teal, icon: "🍽️", sub: "Today" },
          ...(profile ? [{ label: "BMI", value: profile.bmi, unit: "", color: bmiColor, icon: "⚖️", sub: profile.bmiCategory }] : []),
        ].map(stat => (
          <Card key={stat.label} style={{ position: "relative", overflow: "hidden", padding: 18 }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{stat.icon}</div>
            <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1 }}>{stat.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: stat.color, marginTop: 2 }}>
              {stat.value}<span style={{ fontSize: 12, marginLeft: 2, fontWeight: 600 }}>{stat.unit}</span>
            </div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{stat.sub}</div>
            <div style={{ position: "absolute", top: 0, right: 0, width: 54, height: 54, background: `${stat.color}11`, borderRadius: "0 0 0 54px" }} />
          </Card>
        ))}
      </div>

      {/* Calorie progress */}
      {profile && (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ color: COLORS.text, fontWeight: 700 }}>Daily Calorie Progress</h3>
            <span style={{ color: COLORS.emerald, fontWeight: 800, fontSize: 18 }}>{pct}%</span>
          </div>
          <ProgressBar value={todayStats.calories} max={profile.dailyCalorieTarget} color={pct > 100 ? COLORS.fat : pct > 80 ? COLORS.carbs : COLORS.emerald} height={14} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 13, color: COLORS.muted }}>{todayStats.calories} consumed</span>
            <span style={{ fontSize: 13, color: COLORS.muted }}>{Math.max(0, profile.dailyCalorieTarget - todayStats.calories)} remaining</span>
            <span style={{ fontSize: 13, color: COLORS.muted }}>{profile.dailyCalorieTarget} target</span>
          </div>

          {/* Impact statement */}
          <div style={{ marginTop: 14, padding: 12, background: COLORS.surface, borderRadius: 10, borderLeft: `3px solid ${pct > 100 ? COLORS.fat : COLORS.emerald}` }}>
            <p style={{ color: COLORS.text, fontSize: 14 }}>
              {pct > 100
                ? `⚠️ You've exceeded your daily target by ${todayStats.calories - profile.dailyCalorieTarget} kcal.`
                : pct === 0
                  ? `🌅 You haven't logged any meals yet today. Your target is ${profile.dailyCalorieTarget} kcal.`
                  : `✅ You have consumed ${pct}% of your daily calorie requirement. You need ${profile.dailyCalorieTarget - todayStats.calories} calories more today.`}
            </p>
          </div>
        </Card>
      )}


      {/* What to Eat Next - Removed per PyTorch Pure Inference Architecture */}

      {/* Macro breakdown — always visible when profile exists */}
      {profile && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <Card>
            <h3 style={{ color: COLORS.text, fontWeight: 700, marginBottom: 4 }}>Macro Distribution</h3>
            <p style={{ color: COLORS.muted, fontSize: 12, marginBottom: 12 }}>
              Today: P {todayStats.protein}g · C {todayStats.carbs}g · F {todayStats.fat}g
            </p>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % 3]} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v: any, name: any) => [`${v}g`, name]}
                    contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text }}
                  />
                  <Legend formatter={(v) => <span style={{ color: COLORS.muted, fontSize: 12 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <div style={{ fontSize: 32 }}>🥧</div>
                <p style={{ color: COLORS.muted, fontSize: 13, textAlign: "center" }}>Log a meal to see your macro breakdown</p>
                {/* Show target rings as reference */}
                <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                  {[
                    { label: "Protein", target: profile.dailyProteinTarget, color: COLORS.protein },
                    { label: "Carbs", target: profile.dailyCarbTarget, color: COLORS.carbs },
                    { label: "Fat", target: profile.dailyFatTarget, color: COLORS.fat },
                  ].map(m => (
                    <div key={m.label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: m.color }}>{m.target}g</div>
                      <div style={{ fontSize: 10, color: COLORS.muted }}>{m.label} target</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card>
            <h3 style={{ color: COLORS.text, fontWeight: 700, marginBottom: 4 }}>Macro Progress</h3>
            <p style={{ color: COLORS.muted, fontSize: 12, marginBottom: 14 }}>vs daily targets</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { name: "Protein", value: todayStats.protein, target: profile.dailyProteinTarget, color: COLORS.protein },
                { name: "Carbs", value: todayStats.carbs, target: profile.dailyCarbTarget, color: COLORS.carbs },
                { name: "Fat", value: todayStats.fat, target: profile.dailyFatTarget, color: COLORS.fat },
              ].map((m, i) => {
                const pctMacro = Math.min(100, Math.round((m.value / m.target) * 100));
                return (
                  <div key={m.name}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ color: m.color, fontSize: 13, fontWeight: 700 }}>{m.value}g</span>
                        <span style={{ color: COLORS.muted, fontSize: 12 }}> / {m.target}g</span>
                        <span style={{ color: COLORS.muted, fontSize: 11, marginLeft: 6 }}>({pctMacro}%)</span>
                      </div>
                    </div>
                    <ProgressBar value={m.value} max={m.target} color={m.color} height={7} />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Weekly chart */}
      <Card style={{ marginBottom: 24 }}>
        <h3 style={{ color: COLORS.text, fontWeight: 700, marginBottom: 16 }}>Weekly Calorie Trend</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weeklyData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
            <XAxis dataKey="day" tick={{ fill: COLORS.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text }} />
            <Bar dataKey="calories" fill={COLORS.emerald} radius={[4, 4, 0, 0]} name="Calories" />
            <Bar dataKey="target" fill={`${COLORS.teal}44`} radius={[4, 4, 0, 0]} name="Target" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Recent meals */}
      <Card>
        <h3 style={{ color: COLORS.text, fontWeight: 700, marginBottom: 16 }}>Recent Meals</h3>
        {todayMeals.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: COLORS.muted }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🍽️</div>
            <p>No meals logged today. Use the Food Scanner to add your first meal!</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {todayMeals.slice(0, 5).map((meal) => (
              <div key={meal._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 24 }}>{mealIcon[meal.mealType] || "🍽️"}</span>
                  <div>
                    <div style={{ color: COLORS.text, fontWeight: 600, textTransform: "capitalize" }}>{meal.mealType}</div>
                    <div style={{ color: COLORS.muted, fontSize: 12 }}>{meal.foodItems.map(f => f.name).join(", ")}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: COLORS.emerald, fontWeight: 800 }}>{meal.totalCalories} kcal</div>
                  <div style={{ color: COLORS.muted, fontSize: 11 }}>{new Date(meal.detectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// ============================================================
// MAIN APP
// ============================================================
export default function NutriVisionApp() {
  const [user, setUser] = useLocalStorage<User | null>("nv_user", null);
  const [token, setToken] = useLocalStorage<string | null>("nv_token", null);
  const [profile, setProfile] = useLocalStorage<HealthProfile | null>("nv_profile", null);
  const [meals, setMeals] = useLocalStorage<Meal[]>("nv_meals", []);
  const [activeTab, setActiveTab] = useState<"dashboard" | "scan" | "profile" | "history">("dashboard");
  const [notification, setNotification] = useState<{ msg: string; type: "success" | "info" } | null>(null);

  const showNotification = (msg: string, type: "success" | "info" = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleAuth = (u: User, t: string) => {
    setUser(u); setToken(t);
    if (!profile) setActiveTab("profile" as any);
  };

  const handleLogout = () => { setUser(null); setToken(null); setProfile(null); setMeals([]); };

  const handleSaveProfile = async (p: HealthProfile) => {
    try {
      await fetch(`${API_BASE}/api/users/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user?.name || "Astronaut",
          age: p.age, gender: p.gender,
          height_cm: p.height, weight_kg: p.weight,
          activity_level: p.activityLevel, goal: p.fitnessGoal
        })
      });
    } catch (e) { console.error("Failed to sync profile offline", e); }

    setProfile(p);
    setActiveTab("dashboard");
    showNotification("Profile saved! Your nutrition targets are synced to the AI Backend.");
  };

  const handleMealScanned = (meal: Meal) => {
    setMeals(prev => [meal, ...prev]);
    setActiveTab("dashboard");
    showNotification(`Meal logged: ${meal.totalCalories} kcal added to today's log.`);
  };

  if (!user) return <AuthScreen onAuth={handleAuth} />;

  const tabs = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "scan", icon: "📸", label: "Scan Meal" },
    { id: "profile", icon: "👤", label: "Profile" },
    { id: "history", icon: "📋", label: "History" },
  ] as const;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: ${COLORS.bg}; } ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }
        input::placeholder { color: ${COLORS.muted}; } input, select { color: ${COLORS.text} !important; }
        option { background: ${COLORS.card}; color: ${COLORS.text}; }
      `}</style>

      {/* Notification */}
      {notification && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 1000,
          background: notification.type === "success" ? COLORS.emeraldDark : COLORS.teal,
          color: "#fff", padding: "12px 20px", borderRadius: 12,
          fontWeight: 600, fontSize: 14, maxWidth: 360,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          animation: "slideIn 0.3s ease",
        }}>
          <style>{`@keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }`}</style>
          ✓ {notification.msg}
        </div>
      )}

      {/* Header */}
      <header style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>🥗</span>
            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: COLORS.text }}>
              Nutri<span style={{ color: COLORS.emerald }}>Vision</span>
            </span>
            {profile && <Badge>{profile.fitnessGoal === "lose" ? "🔥 Weight Loss" : profile.fitnessGoal === "gain" ? "💪 Muscle Gain" : "⚖️ Maintenance"}</Badge>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ color: COLORS.muted, fontSize: 14 }}>{user.name}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>Sign Out</Button>
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav className="bg-[#111a15] border-b border-[#1e3328]">
        <div className="max-w-[1920px] mx-auto px-4 md:px-6 lg:px-8 flex gap-4">
          {tabs.filter(t => t.id === "profile" || t.id === "history").map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(activeTab === tab.id ? "dashboard" : tab.id)} className={`
              px-5 py-3.5 border-none bg-transparent font-inherit flex items-center gap-1.5 transition-all text-sm cursor-pointer
              ${activeTab === tab.id ? "text-[#10b981] font-bold border-b-2 border-b-[#10b981]" : "text-[#6b8c76] font-medium border-b-2 border-b-transparent"}
            `}>
              {tab.icon} {tab.label}
            </button>
          ))}
          {activeTab === "profile" || activeTab === "history" ? (
            <button onClick={() => setActiveTab("dashboard")} className={`
             px-5 py-3.5 border-none bg-transparent font-inherit flex items-center gap-1.5 transition-all text-sm cursor-pointer
             text-[#6b8c76] font-medium border-b-2 border-b-transparent
           `}>
              ← Back to Dashboard
            </button>
          ) : null}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-[1920px] mx-auto p-4 md:p-6 lg:p-8">
        {/* Profile Setup blocks the whole screen if not configured */}
        {!profile && activeTab === "profile" && (
          <div className="max-w-3xl mx-auto">
            <ProfileSetup onSave={handleSaveProfile} />
          </div>
        )}

        {/* Responsive Split Screen Layout for main app */}
        {profile && activeTab !== "profile" && activeTab !== "history" && (
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">

            {/* LEFT PANEL: Scanner / Input */}
            <div className="w-full lg:w-1/3 xl:w-[450px] shrink-0 flex flex-col gap-6 lg:sticky lg:top-24">
              <div className="bg-[#111a15] border border-[#1e3328] rounded-2xl p-6 shadow-lg shadow-black/20">
                <h2 className="font-syne text-2xl font-extrabold text-[#e2f5ea] mb-6">AI Food Scanner</h2>
                <FoodScanner onScanComplete={handleMealScanned} profile={profile} />
              </div>
            </div>

            {/* RIGHT PANEL: Dashboard & Results */}
            <div className="w-full lg:flex-1 flex flex-col gap-6">
              <div className="bg-[#0a0f0d]">
                <Dashboard profile={profile} meals={meals} user={user} />
              </div>
            </div>
          </div>
        )}
        {activeTab === "history" && (
          <div className="w-full lg:w-2/3 xl:w-3/4 mx-auto">
            <h2 className="font-syne text-2xl font-extrabold text-[#e2f5ea] mb-6">Meal History</h2>
            {meals.length === 0 ? (
              <Card style={{ textAlign: "center", padding: 60 }}>
                <div className="text-5xl mb-4">🍽️</div>
                <h3 className="font-bold text-[#e2f5ea] mb-2">No meals logged yet</h3>
                <p className="text-[#6b8c76] mb-6">Use the Food Scanner to log your first meal</p>
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {meals.map((meal) => (
                  <Card key={meal._id} style={{ padding: 20 }}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{{ breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎" }[meal.mealType] || "🍽️"}</span>
                          <span className="font-bold text-[#e2f5ea] capitalize">{meal.mealType}</span>
                        </div>
                        <div className="text-[#6b8c76] text-xs">
                          {new Date(meal.detectedAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {new Date(meal.detectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[#10b981] font-extrabold text-xl">{meal.totalCalories} <span className="text-xs">kcal</span></div>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[11px] text-[#6366f1]">P: {meal.totalProtein}g</span>
                          <span className="text-[11px] text-[#f59e0b]">C: {meal.totalCarbs}g</span>
                          <span className="text-[11px] text-[#ef4444]">F: {meal.totalFat}g</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {meal.foodItems.map((item, i) => (
                        <span key={i} className="bg-[#111a15] border border-[#1e3328] rounded-full px-3 py-1 text-xs text-[#6b8c76]">
                          {item.name} · {item.calories} kcal
                        </span>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
