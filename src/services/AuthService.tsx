// authService.ts
import apiClient from './AxiosClient'; // Assuming this is your pre-configured Axios instance

// --- INTERFACES ---

interface User {
  id: string;
  userName: string;
  email: string;
  isEmailConfirmed: boolean;
  isAuthenticated: boolean;
  is2FAEnabled: boolean;
  roles: string[];
}

interface LoginResponse {
  succeeded: boolean;
  requires2FA: boolean;
  user: User | null;
  message: string | null;
}

// A generic success response for actions that don't return data
interface SuccessResponse {
  message: string;
}

// --- ENDPOINTS ---
const ENDPOINTS = {
  LOGIN: '/auth/loginCustom',
  LOGOUT: '/auth/logout',
  VERIFY: '/auth/verify',
  GET_CURRENT_USER: '/auth/getcurrentuser',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',
  CONFIRM_EMAIL: '/auth/confirm-email',
  RESEND_CONFIRMATION: '/auth/resend-confirmation',
};

// --- CORE AUTH FUNCTIONS ---

/**
 * Logs in the user using basic authentication.
 * @param username - The user's username or email.
 * @param password - The user's password.
 * @returns A promise resolving to the login response data.
 */
const login = async (
  usernameOrEmail: string,
  password?: string, // Password is optional for the 2FA step
  twoFactorCode?: string // 2FA code is optional for the credentials step
): Promise<LoginResponse> => {
  // The API expects `usernameOrEmail`, let's send that
  const payload = {
    usernameOrEmail,
    password,
    twoFactorCode
  };

  const response = await apiClient.post<LoginResponse>(ENDPOINTS.LOGIN, payload);

  // If login is fully successful, store user data
  if (response.succeeded && response.user) {
    localStorage.setItem('currentUser', JSON.stringify(response.user));
  }

  // Return the full response so the UI can check for `requires2FA`
  return response;
};

/**
 * Logs out the user by calling the backend endpoint to invalidate the session cookie.
 */
const logout = async () => {
  try {
    await apiClient.post(ENDPOINTS.LOGOUT);
  } catch (error) {
    console.error("Logout failed, but clearing client-side session anyway.", error);
  } finally {
    // Always clear local storage on logout
    localStorage.removeItem('currentUser');
  }
};

/**
 * Verifies the current session with the backend.
 * to sync the frontend state with the actual backend session state.
 */
const verifyAuth = async (): Promise<User | null> => {
  try {
    return await apiClient.get<User>(ENDPOINTS.VERIFY);
  } catch (error : any) {
    console.error("Auth verification failed:", error || error?.message);
    console.log("Auth verification failed, user is not logged in.");
    return null;
  }
};

// --- PASSWORD AND EMAIL MANAGEMENT ---

/**
 * Sends a password reset link to the user's email.
 * @param email - The email address of the user who forgot their password.
 */
const forgotPassword = async (email: string): Promise<SuccessResponse> => {
  try {
    return await apiClient.post<SuccessResponse>(ENDPOINTS.FORGOT_PASSWORD, { email });
  } catch (error: any) {
    console.error('Forgot password error:', error?.response?.data || error?.message);
    throw error;
  }
};

/**
 * Resets the user's password using a token from the reset link.
 * @param token - The password reset token from the email link.
 * @param newPassword - The new password for the user.
 */
const resetPassword = async (token: string, newPassword: string): Promise<SuccessResponse> => {
  try {
    return await apiClient.post<SuccessResponse>(ENDPOINTS.RESET_PASSWORD, { token, newPassword });
  } catch (error: any) {
    console.error('Reset password error:', error?.response?.data || error?.message);
    throw error;
  }
};

/**
 * Confirms a user's email address using a confirmation token.
 * @param token - The email confirmation token from the email link.
 */
const confirmEmail = async (token: string): Promise<SuccessResponse> => {
  try {
    // Note: Some APIs use a GET request with the token as a query parameter.
    // Adjust if your backend requires GET /confirm-email?token=...
    return await apiClient.post<SuccessResponse>(ENDPOINTS.CONFIRM_EMAIL, { token });
  } catch (error: any) {
    console.error('Email confirmation error:', error?.response?.data || error?.message);
    throw error;
  }
};

/**
 * Requests a new confirmation email to be sent.
 * @param email - The email address to send the confirmation link to.
 */
const resendConfirmationEmail = async (email: string): Promise<SuccessResponse> => {
  try {
    return await apiClient.post<SuccessResponse>(ENDPOINTS.RESEND_CONFIRMATION, { email });
  } catch (error: any) {
    console.error('Resend confirmation email error:', error?.response?.data || error?.message);
    throw error;
  }
};


// --- UTILITY FUNCTIONS ---

/**
 * Retrieves the current user's data from local storage for UI display.
 * This does NOT confirm if the session is still valid.
 */
const getCurrentUser = (): User | null => {
  const userStr = localStorage.getItem('currentUser');
  if (userStr) return JSON.parse(userStr);
  return null;
};

/**
 * Retrieves the current access token from local storage.
 * @returns The access token string or null if not available.
 */
const getAccessToken = (): string | null => {
  return localStorage.getItem('accessToken');
}

// --- EXPORTED SERVICE OBJECT ---

const authService = {
  login,
  logout,
  forgotPassword,
  resetPassword,
  verifyAuth,
  confirmEmail,
  resendConfirmationEmail,
  getCurrentUser,
  getAccessToken,
};

export default authService;