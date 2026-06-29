import React, { Component } from "react";
import type { ReactNode } from "react";
import { COLORS } from "../constants";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: "" };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ errorInfo: info.componentStack || "" });
    console.error("NutriVision Error Boundary:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: "" });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          background: COLORS.bg,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🥗</div>
          <h1 style={{
            fontSize: 24, fontWeight: 700, color: COLORS.text,
            marginBottom: 8, textAlign: "center",
          }}>
            Something went wrong
          </h1>
          <p style={{
            fontSize: 14, color: COLORS.muted, textAlign: "center",
            maxWidth: 320, lineHeight: 1.5, marginBottom: 24,
          }}>
            NutriVision ran into an unexpected error. Your data is safe.
          </p>
          <button onClick={this.handleReset} style={{
            background: `linear-gradient(135deg, ${COLORS.emerald}, ${COLORS.teal})`,
            color: "#fff", border: "none", borderRadius: 12,
            padding: "14px 32px", fontSize: 15, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit", marginBottom: 12,
          }}>
            Try Again
          </button>
          <button onClick={() => { window.location.href = "/"; }} style={{
            background: "transparent", color: COLORS.muted,
            border: "none", fontSize: 14, cursor: "pointer", fontFamily: "inherit",
          }}>
            Go to Home
          </button>
          {import.meta.env.DEV && this.state.error && (
            <details style={{ marginTop: 24, maxWidth: 500, width: "100%" }}>
              <summary style={{ fontSize: 12, color: COLORS.muted, cursor: "pointer" }}>
                Error details (dev only)
              </summary>
              <pre style={{
                fontSize: 11, color: "#f87171",
                background: "#ef444418", padding: 12,
                borderRadius: 8, overflow: "auto", marginTop: 8,
                whiteSpace: "pre-wrap",
              }}>
                {this.state.error.toString()}
                {"\n\n"}
                {this.state.errorInfo}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
