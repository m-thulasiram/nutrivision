import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { apiCall, ApiRequestError } from '../utils/api';
import { getUser, StoredUser } from '../utils/auth';

const SCREEN_WIDTH = Dimensions.get('window').width;
const RING_SIZE = 180;
const RING_STROKE = 14;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

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

interface UserProfile {
  id: number;
  name: string;
  age?: number;
  target_calories?: number;
  target_protein?: number;
  target_carbs?: number;
  target_fats?: number;
  preferred_region?: string;
  preferred_state?: string;
}

interface RegionalFood {
  Food_items?: string;
  food_items?: string;
  Calories?: number;
  Proteins?: number;
  Carbohydrates?: number;
  Fats?: number;
  region?: string;
  state?: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getTodayDateString(): string {
  const today = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${days[today.getDay()]}, ${today.getDate()} ${months[today.getMonth()]}`;
}

function getMacroColor(pct: number): string {
  if (pct > 1.0) return '#E24B4A';
  if (pct >= 0.85) return '#1D9E75';
  if (pct >= 0.50) return '#BA7517';
  return '#E24B4A';
}

function getHealthScoreColor(score: number): string {
  if (score >= 75) return '#1D9E75';
  if (score >= 50) return '#BA7517';
  return '#E24B4A';
}

function getMotivation(pct: number, streak: number): string {
  if (streak > 0) return `🔥 ${streak} day streak`;
  if (pct >= 0.99) return 'Perfect day! All goals met.';
  if (pct >= 0.9) return 'Outstanding! Almost at your targets for today.';
  if (pct >= 0.5) return 'You still have time to hit your protein goal today!';
  return 'Start logging your meals to track your progress.';
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

export default function DashboardScreen({ navigation }: { navigation: any }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [regionalFoods, setRegionalFoods] = useState<RegionalFood[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const storedUser = await getUser();
      if (!storedUser) {
        navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
        return;
      }
      setUser(storedUser);

      const [meData, progressData] = await Promise.all([
        apiCall<{ status: string; user: UserProfile }>('/api/auth/me', 'GET', undefined, true),
        apiCall<{ status: string; progress: ProgressData }>('/api/users/me/progress', 'GET', undefined, true),
      ]);

      setProfile(meData.user);
      setProgress(progressData.progress);

      const state = meData.user.preferred_state || meData.user.preferred_region || '';
      if (state) {
        try {
          const foodsData = await apiCall<{ state: string; foods: RegionalFood[] }>(`/api/foods/by-state/${encodeURIComponent(state)}`, 'GET', undefined, true);
          setRegionalFoods(foodsData.foods.slice(0, 3));
        } catch {
          setRegionalFoods([]);
        }
      }

      setError('');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.status === 401) {
          navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
          return;
        }
        setError('Could not load your data. Pull down to refresh.');
      } else {
        setError('Could not load your data. Pull down to refresh.');
      }
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 60000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonHeader}>
          <View style={styles.skeletonLine} />
          <View style={[styles.skeletonLine, { width: '60%' }]} />
        </View>
        <View style={styles.skeletonRing} />
        <View style={styles.skeletonBars}>
          <View style={styles.skeletonBar} />
          <View style={styles.skeletonBar} />
          <View style={styles.skeletonBar} />
        </View>
      </View>
    );
  }

  const pctCals = progress ? progress.percentages.calories : 0;
  const streak = progress ? progress.streak_days : 0;
  const healthScore = progress ? progress.health_score : 0;

  const ringProgress = Math.min(pctCals, 1);
  const ringOffset = RING_CIRCUMFERENCE * (1 - ringProgress);

  const consumedCals = progress ? progress.consumed.calories : 0;
  const targetCals = progress ? progress.targets.calories : 0;
  const remainingCals = progress ? progress.remaining.calories : 0;

  const consumedPro = progress ? progress.consumed.protein_g : 0;
  const targetPro = progress ? progress.targets.protein_g : 0;
  const consumedCarbs = progress ? progress.consumed.carbs_g : 0;
  const targetCarbs = progress ? progress.targets.carbs_g : 0;
  const consumedFats = progress ? progress.consumed.fats_g : 0;
  const targetFats = progress ? progress.targets.fats_g : 0;

  const pctPro = targetPro > 0 ? consumedPro / targetPro : 0;
  const pctCarbs = targetCarbs > 0 ? consumedCarbs / targetCarbs : 0;
  const pctFats = targetFats > 0 ? consumedFats / targetFats : 0;

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

      <View style={styles.header}>
        <Text style={styles.greeting}>{getGreeting()}, {user?.name || 'there'}</Text>
        <Text style={styles.date}>{getTodayDateString()}</Text>
        {(profile?.preferred_region || profile?.preferred_state) ? (
          <View style={styles.regionBadge}>
            <Text style={styles.regionText}>
              {profile?.preferred_state || profile?.preferred_region} 🌿
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.ringContainer}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke="#E5E7EB"
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke="#1D9E75"
            strokeWidth={RING_STROKE}
            fill="none"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={ringOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>
        <View style={styles.ringCenter}>
          <Text style={styles.ringCals}>{Math.round(consumedCals)}</Text>
          <Text style={styles.ringTarget}>/ {Math.round(targetCals)} kcal</Text>
        </View>
        <Text style={styles.ringRemaining}>{Math.round(remainingCals)} kcal remaining</Text>
      </View>

      <View style={styles.macroBars}>
        <View style={styles.macroBarItem}>
          <Text style={styles.macroLabel}>PROTEIN</Text>
          <View style={styles.macroBarBg}>
            <View style={[styles.macroBarFill, { width: `${Math.min(pctPro * 100, 100)}%`, backgroundColor: getMacroColor(pctPro) }]} />
          </View>
          <Text style={styles.macroValue}>{Math.round(consumedPro)}g / {Math.round(targetPro)}g</Text>
        </View>
        <View style={styles.macroBarItem}>
          <Text style={styles.macroLabel}>CARBS</Text>
          <View style={styles.macroBarBg}>
            <View style={[styles.macroBarFill, { width: `${Math.min(pctCarbs * 100, 100)}%`, backgroundColor: getMacroColor(pctCarbs) }]} />
          </View>
          <Text style={styles.macroValue}>{Math.round(consumedCarbs)}g / {Math.round(targetCarbs)}g</Text>
        </View>
        <View style={styles.macroBarItem}>
          <Text style={styles.macroLabel}>FATS</Text>
          <View style={styles.macroBarBg}>
            <View style={[styles.macroBarFill, { width: `${Math.min(pctFats * 100, 100)}%`, backgroundColor: getMacroColor(pctFats) }]} />
          </View>
          <Text style={styles.macroValue}>{Math.round(consumedFats)}g / {Math.round(targetFats)}g</Text>
        </View>
      </View>

      <View style={[styles.healthCard, { borderLeftColor: getHealthScoreColor(healthScore) }]}>
        <Text style={styles.healthTitle}>Today's Health Score</Text>
        <Text style={[styles.healthScore, { color: getHealthScoreColor(healthScore) }]}>{healthScore}/100</Text>
        <Text style={styles.healthSub}>{progress?.alerts.slice(0, 2).join(' · ') || ''}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Meals</Text>
        {progress && progress.meals_today.length > 0 ? (
          progress.meals_today.map((meal) => (
            <View key={meal.id} style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <Text style={styles.mealTimeLabel}>{capitalizeLabel(meal.meal_time)}</Text>
                <Text style={styles.mealTimestamp}>{formatMealTime(meal.timestamp)}</Text>
              </View>
              <Text style={styles.mealItems}>{meal.detected_items}</Text>
              <Text style={styles.mealCals}>{Math.round(meal.total_calories)} kcal · {Math.round(meal.total_protein_g)}g P</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyMeals}>
            <Text style={styles.emptyMealText}>No meals logged yet today</Text>
            <Text style={styles.emptyMealSubtext}>Tap Scan to log your first meal</Text>
            <TouchableOpacity
              style={styles.scanNowButton}
              onPress={() => navigation.navigate('Scan')}
            >
              <Text style={styles.scanNowText}>Scan Now</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {regionalFoods.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommended for you</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.regionalScroll}>
            {regionalFoods.map((food, idx) => {
              const name = food.Food_items || food.food_items || '';
              return (
                <View key={idx} style={styles.regionalCard}>
                  <Text style={styles.regionalFoodName}>{name}</Text>
                  <Text style={styles.regionalCals}>{Math.round(food.Calories || 0)} kcal</Text>
                  <Text style={styles.regionalMacros}>
                    P: {Math.round(food.Proteins || 0)}g · C: {Math.round(food.Carbohydrates || 0)}g · F: {Math.round(food.Fats || 0)}g
                  </Text>
                  <TouchableOpacity style={styles.logThisButton}>
                    <Text style={styles.logThisText}>Log This</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.streakSection}>
        <Text style={styles.motivationText}>{getMotivation(pctCals, streak)}</Text>
      </View>
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
    width: '80%',
  },
  skeletonRing: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginVertical: 24,
  },
  skeletonBars: {
    paddingHorizontal: 20,
    gap: 12,
  },
  skeletonBar: {
    height: 40,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
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
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  date: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  regionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  regionText: {
    fontSize: 13,
    color: '#1D9E75',
    fontWeight: '600',
  },
  ringContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  ringCenter: {
    position: 'absolute',
    top: RING_SIZE / 2 - 28,
    alignItems: 'center',
  },
  ringCals: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  ringTarget: {
    fontSize: 14,
    color: '#6B7280',
  },
  ringRemaining: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  macroBars: {
    gap: 12,
    marginBottom: 20,
  },
  macroBarItem: {
    gap: 4,
  },
  macroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  macroBarBg: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  macroBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  macroValue: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  healthCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  healthTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  healthScore: {
    fontSize: 36,
    fontWeight: '800',
  },
  healthSub: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
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
  mealCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#1D9E75',
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  mealTimeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D9E75',
  },
  mealTimestamp: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  mealItems: {
    fontSize: 15,
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
  emptyMealText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '600',
  },
  emptyMealSubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
  scanNowButton: {
    marginTop: 16,
    height: 40,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: '#1D9E75',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanNowText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  regionalScroll: {
    marginLeft: -20,
    paddingLeft: 20,
  },
  regionalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    width: SCREEN_WIDTH * 0.65,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  regionalFoodName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  regionalCals: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  regionalMacros: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  logThisButton: {
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logThisText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D9E75',
  },
  streakSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  motivationText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'center',
  },
});
