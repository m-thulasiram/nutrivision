import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'nutrivision_token';
const USER_KEY = 'nutrivision_user';
const PROFILE_KEY = 'nutrivision_has_profile';

export interface StoredUser {
  id: number;
  name: string;
}

function base64Decode(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  for (let bc = 0, buf = 0, j = 0; j < str.length; j++) {
    buf = (buf << 6) | chars.indexOf(str[j]);
    bc += 6;
    if (bc >= 8) {
      bc -= 8;
      output += String.fromCharCode((buf >> bc) & 0xff);
    }
  }
  return output;
}

export async function saveToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function saveUser(user: StoredUser): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getUser(): Promise<StoredUser | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveProfileFlag(): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, 'true');
}

export async function getProfileFlag(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(PROFILE_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function clearProfileFlag(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_KEY);
}

export async function clearAuth(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, PROFILE_KEY]);
}

export async function isLoggedIn(): Promise<boolean> {
  try {
    const token = await getToken();
    if (!token) return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(base64Decode(parts[1]));
    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  } catch {
    return false;
  }
}

export async function getTokenPayload(): Promise<Record<string, unknown> | null> {
  try {
    const token = await getToken();
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(base64Decode(parts[1]));
  } catch {
    return null;
  }
}
