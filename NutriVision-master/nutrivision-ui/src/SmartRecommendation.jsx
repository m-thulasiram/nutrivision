import React, { useState } from 'react';

function RegionalBadge({ region }) {
  if (!region || region === "All India" || region === "") return null;
  const colors = {
    "North India": "#f97316",
    "South India": "#8b5cf6",
    "East India": "#ef4444",
    "West India": "#14b8a6",
    "Central India": "#eab308",
    "North-East India": "#22c55e"
  };
  const color = colors[region] || "#6b7280";
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 10,
      fontSize: 11, fontWeight: 700, color: "#fff", background: color,
      marginLeft: 8
    }}>
      {region}
    </span>
  );
}

export default function SmartRecommendation() {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [targetCals, setTargetCals] = useState(550);
  const [targetPro, setTargetPro] = useState(30);
  const [targetCarb, setTargetCarb] = useState(60);
  const [targetFat, setTargetFat] = useState(15);
  const [dietType, setDietType] = useState("veg");
  const [preferredRegion, setPreferredRegion] = useState("");

  const REGIONS = ["", "All India", "North India", "South India", "East India", "West India", "Central India", "North-East India"];

  const fetchPerfectMeal = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_cals: targetCals,
          target_pro: targetPro,
          target_carb: targetCarb,
          target_fat: targetFat,
          diet_type: dietType,
          preferred_region: preferredRegion,
          preferred_state: ""
        })
      });
      const data = await response.json();
      setRecommendations(data);
    } catch (error) {
      console.error("Failed to connect to AI Brain:", error);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: "20px", maxWidth: "700px", margin: "auto", fontFamily: "sans-serif" }}>
      <h2>🧠 AI Smart Meal Generator</h2>
      <p style={{ color: "#666" }}>Fill your remaining daily macros with region-aware recommendations.</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px", alignItems: "end" }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Calories</label>
          <input type="number" value={targetCals} onChange={(e) => setTargetCals(Number(e.target.value))} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", width: 90 }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Protein (g)</label>
          <input type="number" value={targetPro} onChange={(e) => setTargetPro(Number(e.target.value))} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", width: 90 }} />
        </div>
        <select value={dietType} onChange={(e) => setDietType(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd" }}>
          <option value="veg">Vegetarian</option>
          <option value="nonveg">Non-Veg</option>
          <option value="any">Any</option>
        </select>
        <select value={preferredRegion} onChange={(e) => setPreferredRegion(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd" }}>
          {REGIONS.map(r => <option key={r} value={r}>{r || "Any Region"}</option>)}
        </select>
        <button onClick={fetchPerfectMeal} disabled={loading}
          style={{ padding: "8px 20px", backgroundColor: loading ? "#999" : "#10b981", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          {loading ? "Generating..." : "Generate Meal"}
        </button>
      </div>

      {recommendations && recommendations.recommendations?.length > 0 && (
        <div style={{ border: "1px solid #e5e7eb", padding: "16px", borderRadius: 10, background: "#f9fafb" }}>
          <h3 style={{ margin: "0 0 12px" }}>✅ Recommended Foods</h3>
          <ul style={{ listStyleType: "none", padding: 0, margin: 0 }}>
            {recommendations.recommendations.map((food, index) => (
              <li key={index} style={{ padding: "12px 0", borderBottom: index < recommendations.recommendations.length - 1 ? "1px solid #eee" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                  <strong>{food.name}</strong>
                  <RegionalBadge region={food.reasoning_trace?.regional_match} />
                </div>
                <div style={{ fontSize: 13, color: "#555", marginTop: 2 }}>
                  {food.calories} kcal | {food.protein}g P | {food.carbs}g C | {food.fat}g F
                </div>
                {food.reasoning_trace && (
                  <div style={{ fontSize: 11, color: "#888", marginTop: 4, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {food.reasoning_trace.cuisine && <span>🍳 {food.reasoning_trace.cuisine}</span>}
                    {food.reasoning_trace.meal_type && <span>⏰ {food.reasoning_trace.meal_type}</span>}
                    {food.reasoning_trace.vegetarian_safe && <span>🥦 Vegetarian Safe</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
