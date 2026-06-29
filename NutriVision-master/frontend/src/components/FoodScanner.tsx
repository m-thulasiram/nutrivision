import { useState, useRef } from "react";
import { api } from "../api";
import { COLORS, FOOD_DATABASE, getSuggestedFoods, detectFoodFromFilename, buildFoodItemFromEntry } from "../constants";
import { Card, Button } from "./ui";
import type { Meal, FoodItem, FoodItemExtended, MLPrediction, HealthProfile } from "../types";

export const FoodScanner = ({ onScanComplete, profile }: { onScanComplete: (meal: Meal) => void; profile: HealthProfile | null }) => {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ meal: Meal; intel: { pct: number; remaining: number; target: number } | null; predictions: MLPrediction[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [manualName, setManualName] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [scanError, setScanError] = useState<string>("");
  const [scanStage, setScanStage] = useState<string>("");
  const [cameraActive, setCameraActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } });
      setCameraActive(true);
      setTimeout(() => {
        if (cameraRef.current) cameraRef.current.srcObject = stream;
      }, 50);
    } catch { setScanError("Camera access denied. Use photo upload instead."); }
  };

  const stopCamera = () => {
    if (cameraRef.current?.srcObject) {
      (cameraRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      cameraRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    const video = cameraRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
      handleFileSelect(file);
      stopCamera();
    }, "image/jpeg", 0.9);
  };

  const handleFileSelect = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setScanError("Please upload a JPG, PNG, or WEBP image."); return; }
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

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) handleFileSelect(f);
    e.target.value = "";
  };

  const scan = async () => {
    if (!manualName.trim() && !uploadedImage) {
      setScanError("Please type a food name OR upload a photo before scanning."); return;
    }
    setScanError(""); setScanning(true);
    let extendedItems: FoodItemExtended[] = [];
    let predictions: MLPrediction[] = [];

    try {
      if (manualName.trim()) {
        const typed = manualName.trim().toLowerCase();
        let entry = FOOD_DATABASE[typed];
        if (!entry) {
          const matchKey = Object.keys(FOOD_DATABASE).find(k => k.includes(typed) || typed.includes(k.split(" ")[0]));
          if (matchKey) entry = FOOD_DATABASE[matchKey];
        }
        if (!entry) {
          setScanning(false); setScanStage("");
          setScanError(`"${manualName.trim()}" not found in database.`);
          return;
        }

        const base = buildFoodItemFromEntry(entry, entry.defaultWeightG);
        extendedItems = [{ ...base, ingredients: entry.ingredients, dietType: entry.dietType }];
        predictions = [{ label: entry.name, confidence: 1.0, dbKey: typed, rawModelLabel: "text-lookup" }];

      } else if (uploadedImage) {
        setScanStage("Sending image to AI backend...");
        const file = fileRef.current?.files?.[0];
        let data: { detections?: Array<Record<string, unknown>> };
        if (file) {
          data = await api.analyzeMeal(file, "lunch") as { detections?: Array<Record<string, unknown>> };
        } else {
          const res = await fetch(uploadedImage);
          const blob = await res.blob();
          const fakeFile = new File([blob], "image.jpg", { type: blob.type || "image/jpeg" });
          data = await api.analyzeMeal(fakeFile, "lunch") as { detections?: Array<Record<string, unknown>> };
        }

        setScanStage("Processing AI predictions...");
        await new Promise(r => setTimeout(r, 400));

        if (data.detections && data.detections.length > 0) {
          data.detections.forEach((det: Record<string, unknown>) => {
            const detName = (det.class_name as string).toLowerCase().replace(/_/g, " ");
            const dbKey = detectFoodFromFilename(detName) || "oatmeal";
            const entry = FOOD_DATABASE[dbKey];
            const base = buildFoodItemFromEntry(entry, entry.defaultWeightG);
            extendedItems.push({ ...base, ingredients: entry.ingredients, dietType: entry.dietType, confidence: det.confidence as number, name: (det.class_name as string).replace(/_/g, " ") });
            predictions.push({ label: det.class_name as string, confidence: det.confidence as number, dbKey, rawModelLabel: "yolo-backend" });
          });
        } else {
          throw new Error("No food detected in image");
        }
      }
      await new Promise(r => setTimeout(r, 200));

      const totalCalories = extendedItems.reduce((s, f) => s + f.calories, 0);
      const finalMeal: Meal = {
        _id: "meal_" + Date.now(), mealType: "meal",
        foodItems: extendedItems as unknown as FoodItem[],
        totalCalories,
        totalProtein: Math.round(extendedItems.reduce((s, f) => s + f.protein, 0) * 10) / 10,
        totalCarbs: Math.round(extendedItems.reduce((s, f) => s + f.carbs, 0) * 10) / 10,
        totalFat: Math.round(extendedItems.reduce((s, f) => s + f.fat, 0) * 10) / 10,
        detectedAt: new Date().toISOString(),
};

      let intel = null;
      if (profile) {
        const pct = Math.min(100, Math.round((totalCalories / profile.dailyCalorieTarget) * 100));
        intel = { pct, remaining: Math.max(0, profile.dailyCalorieTarget - totalCalories), target: profile.dailyCalorieTarget };
      }

      setResult({ meal: finalMeal, intel, predictions });

    } catch (err: unknown) {
      setScanError("Scan failed: " + (err instanceof Error ? err.message : "Unexpected error. Please try again."));
    } finally {
      setScanning(false); setScanStage("");
    }
  };

  const resetScanner = () => {
    setResult(null); setManualName(""); setUploadedImage(null);
    setUploadedFileName(""); setScanError(""); setScanStage("");
  };

  const calColor = (c: number) => c < 200 ? COLORS.emerald : c < 400 ? COLORS.carbs : COLORS.fat;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .nutrition-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8; }
        .suggest-grid-scanner { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10; }

        @media (max-width: 640px) {
          .nutrition-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .suggest-grid-scanner { grid-template-columns: 1fr !important; }
          .scan-card { padding: 16px !important; }
          .ai-status-text { font-size: 10px !important; }
          .food-name-nowrap { white-space: normal !important; overflow: visible !important; text-overflow: clip !important; }
        }
      `}</style>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, padding: "10px 16px", borderRadius: 12, background: `${COLORS.emerald}12`, border: `1px solid ${COLORS.emerald}30` }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>🧠</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.emerald }}>AI Food Scanner — Ready</div>
              <div className="ai-status-text" style={{ fontSize: 11, color: COLORS.muted }}>Canvas pixel analysis · Food-101 keyword classification · Nutrition database lookup</div>
            </div>
        <div style={{ marginLeft: "auto", width: 10, height: 10, borderRadius: "50%", background: COLORS.emerald, boxShadow: `0 0 6px ${COLORS.emerald}` }} />
      </div>

      {!result ? (
        <div style={{ animation: "slideUp 0.3s ease" }}>
          <Card className="scan-card" style={{ marginBottom: 18, padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${COLORS.emerald}18`, border: `2px solid ${COLORS.emerald}44`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: COLORS.emerald, fontSize: 14 }}>A</div>
              <div>
                <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, margin: 0 }}>Type the food name</h3>
                <p style={{ color: COLORS.muted, fontSize: 12, margin: 0 }}>Instant lookup from 20-item nutrition database</p>
              </div>
            </div>
            <input
              type="text" value={manualName}
              onChange={(e) => { setManualName(e.target.value); setScanError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !scanning) scan(); }}
              placeholder="e.g. Grilled Chicken Breast, Paneer Cubes, Oatmeal..."
              style={{ width: "100%", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}
              onFocus={(e) => (e.target.style.borderColor = COLORS.emerald)}
              onBlur={(e) => (e.target.style.borderColor = COLORS.border)}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {(profile?.dietType === "nonveg"
                ? ["Grilled Chicken Breast", "Salmon Fillet", "Beef Steak", "Tuna Can", "Egg Omelette", "Chicken Tikka"]
                : ["Brown Rice", "Paneer Cubes", "Oatmeal", "Greek Yogurt", "Lentil Dal", "Avocado Toast"]
              ).map(s => (
                <button key={s} onClick={() => { setManualName(s); setScanError(""); }} style={{
                  background: manualName === s ? `${COLORS.emerald}22` : COLORS.card,
                  border: `1px solid ${manualName === s ? COLORS.emerald : COLORS.border}`,
                  borderRadius: 20, padding: "5px 14px",
                  color: manualName === s ? COLORS.emerald : COLORS.muted,
                  fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: manualName === s ? 700 : 400,
                  transition: "all 0.15s",
                }}>{s}</button>
              ))}
            </div>
          </Card>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div style={{ flex: 1, height: 1, background: COLORS.border }} />
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 20, padding: "5px 16px" }}>
              <span style={{ color: COLORS.muted, fontSize: 12, fontWeight: 700 }}>OR SCAN PHOTO</span>
            </div>
            <div style={{ flex: 1, height: 1, background: COLORS.border }} />
          </div>

          <Card className="scan-card" style={{ padding: 22, marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${COLORS.teal}18`, border: `2px solid ${COLORS.teal}44`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: COLORS.teal, fontSize: 14 }}>B</div>
              <div>
                <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, margin: 0 }}>Scan meal photo</h3>
                <p style={{ color: COLORS.muted, fontSize: 12, margin: 0 }}>AI analyzes colors, textures and patterns to classify food</p>
              </div>
            </div>

            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={handleFileInputChange} />

            {!uploadedImage ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${dragOver ? COLORS.emerald : COLORS.border}`,
                  borderRadius: 14, padding: "40px 20px", textAlign: "center",
                  background: dragOver ? `${COLORS.emerald}08` : COLORS.surface,
                  transition: "all 0.25s", cursor: "pointer",
                }}
                onClick={() => fileRef.current?.click()}
              >
                <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
                <p style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Drop your meal photo here</p>
                <p style={{ color: COLORS.muted, fontSize: 12, marginBottom: 20 }}>or click to browse</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                  style={{
                    background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.emerald})`,
                    border: "none", borderRadius: 10, padding: "11px 28px",
                    color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
                    boxShadow: `0 4px 14px ${COLORS.teal}44`,
                  }}>
                  📁 Choose Photo
                </button>
                <p style={{ color: COLORS.muted, fontSize: 11, marginTop: 12 }}>JPG · PNG · WEBP · GIF · Max 10MB</p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); if (cameraActive) { capturePhoto(); } else { startCamera(); } }}
                    style={{
                      background: cameraActive ? COLORS.emerald : COLORS.surface,
                      border: `1px solid ${cameraActive ? COLORS.emerald : COLORS.border}`,
                      borderRadius: 10, padding: "10px 20px",
                      color: cameraActive ? "#fff" : COLORS.text,
                      fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                      transition: "all 0.2s",
                    }}>
                    {cameraActive ? "📸 Capture" : "📷 Camera"}
                  </button>
                  {cameraActive && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); stopCamera(); }}
                      style={{
                        background: "transparent",
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 10, padding: "10px 20px",
                        color: COLORS.muted, fontWeight: 700, fontSize: 13,
                        cursor: "pointer", fontFamily: "inherit",
                      }}>
                      ✕ Cancel
                    </button>
                  )}
                </div>
                {cameraActive && (
                  <div style={{ marginTop: 14, borderRadius: 14, overflow: "hidden", background: "#000" }}>
                    <video ref={cameraRef} autoPlay playsInline style={{ width: "100%", maxHeight: 300, objectFit: "cover", display: "block" }} />
                  </div>
                )}
                <canvas ref={canvasRef} style={{ display: "none" }} />
              </div>
            ) : (
              <div>
                <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#000" }}>
                  <img
                    src={uploadedImage}
                    alt="Meal preview"
                    crossOrigin="anonymous"
                    style={{ width: "100%", maxHeight: 260, objectFit: "cover", display: "block" }}
                  />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 55%)" }} />
                  <div style={{ position: "absolute", bottom: 12, left: 14, right: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, background: "rgba(0,0,0,0.5)", padding: "4px 12px", borderRadius: 20 }}>
                      🧠 Ready for AI analysis
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 8, padding: "5px 12px", color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Change</button>
                      <button onClick={() => { setUploadedImage(null); setUploadedFileName(""); setScanError(""); }} style={{ background: "rgba(239,68,68,0.3)", border: "1px solid rgba(239,68,68,0.5)", borderRadius: 8, padding: "5px 12px", color: "#fca5a5", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>✕ Remove</button>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }}>✅</span>
                  <span style={{ color: COLORS.emerald, fontSize: 13, fontWeight: 600 }}>{uploadedFileName}</span>
                  <span style={{ color: COLORS.muted, fontSize: 12 }}>· Ready to scan</span>
                </div>
              </div>
            )}
          </Card>

          {scanError && (
            <div style={{ marginBottom: 16, padding: "12px 16px", background: "#ef444415", border: "1px solid #ef444440", borderRadius: 10, color: "#f87171", fontSize: 13, fontWeight: 600 }}>
              ⚠️ {scanError}
            </div>
          )}

          <button
            onClick={scan} disabled={scanning}
            style={{
              width: "100%",
              background: scanning ? COLORS.surface : `linear-gradient(135deg, ${COLORS.emerald}, ${COLORS.teal})`,
              border: scanning ? `1px solid ${COLORS.border}` : "none",
              borderRadius: 14, padding: "17px",
              color: scanning ? COLORS.muted : "#fff",
              fontWeight: 800, fontSize: 16, cursor: scanning ? "not-allowed" : "pointer",
              fontFamily: "inherit", transition: "all 0.25s",
              boxShadow: scanning ? "none" : `0 6px 22px ${COLORS.emerald}44`,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            }}>
            {scanning ? (
              <>
                <div style={{ width: 18, height: 18, border: `2px solid ${COLORS.border}`, borderTopColor: COLORS.emerald, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                {scanStage || "Analyzing..."}
              </>
            ) : <span>🧠 Analyze Meal</span>}
          </button>

          {scanning && (
            <div style={{ marginTop: 16, padding: 18, background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}` }}>
              {[
                { label: "Image pixel analysis", done: scanStage.includes("Classif") || scanStage.includes("Matching") || scanStage.includes("Building") },
                { label: "Food-101 keyword classification", done: scanStage.includes("Matching") || scanStage.includes("Building") },
                { label: "Nutrition database lookup", done: scanStage.includes("Building") },
                { label: "Generating report", done: false, active: scanStage.includes("Building") },
              ].map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i < 3 ? 10 : 0 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    background: step.done ? `${COLORS.emerald}22` : "transparent",
                    border: `2px solid ${step.done ? COLORS.emerald : COLORS.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
                  }}>
                    {step.done ? "✓" : step.active ? <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.teal, animation: "pulse 1s infinite" }} /> : null}
                  </div>
                  <span style={{ color: step.done ? COLORS.text : COLORS.muted, fontSize: 13, fontWeight: step.done ? 600 : 400 }}>{step.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      ) : (
        <div style={{ animation: "slideUp 0.35s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <h3 style={{ color: COLORS.text, fontSize: 20, fontWeight: 800, fontFamily: "'Syne', sans-serif", margin: 0 }}>✅ Analysis Complete</h3>
              <p style={{ color: COLORS.muted, fontSize: 13, marginTop: 4 }}>
                {uploadedImage ? "AI Image Analysis · " : "Database Lookup · "}
                <span style={{ color: COLORS.emerald, fontWeight: 700 }}>
                  {(result.meal.foodItems as FoodItemExtended[]).map(f => f.name).join(", ")}
                </span>
              </p>
            </div>
            <button onClick={resetScanner} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "7px 16px", color: COLORS.muted, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>← Scan Again</button>
          </div>

          {uploadedImage && result.predictions.length > 0 && (
            <Card className="scan-card" style={{ marginBottom: 18, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 18 }}>🔬</span>
                <div>
                  <h4 style={{ color: COLORS.text, fontWeight: 700, fontSize: 14, margin: 0 }}>AI Classification Results</h4>
                  <p style={{ color: COLORS.muted, fontSize: 11, margin: 0 }}>Canvas pixel analysis + Food-101 keyword matching</p>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {result.predictions.slice(0, 4).map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? COLORS.emerald : COLORS.muted, width: 22, textAlign: "right", flexShrink: 0 }}>#{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: i === 0 ? COLORS.text : COLORS.muted, fontWeight: i === 0 ? 700 : 400 }}>
                          {p.label}
                          {p.dbKey && i === 0 && <span style={{ marginLeft: 8, fontSize: 11, color: COLORS.emerald, fontWeight: 700, background: `${COLORS.emerald}18`, padding: "1px 8px", borderRadius: 10 }}>✓ matched</span>}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? COLORS.emerald : COLORS.muted }}>{Math.round(p.confidence * 100)}%</span>
                      </div>
                      <div style={{ height: 5, background: COLORS.card, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.round(p.confidence * 100)}%`, background: i === 0 ? `linear-gradient(90deg, ${COLORS.emerald}, ${COLORS.teal})` : COLORS.border, borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
            {(result.meal.foodItems as FoodItemExtended[]).map((item, i) => {
              const isVeg = (item.dietType || "veg") === "veg";
              const dbEntry = Object.values(FOOD_DATABASE).find(e => e.name === item.name);
              return (
                <Card key={i} className="scan-card" style={{ padding: 20, border: `2px solid ${isVeg ? "#22c55e33" : "#f9730633"}` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 36 }}>{dbEntry?.emoji || "🍽️"}</span>
                      <div>
                        <div style={{ color: COLORS.text, fontWeight: 800, fontSize: 17 }}>{item.name}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                          <span style={{ background: isVeg ? "#22c55e20" : "#f9730620", color: isVeg ? "#22c55e" : "#f97306", border: `1px solid ${isVeg ? "#22c55e50" : "#f9730650"}`, fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>
                            {isVeg ? "🥦 Vegetarian" : "🍗 Non-Vegetarian"}
                          </span>
                          <span style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, fontSize: 11, color: COLORS.muted, padding: "2px 10px", borderRadius: 20 }}>
                            {item.weightGrams}g serving
                          </span>
                          <span style={{ background: `${COLORS.emerald}12`, border: `1px solid ${COLORS.emerald}30`, fontSize: 11, color: COLORS.emerald, fontWeight: 600, padding: "2px 10px", borderRadius: 20 }}>
                            {Math.round(item.confidence * 100)}% confidence
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                      <div style={{ fontSize: 30, fontWeight: 900, color: calColor(item.calories) }}>{item.calories}</div>
                      <div style={{ fontSize: 11, color: COLORS.muted }}>kcal</div>
                    </div>
                  </div>

                  <div className="nutrition-grid" style={{ marginBottom: 14 }}>
                    {[
                      { label: "Calories", value: item.calories, unit: "kcal", color: COLORS.emerald, per100: item.caloriesPer100g },
                      { label: "Protein", value: item.protein, unit: "g", color: COLORS.protein, per100: Math.round(item.protein / item.weightGrams * 1000) / 10 },
                      { label: "Carbs", value: item.carbs, unit: "g", color: COLORS.carbs, per100: Math.round(item.carbs / item.weightGrams * 1000) / 10 },
                      { label: "Fat", value: item.fat, unit: "g", color: COLORS.fat, per100: Math.round(item.fat / item.weightGrams * 1000) / 10 },
                    ].map(m => (
                      <div key={m.label} style={{ textAlign: "center", background: COLORS.surface, borderRadius: 10, padding: "10px 6px" }}>
                        <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{m.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: m.color }}>{m.value}<span style={{ fontSize: 10 }}>{m.unit}</span></div>
                        <div style={{ fontSize: 10, color: COLORS.muted }}>{m.per100}/100g</div>
                      </div>
                    ))}
                  </div>

                  {item.ingredients && item.ingredients.length > 0 && (
                    <div style={{ background: COLORS.surface, borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>🧾 Ingredients</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {item.ingredients.map((ing, idx) => (
                          <span key={idx} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 20, padding: "3px 10px", color: COLORS.muted, fontSize: 12 }}>{ing}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          <Card className="scan-card" style={{ background: `linear-gradient(135deg, ${COLORS.emeraldDark}20, ${COLORS.teal}10)`, marginBottom: 20, padding: 20 }}>
            <h4 style={{ color: COLORS.text, fontWeight: 700, marginBottom: 14, fontSize: 15 }}>📊 Meal Totals</h4>
            <div className="nutrition-grid" style={{ gap: 12, marginBottom: 14 }}>
              {[
                ["Calories", result.meal.totalCalories, "kcal", COLORS.emerald],
                ["Protein", result.meal.totalProtein, "g", COLORS.protein],
                ["Carbs", result.meal.totalCarbs, "g", COLORS.carbs],
                ["Fat", result.meal.totalFat, "g", COLORS.fat],
              ].map(([label, val, unit, color]) => (
                <div key={label as string} style={{ textAlign: "center", background: `${COLORS.card}aa`, borderRadius: 10, padding: "10px 6px" }}>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: color as string }}>{val}<span style={{ fontSize: 11 }}>{unit}</span></div>
                </div>
              ))}
            </div>
            {result.intel && (
              <div style={{ padding: 12, background: COLORS.surface, borderRadius: 10, borderLeft: `3px solid ${COLORS.emerald}` }}>
                <p style={{ color: COLORS.text, fontSize: 14, fontWeight: 600, margin: 0 }}>
                  This meal is <span style={{ color: COLORS.emerald }}>{result.intel.pct}%</span> of your {result.intel.target} kcal daily target.
                  {result.intel.remaining > 0 ? ` ${result.intel.remaining} kcal remaining today.` : " 🎉 Daily goal reached!"}
                </p>
              </div>
            )}
            {result.intel && result.intel.remaining > 80 && profile && (() => {
              const ss = getSuggestedFoods(result.intel.remaining, profile.fitnessGoal, 15, (profile.dietType || "veg") as "veg" | "nonveg");
              if (!ss.length) return null;
              return (
                <div style={{ marginTop: 14 }}>
                  <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>💡 You can still eat — {result.intel.remaining} kcal left</div>
                  <div className="suggest-grid-scanner">
                    {ss.slice(0, 4).map(food => (
                      <div key={food.name} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "10px 12px", display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 22, flexShrink: 0 }}>{food.emoji}</span>
                        <div style={{ minWidth: 0 }}>
                          <div className="food-name-nowrap" style={{ color: COLORS.text, fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{food.name}</div>
                          <div style={{ color: COLORS.emerald, fontSize: 12, fontWeight: 700 }}>{food.calories} kcal</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </Card>

          <Button onClick={() => { onScanComplete(result.meal); setResult(null); }} size="lg" style={{ width: "100%" }}>
            ✓ Save Meal to Log
          </Button>
        </div>
      )}
    </div>
  );
};

export default FoodScanner;
