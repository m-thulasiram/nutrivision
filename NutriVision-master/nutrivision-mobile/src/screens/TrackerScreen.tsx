import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { apiCall, ApiRequestError } from '../utils/api';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_HEIGHT = 160;
const BAR_WIDTH = (SCREEN_WIDTH - 64) / 9;

interface ProgressData {
  date: string;
  user_id: number;
  targets: { calories: number; protein_g: number; carbs_g: number; fats_g: number };
  consumed: { calories: number; protein_g: number; carbs_g: number; fats_g: number };
  remaining: { calories: number; protein_g: number; carbs_g: number; fats_g: number };
  percentages: { calories: number; protein_g: number; carbs_g: number; fats_g: number };
  meals_today: MealEntry[];
  streak_days: number;
  health_score: number;
  alerts: string[];
}

interface MealEntry {
  id: number;
  timestamp: string;
  meal_time: string;
  detected_items: string;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fats_g: number;
}

interface WeeklyProgress {
  weekly_progress: ProgressData[];
}

const DAY_ABBREV = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getTodayDayIndex(): number {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

function formatMealTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function capitalizeLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getMacroColor(pct: number): string {
  if (pct > 1.0) return '#E24B4A';
  if (pct >= 0.85) return '#1D9E75';
  if (pct >= 0.50) return '#BA7517';
  return '#E24B4A';
}

export default function TrackerScreen({ navigation }: { navigation: any }) {
  const [tab, setTab] = useState<'today' | 'week'>('today');
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [weekly, setWeekly] = useState<ProgressData[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchToday = useCallback(async () => {
    try {
      const data = await apiCall<{ status: string; progress: ProgressData }>(
        '/api/users/me/progress', 'GET', undefined, true
      );
      setProgress(data.progress);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.status === 401) {
          navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
          return;
        }
      }
      setError('Could not load data.');
    }
  }, [navigation]);

  const fetchWeekly = useCallback(async () => {
    try {
      const data = await apiCall<{ status: string; weekly_progress: ProgressData[] }>(
        '/api/users/me/progress/weekly', 'GET', undefined, true
      );
      setWeekly(data.weekly_progress);
    } catch {
      setError('Could not load weekly data.');
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchToday(), fetchWeekly()]);
      setLoading(false);
    };
    load();
  }, [fetchToday, fetchWeekly]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchToday(), fetchWeekly()]);
    setRefreshing(false);
  }, [fetchToday, fetchWeekly]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonHeader}>
          <View style={[styles.skeletonLine, { width: 120 }]} />
        </View>
        <View style={styles.skeletonGrid}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.skeletonCard} />
          ))}
        </View>
      </View>
    );
  }

  const maxCalories = weekly.length > 0
    ? Math.max(...weekly.map((d) => d.targets.calories), 1)
    : 2000;

  const proteinHits = weekly.filter((d) => d.percentages.protein_g >= 0.8).length;
  const calorieHits = weekly.filter((d) => 0.85 <= d.percentages.calories && d.percentages.calories <= 1.05).length;

  let bestDay = '';
  let bestPct = 0;
  let worstDay = '';
  let worstPct = 1;
  for (const d of weekly) {
    const avg = (d.percentages.calories + d.percentages.protein_g + d.percentages.carbs_g + d.percentages.fats_g) / 4;
    if (avg > bestPct) { bestPct = avg; bestDay = d.date; }
    if (avg < worstPct) { worstPct = avg; worstDay = d.date; }
  }

  const avgProDeficit = weekly
    .map((d) => Math.max(0, d.targets.protein_g - d.consumed.protein_g))
    .reduce((a, b) => a + b, 0) / Math.max(weekly.length, 1);
  const avgFiberDeficit = weekly
    .map((d) => Math.max(0, 25 - (d.consumed.carbs_g * 0.1)))
    .reduce((a, b) => a + b, 0) / Math.max(weekly.length, 1);
  const avgIronDeficit = weekly
    .map((d) => Math.max(0, 18 - (d.consumed.protein_g * 0.06)))
    .reduce((a, b) => a + b, 0) / Math.max(weekly.length, 1);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1D9E75" />
      }
    >
      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'today' && styles.tabActive]}
          onPress={() => setTab('today')}
        >
          <Text style={[styles.tabText, tab === 'today' && styles.tabTextActive]}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'week' && styles.tabActive]}
          onPress={() => setTab('week')}
        >
          <Text style={[styles.tabText, tab === 'week' && styles.tabTextActive]}>This Week</Text>
        </TouchableOpacity>
      </View>

      {tab === 'today' ? (
        <View>
          <View style={styles.macroGrid}>
            <View style={styles.macroCard}>
              <Text style={styles.macroCardLabel}>PROTEIN</Text>
              <Text style={styles.macroCardValue}>
                {Math.round(progress?.consumed.protein_g || 0)}g / {Math.round(progress?.targets.protein_g || 0)}g
              </Text>
              <View style={styles.macroCardBarBg}>
                <View style={[styles.macroCardBarFill, {
                  width: `${Math.min((progress?.percentages.protein_g || 0) * 100, 100)}%`,
                  backgroundColor: getMacroColor(progress?.percentages.protein_g || 0)
                }]} />
              </View>
              <Text style={styles.macroCardPct}>{Math.round((progress?.percentages.protein_g || 0) * 100)}%</Text>
            </View>
            <View style={styles.macroCard}>
              <Text style={styles.macroCardLabel}>CARBS</Text>
              <Text style={styles.macroCardValue}>
                {Math.round(progress?.consumed.carbs_g || 0)}g / {Math.round(progress?.targets.carbs_g || 0)}g
              </Text>
              <View style={styles.macroCardBarBg}>
                <View style={[styles.macroCardBarFill, {
                  width: `${Math.min((progress?.percentages.carbs_g || 0) * 100, 100)}%`,
                  backgroundColor: getMacroColor(progress?.percentages.carbs_g || 0)
                }]} />
              </View>
              <Text style={styles.macroCardPct}>{Math.round((progress?.percentages.carbs_g || 0) * 100)}%</Text>
            </View>
            <View style={styles.macroCard}>
              <Text style={styles.macroCardLabel}>FATS</Text>
              <Text style={styles.macroCardValue}>
                {Math.round(progress?.consumed.fats_g || 0)}g / {Math.round(progress?.targets.fats_g || 0)}g
              </Text>
              <View style={styles.macroCardBarBg}>
                <View style={[styles.macroCardBarFill, {
                  width: `${Math.min((progress?.percentages.fats_g || 0) * 100, 100)}%`,
                  backgroundColor: getMacroColor(progress?.percentages.fats_g || 0)
                }]} />
              </View>
              <Text style={styles.macroCardPct}>{Math.round((progress?.percentages.fats_g || 0) * 100)}%</Text>
            </View>
            <View style={styles.macroCard}>
              <Text style={styles.macroCardLabel}>CALORIES</Text>
              <Text style={styles.macroCardValue}>
                {Math.round(progress?.consumed.calories || 0)} / {Math.round(progress?.targets.calories || 0)}
              </Text>
              <View style={styles.macroCardBarBg}>
                <View style={[styles.macroCardBarFill, {
                  width: `${Math.min((progress?.percentages.calories || 0) * 100, 100)}%`,
                  backgroundColor: getMacroColor(progress?.percentages.calories || 0)
                }]} />
              </View>
              <Text style={styles.macroCardPct}>{Math.round((progress?.percentages.calories || 0) * 100)}%</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Meals</Text>
            {progress && progress.meals_today.length > 0 ? (
              progress.meals_today.map((meal) => (
                <View key={meal.id} style={styles.mealTimeline}>
                  <Text style={styles.mealTime}>{formatMealTime(meal.timestamp)}</Text>
                  <View style={styles.mealDot} />
                  <View style={styles.mealContent}>
                    <Text style={styles.mealLabel}>{capitalizeLabel(meal.meal_time)}</Text>
                    <Text style={styles.mealItems}>{meal.detected_items}</Text>
                    <Text style={styles.mealCals}>
                      {Math.round(meal.total_calories)} kcal · {Math.round(meal.total_protein_g)}g P · {Math.round(meal.total_carbs_g)}g C · {Math.round(meal.total_fats_g)}g F
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyMeals}>
                <Text style={styles.emptyText}>No meals logged today</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.logMealButton}
              onPress={() => navigation.navigate('Scan')}
            >
              <Text style={styles.logMealText}>+ Log a Meal</Text>
            </TouchableOpacity>
          </View>

          {progress && progress.alerts.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Alerts</Text>
              {progress.alerts.map((alert, idx) => {
                const isPositive = alert.startsWith('Great job') || alert.includes('hit');
                return (
                  <View
                    key={idx}
                    style={[styles.alertCard, isPositive ? styles.alertPositive : styles.alertWarning]}
                  >
                    <Text style={[styles.alertText, isPositive ? styles.alertTextPositive : styles.alertTextWarning]}>
                      {isPositive ? '✅ ' : '⚠️ '}{alert}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : (
        <View>
          <View style={styles.chartContainer}>
            <View style={styles.chartYAxis}>
              {[0, 25, 50, 75, 100].map((v) => (
                <Text key={v} style={styles.chartYLabel}>{v}%</Text>
              ))}
            </View>
            <View style={styles.chartBars}>
              {weekly.map((day, idx) => {
                const pct = day.targets.calories > 0
                  ? Math.min(day.consumed.calories / day.targets.calories, 1.2)
                  : 0;
                const barHeight = Math.min((pct / 1.2) * CHART_HEIGHT, CHART_HEIGHT);
                const dayIdx = (getTodayDayIndex() - (6 - idx) + 7) % 7;
                const isOver = day.consumed.calories > day.targets.calories && day.targets.calories > 0;
                return (
                  <View key={idx} style={styles.barColumn}>
                    <View style={[styles.bar, { height: barHeight, backgroundColor: isOver ? '#E24B4A' : '#1D9E75' }]} />
                    <Text style={styles.barLabel}>{DAY_ABBREV[dayIdx]}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.weeklySummary}>
            <Text style={styles.weeklyTitle}>This week</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Protein goal hit</Text>
              <Text style={styles.summaryValue}>{proteinHits}/7 days {proteinHits >= 5 ? '✅' : proteinHits >= 3 ? '⚠️' : '❌'}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Calorie goal hit</Text>
              <Text style={styles.summaryValue}>{calorieHits}/7 days {calorieHits >= 5 ? '✅' : calorieHits >= 3 ? '⚠️' : '❌'}</Text>
            </View>
            <View style={styles.summaryDivider} />
            {bestDay ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Best day</Text>
                <Text style={styles.summaryValue}>{bestDay} ({(bestPct * 100).toFixed(0)}% of targets)</Text>
              </View>
            ) : null}
            <View style={styles.summaryDivider} />
            {worstDay ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Needs work</Text>
                <Text style={[styles.summaryValue, { color: '#E24B4A' }]}>{worstDay} ({(worstPct * 100).toFixed(0)}% of targets)</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top deficiencies this week</Text>
            <View style={styles.deficiencyCard}>
              <View style={styles.deficiencyRow}>
                <Text style={styles.deficiencyLabel}>1. Protein</Text>
                <Text style={styles.deficiencyValue}>missed by avg {Math.round(avgProDeficit)}g/day</Text>
              </View>
              <View style={styles.deficiencyDivider} />
              <View style={styles.deficiencyRow}>
                <Text style={styles.deficiencyLabel}>2. Fiber</Text>
                <Text style={styles.deficiencyValue}>missed by avg {Math.round(avgFiberDeficit)}g/day</Text>
              </View>
              <View style={styles.deficiencyDivider} />
              <View style={styles.deficiencyRow}>
                <Text style={styles.deficiencyLabel}>3. Iron</Text>
                <Text style={styles.deficiencyValue}>missed by avg {Math.round(avgIronDeficit)}mg/day</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAF9',
  },
  scrollContent: {
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  skeletonHeader: {
    padding: 20,
    gap: 8,
  },
  skeletonLine: {
    height: 16,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
  },
  skeletonCard: {
    width: (SCREEN_WIDTH - 64) / 2,
    height: 100,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#E24B4A',
    textAlign: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#1D9E75',
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  macroCard: {
    width: (SCREEN_WIDTH - 64) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  macroCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  macroCardValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  macroCardBarBg: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginBottom: 4,
  },
  macroCardBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  macroCardPct: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  mealTimeline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  mealTime: {
    width: 50,
    fontSize: 12,
    color: '#9CA3AF',
    paddingTop: 2,
  },
  mealDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1D9E75',
    marginTop: 4,
    marginHorizontal: 12,
  },
  mealContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#1D9E75',
  },
  mealLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D9E75',
    marginBottom: 2,
  },
  mealItems: {
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  mealCals: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptyMeals: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  logMealButton: {
    marginTop: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#1D9E75',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logMealText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D9E75',
  },
  alertCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  alertPositive: {
    backgroundColor: '#F0FDF4',
  },
  alertWarning: {
    backgroundColor: '#FFFBEB',
  },
  alertText: {
    fontSize: 13,
    fontWeight: '600',
  },
  alertTextPositive: {
    color: '#1D9E75',
  },
  alertTextWarning: {
    color: '#BA7517',
  },
  chartContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    height: CHART_HEIGHT + 60,
  },
  chartYAxis: {
    width: 32,
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  chartYLabel: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  chartBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingBottom: 24,
  },
  barColumn: {
    alignItems: 'center',
    width: BAR_WIDTH,
  },
  bar: {
    width: BAR_WIDTH * 0.6,
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 6,
  },
  weeklySummary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  weeklyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  deficiencyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  deficiencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  deficiencyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  deficiencyValue: {
    fontSize: 13,
    color: '#E24B4A',
  },
  deficiencyDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
});
