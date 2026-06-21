import type { Exercise } from "../constants/exercises";

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  BiometricSetup: undefined;
  GoalMode: undefined;
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
