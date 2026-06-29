import { useState } from "react";
import { api } from "../api";
import { COLORS } from "../constants";
import type { User } from "../types";

const DEMO_USER: User = { _id: "demo_user", name: "Alex Johnson", email: "demo@nutrivision.app" };

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const isStrongPassword = (p: string) =>
  p.length >= 8 && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p);

export const AuthScreen = ({ onAuth }: { onAuth: (user: User, token: string) => void }) => {
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
    try {
      const res = await api.register({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password,
        age: 30,
        gender: "male",
        height_cm: 175,
        weight_kg: 70,
        activity_level: "moderate",
        goal: "maintain",
        diet_type: "any",
      });
      api.setToken(res.token);
      onAuth({ _id: String(res.user.id), name: res.user.name, email: res.user.email }, res.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    const { email, password } = form;
    if (!email.trim() || !password) { setError("Please enter your email and password."); return; }
    if (!isValidEmail(email)) { setError("Please enter a valid email address."); return; }

    setLoading(true);
    try {
      const res = await api.login({ email: email.toLowerCase().trim(), password });
      api.setToken(res.token);
      onAuth({ _id: String(res.user.id), name: res.user.name, email: res.user.email }, res.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!form.email.trim()) { setError("Please enter your email address."); return; }
    if (!isValidEmail(form.email)) { setError("Please enter a valid email address."); return; }
    setLoading(true);
    try {
      await api.forgotPassword({ email: form.email.toLowerCase().trim() });
      setLoading(false);
      setError("");
      setSuccess("✅ If an account exists with that email, a reset link has been sent.");
    } catch (err: unknown) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Failed to send reset email.");
    }
  };

  const handleDemoLogin = () => {
    onAuth(DEMO_USER, "demo_jwt_" + Date.now());
  };

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(p => ({ ...p, [field]: e.target.value }));
    setError("");
    if (field === "password") evalPassword(e.target.value);
  };

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

        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 28 }}>
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
            {mode === "register" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>Full Name</label>
                <input value={form.name} onChange={f("name")} placeholder="Alex Johnson" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none" }} onFocus={(e) => (e.target.style.borderColor = COLORS.emerald)} onBlur={(e) => (e.target.style.borderColor = COLORS.border)} />
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>Email Address</label>
                <input type="email" aria-label="Email address" aria-required="true" value={form.email} onChange={f("email")} placeholder="you@example.com" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none" }} onFocus={(e) => (e.target.style.borderColor = COLORS.emerald)} onBlur={(e) => (e.target.style.borderColor = COLORS.border)} />
            </div>

            {mode !== "forgot" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>Password</label>
                <input type="password" aria-label="Password" aria-required="true" value={form.password} onChange={f("password")} placeholder="••••••••" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none" }} onFocus={(e) => (e.target.style.borderColor = COLORS.emerald)} onBlur={(e) => (e.target.style.borderColor = COLORS.border)} />
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

              {error && (
                <div role="alert" aria-live="assertive" style={{ background: "#ef444418", border: "1px solid #ef444444", borderRadius: 10, padding: "10px 14px", animation: "shake 0.4s ease" }}>
                  <p style={{ color: "#f87171", fontSize: 13, fontWeight: 600 }}>⚠️ {error}</p>
              </div>
            )}

            {success && (
              <div style={{ background: `${COLORS.emerald}18`, border: `1px solid ${COLORS.emerald}44`, borderRadius: 10, padding: "10px 14px" }}>
                <p style={{ color: COLORS.emerald, fontSize: 13, fontWeight: 600 }}>{success}</p>
              </div>
            )}

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

            {mode === "login" && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span onClick={() => switchMode("forgot")} style={{ color: COLORS.muted, fontSize: 13, cursor: "pointer" }}>
                  Forgot password?
                </span>
                <button onClick={handleDemoLogin}
                  style={{ background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 8, padding: "5px 10px", color: COLORS.muted, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                  🎯 Demo account
                </button>
              </div>
            )}

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
        </div>
      </div>
    </div>
  );
};
