import { useState, useMemo } from 'react';
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
import { saveToken, saveUser, clearProfileFlag } from '../utils/auth';

interface SignUpScreenProps {
  navigation: any;
}

function getPasswordStrength(password: string): {
  label: string;
  color: string;
  width: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { label: 'Weak', color: '#E24B4A', width: '33%' };
  if (score <= 4) return { label: 'Medium', color: '#BA7517', width: '66%' };
  return { label: 'Strong', color: '#1D9E75', width: '100%' };
}

export default function SignUpScreen({ navigation }: SignUpScreenProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [age, setAge] = useState('30');
  const [gender, setGender] = useState('male');
  const [heightCm, setHeightCm] = useState('175');
  const [weightKg, setWeightKg] = useState('70');
  const [activityLevel, setActivityLevel] = useState('moderate');
  const [goal, setGoal] = useState('maintain');
  const [showHealthFields, setShowHealthFields] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const passwordStrength = useMemo(
    () => getPasswordStrength(password),
    [password],
  );

  const clearError = () => {
    if (error) setError('');
    if (Object.keys(fieldErrors).length > 0) setFieldErrors({});
  };

  const validate = (): boolean => {
    const errors: {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};
    let valid = true;

    if (!name.trim()) {
      errors.name = 'Full name is required.';
      valid = false;
    }

    if (!email.trim()) {
      errors.email = 'Email is required.';
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Enter a valid email address.';
      valid = false;
    }

    if (!password) {
      errors.password = 'Password is required.';
      valid = false;
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
      valid = false;
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.';
      valid = false;
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
      valid = false;
    }

    setFieldErrors(errors);
    return valid;
  };

  const handleSignUp = async () => {
    clearError();
    if (!validate()) return;

    setLoading(true);
    try {
      const data = await apiCall<{
        status: string;
        token: string;
        user: { id: number; name: string; email: string };
      }>('/api/auth/register', 'POST', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        age: Number(age) || 30,
        gender,
        height_cm: Number(heightCm) || 175,
        weight_kg: Number(weightKg) || 70,
        activity_level: activityLevel,
        goal,
      });

      const token = data.token;
      const user = data.user;

      await saveToken(token);
      await saveUser(user);
      await clearProfileFlag();

      navigation.replace('BiometricSetup');
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
          <Text style={styles.logoIcon}>🌿</Text>
          <Text style={styles.logoText}>
            Nutri<Text style={styles.logoAccent}>Vision</Text>
          </Text>
          <Text style={styles.subtitle}>
            Start your AI-powered nutrition journey
          </Text>
        </View>

        <View style={styles.form}>
          <InputField
            label="Full Name"
            value={name}
            onChangeText={(t) => {
              setName(t);
              clearError();
            }}
            placeholder="Enter your full name"
            autoCapitalize="words"
            error={fieldErrors.name}
          />

          <InputField
            label="Email"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              clearError();
            }}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            error={fieldErrors.email}
          />

          <View>
            <InputField
              label="Password"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                clearError();
              }}
              placeholder="Min 8 characters"
              secureTextEntry
              error={fieldErrors.password}
            />
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBar}>
                  <View
                    style={[
                      styles.strengthFill,
                      {
                        width: passwordStrength.width as any,
                        backgroundColor: passwordStrength.color,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.strengthLabel,
                    { color: passwordStrength.color },
                  ]}
                >
                  {passwordStrength.label}
                </Text>
              </View>
            )}
          </View>

          <InputField
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={(t) => {
              setConfirmPassword(t);
              clearError();
            }}
            placeholder="Re-enter your password"
            secureTextEntry
            error={fieldErrors.confirmPassword}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            onPress={() => setShowHealthFields(!showHealthFields)}
            style={styles.healthToggle}
          >
            <Text style={styles.healthToggleText}>
              {showHealthFields ? '− Hide health details' : '+ Add health details (optional)'}
            </Text>
          </TouchableOpacity>

          {showHealthFields && (
            <View style={styles.healthFields}>
              <InputField
                label="Age"
                value={age}
                onChangeText={setAge}
                placeholder="30"
                keyboardType="numeric"
              />
              <InputField
                label="Gender"
                value={gender}
                onChangeText={setGender}
                placeholder="male / female"
                autoCapitalize="none"
              />
              <InputField
                label="Height (cm)"
                value={heightCm}
                onChangeText={setHeightCm}
                placeholder="175"
                keyboardType="numeric"
              />
              <InputField
                label="Weight (kg)"
                value={weightKg}
                onChangeText={setWeightKg}
                placeholder="70"
                keyboardType="numeric"
              />
              <InputField
                label="Activity Level"
                value={activityLevel}
                onChangeText={setActivityLevel}
                placeholder="sedentary / light / moderate / active / very_active"
                autoCapitalize="none"
              />
              <InputField
                label="Goal"
                value={goal}
                onChangeText={setGoal}
                placeholder="maintain / weight_loss / muscle_gain"
                autoCapitalize="none"
              />
            </View>
          )}

          <PrimaryButton
            title="Create Account"
            onPress={handleSignUp}
            loading={loading}
            disabled={loading}
          />
        </View>

        <View style={styles.bottomRow}>
          <Text style={styles.bottomText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.replace('SignIn')}>
            <Text style={styles.bottomLink}>Sign In</Text>
          </TouchableOpacity>
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
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  logoAccent: {
    color: '#1D9E75',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
  },
  form: {
    gap: 4,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -8,
    marginBottom: 16,
    gap: 8,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    width: 50,
    textAlign: 'right',
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
  healthToggle: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  healthToggleText: {
    fontSize: 14,
    color: '#1D9E75',
    fontWeight: '600',
  },
  healthFields: {
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  bottomText: {
    fontSize: 14,
    color: '#6B7280',
  },
  bottomLink: {
    fontSize: 14,
    color: '#1D9E75',
    fontWeight: '700',
  },
});
