import Constants from 'expo-constants';
import { getToken } from './auth';

export const BASE_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  ((Constants as any).manifest?.extra?.apiUrl as string | undefined) ??
  'http://192.168.29.167:8000';

export interface ApiError {
  status: number;
  message: string;
}

export class ApiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiRequestError';
  }
}

export async function apiCall<T = unknown>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: Record<string, unknown>,
  requiresAuth = false,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (requiresAuth) {
    const token = await getToken();
    if (!token) {
      throw new ApiRequestError(401, 'Authentication required.');
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, config);
  } catch {
    throw new ApiRequestError(0, 'Connection failed. Check your internet.');
  }

  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch {
    throw new ApiRequestError(response.status, 'Something went wrong. Please try again.');
  }

  if (!response.ok) {
    const message = getErrorMessage(response.status, data);
    throw new ApiRequestError(response.status, message);
  }

  return data as T;
}

function getErrorMessage(status: number, data: Record<string, unknown>): string {
  const detail = data.detail as string | undefined;

  if (detail) return detail;

  switch (status) {
    case 401:
      return 'Incorrect email or password.';
    case 409:
      return 'An account with this email already exists.';
    case 422:
      return 'Please check your details and try again.';
    case 500:
      return 'Something went wrong. Please try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
