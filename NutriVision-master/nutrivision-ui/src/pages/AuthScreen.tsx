import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { COLORS } from "../constants";
import { Card, Input, Button } from "../components";
import ForgotPassword from "./ForgotPassword";

const AuthScreen = () => {
  const { register, login, loading, error, clearError } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [localError, setLocalError] = useState("");

  const displayError = localError || error;

  const switchMode = (m: "login" | "register" | "forgot") => {
    setMode(m); setLocalError(""); clearError();
    setForm({ name: "", email: "", password: "", confirmPassword: "" });
  };

  const handleSubmit = async () => {
    const { name, email, password, confirmPassword } = form;
    if (mode === "login") {
      if (!email.trim() || !password) {
        setLocalError("Email and password are required."); return;
      }
    } else {
      if (!name.trim() || !email.trim() || !password) {
        setLocalError("Name, email, and password are required."); return;
      }
    }
    if (mode === "register" && password.length < 6) {
      setLocalError("Password must be at least 6 characters."); return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setLocalError("Passwords do not match."); return;
    }
    if (mode === "register" && (!email.includes("@") || !email.includes("."))) {
      setLocalError("Enter a valid email address."); return;
    }
    try {
      if (mode === "register") {
        await register(name.trim(), email.trim().toLowerCase(), password);
      } else {
        await login(email.trim().toLowerCase(), password);
      }
    } catch {
      // error is set via context
    }
  };

  if (mode === "forgot") return <ForgotPassword onBack={() => switchMode("login")} />;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: "24px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; }
        body { background: ${COLORS.bg}; }
        input, select, button { font-family: 'DM Sans', sans-serif; }
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
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {(["login", "register"] as const).map(m => (
              <button key={m} onClick={() => switchMode(m)} style={{
                flex: 1, padding: "10px", borderRadius: 10, border: "none",
                background: mode === m ? `linear-gradient(135deg, ${COLORS.emerald}, ${COLORS.teal})` : COLORS.surface,
                color: mode === m ? "#fff" : COLORS.muted,
                fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
              }}>
                {m === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {mode === "register" && (
              <Input label="Name" type="text" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Choose a username" required />
            )}
            <Input label="Email" type="email" value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder={mode === "register" ? "Enter your email" : "Enter your email"} required />
            <Input label="Password" type="password" value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder={mode === "register" ? "6+ characters" : "Enter password"} required />
            {mode === "register" && (
              <Input label="Confirm Password" type="password" value={form.confirmPassword}
                onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
                placeholder="Repeat password" required />
            )}

            {displayError && (
              <div style={{ background: "#ef444418", border: "1px solid #ef444444", borderRadius: 10, padding: "10px 14px" }}>
                <p style={{ color: "#f87171", fontSize: 13, fontWeight: 600 }}>{displayError}</p>
              </div>
            )}

            <Button onClick={handleSubmit} disabled={loading} style={{ width: "100%" }}>
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </Button>

            {mode === "login" && (
              <button onClick={() => switchMode("forgot")} style={{ background: "transparent", border: "none", color: COLORS.emerald, cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 4, fontFamily: "inherit" }}>
                Forgot Password?
              </button>
            )}
          </div>
        </Card>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <span style={{ color: COLORS.muted, fontSize: 13 }}>
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <span style={{ color: COLORS.emerald, cursor: "pointer", fontWeight: 600 }} onClick={() => switchMode(mode === "login" ? "register" : "login")}>
              {mode === "login" ? "Sign Up" : "Sign In"}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
