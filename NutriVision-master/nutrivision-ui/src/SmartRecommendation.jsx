import React, { useState } from 'react';

export default function SmartRecommendation() {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState(null);

  // Hardcoded for testing, but you will link these to your real dashboard variables!
  const [targetCals, setTargetCals] = useState(550);
  const [targetPro, setTargetPro] = useState(30);
  const [targetCarb, setTargetCarb] = useState(60);
  const [targetFat, setTargetFat] = useState(15);
  const [dietType, setDietType] = useState("veg");

  const fetchPerfectMeal = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_cals: targetCals,
          target_pro: targetPro,
          target_carb: targetCarb,
          target_fat: targetFat,
          diet_type: dietType
        })
      });

      const data = await response.json();
      setRecommendations(data);
    } catch (error) {
      console.error("Failed to connect to AI Brain:", error);
      alert("Make sure your FastAPI server is running on port 8000!");
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "auto", fontFamily: "sans-serif" }}>
      <h2>🧠 Smart Gap Filler</h2>
      <p>Fill your remaining daily macros with AI-calculated perfect portions.</p>
      
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input type="number" value={targetCals} onChange={(e) => setTargetCals(Number(e.target.value))} placeholder="Calories" />
        <input type="number" value={targetPro} onChange={(e) => setTargetPro(Number(e.target.value))} placeholder="Protein (g)" />
        <select value={dietType} onChange={(e) => setDietType(e.target.value)}>
          <option value="veg">Vegetarian</option>
          <option value="nonveg">Non-Veg</option>
        </select>
        <button 
          onClick={fetchPerfectMeal} 
          disabled={loading}
          style={{ padding: "10px 20px", backgroundColor: "#007BFF", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}
        >
          {loading ? "Calculating..." : "Generate Meal"}
        </button>
      </div>

      {recommendations && (
        <div style={{ border: "1px solid #ddd", padding: "15px", borderRadius: "8px" }}>
          <h3>✅ Perfect Portions Calculated</h3>
          
          <ul style={{ listStyleType: "none", padding: 0 }}>
            {recommendations.recommendations.map((food, index) => (
              <li key={index} style={{ padding: "10px 0", borderBottom: "1px solid #eee" }}>
                <strong>{food.emoji} {food.name}</strong> - {food.grams}g
                <div style={{ fontSize: "14px", color: "#555" }}>
                  {food.calories} kcal | {food.protein}g P | {food.carbs}g C | {food.fat}g F
                </div>
              </li>
            ))}
          </ul>

          <div style={{ marginTop: "15px", padding: "10px", backgroundColor: "#f8f9fa", borderRadius: "5px" }}>
            <strong>📊 Actual Achieved: </strong>
            {recommendations.achieved.calories} kcal | {recommendations.achieved.protein}g P
          </div>
        </div>
      )}
    </div>
  );
}