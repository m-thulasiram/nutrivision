import { useState, useEffect, lazy, Suspense } from "react";
import { api } from "./api";
import { COLORS } from "./constants";
import { db } from "./db";
import { AuthScreen } from "./components/AuthScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { OfflineBanner } from "./components/OfflineBanner";
import { Badge, Button, Card } from "./components/ui";
import type { User, HealthProfile, Meal } from "./types";

const Dashboard = lazy(() => import("./components/Dashboard"));
const FoodScanner = lazy(() => import("./components/FoodScanner"));
const ProfileSetup = lazy(() => import("./components/ProfileSetup"));

const useLocalStorage = <T,>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] => {
  const [state, setState] = useState<T>(() => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : initial; }
    catch { return initial; }
  });
  const set = (v: T | ((p: T) => T)) => {
    setState(prev => {
      const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  };
  return [state, set];
};

const TabLoader = () => (
  <div role="status" aria-label="Loading content" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
    <div style={{ width: 24, height: 24, border: `2px solid ${COLORS.border}`, borderTopColor: COLORS.emerald, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
  </div>
);

export default function NutriVisionApp() {
  const [user, setUser] = useLocalStorage<User | null>("nv_user", null);
  const [storedToken, setToken] = useLocalStorage<string | null>("nv_token", null);
  const [profile, setProfile] = useLocalStorage<HealthProfile | null>("nv_profile", null);
  const [meals, setMeals] = useLocalStorage<Meal[]>("nv_meals", []);
  const [activeTab, setActiveTab] = useState<"dashboard" | "scan" | "profile" | "history">("dashboard");
  const [notification, setNotification] = useState<{ msg: string; type: "success" | "info" } | null>(null);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (storedToken) api.setToken(storedToken);
  }, [storedToken]);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === "update") setUpdateReady(true);
    };
    window.addEventListener("sw-update" as string, handler);
    return () => window.removeEventListener("sw-update" as string, handler);
  }, []);

  const showNotification = (msg: string, type: "success" | "info" = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleAuth = (u: User, t: string) => {
    setUser(u); setToken(t);
    api.setToken(t);
    api.getMyProfile().then(res => {
      const p = res.user;
      const hM = (p.height_cm || 175) / 100;
      const bmi = Math.round((p.weight_kg || 70) / (hM * hM) * 10) / 10;
      setProfile({
        age: p.age || 30,
        gender: p.gender || "male",
        height: p.height_cm || 175,
        weight: p.weight_kg || 70,
        activityLevel: p.activity_level || "moderate",
        fitnessGoal: p.goal === "muscle_gain" ? "gain" : p.goal === "weight_loss" ? "lose" : "maintain",
        dietType: (p.diet_type === "veg" ? "veg" : "nonveg") as "veg" | "nonveg",
        bmi,
        bmiCategory: bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese",
        bmr: p.bmr || 0,
        tdee: p.tdee || 0,
        dailyCalorieTarget: p.target_calories || 2000,
        dailyProteinTarget: p.target_protein || 50,
        dailyCarbTarget: p.target_carbs || 250,
        dailyFatTarget: p.target_fats || 70,
        region: p.preferred_region || undefined,
        state: p.preferred_state || undefined,
      });
      setActiveTab("dashboard");
    }).catch(() => {
      if (!profile) setActiveTab("profile");
    });
  };

  const handleLogout = () => {
    api.logout().catch(() => { /* server cleanup optional */ });
    api.setToken(null);
    setUser(null); setToken(null); setProfile(null); setMeals([]);
  };

  const handleSaveProfile = async (p: HealthProfile) => {
    setProfile(p);
    try {
      await api.updateProfile({
        name: user?.name || "User",
        age: p.age,
        gender: p.gender,
        height_cm: p.height,
        weight_kg: p.weight,
        activity_level: p.activityLevel,
        goal: p.fitnessGoal === "gain" ? "muscle_gain" : p.fitnessGoal === "lose" ? "weight_loss" : "maintain",
        diet_type: p.dietType,
        preferred_region: p.region || undefined,
        preferred_state: p.state || undefined,
      });
    } catch { showNotification("Profile saved locally (server sync pending)", "info"); }
    setActiveTab("dashboard");
    showNotification("Profile saved! Your nutrition targets are ready.");
  };

  const handleMealScanned = async (meal: Meal) => {
    setMeals(prev => [meal, ...prev]);
    db.saveMeal(meal).catch(() => { console.warn("Offline save failed"); });
    try {
      await api.logMeal({
        meal_time: meal.mealType,
        detected_items: meal.foodItems.map(f => f.name).join(", "),
        total_calories: meal.totalCalories,
        total_protein: meal.totalProtein,
        total_carbs: meal.totalCarbs,
        total_fats: meal.totalFat,
      });
    } catch { showNotification("Meal saved offline (will sync later)", "info"); }
    setActiveTab("dashboard");
    showNotification(`Meal logged: ${meal.totalCalories} kcal added to today's log.`);
  };

  if (!user) return <AuthScreen onAuth={handleAuth} />;

  const tabs = [
    { id: "dashboard" as const, icon: "📊", label: "Dashboard" },
    { id: "scan" as const, icon: "📸", label: "Scan Meal" },
    { id: "profile" as const, icon: "👤", label: "Profile" },
    { id: "history" as const, icon: "📋", label: "History" },
  ];

  const userId = user._id ? Number(user._id.replace('demo_user', '0').replace(/\D/g, '')) || undefined : undefined;

  return (
    <ErrorBoundary>
    <OfflineBanner />
    <div style={{ height: "100dvh", background: COLORS.bg, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; }
        html, body, #root { height: 100dvh; overflow: hidden; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 2px; }
        input::placeholder { color: ${COLORS.muted}; } input, select { color: ${COLORS.text} !important; }
        option { background: ${COLORS.card}; color: ${COLORS.text}; }
        .header-badge { display: inline-flex; }
        .notif-toast { right: 20px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }

        @media (max-width: 640px) {
          .header-badge { display: none !important; }
          .notif-toast { left: 12px; right: 12px; max-width: none; top: 12px; font-size: 13px !important; padding: 10px 16px !important; }
          .header-content { padding: 0 12px !important; height: 56px !important; }
          .page-heading { font-size: 18px !important; margin-bottom: 16px !important; }
          .history-macros { gap: 4px; }
          .history-macros span { font-size: 10px !important; }
          .card-mobile { padding: 14px !important; }
          .empty-card { padding: 32px 20px !important; }
          .empty-card-icon { font-size: 40px !important; }
        }
      `}</style>

      {notification && (
        <div role="status" aria-live="polite" className="notif-toast" style={{
          position: "fixed", top: 20, zIndex: 1000,
          background: notification.type === "success" ? COLORS.emeraldDark : COLORS.teal,
          color: "#fff", padding: "12px 20px", borderRadius: 12,
          fontWeight: 600, fontSize: 14,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          animation: "slideIn 0.3s ease",
        }}>
          ✓ {notification.msg}
        </div>
      )}

      {updateReady && (
        <div style={{
          position: "fixed", bottom: 100, left: 16, right: 16, zIndex: 1000,
          background: COLORS.card, border: `1px solid ${COLORS.emerald}`,
          borderRadius: 14, padding: "14px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          <div>
            <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 14 }}>✨ Update Available</div>
            <div style={{ color: COLORS.muted, fontSize: 12 }}>A new version is ready</div>
          </div>
          <button onClick={() => { window.dispatchEvent(new CustomEvent('pwa-activate-update')); }}
            style={{
              background: COLORS.emerald, border: "none", borderRadius: 8,
              padding: "8px 18px", color: "#fff", fontWeight: 700,
              fontSize: 13, cursor: "pointer", fontFamily: "inherit",
            }}>
            Update
          </button>
        </div>
      )}

      <a href="#main-content" style={{ position: "absolute", left: "-9999px", top: 0, zIndex: 9999, background: COLORS.emerald, color: "#fff", padding: "8px 16px", fontSize: 14, fontWeight: 600, textDecoration: "none" }}
        onFocus={e => { e.currentTarget.style.left = "0"; }}
        onBlur={e => { e.currentTarget.style.left = "-9999px"; }}>
        Skip to main content
      </a>
      <header style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}` }}>
        <div className="header-content" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 28, flexShrink: 0 }}>🥗</span>
            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: COLORS.text, whiteSpace: "nowrap" }}>
              Nutri<span style={{ color: COLORS.emerald }}>Vision</span>
            </span>
            {profile && <Badge className="header-badge">{profile.fitnessGoal === "lose" ? "🔥 Weight Loss" : profile.fitnessGoal === "gain" ? "💪 Muscle Gain" : "⚖️ Maintenance"}</Badge>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <span style={{ color: COLORS.muted, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{user.name}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>Sign Out</Button>
          </div>
        </div>
      </header>

      <main id="main-content" role="main" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch", maxWidth: 1100, margin: "0 auto", width: "100%", padding: "24px 24px 92px" }}>
        <Suspense fallback={<TabLoader />}>
          {activeTab === "dashboard" && (
            <ErrorBoundary fallback={<div style={{ padding: "2rem", textAlign: "center", color: COLORS.muted }}>Dashboard failed to load. <button onClick={() => window.location.reload()} style={{ color: COLORS.emerald, cursor: "pointer", background: "none", border: "none", fontFamily: "inherit", fontWeight: 600 }}>Reload</button></div>}>
              <Dashboard profile={profile} meals={meals} user={user} userId={userId} />
            </ErrorBoundary>
          )}
          {activeTab === "scan" && (
            <div style={{ maxWidth: 700, margin: "0 auto" }}>
              <h2 className="page-heading" style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, color: COLORS.text, fontWeight: 800, marginBottom: 24 }}>AI Food Scanner</h2>
              <ErrorBoundary fallback={<div style={{ padding: "2rem", textAlign: "center", color: COLORS.muted }}>Scanner failed to load. <button onClick={() => window.location.reload()} style={{ color: COLORS.emerald, cursor: "pointer", background: "none", border: "none", fontFamily: "inherit", fontWeight: 600 }}>Reload</button></div>}>
                <FoodScanner onScanComplete={handleMealScanned} profile={profile} />
              </ErrorBoundary>
            </div>
          )}
          {activeTab === "profile" && (
            <div style={{ maxWidth: 800, margin: "0 auto" }}>
              <ErrorBoundary fallback={<div style={{ padding: "2rem", textAlign: "center", color: COLORS.muted }}>Profile failed to load. <button onClick={() => window.location.reload()} style={{ color: COLORS.emerald, cursor: "pointer", background: "none", border: "none", fontFamily: "inherit", fontWeight: 600 }}>Reload</button></div>}>
                <ProfileSetup onSave={handleSaveProfile} />
              </ErrorBoundary>
            </div>
          )}
          {activeTab === "history" && (
            <div>
              <h2 className="page-heading" style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, color: COLORS.text, fontWeight: 800, marginBottom: 24 }}>Meal History</h2>
              {meals.length === 0 ? (
                <Card className="empty-card" style={{ textAlign: "center", padding: 60 }}>
                  <div className="empty-card-icon" style={{ fontSize: 56, marginBottom: 16 }}>🍽️</div>
                  <h3 style={{ color: COLORS.text, fontWeight: 700, marginBottom: 8 }}>No meals logged yet</h3>
                  <p style={{ color: COLORS.muted, marginBottom: 24 }}>Use the Food Scanner to log your first meal</p>
                  <Button onClick={() => setActiveTab("scan")}>Go to Food Scanner</Button>
                </Card>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {meals.map((meal: Meal) => (
                    <Card key={meal._id} className="card-mobile" style={{ padding: 20 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 20 }}>{({ breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎" } as Record<string, string>)[meal.mealType] || "🍽️"}</span>
                            <span style={{ color: COLORS.text, fontWeight: 700, textTransform: "capitalize" }}>{meal.mealType}</span>
                          </div>
                          <div style={{ color: COLORS.muted, fontSize: 12 }}>
                            {new Date(meal.detectedAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {new Date(meal.detectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: COLORS.emerald, fontWeight: 800, fontSize: 20 }}>{meal.totalCalories} <span style={{ fontSize: 12 }}>kcal</span></div>
                          <div className="history-macros" style={{ display: "flex", gap: 8, marginTop: 4 }}>
                            <span style={{ fontSize: 11, color: COLORS.protein }}>P: {meal.totalProtein}g</span>
                            <span style={{ fontSize: 11, color: COLORS.carbs }}>C: {meal.totalCarbs}g</span>
                            <span style={{ fontSize: 11, color: COLORS.fat }}>F: {meal.totalFat}g</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {meal.foodItems.map((item: { name: string; calories: number }, i: number) => (
                          <span key={i} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 20, padding: "4px 12px", fontSize: 12, color: COLORS.muted }}>
                            {item.name} · {item.calories} kcal
                          </span>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </Suspense>
      </main>

      <nav role="navigation" aria-label="Main navigation" style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: COLORS.surface,
        borderTop: `1px solid ${COLORS.border}`,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        zIndex: 100,
      }}>
        <div role="tablist" style={{ display: "flex", maxWidth: 1100, margin: "0 auto" }}>
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} role="tab" aria-selected={isActive} aria-label={tab.label} onClick={() => setActiveTab(tab.id)} style={{
                flex: 1, border: "none", background: "transparent",
                padding: "8px 4px 10px", cursor: "pointer", fontFamily: "inherit",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                color: isActive ? COLORS.emerald : COLORS.muted,
                transition: "color 0.15s",
              }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>{tab.icon}</span>
                <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, letterSpacing: 0.3 }}>
                  {tab.label}
                </span>
                {isActive && <div style={{ width: 20, height: 3, background: COLORS.emerald, borderRadius: 2, marginTop: 2 }} />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
    </ErrorBoundary>
  );
}
