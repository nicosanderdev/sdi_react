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

interface UserSettings {
  emailConfirmed : boolean;
  twoFactorEnabled : boolean;
  newListings : boolean;
  priceDrops : boolean;
  statusChanges : boolean;
  openHouses : boolean;
  marketUpdates : boolean;
  email : boolean;
  push : boolean;
}

interface LoginResponse {
  succeeded: boolean;
  requires2FA: boolean;
  user: User | null;
  message: string | null;
}

interface SuccessResponse {
  message: string;
}

interface RecoveryCodeResponse {
  recoveryCode: string;
}

export interface RegisterUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface RegistrationResponse {
  message: string;
  userId?: string;
}

// --- ENDPOINTS ---
const ENDPOINTS = {
  LOGIN: '/auth/login-custom',
  LOGOUT: '/auth/logout-custom',
  VERIFY: '/auth/verify',
  FORGOT_PASSWORD: '/auth/forgot-password-custom',
  RESET_PASSWORD: '/auth/reset-password-custom',
  CONFIRM_EMAIL: '/auth/confirm-email-custom',
  RESEND_CONFIRMATION_EMAIL: '/auth/resend-confirmation-email-custom',
  TWO_FA_ENABLE_FIRST_STEP: '/auth/2fa/enable-2fa-first-step',
  TWO_FA_ENABLE: '/auth/2fa/enable-confirm',
  REGISTER: '/auth/register',
  SETTINGS: '/user/settings'
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
  if (response.succeeded && response.user) {
    localStorage.setItem('currentUser', JSON.stringify(response.user));
  }

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
const resendConfirmationEmail = async (): Promise<SuccessResponse> => {
  try {
    return await apiClient.get<SuccessResponse>(ENDPOINTS.RESEND_CONFIRMATION_EMAIL);
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

// --- TWO-FACTOR AUTHENTICATION ---

/**
 * Requests a 2FA code to be sent to the user (e.g., via email).
 * This is called after successful password verification when 2FA is required.
 * @param password The user's email to identify who needs a code.
 */
const requestLogin2faCode = async (password: string): Promise<void> => {
  try {
    // Per feature description, we call the generate endpoint to trigger the code sending.
    // The backend should differentiate this from a setup request (e.g., via POST vs GET).
    await apiClient.post(ENDPOINTS.TWO_FA_ENABLE_FIRST_STEP, { password });
  } catch (error: any) {
    console.error('Error requesting 2FA login code:', error?.response?.data || error?.message);
    throw new Error('Could not send verification code. Please try logging in again.');
  }
};

/**
 * Enables 2FA for the user after they've scanned the QR code and entered a verification code.
 * @param code The 6-digit code from the user's authenticator app.
 */
const enable2fa = async (twoFactorCode: string): Promise<RecoveryCodeResponse> => {
  try {
    return await apiClient.post<RecoveryCodeResponse>(ENDPOINTS.TWO_FA_ENABLE, { twoFactorCode });
  } catch (error: any) {
    console.error('Error enabling 2FA:', error?.response?.data || error?.message);
    throw error;
  }
};

/**
 * Registers a new user.
 * @param userData The user's registration data.
 * @returns A promise that resolves with the registration response.
 */
export const registerUser = async (userData: RegisterUserPayload): Promise<RegistrationResponse> => {
  // The API expects the payload to be nested inside a `registerUserDto` object.
  const requestBody = {
    registerUserDto: userData,
  };

  try {
    // The apiClient's response interceptor automatically returns `response.data`,
    // so we can expect our RegistrationResponse type directly.
    const response = await apiClient.post<RegistrationResponse>(ENDPOINTS.REGISTER, requestBody);
    return response;
  } catch (error: any) {
    // The apiClient's error interceptor creates a custom error object.
    // We log it and re-throw it to be handled by the component.
    console.error('Error during user registration:', error.message);
    throw error;
  }
};

const getUserSettings = async () => {
  try {
    return await apiClient.get<UserSettings>(ENDPOINTS.SETTINGS);
  } catch (error : any) {
    console.error("Getting users settings failed:", error || error?.message);
    return null;
  }
};
// --- EXPORTED SERVICE OBJECT ---

const authService = {
  login,
  logout,
  forgotPassword,
  resetPassword,
  verifyAuth,
  confirmEmail,
  resendConfirmationEmail,
  registerUser,
  requestLogin2faCode,
  enable2fa,
  getCurrentUser,
  getAccessToken,
  getUserSettings
};

export default authService;