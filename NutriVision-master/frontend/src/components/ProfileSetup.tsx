import { useState, useEffect } from "react";
import { COLORS } from "../constants";
import { api } from "../api";
import { Card, Input, Select, Button } from "./ui";
import type { HealthProfile } from "../types";

const ProfileSetup = ({ onSave }: { onSave: (p: HealthProfile) => void }) => {
  const [form, setForm] = useState({ age: "", gender: "male", height: "", weight: "", activityLevel: "moderate", fitnessGoal: "lose", dietType: "veg", region: "", state: "" });
  const [result, setResult] = useState<HealthProfile | null>(null);
  const [regions, setRegions] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);

  useEffect(() => {
    api.getRegions().then(r => setRegions(r.regions)).catch(() => { /* regions unavailable */ });
    api.getStates().then(r => setStates(r.states)).catch(() => { /* states unavailable */ });
  }, []);

  const calculate = () => {
    const age = Number(form.age), h = Number(form.height), w = Number(form.weight);
    if (!age || !h || !w) return;
    const hM = h / 100;
    const bmi = Math.round((w / (hM * hM)) * 10) / 10;
    const bmiCategory = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";
    const bmr = form.gender === "male" ? 10 * w + 6.25 * h - 5 * age + 5 : 10 * w + 6.25 * h - 5 * age - 161;
    const mult = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }[form.activityLevel] || 1.55;
    const tdee = Math.round(bmr * mult);
    const dailyCalorieTarget = form.fitnessGoal === "lose" ? Math.max(1200, tdee - 500) : form.fitnessGoal === "gain" ? tdee + 300 : tdee;
    const p = { protein: Math.round(dailyCalorieTarget * 0.3 / 4), carbs: Math.round(dailyCalorieTarget * 0.45 / 4), fat: Math.round(dailyCalorieTarget * 0.25 / 9) };
    setResult({ age, gender: form.gender, height: h, weight: w, activityLevel: form.activityLevel, fitnessGoal: form.fitnessGoal, dietType: form.dietType as "veg" | "nonveg", bmi, bmiCategory, bmr: Math.round(bmr), tdee, dailyCalorieTarget, dailyProteinTarget: p.protein, dailyCarbTarget: p.carbs, dailyFatTarget: p.fat, region: form.region || undefined, state: form.state || undefined });
};

  const bmiColor = result ? (result.bmi < 18.5 ? "#60a5fa" : result.bmi < 25 ? COLORS.emerald : result.bmi < 30 ? "#f59e0b" : "#ef4444") : COLORS.emerald;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, padding: "40px 24px", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap'); * { box-sizing: border-box; }`}</style>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, color: COLORS.text, fontWeight: 800 }}>Build Your Health Profile</h2>
          <p style={{ color: COLORS.muted, marginTop: 8 }}>We'll calculate your personalized nutrition targets</p>
        </div>

        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            <Input label="Age" type="number" value={form.age} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, age: e.target.value }))} placeholder="28" />
            <Select label="Gender" value={form.gender} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(p => ({ ...p, gender: e.target.value }))} options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]} />
            <Input label="Height (cm)" type="number" value={form.height} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, height: e.target.value }))} placeholder="178" />
            <Input label="Weight (kg)" type="number" value={form.weight} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, weight: e.target.value }))} placeholder="75" />
            <Select label="Activity Level" value={form.activityLevel} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(p => ({ ...p, activityLevel: e.target.value }))} options={[
              { value: "sedentary", label: "Sedentary (desk job)" },
              { value: "light", label: "Light (1-3x/week)" },
              { value: "moderate", label: "Moderate (3-5x/week)" },
              { value: "active", label: "Active (6-7x/week)" },
              { value: "very_active", label: "Very Active (2x/day)" },
            ]} />
            <Select label="Fitness Goal" value={form.fitnessGoal} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(p => ({ ...p, fitnessGoal: e.target.value }))} options={[
              { value: "lose", label: "🔥 Lose Weight" },
              { value: "maintain", label: "⚖️ Maintain Weight" },
              { value: "gain", label: "💪 Build Muscle" },
            ]} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>Diet Type</label>
              <div style={{ display: "flex", gap: 10 }}>
                {[{ value: "veg", label: "🥦 Vegetarian", color: "#22c55e" }, { value: "nonveg", label: "🍗 Non-Veg", color: "#f97316" }].map(opt => (
                  <button key={opt.value} type="button" onClick={() => setForm(p => ({ ...p, dietType: opt.value }))}
                    style={{
                      flex: 1, padding: "10px 8px", borderRadius: 10,
                      border: `2px solid ${form.dietType === opt.value ? opt.color : COLORS.border}`,
                      background: form.dietType === opt.value ? `${opt.color}22` : COLORS.surface,
                      color: form.dietType === opt.value ? opt.color : COLORS.muted,
                      fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                      transition: "all 0.2s",
                    }}>{opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginTop: 20 }}>
            <Select label="Region" value={form.region} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(p => ({ ...p, region: e.target.value }))}
              options={[{ value: "", label: "All Regions" }, ...regions.map(r => ({ value: r, label: r }))]} />
            <Select label="State" value={form.state} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(p => ({ ...p, state: e.target.value }))}
              options={[{ value: "", label: "All States" }, ...states.map(s => ({ value: s, label: s }))]} />
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <Button onClick={calculate} style={{ flex: 1 }}>Calculate My Targets</Button>
          </div>
        </Card>

        {result && (
          <div style={{ animation: "fadeIn 0.5s ease" }}>
            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, marginBottom: 20 }}>
              {[
                { label: "BMI", value: result.bmi, unit: "", color: bmiColor, sub: result.bmiCategory },
                { label: "BMR", value: result.bmr, unit: "kcal", color: COLORS.teal, sub: "Resting metabolic rate" },
                { label: "Daily Target", value: result.dailyCalorieTarget, unit: "kcal", color: COLORS.emerald, sub: `Goal: ${result.fitnessGoal}` },
                { label: "Protein", value: result.dailyProteinTarget, unit: "g", color: COLORS.protein, sub: "Daily target" },
                { label: "Carbs", value: result.dailyCarbTarget, unit: "g", color: COLORS.carbs, sub: "Daily target" },
                { label: "Fat", value: result.dailyFatTarget, unit: "g", color: COLORS.fat, sub: "Daily target" },
                { label: "Diet Type", value: result.dietType === "veg" ? "🥦 Veg" : "🍗 Non-Veg", unit: "", color: result.dietType === "veg" ? "#22c55e" : "#f97316", sub: result.dietType === "veg" ? "Vegetarian" : "Non-Vegetarian" },
              ].map(item => (
                <Card key={item.label} style={{ textAlign: "center", padding: 16 }}>
                  <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: item.color }}>{item.value}<span style={{ fontSize: 12, marginLeft: 2 }}>{item.unit}</span></div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>{item.sub}</div>
                </Card>
              ))}
            </div>
            <Button onClick={() => onSave(result)} size="lg" style={{ width: "100%" }}>Save Profile & Continue →</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export { ProfileSetup };
export default ProfileSetup;

