import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import InputField from '../components/InputField';
import PrimaryButton from '../components/PrimaryButton';
import { apiCall, ApiRequestError, BASE_URL } from '../utils/api';
import { getToken, clearAuth, saveProfileFlag } from '../utils/auth';

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Lightly Active' },
  { value: 'moderate', label: 'Moderately Active' },
  { value: 'active', label: 'Very Active' },
  { value: 'very_active', label: 'Athlete' },
];

const GOALS = [
  { value: 'weight_loss', label: 'Weight Loss' },
  { value: 'muscle_gain', label: 'Muscle Gain' },
  { value: 'maintain', label: 'Maintain Weight' },
];

interface ProfileData {
  age: number;
  gender: string;
  height_cm: number;
  weight_kg: number;
  activity_level: string;
  goal: string;
  bmr: number;
  tdee: number;
  target_calories: number;
  target_protein: number;
  target_carbs: number;
  target_fats: number;
}

interface ProfileScreenProps {
  navigation: any;
}

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [goal, setGoal] = useState('');

  const [savedTargets, setSavedTargets] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const u = data.user;
        const p: ProfileData = {
          age: u.age || 30,
          gender: u.gender || 'male',
          height_cm: u.height_cm || 175,
          weight_kg: u.weight_kg || 70,
          activity_level: u.activity_level || 'moderate',
          goal: u.goal || 'maintain',
          bmr: u.bmr || 0,
          tdee: u.tdee || 0,
          target_calories: u.target_calories || 0,
          target_protein: u.target_protein || 0,
          target_carbs: u.target_carbs || 0,
          target_fats: u.target_fats || 0,
        };
        setProfile(p);
        setAge(String(p.age));
        setGender(p.gender);
        setHeight(String(p.height_cm));
        setWeight(String(p.weight_kg));
        setActivityLevel(p.activity_level);
        setGoal(p.goal);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setSavedTargets(null);
    try {
      const token = await getToken();
      const data = await apiCall<{ status: string; user: ProfileData }>(
        '/api/users/profile',
        'POST',
        {
          name: '',
          age: parseInt(age, 10) || profile.age,
          gender: gender || profile.gender,
          height_cm: parseFloat(height) || profile.height_cm,
          weight_kg: parseFloat(weight) || profile.weight_kg,
          activity_level: activityLevel || profile.activity_level,
          goal: goal || profile.goal,
        },
        true,
      );
      if (data.user) {
        const u = data.user;
        const updated: ProfileData = {
          age: u.age || parseInt(age, 10) || profile.age,
          gender: u.gender || gender || profile.gender,
          height_cm: u.height_cm || parseFloat(height) || profile.height_cm,
          weight_kg: u.weight_kg || parseFloat(weight) || profile.weight_kg,
          activity_level: u.activity_level || activityLevel || profile.activity_level,
          goal: u.goal || goal || profile.goal,
          bmr: u.bmr || profile.bmr,
          tdee: u.tdee || profile.tdee,
          target_calories: u.target_calories || profile.target_calories,
          target_protein: u.target_protein || profile.target_protein,
          target_carbs: u.target_carbs || profile.target_carbs,
          target_fats: u.target_fats || profile.target_fats,
        };
        setProfile(updated);
        await saveProfileFlag();
        setEditing(false);
        setSavedTargets(
          `${updated.target_calories} kcal · ${updated.target_protein}g protein · ${updated.target_carbs}g carbs · ${updated.target_fats}g fat`,
        );
      }
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'Failed to save';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await clearAuth();
    navigation.reset({
      index: 0,
      routes: [{ name: 'SignIn' }],
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAF9" />
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAF9" />

      <View style={styles.header}>
        <Text style={styles.icon}>👤</Text>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Manage your metrics and nutrition targets</Text>
      </View>

      {profile && (
        <>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Current Metrics</Text>
              {!editing && (
                <TouchableOpacity onPress={() => setEditing(true)}>
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {editing ? (
              <View>
                <InputField
                  label="Age"
                  value={age}
                  onChangeText={setAge}
                  placeholder="30"
                  keyboardType="number-pad"
                />
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Gender</Text>
                  <View style={styles.segmentedControl}>
                    {['male', 'female'].map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[
                          styles.segment,
                          gender === g && styles.segmentActive,
                        ]}
                        onPress={() => setGender(g)}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            gender === g && styles.segmentTextActive,
                          ]}
                        >
                          {g === 'male' ? 'Male' : 'Female'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <InputField
                  label="Height (cm)"
                  value={height}
                  onChangeText={setHeight}
                  placeholder="175"
                  keyboardType="decimal-pad"
                />
                <InputField
                  label="Weight (kg)"
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="70"
                  keyboardType="decimal-pad"
                />
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Activity Level</Text>
                  <View style={styles.optionsList}>
                    {ACTIVITY_LEVELS.map((a) => (
                      <TouchableOpacity
                        key={a.value}
                        style={[
                          styles.optionItem,
                          activityLevel === a.value && styles.optionItemActive,
                        ]}
                        onPress={() => setActivityLevel(a.value)}
                      >
                        <Text
                          style={[
                            styles.optionTitle,
                            activityLevel === a.value && styles.optionTitleActive,
                          ]}
                        >
                          {a.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Goal</Text>
                  <View style={styles.chipRow}>
                    {GOALS.map((g) => (
                      <TouchableOpacity
                        key={g.value}
                        style={[styles.chip, goal === g.value && styles.chipActive]}
                        onPress={() => setGoal(g.value)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            goal === g.value && styles.chipTextActive,
                          ]}
                        >
                          {g.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.editActions}>
                  <PrimaryButton
                    title="Save Changes"
                    onPress={handleSave}
                    loading={saving}
                    disabled={saving}
                  />
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setEditing(false);
                      setAge(String(profile.age));
                      setGender(profile.gender);
                      setHeight(String(profile.height_cm));
                      setWeight(String(profile.weight_kg));
                      setActivityLevel(profile.activity_level);
                      setGoal(profile.goal);
                    }}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Age</Text>
                  <Text style={styles.metricValue}>{profile.age}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Gender</Text>
                  <Text style={styles.metricValue}>{profile.gender === 'male' ? 'Male' : 'Female'}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Height</Text>
                  <Text style={styles.metricValue}>{profile.height_cm} cm</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Weight</Text>
                  <Text style={styles.metricValue}>{profile.weight_kg} kg</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Activity</Text>
                  <Text style={styles.metricValue}>{profile.activity_level}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Goal</Text>
                  <Text style={styles.metricValue}>{profile.goal.replace('_', ' ')}</Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nutrition Targets</Text>
            <View style={styles.targetRow}>
              <Text style={styles.targetLabel}>BMR</Text>
              <Text style={styles.targetValue}>{profile.bmr} kcal</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.targetRow}>
              <Text style={styles.targetLabel}>TDEE</Text>
              <Text style={styles.targetValue}>{profile.tdee} kcal</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.targetRow}>
              <Text style={styles.targetLabel}>Daily Calories</Text>
              <Text style={styles.targetValue}>{profile.target_calories} kcal</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.targetRow}>
              <Text style={styles.targetLabel}>Protein</Text>
              <Text style={styles.targetValue}>{profile.target_protein}g</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.targetRow}>
              <Text style={styles.targetLabel}>Carbs</Text>
              <Text style={styles.targetValue}>{profile.target_carbs}g</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.targetRow}>
              <Text style={styles.targetLabel}>Fats</Text>
              <Text style={styles.targetValue}>{profile.target_fats}g</Text>
            </View>
          </View>

          {savedTargets && (
            <View style={styles.successCard}>
              <Text style={styles.successIcon}>✅</Text>
              <Text style={styles.successTitle}>Targets Updated</Text>
              <Text style={styles.successSubtitle}>New targets: {savedTargets}</Text>
            </View>
          )}
        </>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAF9',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  icon: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  editLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1D9E75',
    marginBottom: 12,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  metricLabel: {
    fontSize: 15,
    color: '#6B7280',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'capitalize',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  targetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  targetLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  targetValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1D9E75',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  segmentActive: {
    backgroundColor: '#1D9E75',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  optionsList: {
    gap: 8,
  },
  optionItem: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  optionItemActive: {
    borderColor: '#1D9E75',
    backgroundColor: '#F0FDF4',
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  optionTitleActive: {
    color: '#1D9E75',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    borderColor: '#1D9E75',
    backgroundColor: '#1D9E75',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  editActions: {
    gap: 8,
    marginTop: 8,
  },
  cancelButton: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  successCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  successIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1D9E75',
    marginBottom: 4,
  },
  successSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  logoutButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E24B4A',
  },
});
