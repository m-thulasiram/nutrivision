import { useState } from "react";
import { COLORS } from "../constants";
import { Card, Input, Button } from "../components";

interface Props {
  onBack: () => void;
  initialToken?: string;
}

const ResetPassword = ({ onBack, initialToken = "" }: Props) => {
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!token.trim()) { setError("Reset token is required."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Reset failed");
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: "24px" }}>
        <Card style={{ padding: 28, maxWidth: 460, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, color: COLORS.text, marginBottom: 12 }}>Password Reset Successful</h2>
          <p style={{ color: COLORS.muted, fontSize: 14, marginBottom: 24 }}>Your password has been updated. You can now sign in with your new password.</p>
          <Button onClick={onBack} style={{ width: "100%" }}>Back to Sign In</Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: "24px" }}>
      <Card style={{ padding: 28, maxWidth: 460, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🔐</div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, color: COLORS.text }}>Reset Your Password</h2>
          <p style={{ color: COLORS.muted, fontSize: 13, marginTop: 4 }}>Enter the reset token from your email and choose a new password.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {!initialToken && (
            <Input label="Reset Token" type="text" value={token}
              onChange={e => { setToken(e.target.value); setError(""); }}
              placeholder="Paste your reset token here" required />
          )}
          <Input label="New Password" type="password" value={password}
            onChange={e => { setPassword(e.target.value); setError(""); }}
            placeholder="6+ characters" required />
          <Input label="Confirm Password" type="password" value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); setError(""); }}
            placeholder="Repeat new password" required />
          {error && (
            <div style={{ background: "#ef444418", border: "1px solid #ef444444", borderRadius: 10, padding: "10px 14px" }}>
              <p style={{ color: "#f87171", fontSize: 13, fontWeight: 600 }}>{error}</p>
            </div>
          )}
          <Button onClick={handleSubmit} disabled={loading} style={{ width: "100%" }}>
            {loading ? "Resetting..." : "Reset Password"}
          </Button>
          <button onClick={onBack} style={{ background: "transparent", border: "none", color: COLORS.emerald, cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 8, fontFamily: "inherit" }}>
            Back to Sign In
          </button>
        </div>
      </Card>
    </div>
  );
};

export default ResetPassword;
