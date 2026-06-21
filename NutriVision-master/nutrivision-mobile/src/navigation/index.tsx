// import { useEffect } from 'react'; // ARCHIVED: was used for initTF
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
// import { initTF } from '../utils/tfSetup'; // ARCHIVED: TF removed for build

import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import BiometricSetupScreen from '../screens/BiometricSetupScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ScanScreen from '../screens/ScanScreen';
import TrackerScreen from '../screens/TrackerScreen';
import ProfileScreen from '../screens/ProfileScreen';
import WorkoutScreen from '../screens/WorkoutScreen';
import PoseCheckScreen from '../screens/PoseCheckScreen';

import WorkoutResultScreen from '../screens/WorkoutResultScreen';
import CopilotScreen from '../screens/CopilotScreen';
import type { Exercise } from '../constants/exercises';

type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  BiometricSetup: undefined;
  MainTabs: undefined;
  PoseCheck: { exercise: Exercise };

  WorkoutResult: {
    exercise: Exercise;
    setsCompleted: number;
    avgFormScore: number;
    caloriesBurned: number;
    durationSec: number;
  };
};

type TabParamList = {
  Dashboard: undefined;
  Scan: undefined;
  Copilot: undefined;
  Workout: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function DashboardPlaceholder({ navigation }: any) {
  return <DashboardScreen navigation={navigation} />;
}

function ScanPlaceholder({ navigation }: any) {
  return <ScanScreen navigation={navigation} />;
}

function WorkoutPlaceholder() {
  return <WorkoutScreen />;
}

function CopilotPlaceholder() {
  return <CopilotScreen />;
}

function ProfilePlaceholder({ navigation: nav }: { navigation: any }) {
  return <ProfileScreen navigation={nav} />;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1D9E75',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardPlaceholder}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>📊</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Scan"
        component={ScanPlaceholder}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>📷</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Copilot"
        component={CopilotPlaceholder}
        options={{
          tabBarLabel: "AI Chat",
          tabBarIcon: ({ color, size = 24 }) => (
            <Text style={{ fontSize: size - 4, color }}>🤖</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Workout"
        component={WorkoutPlaceholder}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>🏋️</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfilePlaceholder}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>👤</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  // useEffect(() => {
  //   initTF().catch((err) => console.warn('Failed to pre-initialize TF on startup:', err));
  // }, []); // ARCHIVED: TF removed for build

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen
          name="SignIn"
          component={SignInScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="SignUp"
          component={SignUpScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="ForgotPassword"
          component={ForgotPasswordScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="BiometricSetup"
          component={BiometricSetupScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ animation: 'fade' }}
        />
        <Stack.Screen
          name="PoseCheck"
          component={PoseCheckScreen}
          options={{
            headerShown: false,
            presentation: "fullScreenModal"
          }}
        />
        <Stack.Screen
          name="WorkoutResult"
          component={WorkoutResultScreen}
          options={{
            headerShown: false,
            presentation: "fullScreenModal"
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

