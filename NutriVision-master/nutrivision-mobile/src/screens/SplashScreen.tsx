import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { isLoggedIn, getToken, saveProfileFlag, getProfileFlag } from '../utils/auth';
import { BASE_URL } from '../utils/api';

interface SplashScreenProps {
  navigation: any;
}

export default function SplashScreen({ navigation }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const loggedIn = await isLoggedIn();
      if (loggedIn) {
        const token = await getToken();
        if (!token) {
          navigation.replace('SignIn');
          return;
        }

        const hasProfileLocal = await getProfileFlag();
        if (hasProfileLocal) {
          navigation.replace('MainTabs');
          return;
        }

        try {
          const res = await fetch(`${BASE_URL}/api/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            const weight = data.user?.weight_kg;
            if (weight && parseFloat(weight) > 0) {
              await saveProfileFlag();
              navigation.replace('MainTabs');
            } else {
              navigation.replace('BiometricSetup');
            }
          } else {
            navigation.replace('SignIn');
          }
        } catch {
          if (hasProfileLocal) {
            navigation.replace('MainTabs');
          } else {
            navigation.replace('BiometricSetup');
          }
        }
      } else {
        navigation.replace('SignIn');
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F6E56" />
      <View style={styles.gradient} />
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>🌿</Text>
          <Text style={styles.logoText}>
            Nutri<Text style={styles.logoAccent}>Vision</Text>
          </Text>
        </View>
        <Text style={styles.tagline}>
          Your AI-Powered Nutrition Intelligence
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1D9E75',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#0F6E56',
    opacity: 0.3,
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoIcon: {
    fontSize: 40,
    marginRight: 8,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  logoAccent: {
    color: '#A7F3D0',
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
