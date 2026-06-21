import { useState } from "react";
import { COLORS } from "../constants";
import { Card, Input, Button } from "../components";

interface Props {
  onBack: () => void;
}

const ForgotPassword = ({ onBack }: Props) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.includes("@")) { setError("Enter a valid email address."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Request failed");
      setSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: "24px" }}>
        <Card style={{ padding: 28, maxWidth: 460, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, color: COLORS.text, marginBottom: 12 }}>Check your email</h2>
          <p style={{ color: COLORS.muted, fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
            If an account exists for <strong>{email}</strong>, we've sent a password reset link.
          </p>
          <Button onClick={onBack} style={{ width: "100%" }}>Back to Sign In</Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: "24px" }}>
      <Card style={{ padding: 28, maxWidth: 460, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🔑</div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, color: COLORS.text }}>Reset Password</h2>
          <p style={{ color: COLORS.muted, fontSize: 13, marginTop: 4 }}>Enter your email and we'll send you a reset link.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Email" type="email" value={email}
            onChange={e => { setEmail(e.target.value); setError(""); }}
            placeholder="Enter your email" required />
          {error && (
            <div style={{ background: "#ef444418", border: "1px solid #ef444444", borderRadius: 10, padding: "10px 14px" }}>
              <p style={{ color: "#f87171", fontSize: 13, fontWeight: 600 }}>{error}</p>
            </div>
          )}
          <Button onClick={handleSubmit} disabled={loading} style={{ width: "100%" }}>
            {loading ? "Sending..." : "Send Reset Link"}
          </Button>
          <button onClick={onBack} style={{ background: "transparent", border: "none", color: COLORS.emerald, cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 8, fontFamily: "inherit" }}>
            Back to Sign In
          </button>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPassword;
