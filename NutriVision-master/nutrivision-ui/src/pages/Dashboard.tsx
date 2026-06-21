import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { useState, useEffect, useCallback } from "react";
import { COLORS, PIE_COLORS } from "../constants";
import { Card, ProgressBar, Badge, Spinner } from "../components";
import type { HealthProfile, Meal, User, DailyProgress, WeeklyProgressItem, Suggestion, BackendMeal } from "../types";
import { useAuth } from "../contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

const Dashboard = ({ profile, meals, user, liveProgress, weeklyProgress, onRefresh }:
  { profile: HealthProfile | null; meals: Meal[]; user: User;
    liveProgress: DailyProgress | null; weeklyProgress: WeeklyProgressItem[]; onRefresh: () => void }) => {
  const { token } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const today = new Date().toDateString();
  const todayMeals = meals.filter(m => new Date(m.detectedAt).toDateString() === today);

  const consumed = liveProgress?.consumed ?? { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 };
  const targets = liveProgress?.targets ?? { calories: 2000, protein_g: 50, carbs_g: 250, fats_g: 70 };
  const percentages = liveProgress?.percentages ?? { calories: 0, protein: 0, carbs: 0, fats: 0 };
  const healthScore = liveProgress?.health_score ?? null;
  const streakDays = liveProgress?.streak_days ?? null;
  const liveAlerts = liveProgress?.alerts || [];
  const backendMeals = liveProgress?.meals_today || [];

  const todayStats = {
    calories: consumed.calories ?? todayMeals.reduce((s, m) => s + m.totalCalories, 0),
    protein: consumed.protein_g ?? Math.round(todayMeals.reduce((s, m) => s + m.totalProtein, 0) * 10) / 10,
    carbs: consumed.carbs_g ?? Math.round(todayMeals.reduce((s, m) => s + m.totalCarbs, 0) * 10) / 10,
    fat: consumed.fats_g ?? Math.round(todayMeals.reduce((s, m) => s + m.totalFat, 0) * 10) / 10,
  };

  const calTarget = targets.calories ?? profile?.dailyCalorieTarget ?? 2000;
  const proTarget = targets.protein_g ?? profile?.dailyProteinTarget ?? 50;
  const carbTarget = targets.carbs_g ?? profile?.dailyCarbTarget ?? 250;
  const fatTarget = targets.fats_g ?? profile?.dailyFatTarget ?? 70;

  const weeklyData = weeklyProgress.length > 0
    ? weeklyProgress.map(d => ({
        day: new Date(d.date).toLocaleDateString("en", { weekday: "short" }),
        calories: d.consumed?.calories || 0,
        target: d.targets?.calories || calTarget,
      }))
    : Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        const ds = d.toDateString();
        const dm = meals.filter(m => new Date(m.detectedAt).toDateString() === ds);
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return {
          day: days[d.getDay()],
          calories: dm.reduce((s, m) => s + m.totalCalories, 0),
          target: calTarget,
        };
      });

  const macroData = [
    { name: "Protein", value: todayStats.protein, target: proTarget },
    { name: "Carbs", value: todayStats.carbs, target: carbTarget },
    { name: "Fat", value: todayStats.fat, target: fatTarget },
  ];

  const pieData = macroData.filter(m => m.value > 0).map(m => ({ name: m.name, value: m.value }));
  const pct = Math.min(100, Math.round((todayStats.calories / calTarget) * 100)) || 0;

  const bmiColor = !profile ? COLORS.emerald : profile.bmi < 18.5 ? "#60a5fa" : profile.bmi < 25 ? COLORS.emerald : profile.bmi < 30 ? "#f59e0b" : "#ef4444";

  const mealIcon: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎" };

  const [deficitReason, setDeficitReason] = useState("");

  const fetchSmartSuggestions = useCallback(async () => {
    if (!token || !user) return;
    setSuggestionsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/me/next-meal-recommendation`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggested_meals || []);
        setDeficitReason(data.deficit_reason || "Based on your remaining macros");
      }
    } catch {} finally {
      setSuggestionsLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    if (liveProgress) fetchSmartSuggestions();
  }, [liveProgress, fetchSmartSuggestions]);

  const renderRemainingMacros = () => {
    const rem = {
      calories: Math.max(0, calTarget - todayStats.calories),
      protein: Math.max(0, proTarget - todayStats.protein),
      carbs: Math.max(0, carbTarget - todayStats.carbs),
      fat: Math.max(0, fatTarget - todayStats.fat),
    };
    const labels = [
      { key: "protein", label: "Protein", value: rem.protein, target: proTarget, color: COLORS.protein },
      { key: "carbs", label: "Carbs", value: rem.carbs, target: carbTarget, color: COLORS.carbs },
      { key: "fat", label: "Fat", value: rem.fat, target: fatTarget, color: COLORS.fat },
    ].filter(m => m.target > 0);
    if (labels.every(m => m.value <= 0)) return null;
    return (
      <div style={{ marginBottom: 14, padding: "10px 14px", background: COLORS.surface, borderRadius: 10 }}>
        <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Remaining Macros</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {labels.map(m => {
            const pct = m.target > 0 ? Math.round((m.value / m.target) * 100) : 0;
            return (
              <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: COLORS.muted, minWidth: 50 }}>{m.label}</span>
                <div style={{ flex: 1, height: 6, background: COLORS.border, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: pct > 50 ? m.color : COLORS.muted, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, color: m.color, fontWeight: 600, minWidth: 40, textAlign: "right" }}>
                  {m.value}g
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const closeSuggestion = (idx: number) => {
    setSuggestions(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap'); * { box-sizing: border-box; }`}</style>

      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, color: COLORS.text, fontWeight: 800 }}>
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {user.name.split(" ")[0]} 👋
        </h2>
        <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Calories", value: todayStats.calories, unit: "kcal", color: COLORS.emerald, icon: "🔥", sub: `of ${calTarget} kcal` },
          { label: "Protein", value: todayStats.protein, unit: "g", color: COLORS.protein, icon: "💪", sub: `of ${proTarget}g` },
          { label: "Carbs", value: todayStats.carbs, unit: "g", color: COLORS.carbs, icon: "🌾", sub: `of ${carbTarget}g` },
          { label: "Fat", value: todayStats.fat, unit: "g", color: COLORS.fat, icon: "🫒", sub: `of ${fatTarget}g` },
          { label: "Meals Logged", value: backendMeals.length || todayMeals.length, unit: "", color: COLORS.teal, icon: "🍽️", sub: "Today" },
          ...(profile ? [{ label: "BMI", value: profile.bmi, unit: "", color: bmiColor, icon: "⚖️", sub: profile.bmiCategory }] : []),
          ...(healthScore !== null ? [{ label: "Health Score", value: healthScore, unit: "", color: healthScore >= 80 ? COLORS.emerald : healthScore >= 50 ? COLORS.carbs : COLORS.fat, icon: "❤️", sub: "Daily score" }] : []),
          ...(streakDays !== null ? [{ label: "Streak", value: streakDays, unit: "days", color: COLORS.teal, icon: "🔥", sub: "Logging streak" }] : []),
        ].map(stat => (
          <Card key={stat.label} style={{ position: "relative", overflow: "hidden", padding: 18 }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{stat.icon}</div>
            <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1 }}>{stat.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: stat.color, marginTop: 2 }}>
              {stat.value}<span style={{ fontSize: 12, marginLeft: 2, fontWeight: 600 }}>{stat.unit}</span>
            </div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{stat.sub}</div>
            <div style={{ position: "absolute", top: 0, right: 0, width: 54, height: 54, background: `${stat.color}11`, borderRadius: "0 0 0 54px" }} />
          </Card>
        ))}
      </div>

      {liveAlerts.length > 0 && (
        <Card style={{ marginBottom: 24, border: `1px solid ${COLORS.carbs}44`, background: `${COLORS.carbs}08` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 4 }}>
            {liveAlerts.map((alert, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: alert.includes("deficit") || alert.includes("exceeded") ? "#fbbf24" : COLORS.text }}>
                <span>{alert.includes("deficit") || alert.includes("exceeded") ? "⚠️" : alert.includes("Great") ? "✅" : "ℹ️"}</span>
                <span>{alert}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ color: COLORS.text, fontWeight: 700 }}>Daily Calorie Progress</h3>
          <span style={{ color: COLORS.emerald, fontWeight: 800, fontSize: 18 }}>{pct}%</span>
        </div>
        <ProgressBar value={todayStats.calories} max={calTarget} color={pct > 100 ? COLORS.fat : pct > 80 ? COLORS.carbs : COLORS.emerald} height={14} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontSize: 13, color: COLORS.muted }}>{todayStats.calories} consumed</span>
          <span style={{ fontSize: 13, color: COLORS.muted }}>{Math.max(0, calTarget - todayStats.calories)} remaining</span>
          <span style={{ fontSize: 13, color: COLORS.muted }}>{calTarget} target</span>
        </div>
        <div style={{ marginTop: 14, padding: 12, background: COLORS.surface, borderRadius: 10, borderLeft: `3px solid ${pct > 100 ? COLORS.fat : COLORS.emerald}` }}>
          <p style={{ color: COLORS.text, fontSize: 14 }}>
            {pct > 100
              ? `⚠️ You've exceeded your daily target by ${todayStats.calories - calTarget} kcal.`
              : pct === 0
                ? `🌅 You haven't logged any meals yet today. Your target is ${calTarget} kcal.`
                : `✅ You have consumed ${pct}% of your daily calorie requirement. You need ${calTarget - todayStats.calories} calories more today.`}
          </p>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card>
          <h3 style={{ color: COLORS.text, fontWeight: 700, marginBottom: 4 }}>Macro Distribution</h3>
          <p style={{ color: COLORS.muted, fontSize: 12, marginBottom: 12 }}>
            Today: P {todayStats.protein}g · C {todayStats.carbs}g · F {todayStats.fat}g
          </p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % 3]} />)}
                </Pie>
                <Tooltip
                  formatter={(v, name) => [`${v}g`, name]}
                  contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text }}
                />
                <Legend formatter={(v) => <span style={{ color: COLORS.muted, fontSize: 12 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <div style={{ fontSize: 32 }}>🥧</div>
              <p style={{ color: COLORS.muted, fontSize: 13, textAlign: "center" }}>Log a meal to see your macro breakdown</p>
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                {[
                  { label: "Protein", target: proTarget, color: COLORS.protein },
                  { label: "Carbs", target: carbTarget, color: COLORS.carbs },
                  { label: "Fat", target: fatTarget, color: COLORS.fat },
                ].map(m => (
                  <div key={m.label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: m.color }}>{m.target}g</div>
                    <div style={{ fontSize: 10, color: COLORS.muted }}>{m.label} target</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h3 style={{ color: COLORS.text, fontWeight: 700, marginBottom: 4 }}>Macro Progress</h3>
          <p style={{ color: COLORS.muted, fontSize: 12, marginBottom: 14 }}>vs daily targets</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { name: "Protein", value: todayStats.protein, target: proTarget, color: COLORS.protein },
              { name: "Carbs", value: todayStats.carbs, target: carbTarget, color: COLORS.carbs },
              { name: "Fat", value: todayStats.fat, target: fatTarget, color: COLORS.fat },
            ].map((m, i) => {
              const pctMacro = Math.min(100, Math.round((m.value / m.target) * 100));
              return (
                <div key={m.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ color: m.color, fontSize: 13, fontWeight: 700 }}>{m.value}g</span>
                      <span style={{ color: COLORS.muted, fontSize: 12 }}> / {m.target}g</span>
                      <span style={{ color: COLORS.muted, fontSize: 11, marginLeft: 6 }}>({pctMacro}%)</span>
                    </div>
                  </div>
                  <ProgressBar value={m.value} max={m.target} color={m.color} height={7} />
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card style={{ marginBottom: 24, background: `linear-gradient(135deg, ${COLORS.emeraldDark}18, ${COLORS.teal}10)`, border: `1px solid ${COLORS.emerald}44` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ color: COLORS.text, fontWeight: 700 }}>🧠 AI Meal Suggestions</h3>
          <span style={{ fontSize: 11, color: COLORS.muted }}>Smart deficit analysis</span>
        </div>

        {deficitReason && deficitReason !== "Balanced" && (
          <div style={{
            padding: "10px 16px", background: `${COLORS.carbs}18`,
            border: `1px solid ${COLORS.carbs}44`, borderRadius: 10, marginBottom: 14,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>⚡</span>
            <span style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{deficitReason}</span>
          </div>
        )}

        {renderRemainingMacros && renderRemainingMacros()}

        {suggestions.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {suggestions.map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: COLORS.card, borderRadius: 12, border: `1px solid ${COLORS.border}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: COLORS.emerald, fontWeight: 700 }}>{s.food}</span>
                    {s.match_score && (
                      <span style={{ fontSize: 11, background: `${COLORS.emerald}22`, color: COLORS.emerald, padding: "1px 8px", borderRadius: 10 }}>{s.match_score}%</span>
                    )}
                  </div>
                  <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>{s.explanation}</div>
                  {s.reasoning_trace && (
                    <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: COLORS.muted }}>
                      {s.reasoning_trace.regional_match && <span>🌍 {s.reasoning_trace.regional_match}</span>}
                      {s.reasoning_trace.cuisine && <span>🍳 {s.reasoning_trace.cuisine}</span>}
                      {s.reasoning_trace.vegetarian_safe !== undefined && (
                        <span>{s.reasoning_trace.vegetarian_safe ? "🥦 Veg" : "🍗 Non-Veg"}</span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right", marginLeft: 12 }}>
                  <div style={{ color: COLORS.emerald, fontWeight: 800 }}>{s.calories} kcal</div>
                  <div style={{ color: COLORS.muted, fontSize: 11 }}>P:{s.protein}g · C:{s.carbs}g · F:{s.fat}g</div>
                </div>
                <button onClick={() => closeSuggestion(i)} style={{ background: "transparent", border: "none", color: COLORS.muted, cursor: "pointer", fontSize: 16, marginLeft: 8, padding: "4px 8px" }}>✕</button>
              </div>
            ))}
          </div>
        ) : suggestionsLoading ? (
          <div style={{ textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 14, color: COLORS.muted }}>🧠 Analyzing your macros...</div>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 14, color: COLORS.muted }}>Log a meal to get personalized suggestions</div>
          </div>
        )}
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <h3 style={{ color: COLORS.text, fontWeight: 700, marginBottom: 16 }}>Weekly Calorie Trend</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weeklyData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
            <XAxis dataKey="day" tick={{ fill: COLORS.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text }} />
            <Bar dataKey="calories" fill={COLORS.emerald} radius={[4, 4, 0, 0]} name="Calories" />
            <Bar dataKey="target" fill={`${COLORS.teal}44`} radius={[4, 4, 0, 0]} name="Target" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <h3 style={{ color: COLORS.text, fontWeight: 700, marginBottom: 16 }}>Recent Meals</h3>
        {(() => {
          const displayMeals = backendMeals.length > 0 ? backendMeals : todayMeals.slice(0, 5);
          if (displayMeals.length === 0) {
            return (
              <div style={{ textAlign: "center", padding: 32, color: COLORS.muted }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🍽️</div>
                <p>No meals logged today. Use the Food Scanner to add your first meal!</p>
              </div>
            );
          }
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {displayMeals.map((meal: BackendMeal, i: number) => {
                const isBackend = backendMeals.length > 0;
                const items = isBackend ? (meal.detected_items || "").split(", ") : (meal.foodItems || []).map(f => f.name);
                const cals = isBackend ? (meal.total_calories || meal.totalCalories) : meal.totalCalories;
                const prot = isBackend ? (meal.total_protein_g || meal.totalProtein) : meal.totalProtein;
                const carbs = isBackend ? (meal.total_carbs_g || meal.totalCarbs) : meal.totalCarbs;
                const fats = isBackend ? (meal.total_fats_g || meal.totalFat) : meal.totalFat;
                const mealTime_label = meal.meal_time || meal.mealType || "Meal";
                return (
                  <div key={isBackend ? meal.id || i : meal._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 24 }}>{mealIcon[mealTime_label] || "🍽️"}</span>
                      <div>
                        <div style={{ color: COLORS.text, fontWeight: 600, textTransform: "capitalize" }}>{mealTime_label}</div>
                        <div style={{ color: COLORS.muted, fontSize: 12 }}>{(Array.isArray(items) ? items : []).filter(Boolean).join(", ")}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: COLORS.emerald, fontWeight: 800 }}>{cals} kcal</div>
                      <div style={{ color: COLORS.muted, fontSize: 11 }}>P:{prot}g C:{carbs}g F:{fats}g</div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </Card>
    </div>
  );
};

export default Dashboard;
