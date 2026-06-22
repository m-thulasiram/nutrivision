import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUser, getToken } from '../utils/auth';
import { apiCall, BASE_URL } from '../utils/api';
import {
  EXERCISES,
  Exercise,
  GoalCategory,
  getGoalFromUser,
  getGoalLabel,
} from '../constants/exercises';

interface LogEntry {
  id: number;
  date: string;
  exercise_name: string;
  sets: number;
  reps: number;
  duration_minutes: number;
  calories_burned: number;
  created_at: string;
}

export default function WorkoutLibraryScreen({ navigation }: { navigation: any }) {
  const [goal, setGoal] = useState<GoalCategory>('weight_loss');
  const [userName, setUserName] = useState('Athlete');
  const [todayLogs, setTodayLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [manualLogs, setManualLogs] = useState<Record<string, { sets: number; mins: number }>>({});

  const loadData = useCallback(async () => {
    try {
      const user = await getUser();
      const userRaw = await AsyncStorage.getItem('nutrivision_user');
      if (user) setUserName(user.name || 'Athlete');
      if (userRaw) setGoal(getGoalFromUser(userRaw));

      const token = await getToken();
      if (!token) return;

      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(
        `${BASE_URL}/api/workouts/logs?start_date=${today}&end_date=${today}&per_page=50`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      if (data.status === 'success') {
        setTodayLogs(data.logs || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  const exercises = EXERCISES.filter((ex) => ex.goalTags.includes(goal));

  const todayBurn = todayLogs.reduce((s, l) => s + (l.calories_burned || 0), 0);

  const handleStartCamera = (ex: Exercise) => {
    navigation.navigate('PoseCheck', { exercise: ex });
  };


  const handleManualLog = async (ex: Exercise) => {
    const data = manualLogs[ex.id] || { sets: 0, mins: 0 };
    const setsVal = data.sets > 0 ? data.sets : ex.sets;
    const minsVal = data.mins > 0 ? data.mins : Math.ceil(ex.durationSec / 60);
    const cals = Math.round(ex.caloriesPerMin * minsVal);

    try {
      setLoggingId(ex.id);
      await apiCall(
        '/api/workouts/log',
        'POST',
        {
          exercise_name: ex.name,
          sets: setsVal,
          reps: ex.reps,
          duration_minutes: minsVal,
          calories_burned: cals,
          date: new Date().toISOString().split('T')[0],
        },
        true,
      );
      await loadData();
      setManualLogs((prev) => ({ ...prev, [ex.id]: { sets: 0, mins: 0 } }));
    } catch {
      // silent
    } finally {
      setLoggingId(null);
    }
  };

  const toggleManualForm = (exId: string) => {
    setManualLogs((prev) => {
      if (prev[exId]) {
        const next = { ...prev };
        delete next[exId];
        return next;
      }
      return { ...prev, [exId]: { sets: 0, mins: 0 } };
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Workout Coach</Text>
        <Text style={styles.subtitle}>Recommended for {getGoalLabel(goal)}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {exercises.map((ex) => {
          const isManualOpen = !!manualLogs[ex.id];
          const manualData = manualLogs[ex.id] || { sets: 0, mins: 0 };
          return (
            <View key={ex.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.exerciseNames}>
                  {ex.script && (
                    <Text style={styles.exerciseScript}>{ex.script}</Text>
                  )}
                  <Text style={styles.exName}>{ex.name}</Text>
                  {ex.origin && (
                    <Text style={styles.exerciseOrigin}>{ex.origin}</Text>
                  )}
                </View>
                <View style={styles.muscleBadge}>
                  <Text style={styles.muscleBadgeText}>{ex.muscle}</Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <Text style={styles.statText}>
                  {ex.sets} × {ex.reps} reps
                </Text>
                {ex.durationSec >= 60 ? (
                  <Text style={styles.statText}>
                    {Math.ceil(ex.durationSec / 60)} min
                  </Text>
                ) : (
                  <Text style={styles.statText}>{ex.durationSec}s</Text>
                )}
                <Text style={styles.statText}>~{ex.caloriesPerMin * Math.ceil(ex.durationSec / 60)} kcal</Text>
              </View>

              {ex.description && (
                <Text style={styles.exerciseDesc}>{ex.description}</Text>
              )}

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => handleStartCamera(ex)}
                >
                  <Text style={styles.primaryBtnText}>Start with Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => toggleManualForm(ex.id)}
                >
                  <Text style={styles.secondaryBtnText}>Log Manually</Text>
                </TouchableOpacity>
              </View>

              {isManualOpen && (
                <View style={styles.manualForm}>
                  <View style={styles.stepperRow}>
                    <Text style={styles.stepperLabel}>Duration (min):</Text>
                    <View style={styles.stepper}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() =>
                          setManualLogs((p) => ({
                            ...p,
                            [ex.id]: {
                              ...p[ex.id],
                              mins: Math.max(0, (p[ex.id]?.mins || Math.ceil(ex.durationSec / 60)) - 1),
                            },
                          }))
                        }
                      >
                        <Text style={styles.stepperBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepperValue}>
                        {manualData.mins || Math.ceil(ex.durationSec / 60)}
                      </Text>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() =>
                          setManualLogs((p) => ({
                            ...p,
                            [ex.id]: {
                              ...p[ex.id],
                              mins: (p[ex.id]?.mins || Math.ceil(ex.durationSec / 60)) + 1,
                            },
                          }))
                        }
                      >
                        <Text style={styles.stepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.stepperRow}>
                    <Text style={styles.stepperLabel}>Sets:</Text>
                    <View style={styles.stepper}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() =>
                          setManualLogs((p) => ({
                            ...p,
                            [ex.id]: {
                              ...p[ex.id],
                              sets: Math.max(0, (p[ex.id]?.sets || ex.sets) - 1),
                            },
                          }))
                        }
                      >
                        <Text style={styles.stepperBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepperValue}>
                        {manualData.sets || ex.sets}
                      </Text>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() =>
                          setManualLogs((p) => ({
                            ...p,
                            [ex.id]: {
                              ...p[ex.id],
                              sets: (p[ex.id]?.sets || ex.sets) + 1,
                            },
                          }))
                        }
                      >
                        <Text style={styles.stepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.logBtn}
                    onPress={() => handleManualLog(ex)}
                    disabled={loggingId === ex.id}
                  >
                    {loggingId === ex.id ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={styles.logBtnText}>Log it</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.todaySection}>
          <Text style={styles.todayTitle}>Today's Activity</Text>
          {todayLogs.length === 0 ? (
            <Text style={styles.todayEmpty}>No workouts logged yet today</Text>
          ) : (
            todayLogs.map((log) => (
              <View key={log.id} style={styles.todayRow}>
                <Text style={styles.todayExName}>{log.exercise_name}</Text>
                <Text style={styles.todayExDetail}>
                  {log.sets} sets · {log.duration_minutes} min
                </Text>
                <Text style={styles.todayExCals}>{log.calories_burned} kcal</Text>
              </View>
            ))
          )}
          {todayLogs.length > 0 && (
            <View style={styles.totalBurnRow}>
              <Text style={styles.totalBurnLabel}>Total burn</Text>
              <Text style={styles.totalBurnValue}>{todayBurn} kcal</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF9' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, backgroundColor: '#FFFFFF' },
  title: { fontSize: 26, fontWeight: '800', color: '#1A1A1A' },
  subtitle: { fontSize: 15, color: '#6B7280', marginTop: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  exName: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  exerciseNames: {
    flex: 1,
    marginRight: 8,
  },
  exerciseScript: {
    fontSize: 18,
    color: "#1D9E75",
    fontWeight: "500",
    marginBottom: 2,
  },
  exerciseOrigin: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  exerciseDesc: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 6,
    lineHeight: 18,
  },
  muscleBadge: {
    backgroundColor: '#EDF9F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  muscleBadgeText: { fontSize: 12, fontWeight: '600', color: '#1D9E75' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#1D9E75',
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#4B5563', fontSize: 14, fontWeight: '600' },
  manualForm: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stepperLabel: { fontSize: 14, color: '#4B5563', fontWeight: '500' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnText: { fontSize: 18, fontWeight: '700', color: '#4B5563' },
  stepperValue: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', minWidth: 24, textAlign: 'center' },
  logBtn: {
    backgroundColor: '#1D9E75',
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  logBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  todaySection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  todayTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 },
  todayEmpty: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 12 },
  todayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  todayExName: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', flex: 1 },
  todayExDetail: { fontSize: 13, color: '#6B7280', marginHorizontal: 8 },
  todayExCals: { fontSize: 14, fontWeight: '700', color: '#1D9E75' },
  totalBurnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 4,
  },
  totalBurnLabel: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  totalBurnValue: { fontSize: 18, fontWeight: '800', color: '#1D9E75' },
});
