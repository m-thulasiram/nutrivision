import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import InputField from '../components/InputField';
import PrimaryButton from '../components/PrimaryButton';
import { apiCall, ApiRequestError } from '../utils/api';
import { getUser, saveUser, saveProfileFlag } from '../utils/auth';

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Desk job, little exercise' },
  { value: 'light', label: 'Lightly Active', desc: 'Light exercise 1-3 days/week' },
  { value: 'moderate', label: 'Moderately Active', desc: 'Moderate exercise 3-5 days/week' },
  { value: 'active', label: 'Very Active', desc: 'Hard exercise 6-7 days/week' },
  { value: 'very_active', label: 'Athlete', desc: 'Physical job or 2x training' },
];

const GOALS = [
  { value: 'weight_loss', label: 'Weight Loss' },
  { value: 'muscle_gain', label: 'Muscle Gain' },
  { value: 'maintain', label: 'Maintain Weight' },
];

const GENDERS = ['Male', 'Female'];

const REGIONS = [
  'Tamil Nadu',
  'Kerala',
  'Karnataka',
  'Andhra Pradesh',
  'Telangana',
  'Maharashtra',
  'Punjab',
  'Gujarat',
  'West Bengal',
  'Rajasthan',
  'Delhi',
  'Other',
];

interface UserProfile {
  id: number;
  name: string;
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
  preferred_region?: string;
  preferred_state?: string;
}

interface BiometricSetupScreenProps {
  navigation: any;
}

