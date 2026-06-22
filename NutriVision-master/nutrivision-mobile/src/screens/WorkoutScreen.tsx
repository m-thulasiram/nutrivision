import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../types/navigation";
import { apiCall } from "../utils/api";
import { getExerciseConfig } from "../constants/exerciseMapping";
import type { Exercise } from "../constants/exercises";

const SCREEN_WIDTH = Dimensions.get("window").width;

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
  chest: "🏋️",
  back: "🔙",
  legs: "🦵",
  shoulders: "💪",
  arms: "💪",
  core: "🧘",
  full_body: "🔥",
};

type WorkoutNavProp = NativeStackNavigationProp<RootStackParamList>;

export default function WorkoutScreen() {
  const navigation = useNavigation<WorkoutNavProp>();
  const [tab, setTab] = useState<TabType>("my-plan");
  const [plan, setPlan] = useState<PlanDay[] | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [equipment, setEquipment] = useState("bodyweight");
  const [generating, setGenerating] = useState(false);

  // Manual logs history state
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsTotal, setLogsTotal] = useState(0);

  // Inline logging target
  const [logTarget, setLogTarget] = useState<PlanExercise | null>(null);
  const [inlineSets, setInlineSets] = useState("3");
  const [inlineReps, setInlineReps] = useState("15");
  const [inlineWeight, setInlineWeight] = useState("0");
  const [inlineDuration, setInlineDuration] = useState("30");
  const [inlineNotes, setInlineNotes] = useState("");
  const [inlineLoggingId, setInlineLoggingId] = useState<string | null>(null);

  // Log Workout Tab Form state
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

  const fetchPlan = useCallback(async () => {
    setPlanLoading(true);
    try {
      const data = await apiCall<{
        status: string;
        plan: { plan_json: string } | null;
      }>("/api/workouts/plans", "GET", undefined, true);
      if (data.status === "success" && data.plan?.plan_json) {
        setPlan(JSON.parse(data.plan.plan_json));
      }
    } catch {
      // silent
    } finally {
      setPlanLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await apiCall<{
        status: string;
        logs: WorkoutLog[];
        total: number;
      }>("/api/workouts/logs?page=1&per_page=50", "GET", undefined, true);
      if (data.status === "success") {
        setLogs(data.logs || []);
        setLogsTotal(data.total || 0);
      }
    } catch {
      // silent
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  useEffect(() => {
    if (tab === "history") {
      fetchLogs();
    }
  }, [tab, fetchLogs]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await apiCall<{
        status: string;
        plan: { plan_json: string };
      }>("/api/workouts/plans", "POST", { equipment }, true);
      if (data.status === "success" && data.plan?.plan_json) {
        setPlan(JSON.parse(data.plan.plan_json));
      }
    } catch {
      // silent
    } finally {
      setGenerating(false);
    }
  };

  const handleInlineLogSubmit = async (exercise: PlanExercise) => {
    if (inlineLoggingId) return;
    setInlineLoggingId(exercise.name);

    const setsVal = parseInt(inlineSets) || exercise.sets;
    const repsVal = parseInt(inlineReps) || exercise.reps;
    const weightVal = parseFloat(inlineWeight) || 0;
    const durationVal = parseInt(inlineDuration) || 30;

    // Standard MET estimation: ~5 cal per min for bodyweight, 6 for gym/dumbbell
    const caloriesBurned = Math.round(5 * durationVal);

    try {
      await apiCall(
        "/api/workouts/log",
        "POST",
        {
          exercise_name: exercise.name,
          date: new Date().toISOString().split("T")[0],
          sets: setsVal,
          reps: repsVal,
          weight_kg: weightVal,
          duration_minutes: durationVal,
          calories_burned: caloriesBurned,
          notes: inlineNotes,
        },
        true
      );
      setLogTarget(null);
      setInlineNotes("");
      setInlineWeight("0");
      setInlineDuration("30");
      fetchLogs();
    } catch {
      // silent
    } finally {
      setInlineLoggingId(null);
    }
  };

  const handleFullLogSubmit = async () => {
    if (!logForm.exercise_name || logSubmitting) return;
    setLogSubmitting(true);
    setLogSuccess("");

    const setsVal = parseInt(logForm.sets) || 0;
    const repsVal = parseInt(logForm.reps) || 0;
    const weightVal = parseFloat(logForm.weight_kg) || 0;
    const durationVal = parseInt(logForm.duration_minutes) || 0;
    const calsVal = parseInt(logForm.calories_burned) || Math.round(5 * durationVal);

    try {
      await apiCall(
        "/api/workouts/log",
        "POST",
        {
          date: logForm.date,
          exercise_name: logForm.exercise_name,
          sets: setsVal,
          reps: repsVal,
          weight_kg: weightVal,
          duration_minutes: durationVal,
          calories_burned: calsVal,
          notes: logForm.notes,
        },
        true
      );
      setLogSuccess("Workout logged successfully!");
      setLogForm({
        date: new Date().toISOString().split("T")[0],
        exercise_name: "",
        sets: "3",
        reps: "10",
        weight_kg: "0",
        duration_minutes: "30",
        calories_burned: "0",
        notes: "",
      });
      setTimeout(() => setLogSuccess(""), 3000);
      fetchLogs();
    } catch {
      // silent
    } finally {
      setLogSubmitting(false);
    }
  };

  const weeklyVolume = logs.reduce(
    (sum, l) => sum + l.sets * l.reps * (l.weight_kg || 1),
    0
  );

  return (
    <View style={styles.container}>
      {/* Title */}
      <View style={styles.header}>
        <Text style={styles.title}>Workout Coach</Text>
        <Text style={styles.subtitle}>
          Plan your training, log workouts, and track progress
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {[
          { id: "my-plan", label: "📋 My Plan" },
          { id: "log", label: "✏️ Log Workout" },
          { id: "history", label: "📈 History" },
        ].map((t) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setTab(t.id as TabType)}
            style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabBtnText,
                tab === t.id && styles.tabBtnTextActive,
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {tab === "my-plan" && (
          <View style={styles.planSection}>
            {/* Equipment Selector */}
            <Text style={styles.sectionLabel}>EQUIPMENT</Text>
            <View style={styles.equipmentRow}>
              {[
                { id: "bodyweight", label: "🏠 Bodyweight" },
                { id: "gym", label: "🏋️ Full Gym" },
                { id: "minimal", label: "🎒 Minimal" },
              ].map((eq) => (
                <TouchableOpacity
                  key={eq.id}
                  onPress={() => setEquipment(eq.id)}
                  style={[
                    styles.eqBtn,
                    equipment === eq.id && styles.eqBtnActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.eqBtnText,
                      equipment === eq.id && styles.eqBtnTextActive,
                    ]}
                  >
                    {eq.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.regenerateBtn}
              onPress={handleGenerate}
              disabled={generating}
              activeOpacity={0.8}
            >
              {generating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.regenerateBtnText}>
                  {plan ? "🔄 Regenerate Plan" : "⚡ Generate Plan"}
                </Text>
              )}
            </TouchableOpacity>

            {planLoading && (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#1D9E75" />
              </View>
            )}

            {!planLoading && !plan && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No workout plan generated yet.</Text>
                <Text style={styles.emptySubtext}>
                  Select equipment and press Generate Plan.
                </Text>
              </View>
            )}

            {!planLoading &&
              plan &&
              plan.map((day, i) => (
                <View key={i} style={styles.dayCard}>
                  {/* Day Header */}
                  <View style={styles.dayHeader}>
                    <View style={styles.dayTitleRow}>
                      <Text style={styles.dayFocusIcon}>
                        {muscleGroupIcons[day.focus] || "🏋️"}
                      </Text>
                      <Text style={styles.dayName}>{day.day}</Text>
                    </View>
                    <View style={styles.focusBadge}>
                      <Text style={styles.focusBadgeText}>{day.focus}</Text>
                    </View>
                  </View>

                  {/* Exercises */}
                  <View style={styles.dayExercises}>
                    {day.exercises.map((ex, j) => {
                      const isInlineOpen = logTarget?.name === ex.name;
                      return (
                        <View key={j} style={styles.exerciseCard}>
                          {/* Exercise Info */}
                          <View style={styles.exerciseHeader}>
                            <Text style={styles.exerciseName}>{ex.name}</Text>
                            <Text style={styles.exerciseMeta}>
                              {ex.sets} sets × {ex.reps} reps · {ex.rest_seconds}s
                              rest
                            </Text>
                          </View>

                          {/* Action Buttons */}
                          <View style={styles.exerciseActions}>
                            <TouchableOpacity
                              style={styles.cameraBtn}
                              onPress={() => {
                                const exerciseConfig = getExerciseConfig(
                                  ex.name,
                                  ex.sets,
                                  ex.reps
                                );
                                navigation.navigate("PoseCheck", {
                                  exercise: exerciseConfig,
                                });
                              }}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.cameraBtnText}>
                                📷 Start with Camera
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.logBtn}
                              onPress={() => {
                                if (isInlineOpen) {
                                  setLogTarget(null);
                                } else {
                                  setLogTarget(ex);
                                  setInlineSets(String(ex.sets));
                                  setInlineReps(String(ex.reps));
                                  setInlineWeight("0");
                                  setInlineDuration("30");
                                }
                              }}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.logBtnText}>✏️ Log it</Text>
                            </TouchableOpacity>
                          </View>

                          {/* Inline Log Form */}
                          {isInlineOpen && (
                            <View style={styles.manualForm}>
                              <Text style={styles.formTitle}>Log manually</Text>

                              {/* Steppers */}
                              <View style={styles.stepperRow}>
                                <Text style={styles.stepperLabel}>Sets:</Text>
                                <View style={styles.stepper}>
                                  <TouchableOpacity
                                    style={styles.stepperBtn}
                                    onPress={() =>
                                      setInlineSets((s) =>
                                        String(Math.max(1, parseInt(s) - 1))
                                      )
                                    }
                                  >
                                    <Text style={styles.stepperBtnText}>-</Text>
                                  </TouchableOpacity>
                                  <Text style={styles.stepperValue}>
                                    {inlineSets}
                                  </Text>
                                  <TouchableOpacity
                                    style={styles.stepperBtn}
                                    onPress={() =>
                                      setInlineSets((s) =>
                                        String(parseInt(s) + 1)
                                      )
                                    }
                                  >
                                    <Text style={styles.stepperBtnText}>+</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>

                              <View style={styles.stepperRow}>
                                <Text style={styles.stepperLabel}>Reps:</Text>
                                <View style={styles.stepper}>
                                  <TouchableOpacity
                                    style={styles.stepperBtn}
                                    onPress={() =>
                                      setInlineReps((s) =>
                                        String(Math.max(1, parseInt(s) - 1))
                                      )
                                    }
                                  >
                                    <Text style={styles.stepperBtnText}>-</Text>
                                  </TouchableOpacity>
                                  <Text style={styles.stepperValue}>
                                    {inlineReps}
                                  </Text>
                                  <TouchableOpacity
                                    style={styles.stepperBtn}
                                    onPress={() =>
                                      setInlineReps((s) =>
                                        String(parseInt(s) + 1)
                                      )
                                    }
                                  >
                                    <Text style={styles.stepperBtnText}>+</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>

                              {/* Text inputs */}
                              <View style={styles.inputRow}>
                                <View style={styles.inputCol}>
                                  <Text style={styles.inputLabel}>Weight (kg)</Text>
                                  <TextInput
                                    style={styles.textInput}
                                    value={inlineWeight}
                                    onChangeText={setInlineWeight}
                                    keyboardType="numeric"
                                  />
                                </View>
                                <View style={styles.inputCol}>
                                  <Text style={styles.inputLabel}>Duration (m)</Text>
                                  <TextInput
                                    style={styles.textInput}
                                    value={inlineDuration}
                                    onChangeText={setInlineDuration}
                                    keyboardType="numeric"
                                  />
                                </View>
                              </View>

                              <View style={styles.inputColFull}>
                                <Text style={styles.inputLabel}>Notes</Text>
                                <TextInput
                                  style={[styles.textInput, styles.textArea]}
                                  value={inlineNotes}
                                  onChangeText={setInlineNotes}
                                  placeholder="How did it feel?"
                                  multiline
                                />
                              </View>

                              <TouchableOpacity
                                style={styles.submitInlineBtn}
                                onPress={() => handleInlineLogSubmit(ex)}
                                disabled={inlineLoggingId === ex.name}
                              >
                                {inlineLoggingId === ex.name ? (
                                  <ActivityIndicator
                                    color="#fff"
                                    size="small"
                                  />
                                ) : (
                                  <Text style={styles.submitInlineBtnText}>
                                    Log Workout
                                  </Text>
                                )}
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
          </View>
        )}

        {tab === "log" && (
          <View style={styles.logSection}>
            <View style={styles.formCard}>
              <Text style={styles.formSectionTitle}>Log Your Workout</Text>

              {logSuccess !== "" && (
                <View style={styles.successAlert}>
                  <Text style={styles.successAlertText}>✓ {logSuccess}</Text>
                </View>
              )}

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>DATE</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={logForm.date}
                  onChangeText={(val) =>
                    setLogForm((p) => ({ ...p, date: val }))
                  }
                  placeholder="YYYY-MM-DD"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>EXERCISE NAME</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={logForm.exercise_name}
                  onChangeText={(val) =>
                    setLogForm((p) => ({ ...p, exercise_name: val }))
                  }
                  placeholder="e.g. Push Up"
                />
              </View>

              <View style={styles.fieldGrid}>
                <View style={[styles.formField, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>SETS</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={logForm.sets}
                    onChangeText={(val) =>
                      setLogForm((p) => ({ ...p, sets: val }))
                    }
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.formField, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.fieldLabel}>REPS</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={logForm.reps}
                    onChangeText={(val) =>
                      setLogForm((p) => ({ ...p, reps: val }))
                    }
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.fieldGrid}>
                <View style={[styles.formField, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>WEIGHT (KG)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={logForm.weight_kg}
                    onChangeText={(val) =>
                      setLogForm((p) => ({ ...p, weight_kg: val }))
                    }
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.formField, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.fieldLabel}>DURATION (MIN)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={logForm.duration_minutes}
                    onChangeText={(val) =>
                      setLogForm((p) => ({ ...p, duration_minutes: val }))
                    }
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>CALORIES BURNED</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={logForm.calories_burned}
                  onChangeText={(val) =>
                    setLogForm((p) => ({ ...p, calories_burned: val }))
                  }
                  keyboardType="numeric"
                  placeholder="Leave 0 for auto-estimate"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>NOTES</Text>
                <TextInput
                  style={[styles.fieldInput, styles.fieldTextArea]}
                  value={logForm.notes}
                  onChangeText={(val) =>
                    setLogForm((p) => ({ ...p, notes: val }))
                  }
                  placeholder="How did it feel?"
                  multiline
                />
              </View>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleFullLogSubmit}
                disabled={logSubmitting || !logForm.exercise_name}
                activeOpacity={0.8}
              >
                {logSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>💪 Log Workout</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {tab === "history" && (
          <View style={styles.historySection}>
            <View style={styles.statsSummaryGrid}>
              <View style={styles.statSummaryCard}>
                <Text style={styles.statSummaryLabel}>Total Logs</Text>
                <Text style={[styles.statSummaryVal, { color: "#1D9E75" }]}>
                  {logsTotal}
                </Text>
              </View>
              <View style={[styles.statSummaryCard, { marginLeft: 12 }]}>
                <Text style={styles.statSummaryLabel}>Weekly Volume</Text>
                <Text style={[styles.statSummaryVal, { color: "#0D9488" }]}>
                  {weeklyVolume.toLocaleString()}
                  <Text style={{ fontSize: 13 }}> kg</Text>
                </Text>
              </View>
            </View>

            {logsLoading && (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#1D9E75" />
              </View>
            )}

            {!logsLoading && logs.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No logs found.</Text>
                <Text style={styles.emptySubtext}>
                  Start by logging a workout manually or with the camera.
                </Text>
              </View>
            )}

            {!logsLoading &&
              logs.map((log) => (
                <View key={log.id} style={styles.historyCard}>
                  <View style={styles.historyCardHeader}>
                    <View>
                      <Text style={styles.historyExName}>
                        {log.exercise_name}
                      </Text>
                      <Text style={styles.historyMeta}>
                        {log.sets} sets × {log.reps} reps
                        {log.weight_kg > 0 ? ` · ${log.weight_kg}kg` : ""}
                      </Text>
                      {log.notes !== "" && (
                        <Text style={styles.historyNotes}>"{log.notes}"</Text>
                      )}
                    </View>
                    <View style={styles.historyRight}>
                      <Text style={styles.historyDate}>{log.date}</Text>
                      <Text style={styles.historyCals}>
                        {log.calories_burned} kcal
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAF9",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 0.5,
    borderColor: "#E5E7EB",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
    lineHeight: 18,
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 0.5,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },
  tabBtnActive: {
    backgroundColor: "#1D9E75",
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  planSection: {},
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  equipmentRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  eqBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  eqBtnActive: {
    backgroundColor: "#1D9E75",
    borderColor: "#1D9E75",
  },
  eqBtnText: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "600",
  },
  eqBtnTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  regenerateBtn: {
    backgroundColor: "#1D9E75",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#1D9E75",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  regenerateBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  loaderContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#E5E7EB",
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },
  dayCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#1D9E75",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  dayTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dayFocusIcon: {
    fontSize: 20,
    marginRight: 6,
  },
  dayName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  focusBadge: {
    backgroundColor: "#EDF9F5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  focusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1D9E75",
    textTransform: "capitalize",
  },
  dayExercises: {
    gap: 8,
  },
  exerciseCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: "#E5E7EB",
  },
  exerciseHeader: {
    marginBottom: 10,
  },
  exerciseNames: {
    marginBottom: 4,
  },
  exerciseScript: {
    fontSize: 18,
    color: "#1D9E75",
    fontWeight: "500",
    marginBottom: 2,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  exerciseOrigin: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  exerciseMeta: {
    fontSize: 12,
    color: "#6B7280",
  },
  exerciseDesc: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 6,
    lineHeight: 18,
  },
  exerciseActions: {
    flexDirection: "row",
    gap: 8,
  },
  cameraBtn: {
    flex: 1,
    backgroundColor: "#1D9E75",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  cameraBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  logBtn: {
    flex: 1,
    backgroundColor: "transparent",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  logBtnText: {
    color: "#6B7280",
    fontSize: 13,
  },
  manualForm: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: "#E5E7EB",
  },
  formTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 10,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  stepperLabel: {
    fontSize: 13,
    color: "#4B5563",
    fontWeight: "500",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  stepperBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4B5563",
  },
  stepperValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A1A",
    minWidth: 24,
    textAlign: "center",
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
  },
  inputCol: {
    flex: 1,
  },
  inputColFull: {
    width: "100%",
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: "#1A1A1A",
    backgroundColor: "#F9FAFB",
  },
  textArea: {
    height: 60,
    textAlignVertical: "top",
  },
  submitInlineBtn: {
    backgroundColor: "#1D9E75",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  submitInlineBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  logSection: {},
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 0.5,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  formSectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 16,
  },
  successAlert: {
    backgroundColor: "#F0FDF4",
    borderColor: "#1D9E75",
    borderWidth: 0.5,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  successAlertText: {
    color: "#1D9E75",
    fontSize: 13,
    fontWeight: "600",
  },
  formField: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1A1A1A",
    backgroundColor: "#F9FAFB",
  },
  fieldTextArea: {
    height: 80,
    textAlignVertical: "top",
  },
  fieldGrid: {
    flexDirection: "row",
  },
  submitBtn: {
    backgroundColor: "#1D9E75",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  historySection: {},
  statsSummaryGrid: {
    flexDirection: "row",
    marginBottom: 16,
  },
  statSummaryCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 0.5,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  statSummaryLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  statSummaryVal: {
    fontSize: 22,
    fontWeight: "800",
  },
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: "#E5E7EB",
  },
  historyCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  historyExName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  historyMeta: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  historyNotes: {
    fontSize: 11,
    color: "#9CA3AF",
    fontStyle: "italic",
    marginTop: 4,
  },
  historyRight: {
    alignItems: "flex-end",
  },
  historyDate: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  historyCals: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1D9E75",
    marginTop: 4,
  },
});
