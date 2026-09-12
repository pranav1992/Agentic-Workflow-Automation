import axios from "axios";

// Ensure base URL and timeout are always set so requests don't hang indefinitely
const baseURL =
  import.meta.env.VITE_APP_BASE_URL || "http://127.0.0.1:8000";
const timeout =
  Number(import.meta.env.VITE_APP_API_TIMEOUT) > 0
    ? Number(import.meta.env.VITE_APP_API_TIMEOUT)
    : 10000; // 10s default

const AUTH_TOKEN_KEY = "voiceorchid_auth_token";
const AUTH_USER_KEY = "voiceorchid_auth_user";

// JWT issued by POST /auth/login. Sent as a Bearer token; per
// app/api/dependencies/auth.py, every route just requires a signed-in user
// — there's no admin/operator distinction, any authenticated user can do
// everything.
export const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_KEY) || "";

export const getAuthUser = () => {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USER_KEY) || "null");
  } catch {
    return null;
  }
};

export const setAuthSession = (token, user) => {
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  else localStorage.removeItem(AUTH_TOKEN_KEY);
  if (user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(AUTH_USER_KEY);
};

export const clearAuthSession = () => setAuthSession(null, null);

export const apiClient = axios.create({
  baseURL,
  timeout,
});

apiClient.interceptors.request.use((config) => {
  const authToken = getAuthToken();
  if (authToken) config.headers["Authorization"] = `Bearer ${authToken}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    // Turn the raw 401 into something actionable — without this a
    // signed-out user just sees requests silently fail.
    if (status === 401) {
      const hadAuthToken = !!getAuthToken();
      error.userMessage = hadAuthToken
        ? "Your session has expired. Please sign in again."
        : "This action needs you to be signed in.";
      // Login itself returns 401 for bad credentials — that shouldn't bounce
      // the sign-in page back to itself, so only redirect for an expired
      // session on an otherwise-authenticated request.
      if (hadAuthToken && !error.config?.url?.includes("/auth/login")) {
        clearAuthSession();
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    } else if (status === 429) {
      error.userMessage =
        error.response?.data?.detail ||
        "Too many requests — please wait and try again.";
    }
    return Promise.reject(error);
  },
);
