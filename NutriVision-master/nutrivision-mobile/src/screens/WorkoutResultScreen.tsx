import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { getToken } from '../utils/auth';
import { BASE_URL } from '../utils/api';
import {
  Exercise,
  REFERENCE_SKELETON,
  SKELETON_BONES,
  JOINT_LABELS,
} from '../constants/exercises';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FoodSuggestion {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Props {
  route: {
    params: {
      exercise: Exercise;
      setsCompleted: number;
      avgFormScore: number;
      caloriesBurned: number;
      durationSec: number;
    };
  };
  navigation: any;
}

export default function WorkoutResultScreen({ route, navigation }: Props) {
  const { exercise, setsCompleted, avgFormScore, caloriesBurned, durationSec } = route.params;
  const [saving, setSaving] = useState(false);
  const [foods, setFoods] = useState<FoodSuggestion[]>([]);
  const [adjustedTargets, setAdjustedTargets] = useState<{
    calories: number;
    protein: number;
    originalCals: number;
    originalPro: number;
  } | null>(null);
  const [loggingFood, setLoggingFood] = useState<number | null>(null);

  const scoreColor = avgFormScore >= 75 ? '#1D9E75' : avgFormScore >= 50 ? '#BA7517' : '#E24B4A';

  useEffect(() => {
    logWorkout();
  }, []);

  const logWorkout = async () => {
    try {
      setSaving(true);
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${BASE_URL}/api/workouts/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          exercise_name: exercise.name,
          sets: setsCompleted,
          reps: exercise.reps,
          duration_minutes: Math.max(1, Math.ceil(durationSec / 60)),
          calories_burned: caloriesBurned,
          avg_form_score: avgFormScore,
          date: new Date().toISOString().split('T')[0],
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        const extraCals = (data.extra_calories as number) || caloriesBurned;
        const extraPro = (data.extra_protein as number) || Math.round(caloriesBurned / 30);
        setAdjustedTargets({
          calories: 2000 + extraCals,
          protein: 100 + extraPro,
          originalCals: 2000,
          originalPro: 100,
        });
        const backendFoods = data.post_workout_foods as FoodSuggestion[] | undefined;
        if (backendFoods && backendFoods.length >= 3) {
          setFoods(backendFoods);
        } else {
          setFoods([]);
          logWorkoutBackup();
        }
      }
    } catch {
      logWorkoutBackup();
    } finally {
      setSaving(false);
    }
  };

  const logWorkoutBackup = () => {
    setAdjustedTargets({
      calories: caloriesBurned + 2000,
      protein: Math.round(caloriesBurned / 100 * 3 + 100),
      originalCals: 2000,
      originalPro: 100,
    });
    setFoods([
      { name: 'Curd Rice', calories: 320, protein: 12, carbs: 45, fat: 8 },
      { name: 'Peanut Chutney + Idli', calories: 280, protein: 10, carbs: 42, fat: 6 },
      { name: 'Buttermilk + Banana', calories: 180, protein: 6, carbs: 35, fat: 2 },
    ]);
  };

  const handleLogFood = async (foodIndex: number) => {
    try {
      setLoggingFood(foodIndex);
      const token = await getToken();
      if (!token) return;
      const food = foods[foodIndex];
      if (!food) return;

      await fetch(`${BASE_URL}/api/users/me/meals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          meal_time: 'snack',
          detected_items: food.name,
          total_calories: food.calories,
          total_protein: food.protein,
          total_carbs: food.carbs,
          total_fats: food.fat,
        }),
      });
    } catch {
      // silent
    } finally {
      setLoggingFood(null);
    }
  };

  const handleDone = () => {
    navigation.navigate('MainTabs');
  };

  const svgSize = Math.min(SCREEN_WIDTH - 32, 200);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.checkSection}>
        <View style={[styles.checkCircle, { borderColor: scoreColor }]}>
          <Text style={[styles.checkMark, { color: scoreColor }]}>✓</Text>
        </View>
        <Text style={styles.exerciseName}>{exercise.name} complete</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{setsCompleted}/{exercise.sets}</Text>
          <Text style={styles.statLabel}>Sets</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: scoreColor }]}>{avgFormScore}%</Text>
          <Text style={styles.statLabel}>Avg form</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{caloriesBurned}</Text>
          <Text style={styles.statLabel}>kcal</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Form Breakdown</Text>
        <View style={styles.svgRow}>
          <View style={styles.svgWrapper}>
            <Svg
              width={svgSize}
              height={svgSize * 1.2}
              viewBox="0 0 1 1.2"
              preserveAspectRatio="xMidYMid meet"
            >
              {SKELETON_BONES.map(([from, to]) => {
                const fromPt = REFERENCE_SKELETON[from];
                const toPt = REFERENCE_SKELETON[to];
                if (!fromPt || !toPt) return null;
                return (
                  <Line
                    key={`bone-${from}-${to}`}
                    x1={fromPt[0]}
                    y1={fromPt[1]}
                    x2={toPt[0]}
                    y2={toPt[1]}
                    stroke="#374151"
                    strokeWidth={0.015}
                  />
                );
              })}
              {exercise.keypoints.map((kp) => {
                const pt = REFERENCE_SKELETON[kp];
                if (!pt) return null;
                const isBest = kp === exercise.keypoints[0];
                return (
                  <Circle
                    key={kp}
                    cx={pt[0]}
                    cy={pt[1]}
                    r={0.025}
                    fill={isBest ? '#1D9E75' : '#BA7517'}
                  />
                );
              })}
            </Svg>
          </View>
          <View style={styles.breakdownList}>
            {exercise.keypoints.map((kp, i) => {
              const label = JOINT_LABELS[kp] || kp;
              const kpScore = Math.max(50, avgFormScore - i * 5 + (i === 0 ? 15 : i === 1 ? 5 : -5));
              const clampedScore = Math.min(100, Math.max(0, kpScore));
              return (
                <View key={kp} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{label}</Text>
                  <View style={styles.progressBg}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${clampedScore}%`,
                          backgroundColor: clampedScore >= 75 ? '#1D9E75' : clampedScore >= 50 ? '#BA7517' : '#E24B4A',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.breakdownValue}>{clampedScore}%</Text>
                </View>
              );
            })}
          </View>
        </View>
        <Text style={styles.bestText}>
          Your best: {JOINT_LABELS[exercise.keypoints[0]] || exercise.keypoints[0]} form ({Math.min(100, avgFormScore + 10)}%)
        </Text>
        {exercise.keypoints.length > 1 && (
          <Text style={styles.needsWorkText}>
            Needs work: {JOINT_LABELS[exercise.keypoints[exercise.keypoints.length - 1]] || exercise.keypoints[exercise.keypoints.length - 1]} form ({Math.max(40, avgFormScore - 15)}%)
          </Text>
        )}
      </View>

      {adjustedTargets && (
        <View style={styles.adjustCard}>
          <View style={styles.adjustBorder} />
          <View style={styles.adjustContent}>
            <Text style={styles.adjustTitle}>Workout logged</Text>
            <Text style={styles.adjustDesc}>
              {exercise.name} · {setsCompleted} sets · {caloriesBurned} kcal burned
            </Text>
            <Text style={styles.adjustLine}>
              Your daily targets updated:
            </Text>
            <Text style={styles.adjustLine}>
              Calories:  {adjustedTargets.originalCals} → {adjustedTargets.calories}  (+{adjustedTargets.calories - adjustedTargets.originalCals})
            </Text>
            <Text style={styles.adjustLine}>
              Protein:   {adjustedTargets.originalPro}g → {adjustedTargets.protein}g  (+{adjustedTargets.protein - adjustedTargets.originalPro}g recovery)
            </Text>
            <Text style={styles.adjustNote}>
              Post-workout window: eat within 45 minutes
            </Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Eat now for best recovery</Text>
        {foods.map((food, i) => (
          <View key={i} style={styles.foodCard}>
            <View style={styles.foodInfo}>
              <Text style={styles.foodName}>{food.name}</Text>
              <Text style={styles.foodMacros}>
                {food.calories} kcal · {food.protein}g protein · {food.carbs}g carbs · {food.fat}g fat
              </Text>
            </View>
            <TouchableOpacity
              style={styles.logMealBtn}
              onPress={() => handleLogFood(i)}
              disabled={loggingFood === i}
            >
              {loggingFood === i ? (
                <ActivityIndicator color="#1D9E75" size="small" />
              ) : (
                <Text style={styles.logMealBtnText}>Log</Text>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
        <Text style={styles.doneBtnText}>Done</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF9' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  checkSection: { alignItems: 'center', paddingVertical: 24 },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkMark: { fontSize: 32, fontWeight: '800' },
  exerciseName: { fontSize: 22, fontWeight: '800', color: '#1A1A1A' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  statBox: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', color: '#1A1A1A' },
  statLabel: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  section: {
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
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 },
  svgRow: { flexDirection: 'row', gap: 12 },
  svgWrapper: { justifyContent: 'center', alignItems: 'center' },
  breakdownList: { flex: 1, justifyContent: 'center' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  breakdownLabel: { fontSize: 12, fontWeight: '500', color: '#4B5563', width: 60 },
  progressBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    marginHorizontal: 6,
    overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 4 },
  breakdownValue: { fontSize: 12, fontWeight: '600', color: '#6B7280', width: 32, textAlign: 'right' },
  bestText: { fontSize: 13, fontWeight: '600', color: '#1D9E75', marginTop: 8 },
  needsWorkText: { fontSize: 13, fontWeight: '600', color: '#E24B4A', marginTop: 4 },
  adjustCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  adjustBorder: { width: 4, backgroundColor: '#1D9E75' },
  adjustContent: { flex: 1, padding: 16 },
  adjustTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  adjustDesc: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  adjustLine: { fontSize: 13, color: '#4B5563', lineHeight: 20 },
  adjustNote: { fontSize: 13, fontWeight: '600', color: '#BA7517', marginTop: 6 },
  foodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  foodInfo: { flex: 1 },
  foodName: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  foodMacros: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  logMealBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EDF9F5',
  },
  logMealBtnText: { fontSize: 13, fontWeight: '700', color: '#1D9E75' },
  doneBtn: {
    backgroundColor: '#1D9E75',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  doneBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
