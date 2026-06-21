import { useState, useEffect, useCallback } from "react";
import { COLORS } from "../constants";
import { Card, Input, Select, Button, Spinner, ProgressBar } from "../components";
import { useAuth } from "../contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

interface Exercise {
  name: string;
  equipment: string;
  muscle_group: string;
}

interface PlanExercise {
  name: string;
  sets: number;
  reps: number;
  rest_seconds: number;
}

interface PlanDay {
  day: string;
  focus: string;
  exercises: PlanExercise[];
}

interface WorkoutLog {
  id: number;
  date: string;
  exercise_name: string;
  sets: number;
  reps: number;
  weight_kg: number;
  duration_minutes: number;
  calories_burned: number;
  notes: string;
  created_at: string;
}

type TabType = "my-plan" | "log" | "history";

const muscleGroupIcons: Record<string, string> = {
  chest: "🏋️", back: "🔙", legs: "🦵", shoulders: "💪",
  arms: "💪", core: "🧘", full_body: "🔥",
};

const WorkoutCoach = () => {
  const { token } = useAuth();
  const [tab, setTab] = useState<TabType>("my-plan");
  const [plan, setPlan] = useState<PlanDay[] | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [equipment, setEquipment] = useState("bodyweight");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [logForm, setLogForm] = useState({
    date: new Date().toISOString().split("T")[0],
    exercise_name: "",
    sets: "3",
    reps: "10",
    weight_kg: "0",
    duration_minutes: "30",
    calories_burned: "0",
    notes: "",
  });
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [logSuccess, setLogSuccess] = useState("");

  const [logTarget, setLogTarget] = useState<string | null>(null);
  const [inlineSets, setInlineSets] = useState("3");
  const [inlineReps, setInlineReps] = useState("15");
  const [inlineWeight, setInlineWeight] = useState("0");
  const [inlineDuration, setInlineDuration] = useState("30");
  const [inlineNotes, setInlineNotes] = useState("");
  const [inlineLoggingId, setInlineLoggingId] = useState<string | null>(null);

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }), [token]);

  const handleInlineLog = async (ex: PlanExercise) => {
    if (!token || inlineLoggingId) return;
    setInlineLoggingId(ex.name);
    try {
      const setsVal = parseInt(inlineSets) || ex.sets;
      const repsVal = parseInt(inlineReps) || ex.reps;
      const weightVal = parseFloat(inlineWeight) || 0;
      const durationVal = parseInt(inlineDuration) || 30;
      const caloriesBurned = Math.round(5 * durationVal);

      const res = await fetch(`${API_BASE}/api/workouts/log`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          date: new Date().toISOString().split("T")[0],
          exercise_name: ex.name,
          sets: setsVal,
          reps: repsVal,
          weight_kg: weightVal,
          duration_minutes: durationVal,
          calories_burned: caloriesBurned,
          notes: inlineNotes,
        }),
      });
      if (res.ok) {
        setLogTarget(null);
        setInlineNotes("");
        fetchLogs();
      }
    } catch {} finally {
      setInlineLoggingId(null);
    }
  };

  const fetchPlan = useCallback(async () => {
    if (!token) return;
    setPlanLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/workouts/plans`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.plan?.plan_json) {
          setPlan(JSON.parse(data.plan.plan_json));
        }
      }
    } catch {} finally {
      setPlanLoading(false);
    }
  }, [token]);

  const fetchExercises = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/workouts/exercises`);
      if (res.ok) {
        const data = await res.json();
        setExercises(data.exercises || []);
      }
    } catch {}
  }, []);

  const fetchLogs = useCallback(async (page = 1) => {
    if (!token) return;
    setLogsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/workouts/logs?page=${page}&per_page=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setLogsTotal(data.total || 0);
        setLogsPage(page);
      }
    } catch {} finally {
      setLogsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPlan();
    fetchExercises();
  }, [fetchPlan, fetchExercises]);

  useEffect(() => {
    if (tab === "history") fetchLogs();
  }, [tab, fetchLogs]);

  const handleGenerate = async () => {
    if (!token) return;
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/workouts/plans`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ equipment }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.plan?.plan_json) {
          setPlan(JSON.parse(data.plan.plan_json));
        }
      }
    } catch {} finally {
      setGenerating(false);
    }
  };

  const handleLogSubmit = async () => {
    if (!token || !logForm.exercise_name) return;
    setLogSubmitting(true);
    setLogSuccess("");
    try {
      const res = await fetch(`${API_BASE}/api/workouts/log`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          date: logForm.date,
          exercise_name: logForm.exercise_name,
          sets: parseInt(logForm.sets) || 0,
          reps: parseInt(logForm.reps) || 0,
          weight_kg: parseFloat(logForm.weight_kg) || 0,
          duration_minutes: parseInt(logForm.duration_minutes) || 0,
          calories_burned: parseInt(logForm.calories_burned) || 0,
          notes: logForm.notes,
        }),
      });
      if (res.ok) {
        setLogSuccess("Workout logged successfully!");
        setLogForm(prev => ({ ...prev, exercise_name: "", sets: "3", reps: "10", weight_kg: "0", duration_minutes: "30", calories_burned: "0", notes: "" }));
        if (tab === "history") fetchLogs();
        setTimeout(() => setLogSuccess(""), 3000);
      }
    } catch {} finally {
      setLogSubmitting(false);
    }
  };

  const weeklyVolume = logs.reduce((sum, l) => sum + (l.sets * l.reps * (l.weight_kg || 1)), 0);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap'); * { box-sizing: border-box; }`}</style>

      <div style={{ display: "flex", gap: 12, marginBottom: 24, overflowX: "auto" }}>
        {[
          { id: "my-plan", label: "📋 My Plan" },
          { id: "log", label: "✏️ Log Workout" },
          { id: "history", label: "📈 History" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as TabType)}
            style={{
              padding: "10px 18px", borderRadius: 12, border: "none", cursor: "pointer",
              background: tab === t.id ? `linear-gradient(135deg, ${COLORS.emerald}, ${COLORS.teal})` : COLORS.surface,
              color: tab === t.id ? "#fff" : COLORS.muted, fontWeight: 700, fontSize: 13,
              fontFamily: "inherit", whiteSpace: "nowrap",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "my-plan" && (
        <>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <Select label="Equipment" value={equipment}
                onChange={e => setEquipment(e.target.value)}
                options={[
                  { value: "bodyweight", label: "🏠 Bodyweight Only" },
                  { value: "gym", label: "🏋️ Full Gym" },
                  { value: "minimal", label: "🎒 Minimal (Dumbbells)" },
                ]} />
            </div>
            <Button onClick={handleGenerate} disabled={generating} style={{ marginBottom: 2 }}>
              {generating ? "Generating..." : plan ? "🔄 Regenerate Plan" : "⚡ Generate Plan"}
            </Button>
          </div>

          {planLoading && <div style={{ textAlign: "center", padding: 40 }}><Spinner /></div>}

          {!planLoading && !plan && (
            <Card style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏋️</div>
              <h3 style={{ color: COLORS.text, fontWeight: 700, marginBottom: 8 }}>No Workout Plan Yet</h3>
              <p style={{ color: COLORS.muted, fontSize: 14 }}>Select your equipment and generate a personalized weekly plan based on your fitness goal.</p>
            </Card>
          )}

          {plan && plan.map((day, i) => (
            <Card key={i} style={{ marginBottom: 12, borderLeft: `4px solid ${COLORS.emerald}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{muscleGroupIcons[day.focus] || "🏋️"}</span>
                  <h4 style={{ color: COLORS.text, fontWeight: 700 }}>{day.day}</h4>
                </div>
                <span style={{ fontSize: 12, background: `${COLORS.emerald}22`, color: COLORS.emerald, padding: "3px 10px", borderRadius: 8, textTransform: "capitalize" }}>
                  {day.focus}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {day.exercises.map((ex, j) => {
                  const isInlineOpen = logTarget === ex.name;
                  return (
                    <div key={j} style={{
                      backgroundColor: "#fff",
                      borderRadius: 10,
                      padding: 14,
                      marginBottom: 8,
                      border: "0.5px solid #E5E7EB",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10
                    }}>
                      {/* Exercise info */}
                      <div>
                        <div style={{ fontSize: 14, fontWeight: "500", color: "#1A1A1A", marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
                          <span>💪</span> {ex.name}
                        </div>
                        <div style={{ fontSize: 12, color: "#6B7280" }}>
                          {ex.sets} sets × {ex.reps} reps · {ex.rest_seconds}s rest
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => {
                            alert("📷 Live camera and real-time AI pose detection are only available in the NutriVision Mobile Application. Please log in using the mobile app to scan your form!");
                          }}
                          style={{
                            flex: 1,
                            backgroundColor: "#1D9E75",
                            padding: "10px",
                            borderRadius: 8,
                            border: "none",
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: "600",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4
                          }}
                        >
                          📷 Start with Camera
                        </button>

                        <button
                          onClick={() => {
                            if (isInlineOpen) {
                              setLogTarget(null);
                            } else {
                              setLogTarget(ex.name);
                              setInlineSets(String(ex.sets));
                              setInlineReps(String(ex.reps));
                              setInlineWeight("0");
                              setInlineDuration("30");
                            }
                          }}
                          style={{
                            flex: 1,
                            backgroundColor: "transparent",
                            padding: "10px",
                            borderRadius: 8,
                            border: "1px solid #E5E7EB",
                            color: "#6B7280",
                            fontSize: 13,
                            cursor: "pointer"
                          }}
                        >
                          ✏️ Log it
                        </button>
                      </div>

                      {/* Inline log form */}
                      {isInlineOpen && (
                        <div style={{
                          marginTop: 10,
                          paddingTop: 14,
                          borderTop: "0.5px solid #E5E7EB",
                          display: "flex",
                          flexDirection: "column",
                          gap: 12
                        }}>
                          <div style={{ fontSize: 13, fontWeight: "700", color: "#374151" }}>Log manually</div>
                          
                          {/* Inputs */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <label style={{ fontSize: 11, fontWeight: "600", color: "#6B7280" }}>Sets</label>
                              <input
                                type="number"
                                value={inlineSets}
                                onChange={(e) => setInlineSets(e.target.value)}
                                style={{
                                  border: "1px solid #E5E7EB",
                                  borderRadius: 8,
                                  padding: "6px 10px",
                                  fontSize: 13,
                                  color: "#1A1A1A",
                                  backgroundColor: "#F9FAFB"
                                }}
                              />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <label style={{ fontSize: 11, fontWeight: "600", color: "#6B7280" }}>Reps</label>
                              <input
                                type="number"
                                value={inlineReps}
                                onChange={(e) => setInlineReps(e.target.value)}
                                style={{
                                  border: "1px solid #E5E7EB",
                                  borderRadius: 8,
                                  padding: "6px 10px",
                                  fontSize: 13,
                                  color: "#1A1A1A",
                                  backgroundColor: "#F9FAFB"
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <label style={{ fontSize: 11, fontWeight: "600", color: "#6B7280" }}>Weight (kg)</label>
                              <input
                                type="number"
                                value={inlineWeight}
                                onChange={(e) => setInlineWeight(e.target.value)}
                                style={{
                                  border: "1px solid #E5E7EB",
                                  borderRadius: 8,
                                  padding: "6px 10px",
                                  fontSize: 13,
                                  color: "#1A1A1A",
                                  backgroundColor: "#F9FAFB"
                                }}
                              />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <label style={{ fontSize: 11, fontWeight: "600", color: "#6B7280" }}>Duration (min)</label>
                              <input
                                type="number"
                                value={inlineDuration}
                                onChange={(e) => setInlineDuration(e.target.value)}
                                style={{
                                  border: "1px solid #E5E7EB",
                                  borderRadius: 8,
                                  padding: "6px 10px",
                                  fontSize: 13,
                                  color: "#1A1A1A",
                                  backgroundColor: "#F9FAFB"
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <label style={{ fontSize: 11, fontWeight: "600", color: "#6B7280" }}>Notes</label>
                            <input
                              type="text"
                              value={inlineNotes}
                              onChange={(e) => setInlineNotes(e.target.value)}
                              placeholder="How did it feel?"
                              style={{
                                border: "1px solid #E5E7EB",
                                borderRadius: 8,
                                padding: "6px 10px",
                                fontSize: 13,
                                color: "#1A1A1A",
                                backgroundColor: "#F9FAFB"
                              }}
                            />
                          </div>

                          <button
                            onClick={() => handleInlineLog(ex)}
                            disabled={inlineLoggingId === ex.name}
                            style={{
                              backgroundColor: "#1D9E75",
                              border: "none",
                              color: "#fff",
                              padding: "10px",
                              borderRadius: 8,
                              fontSize: 13,
                              fontWeight: "700",
                              cursor: "pointer"
                            }}
                          >
                            {inlineLoggingId === ex.name ? "Logging..." : "Log Workout"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </>
      )}

      {tab === "log" && (
        <Card>
          <h3 style={{ color: COLORS.text, fontWeight: 700, marginBottom: 16 }}>Log Your Workout</h3>

          {logSuccess && (
            <div style={{ background: `${COLORS.emerald}22`, border: `1px solid ${COLORS.emerald}44`, borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
              <p style={{ color: COLORS.emerald, fontSize: 13, fontWeight: 600 }}>✓ {logSuccess}</p>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
            <Input label="Date" type="date" value={logForm.date}
              onChange={e => setLogForm(p => ({ ...p, date: e.target.value }))} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>Exercise</label>
              <input list="exercise-list" value={logForm.exercise_name}
                onChange={e => setLogForm(p => ({ ...p, exercise_name: e.target.value }))}
                placeholder="Type or select exercise"
                style={{
                  padding: "10px 14px", borderRadius: 10, border: `1px solid ${COLORS.border}`,
                  background: COLORS.surface, color: COLORS.text, fontSize: 14, fontFamily: "inherit", outline: "none",
                  width: "100%",
                }} />
              <datalist id="exercise-list">
                {exercises.map((ex, i) => (
                  <option key={i} value={ex.name} />
                ))}
              </datalist>
            </div>
            <Input label="Sets" type="number" value={logForm.sets}
              onChange={e => setLogForm(p => ({ ...p, sets: e.target.value }))} />
            <Input label="Reps" type="number" value={logForm.reps}
              onChange={e => setLogForm(p => ({ ...p, reps: e.target.value }))} />
            <Input label="Weight (kg)" type="number" value={logForm.weight_kg}
              onChange={e => setLogForm(p => ({ ...p, weight_kg: e.target.value }))} />
            <Input label="Duration (min)" type="number" value={logForm.duration_minutes}
              onChange={e => setLogForm(p => ({ ...p, duration_minutes: e.target.value }))} />
            <Input label="Calories Burned" type="number" value={logForm.calories_burned}
              onChange={e => setLogForm(p => ({ ...p, calories_burned: e.target.value }))} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>Notes</label>
              <input value={logForm.notes}
                onChange={e => setLogForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="How did it feel?"
                style={{
                  padding: "10px 14px", borderRadius: 10, border: `1px solid ${COLORS.border}`,
                  background: COLORS.surface, color: COLORS.text, fontSize: 14, fontFamily: "inherit", outline: "none",
                  width: "100%",
                }} />
            </div>
          </div>
          <Button onClick={handleLogSubmit} disabled={logSubmitting || !logForm.exercise_name}
            style={{ marginTop: 16, width: "100%" }}>
            {logSubmitting ? "Saving..." : "💪 Log Workout"}
          </Button>
        </Card>
      )}

      {tab === "history" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 20 }}>
            <Card style={{ textAlign: "center", padding: 16 }}>
              <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1 }}>Total Logs</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: COLORS.emerald }}>{logsTotal}</div>
            </Card>
            <Card style={{ textAlign: "center", padding: 16 }}>
              <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1 }}>Weekly Volume</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: COLORS.teal }}>{weeklyVolume.toLocaleString()}<span style={{ fontSize: 12 }}> kg</span></div>
            </Card>
          </div>

          {logsLoading ? (
            <div style={{ textAlign: "center", padding: 40 }}><Spinner /></div>
          ) : logs.length === 0 ? (
            <Card style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
              <p style={{ color: COLORS.muted, fontSize: 14 }}>No workouts logged yet. Start tracking your progress!</p>
            </Card>
          ) : (
            <>
              {logs.map(log => (
                <Card key={log.id} style={{ marginBottom: 8, padding: "12px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ color: COLORS.text, fontWeight: 600, fontSize: 14 }}>{log.exercise_name}</div>
                      <div style={{ color: COLORS.muted, fontSize: 12 }}>
                        {log.sets}×{log.reps} · {log.date}
                        {log.weight_kg > 0 ? ` · ${log.weight_kg}kg` : ""}
                        {log.calories_burned > 0 ? ` · ${log.calories_burned} cal` : ""}
                      </div>
                      {log.notes && <div style={{ color: COLORS.muted, fontSize: 11, fontStyle: "italic", marginTop: 2 }}>"{log.notes}"</div>}
                    </div>
                    <div style={{ fontSize: 24 }}>💪</div>
                  </div>
                </Card>
              ))}
              {logsTotal > logsPage * 20 && (
                <div style={{ textAlign: "center", marginTop: 12 }}>
                  <Button onClick={() => fetchLogs(logsPage + 1)} variant="ghost">Load More</Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default WorkoutCoach;
