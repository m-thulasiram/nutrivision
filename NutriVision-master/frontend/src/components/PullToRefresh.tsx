import { useState, useCallback } from "react";
import { COLORS } from "../constants";

export const PullToRefresh = ({ onRefresh, children }: { onRefresh: () => Promise<void>; children: React.ReactNode }) => {
  const [state, setState] = useState<"idle" | "pulling" | "ready" | "loading">("idle");
  const [pullDist, setPullDist] = useState(0);
  const [startY, setStartY] = useState(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY <= 0) {
      setStartY(e.touches[0].clientY);
      setPullDist(0);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (window.scrollY > 0) return;
    if (state === "loading") return;
    const dist = Math.max(0, e.touches[0].clientY - startY);
    setPullDist(dist);
    if (dist > 10) {
      setState(dist > 80 ? "ready" : "pulling");
    } else {
      setState("idle");
    }
  }, [state, startY]);

  const handleTouchEnd = useCallback(async () => {
    if (state === "ready") {
      setState("loading");
      try { await onRefresh(); } catch { console.warn("Pull-to-refresh failed"); }
      setState("idle");
    } else {
      setState("idle");
    }
    setPullDist(0);
  }, [state, onRefresh]);

  const progress = Math.min(1, pullDist / 80);

  return (
    <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} style={{ position: "relative" }}>
      <div style={{
        height: state === "loading" ? 48 : state === "idle" ? 0 : Math.min(48, pullDist * 0.6),
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", transition: state === "idle" ? "height 0.25s ease" : "none",
      }}>
        {state === "loading" ? (
          <div style={{ width: 20, height: 20, border: `2px solid ${COLORS.border}`, borderTopColor: COLORS.emerald, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        ) : (
          <span style={{ color: COLORS.muted, fontSize: 13, transform: `rotate(${progress * 180}deg)`, transition: "transform 0.1s" }}>
            ↓
          </span>
        )}
      </div>
      {children}
    </div>
  );
};
