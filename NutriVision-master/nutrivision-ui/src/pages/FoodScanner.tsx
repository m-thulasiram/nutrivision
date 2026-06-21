import { useState, useRef } from "react";
import { COLORS } from "../constants";
import { Card, Button } from "../components";
import { useAuth } from "../contexts/AuthContext";
import type { HealthProfile, Meal, BackendAnalysisResult } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

const FoodScanner = ({ onScanComplete, profile }: { onScanComplete: (meal: Meal) => void; profile: HealthProfile | null }) => {
  const { token } = useAuth();
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
      const scanHeaders: Record<string, string> = {};
      if (token) scanHeaders["Authorization"] = `Bearer ${token}`;
      const apiRes = await fetch(`${API_BASE}/api/analyze-meal`, {
        method: 'POST',
        headers: scanHeaders,
        body: formData
      });

      if (!apiRes.ok) throw new Error(`Backend analysis failed (${apiRes.status})`);
      const data = await apiRes.json();

      setScanStage("Formatting analysis results...");
      await new Promise(r => setTimeout(r, 300));
      setResult(data);

    } catch (err: unknown) {
      setScanError("Scan failed: " + (err instanceof Error ? err.message : "Unexpected error."));
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

export default FoodScanner;