export default function BiometricSetupScreen({
  navigation,
}: BiometricSetupScreenProps) {
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [goal, setGoal] = useState('');
  const [region, setRegion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearError = () => {
    if (error) setError('');
    if (Object.keys(fieldErrors).length > 0) setFieldErrors({});
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    let valid = true;

    const ageNum = parseInt(age, 10);
    if (!age || isNaN(ageNum) || ageNum < 10 || ageNum > 100) {
      errors.age = 'Enter a valid age (10–100).';
      valid = false;
    }

    if (!gender) {
      errors.gender = 'Select your gender.';
      valid = false;
    }

    const heightNum = parseFloat(height);
    if (!height || isNaN(heightNum) || heightNum < 100 || heightNum > 250) {
      errors.height = 'Enter a valid height (100–250 cm).';
      valid = false;
    }

    const weightNum = parseFloat(weight);
    if (!weight || isNaN(weightNum) || weightNum < 20 || weightNum > 300) {
      errors.weight = 'Enter a valid weight (20–300 kg).';
      valid = false;
    }

    if (!activityLevel) {
      errors.activityLevel = 'Select your activity level.';
      valid = false;
    }

    if (!goal) {
      errors.goal = 'Select your goal.';
      valid = false;
    }

    if (!region) {
      errors.region = 'Select your region.';
      valid = false;
    }

    setFieldErrors(errors);
    return valid;
  };

  const handleCalculate = async () => {
    clearError();
    if (!validate()) return;

    setLoading(true);
    try {
      const storedUser = await getUser();
      if (!storedUser?.name) {
        setError('Session expired. Please sign in again.');
        setLoading(false);
        return;
      }

      await apiCall<{ status: string; user: { id: number; name: string } }>(
        '/api/users/profile',
        'POST',
        {
          name: storedUser.name,
          age: parseInt(age, 10),
          gender: gender.toLowerCase(),
          height_cm: parseFloat(height),
          weight_kg: parseFloat(weight),
          activity_level: activityLevel,
          goal,
          preferred_region: region,
          preferred_state: region,
        },
        true,
      );

      const meData = await apiCall<{
        status: string;
        user: UserProfile;
      }>('/api/auth/me', 'GET', undefined, true);

      await saveUser({ id: meData.user.id, name: meData.user.name });
      setProfile(meData.user);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    await saveProfileFlag();
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
  };

  if (profile) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAF9" />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.resultIcon}>🎉</Text>
            <Text style={styles.title}>Your Nutrition Targets</Text>
            <Text style={styles.subtitle}>
              Personalised based on your profile
            </Text>
          </View>

          <View style={styles.resultsCard}>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Daily Calories</Text>
              <Text style={styles.resultValue}>
                {profile.target_calories} kcal
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Protein</Text>
              <Text style={styles.resultValue}>
                {profile.target_protein}g
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Carbs</Text>
              <Text style={styles.resultValue}>{profile.target_carbs}g</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Fats</Text>
              <Text style={styles.resultValue}>{profile.target_fats}g</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>BMR</Text>
              <Text style={styles.resultValue}>{profile.bmr} kcal</Text>
            </View>
          </View>

          <View style={styles.completeButton}>
            <PrimaryButton title="Let's Go" onPress={handleComplete} />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAF9" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Tell us about yourself</Text>
          <Text style={styles.subtitle}>
            We use this to calculate your daily nutrition targets
          </Text>
        </View>

        <View style={styles.form}>
          <InputField
            label="Age"
            value={age}
            onChangeText={(t) => {
              setAge(t);
              clearError();
            }}
            placeholder="10–100"
            keyboardType="number-pad"
            error={fieldErrors.age}
          />

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Gender</Text>
            <View style={styles.segmentedControl}>
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.segment,
                    gender === g && styles.segmentActive,
                  ]}
                  onPress={() => {
                    setGender(g);
                    clearError();
                  }}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      gender === g && styles.segmentTextActive,
                    ]}
                  >
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {fieldErrors.gender ? (
              <Text style={styles.fieldError}>{fieldErrors.gender}</Text>
            ) : null}
          </View>

          <InputField
            label="Height (cm)"
            value={height}
            onChangeText={(t) => {
              setHeight(t);
              clearError();
            }}
            placeholder="100–250"
            keyboardType="decimal-pad"
            error={fieldErrors.height}
          />

          <InputField
            label="Weight (kg)"
            value={weight}
            onChangeText={(t) => {
              setWeight(t);
              clearError();
            }}
            placeholder="20–300"
            keyboardType="decimal-pad"
            error={fieldErrors.weight}
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
                  onPress={() => {
                    setActivityLevel(a.value);
                    clearError();
                  }}
                >
                  <Text
                    style={[
                      styles.optionTitle,
                      activityLevel === a.value && styles.optionTitleActive,
                    ]}
                  >
                    {a.label}
                  </Text>
                  <Text
                    style={[
                      styles.optionDesc,
                      activityLevel === a.value && styles.optionDescActive,
                    ]}
                  >
                    {a.desc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {fieldErrors.activityLevel ? (
              <Text style={styles.fieldError}>{fieldErrors.activityLevel}</Text>
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Goal</Text>
            <View style={styles.chipRow}>
              {GOALS.map((g) => (
                <TouchableOpacity
                  key={g.value}
                  style={[styles.chip, goal === g.value && styles.chipActive]}
                  onPress={() => {
                    setGoal(g.value);
                    clearError();
                  }}
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
            {fieldErrors.goal ? (
              <Text style={styles.fieldError}>{fieldErrors.goal}</Text>
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Region</Text>
            <View style={styles.chipRow}>
              {REGIONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.chip, region === r && styles.chipActive]}
                  onPress={() => {
                    setRegion(r);
                    clearError();
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      region === r && styles.chipTextActive,
                    ]}
                  >
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {fieldErrors.region ? (
              <Text style={styles.fieldError}>{fieldErrors.region}</Text>
            ) : null}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <PrimaryButton
            title="Calculate My Targets"
            onPress={handleCalculate}
            loading={loading}
            disabled={loading}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAF9',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  form: {
    gap: 4,
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
  fieldError: {
    fontSize: 12,
    color: '#E24B4A',
    marginTop: 4,
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
    marginBottom: 2,
  },
  optionTitleActive: {
    color: '#1D9E75',
  },
  optionDesc: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  optionDescActive: {
    color: '#6B7280',
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
  errorText: {
    fontSize: 13,
    color: '#E24B4A',
    textAlign: 'center',
    marginBottom: 12,
    backgroundColor: '#FEF2F2',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    overflow: 'hidden',
  },
  resultIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  resultsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 32,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  resultLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  resultValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1D9E75',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  completeButton: {
    paddingBottom: 32,
  },
});
