import { useState, useEffect } from "react";
import { api } from "../api";
import { COLORS } from "../constants";
import { Card } from "./ui";

interface SuggestionFood {
  food: string;
  calories: number;
  protein: number;
  match_score: number;
  explanation: string;
}
interface SuggestionData {
  suggested_meals: SuggestionFood[];
  priority_focus?: string;
}

export const AISuggestions = ({ remainingCals, remainingProtein, userId }: { remainingCals: number; remainingProtein: number; userId?: number }) => {
  const [aiSuggestions, setAiSuggestions] = useState<SuggestionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetch = userId
      ? api.getNextMealSuggestion(userId, true)
      : api.getSmartNextMealRecommendation();
    fetch.then(data => {
      if (!cancelled) {
        setAiSuggestions(data as SuggestionData);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [remainingCals, remainingProtein, userId]);

  if (loading) {
    return (
      <Card style={{ marginBottom: 24, textAlign: 'center', padding: 40 }}>
        <div style={{ width: 24, height: 24, border: `2px solid ${COLORS.border}`, borderTopColor: COLORS.emerald, borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: '0 auto 12px' }} />
        <div style={{ color: COLORS.muted, fontSize: 13 }}>Consulting Anti-Gravity Intelligence Engine...</div>
      </Card>
    );
  }

  if (!aiSuggestions?.suggested_meals?.length) return null;

  return (
    <Card style={{ marginBottom: 24, background: `linear-gradient(135deg, ${COLORS.card}, #0e1f18)` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h3 style={{ color: COLORS.text, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>🛰️ Space-Optimized Meals</h3>
          <p style={{ color: COLORS.muted, fontSize: 13, marginTop: 3 }}>
            Anti-Gravity Picks for your remaining <span style={{ color: COLORS.emerald, fontWeight: 700 }}>{remainingCals} kcal</span>
            {aiSuggestions.priority_focus && <> · Focus: <span style={{ color: COLORS.protein, fontWeight: 700 }}>{aiSuggestions.priority_focus}</span></>}
          </p>
        </div>
        <div style={{ background: COLORS.emeraldDark, color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
          Active: Anti-Gravity Mode
        </div>
      </div>
      <div className="suggest-grid">
        {aiSuggestions.suggested_meals.map((food, i) => {
          const isFit = food.calories <= remainingCals;
          return (
            <div key={i} style={{
              background: COLORS.surface, borderRadius: 14,
              border: `1px solid ${isFit ? COLORS.border : COLORS.fat + "55"}`,
              padding: 16, position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, right: 0, width: 50, height: 50, background: `${COLORS.emerald}0d`, borderRadius: "0 0 0 50px" }} />
              <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, textTransform: "capitalize", marginBottom: 10 }}>{food.food}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                <span style={{ background: `${COLORS.emerald}1a`, color: COLORS.emerald, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 10 }}>
                  {food.match_score}% Match
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, marginBottom: 10 }}>
                {[
                  { label: "Calories", value: food.calories + " kcal", color: isFit ? COLORS.emerald : COLORS.fat },
                  { label: "Protein", value: food.protein + "g", color: COLORS.protein },
                ].map(m => (
                  <div key={m.label} style={{ textAlign: "center", background: COLORS.card, borderRadius: 8, padding: "6px 2px" }}>
                    <div style={{ fontSize: 9, color: COLORS.muted }}>{m.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: COLORS.muted, lineHeight: 1.4, borderTop: `1px dashed ${COLORS.border}`, paddingTop: 8 }}>
                <i>{food.explanation}</i>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
