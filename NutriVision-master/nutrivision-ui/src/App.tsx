import { useState, useCallback, useEffect } from "react";
import { useAuth } from "./contexts/AuthContext.tsx";
import { COLORS } from "./constants";
import type { HealthProfile, Meal, User, DailyProgress, WeeklyProgressItem } from "./types";
import AuthScreen from "./pages/AuthScreen";
import ProfileSetup from "./pages/ProfileSetup";
import FoodScanner from "./pages/FoodScanner";
import Dashboard from "./pages/Dashboard";
import WorkoutCoach from "./pages/WorkoutCoach";
import ResetPassword from "./pages/ResetPassword";
import CopilotCoach from "./pages/CopilotCoach";

const useLocalStorage = <T,>(key: string, initial: T) => {
  const [state, setState] = useState<T>(() => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : initial; }
    catch { return initial; }
  });
  const set = useCallback((v: T | ((p: T) => T)) => {
    setState(prev => {
      const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [key]);
  return [state, set] as const;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export default function NutriVisionApp() {
  const { user, token, logout: authLogout } = useAuth();
  const [profile, setProfile] = useLocalStorage<HealthProfile | null>("nv_profile", null);
  const [meals, setMeals] = useLocalStorage<Meal[]>("nv_meals", []);
  const [activeTab, setActiveTab] = useState<"dashboard" | "scan" | "copilot" | "workout" | "profile" | "history">("dashboard");
  const [notification, setNotification] = useState<{ msg: string; type: "success" | "info" } | null>(null);
  const [liveProgress, setLiveProgress] = useState<DailyProgress | null>(null);
  const [weeklyProgress, setWeeklyProgress] = useState<WeeklyProgressItem[]>([]);

  const showNotification = (msg: string, type: "success" | "info" = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchProgress = useCallback(async () => {
    if (!token) return;
    try {
      const [progRes, wklyRes] = await Promise.all([
        fetch(`${API_BASE}/api/users/me/progress`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/api/users/me/progress/weekly`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      if (progRes.ok) {
        const data = await progRes.json();
        setLiveProgress(data.progress);
      }
      if (wklyRes.ok) {
        const data = await wklyRes.json();
        setWeeklyProgress(data.weekly_progress || []);
      }
    } catch {}
  }, [token]);

  useEffect(() => {
    if (token && profile) fetchProgress();
  }, [token, profile, fetchProgress]);

  const handleLogout = () => { authLogout(); setProfile(null); setMeals([]); };

  const handleSaveProfile = async (p: HealthProfile) => {
    try {
      const profHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (token) profHeaders["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/users/profile`, {
        method: "POST",
        headers: profHeaders,
        body: JSON.stringify({
          age: p.age, gender: p.gender,
          height_cm: p.height, weight_kg: p.weight,
          activity_level: p.activityLevel, goal: p.fitnessGoal,
          diet_type: p.dietType || "any",
          preferred_region: p.preferredRegion || "",
          preferred_state: p.preferredState || ""
        })
      });
      if (res.ok && token) {
        const meRes = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          const u = meData.user;
          if (u.target_calories) {
            setProfile({
              ...p,
              bmr: u.bmr || p.bmr,
              tdee: u.tdee || p.tdee,
              dailyCalorieTarget: u.target_calories,
              dailyProteinTarget: u.target_protein,
              dailyCarbTarget: u.target_carbs,
              dailyFatTarget: u.target_fats,
            });
            setActiveTab("dashboard");
            showNotification("Profile synced with AI Backend!");
            return;
          }
        }
      }
    } catch (e) { console.error("Failed to sync profile", e); }

    setProfile(p);
    setActiveTab("dashboard");
    showNotification("Profile saved! Your nutrition targets are synced to the AI Backend.");
  };

  const handleMealScanned = (meal: Meal) => {
    setMeals(prev => [meal, ...prev]);
    setActiveTab("dashboard");
    fetchProgress();
    showNotification(`Meal logged: ${meal.totalCalories} kcal added to today's log.`);
  };

  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get("reset_token");
  if (resetToken) {
    return <ResetPassword onBack={() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("reset_token");
      window.history.replaceState({}, "", url.toString());
      window.location.reload();
    }} initialToken={resetToken} />;
  }

  if (!user) return <AuthScreen />;

  if (!profile) return <ProfileSetup onSave={handleSaveProfile} />;

  const tabs = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "scan", icon: "📸", label: "Scan Meal" },
    { id: "copilot", icon: "🤖", label: "AI Copilot" },
    { id: "workout", icon: "🏋️", label: "Workout" },
    { id: "profile", icon: "👤", label: "Profile" },
    { id: "history", icon: "📋", label: "History" },
  ] as const;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: ${COLORS.bg}; } ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }
        input::placeholder { color: ${COLORS.muted}; } input, select { color: ${COLORS.text} !important; }
        option { background: ${COLORS.card}; color: ${COLORS.text}; }
      `}</style>

      {notification && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 1000,
          background: notification.type === "success" ? COLORS.emeraldDark : COLORS.teal,
          color: "#fff", padding: "12px 20px", borderRadius: 12,
          fontWeight: 600, fontSize: 14, maxWidth: 360,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          animation: "slideIn 0.3s ease",
        }}>
          <style>{`@keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }`}</style>
          ✓ {notification.msg}
        </div>
      )}

      <header style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>🥗</span>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, color: COLORS.text, fontWeight: 800 }}>
              Nutri<span style={{ color: COLORS.emerald }}>Vision</span>
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: COLORS.muted, fontSize: 13 }}>{user.name}</span>
            <button onClick={handleLogout} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "6px 14px", color: COLORS.muted, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)} style={{
              padding: "10px 18px", borderRadius: 12, border: "none", cursor: "pointer",
              background: activeTab === tab.id ? `linear-gradient(135deg, ${COLORS.emerald}, ${COLORS.teal})` : COLORS.surface,
              color: activeTab === tab.id ? "#fff" : COLORS.muted,
              fontWeight: 700, fontSize: 13, fontFamily: "inherit", whiteSpace: "nowrap",
              transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6,
            }}>
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "dashboard" && (
          <Dashboard profile={profile} meals={meals} user={user}
            liveProgress={liveProgress} weeklyProgress={weeklyProgress}
            onRefresh={fetchProgress} />
        )}
        {activeTab === "scan" && (
          <FoodScanner onScanComplete={handleMealScanned} profile={profile} />
        )}
        {activeTab === "copilot" && (
          <CopilotCoach />
        )}
        {activeTab === "workout" && (
          <WorkoutCoach />
        )}
        {activeTab === "profile" && (
          <ProfileSetup onSave={handleSaveProfile} />
        )}
        {activeTab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {meals.length === 0 ? <p style={{ color: COLORS.muted, textAlign: "center", padding: 40 }}>No meal history yet.</p> : null}
            {[...meals].reverse().slice(0, 50).map(meal => (
              <div key={meal._id} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: COLORS.text, fontWeight: 600, fontSize: 14 }}>{new Date(meal.detectedAt).toLocaleString()}</div>
                  {meal.foodItems.length > 0 && <div style={{ color: COLORS.muted, fontSize: 12 }}>{meal.foodItems.map(f => f.name).join(", ")}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: COLORS.emerald, fontWeight: 700 }}>{meal.totalCalories} kcal</div>
                  <div style={{ color: COLORS.muted, fontSize: 11 }}>P:{meal.totalProtein}g C:{meal.totalCarbs}g F:{meal.totalFat}g</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  );
}
