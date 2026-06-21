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
  Alert,
} from 'react-native';
import InputField from '../components/InputField';
import PrimaryButton from '../components/PrimaryButton';
import { apiCall, ApiRequestError, BASE_URL } from '../utils/api';
import { saveToken, saveUser, saveProfileFlag } from '../utils/auth';

interface SignInScreenProps {
  navigation: any;
}

export default function SignInScreen({ navigation }: SignInScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const clearError = () => {
    if (error) setError('');
    if (fieldErrors.email || fieldErrors.password) setFieldErrors({});
  };

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    let valid = true;

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
    }

    setFieldErrors(errors);
    return valid;
  };

  const handleSignIn = async () => {
    clearError();
    if (!validate()) return;

    setLoading(true);
    try {
      const data = await apiCall<{
        status: string;
        token: string;
        user: { id: number; name: string; email: string };
      }>('/api/auth/login', 'POST', {
        email: email.trim().toLowerCase(),
        password,
      });

      const token = data.token;
      const user = data.user;

      await saveToken(token);
      await saveUser(user);

      const meRes = await fetch(`${BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        const weight = meData.user?.weight_kg;
        if (weight && parseFloat(weight) > 0) {
          await saveProfileFlag();
          navigation.reset({
            index: 0,
            routes: [{ name: 'MainTabs' }],
          });
        } else {
          navigation.reset({
            index: 0,
            routes: [{ name: 'BiometricSetup' }],
          });
        }
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'BiometricSetup' }],
        });
      }
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

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword');
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
          <Text style={styles.subtitle}>Welcome back to your nutrition hub</Text>
        </View>

        <View style={styles.form}>
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

          <InputField
            label="Password"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              clearError();
            }}
            placeholder="Enter your password"
            secureTextEntry
            error={fieldErrors.password}
          />

          <TouchableOpacity
            onPress={handleForgotPassword}
            style={styles.forgotRow}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <PrimaryButton
            title="Sign In"
            onPress={handleSignIn}
            loading={loading}
            disabled={loading}
          />
        </View>

        <View style={styles.bottomRow}>
          <Text style={styles.bottomText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.replace('SignUp')}>
            <Text style={styles.bottomLink}>Sign Up</Text>
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
    marginBottom: 40,
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
  forgotRow: {
    alignItems: 'flex-end',
    marginBottom: 16,
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    color: '#1D9E75',
    fontWeight: '600',
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
