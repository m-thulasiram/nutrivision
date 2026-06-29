import { useState, useEffect } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { api } from "../api";
import { COLORS, PIE_COLORS } from "../constants";
import { Card, ProgressBar } from "./ui";
import { AISuggestions } from "./AISuggestions";
import { PullToRefresh } from "./PullToRefresh";
import type { HealthProfile, Meal, User } from "../types";

interface DailyProgress {
  consumed: { calories: number; protein_g: number; carbs_g: number; fats_g: number };
  targets: { calories: number; protein_g: number; carbs_g: number; fats_g: number };
}
interface WeeklyEntry {
  date: string;
  consumed: { calories: number; protein_g: number; carbs_g: number; fats_g: number };
  targets: { calories: number; protein_g: number; carbs_g: number; fats_g: number };
}

const Dashboard = ({ profile, meals, user, userId }: { profile: HealthProfile | null; meals: Meal[]; user: User; userId?: number }) => {
  const [progress, setProgress] = useState<DailyProgress | null>(null);
  const [weeklyProgress, setWeeklyProgress] = useState<WeeklyEntry[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProgress = async () => {
    setFetchError(null);
    setIsLoading(true);
    let loaded = 0;
    const done = () => { loaded++; if (loaded >= 2) setIsLoading(false); };
    api.getDailyProgress()
      .then(r => { setProgress(r.progress as DailyProgress); done(); })
      .catch((err: Error) => { setFetchError(err.message || "Failed to load today's data"); done(); });
    api.getWeeklyProgress()
      .then(r => { setWeeklyProgress(r.weekly_progress as WeeklyEntry[]); done(); })
      .catch((err: Error) => { setFetchError(err.message || "Failed to load weekly data"); done(); });
  };

  useEffect(() => { fetchProgress(); }, []);

  const today = new Date().toDateString();
  const todayMeals = meals.filter(m => new Date(m.detectedAt).toDateString() === today);
  const todayStats = progress ? {
    calories: progress.consumed.calories,
    protein: progress.consumed.protein_g,
    carbs: progress.consumed.carbs_g,
    fat: progress.consumed.fats_g,
  } : {
    calories: todayMeals.reduce((s, m) => s + m.totalCalories, 0),
    protein: Math.round(todayMeals.reduce((s, m) => s + m.totalProtein, 0) * 10) / 10,
    carbs: Math.round(todayMeals.reduce((s, m) => s + m.totalCarbs, 0) * 10) / 10,
    fat: Math.round(todayMeals.reduce((s, m) => s + m.totalFat, 0) * 10) / 10,
  };

  const weeklyData = weeklyProgress ? weeklyProgress.map((wp) => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const d = new Date(wp.date + "T00:00:00");
    return {
      day: days[d.getDay()],
      calories: wp.consumed.calories,
      target: wp.targets.calories,
    };
  }) : Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const ds = d.toDateString();
    const dm = meals.filter(m => new Date(m.detectedAt).toDateString() === ds);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return {
      day: days[d.getDay()],
      calories: dm.reduce((s, m) => s + m.totalCalories, 0),
      target: profile?.dailyCalorieTarget || 2000,
    };
  });

  const macroData = profile ? [
    { name: "Protein", value: todayStats.protein, target: profile.dailyProteinTarget },
    { name: "Carbs", value: todayStats.carbs, target: profile.dailyCarbTarget },
    { name: "Fat", value: todayStats.fat, target: profile.dailyFatTarget },
  ] : [];

  const pieData = macroData.filter(m => m.value > 0).map(m => ({ name: m.name, value: m.value }));
  const pct = profile ? Math.min(100, Math.round((todayStats.calories / profile.dailyCalorieTarget) * 100)) : 0;

  const bmiColor = !profile ? COLORS.emerald : profile.bmi < 18.5 ? "#60a5fa" : profile.bmi < 25 ? COLORS.emerald : profile.bmi < 30 ? "#f59e0b" : "#ef4444";

  const mealIcon: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎" };

  if (isLoading) {
    return (
      <div role="status" aria-label="Loading your nutrition data" style={{ padding: "20px 0" }}>
        <style>{`@keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }`}</style>
        <div style={{ width: 160, height: 160, borderRadius: "50%", margin: "0 auto 24px",
          background: "linear-gradient(90deg, #1a2a22 25%, #23332b 50%, #1a2a22 75%)",
          backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
        {[1,2,3].map(i => (
          <div key={i} style={{ height: 64, borderRadius: 12, marginBottom: 12,
            background: "linear-gradient(90deg, #1a2a22 25%, #23332b 50%, #1a2a22 75%)",
            backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
        ))}
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={fetchProgress}>
      {fetchError && (
        <div style={{ background: "#f59e0b18", border: "1px solid #f59e0b44", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
          <p style={{ color: "#f59e0b", fontSize: 13, fontWeight: 600 }}>⚠️ {fetchError}</p>
        </div>
      )}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .macro-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16; }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(148px, 1fr)); gap: 14; }
        .suggest-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12; }
        .dash-heading { font-size: 24px; }

        @media (max-width: 640px) {
          .macro-grid { grid-template-columns: 1fr !important; }
          .stat-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10 !important; }
          .suggest-grid { grid-template-columns: 1fr !important; }
          .dash-heading { font-size: 20px !important; }
        }
        @media (max-width: 400px) {
          .stat-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8 !important; }
        }
      `}</style>

      <div style={{ marginBottom: 24 }}>
        <h2 className="dash-heading" style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, color: COLORS.text, fontWeight: 800 }}>
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {user.name.split(" ")[0]} 👋
        </h2>
        <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {[
          { label: "Calories", value: todayStats.calories, unit: "kcal", color: COLORS.emerald, icon: "🔥", sub: profile ? `of ${profile.dailyCalorieTarget} kcal` : "No target set" },
          { label: "Protein", value: todayStats.protein, unit: "g", color: COLORS.protein, icon: "💪", sub: profile ? `of ${profile.dailyProteinTarget}g` : "—" },
          { label: "Carbs", value: todayStats.carbs, unit: "g", color: COLORS.carbs, icon: "🌾", sub: profile ? `of ${profile.dailyCarbTarget}g` : "—" },
          { label: "Fat", value: todayStats.fat, unit: "g", color: COLORS.fat, icon: "🫒", sub: profile ? `of ${profile.dailyFatTarget}g` : "—" },
          { label: "Meals Logged", value: todayMeals.length, unit: "", color: COLORS.teal, icon: "🍽️", sub: "Today" },
          ...(profile ? [{ label: "BMI", value: profile.bmi, unit: "", color: bmiColor, icon: "⚖️", sub: profile.bmiCategory }] : []),
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

      {profile && (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ color: COLORS.text, fontWeight: 700 }}>Daily Calorie Progress</h3>
            <span style={{ color: COLORS.emerald, fontWeight: 800, fontSize: 18 }}>{pct}%</span>
          </div>
          <ProgressBar value={todayStats.calories} max={profile.dailyCalorieTarget} color={pct > 100 ? COLORS.fat : pct > 80 ? COLORS.carbs : COLORS.emerald} height={14} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 13, color: COLORS.muted }}>{todayStats.calories} consumed</span>
            <span style={{ fontSize: 13, color: COLORS.muted }}>{Math.max(0, profile.dailyCalorieTarget - todayStats.calories)} remaining</span>
            <span style={{ fontSize: 13, color: COLORS.muted }}>{profile.dailyCalorieTarget} target</span>
          </div>

          <div style={{ marginTop: 14, padding: 12, background: COLORS.surface, borderRadius: 10, borderLeft: `3px solid ${pct > 100 ? COLORS.fat : COLORS.emerald}` }}>
            <p style={{ color: COLORS.text, fontSize: 14 }}>
              {pct > 100
                ? `⚠️ You've exceeded your daily target by ${todayStats.calories - profile.dailyCalorieTarget} kcal.`
                : pct === 0
                  ? `🌅 You haven't logged any meals yet today. Your target is ${profile.dailyCalorieTarget} kcal.`
                  : `✅ You have consumed ${pct}% of your daily calorie requirement. You need ${profile.dailyCalorieTarget - todayStats.calories} calories more today.`}
            </p>
          </div>
        </Card>
      )}

      {profile && todayStats.calories < profile.dailyCalorieTarget && (
        <AISuggestions
          remainingCals={profile.dailyCalorieTarget - todayStats.calories}
          remainingProtein={Math.max(0, profile.dailyProteinTarget - todayStats.protein)}
          userId={userId}
        />
      )}

      {profile && (
        <div className="macro-grid" style={{ marginBottom: 24 }}>
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
                    formatter={(v: number | undefined) => [`${v ?? 0}g`, undefined]}
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
                    { label: "Protein", target: profile.dailyProteinTarget, color: COLORS.protein },
                    { label: "Carbs", target: profile.dailyCarbTarget, color: COLORS.carbs },
                    { label: "Fat", target: profile.dailyFatTarget, color: COLORS.fat },
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
                { name: "Protein", value: todayStats.protein, target: profile.dailyProteinTarget, color: COLORS.protein },
                { name: "Carbs", value: todayStats.carbs, target: profile.dailyCarbTarget, color: COLORS.carbs },
                { name: "Fat", value: todayStats.fat, target: profile.dailyFatTarget, color: COLORS.fat },
              ].map((m) => {
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
      )}

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
        {todayMeals.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: COLORS.muted }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🍽️</div>
            <p>No meals logged today. Use the Food Scanner to add your first meal!</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {todayMeals.slice(0, 5).map((meal) => (
              <div key={meal._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 24 }}>{mealIcon[meal.mealType] || "🍽️"}</span>
                  <div>
                    <div style={{ color: COLORS.text, fontWeight: 600, textTransform: "capitalize" }}>{meal.mealType}</div>
                    <div style={{ color: COLORS.muted, fontSize: 12 }}>{meal.foodItems.map(f => f.name).join(", ")}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: COLORS.emerald, fontWeight: 800 }}>{meal.totalCalories} kcal</div>
                  <div style={{ color: COLORS.muted, fontSize: 11 }}>{new Date(meal.detectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PullToRefresh>
  );
};

export { Dashboard };
export default Dashboard;
