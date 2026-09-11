import axios from "axios";

// Ensure base URL and timeout are always set so requests don't hang indefinitely
const baseURL =
  import.meta.env.VITE_APP_BASE_URL || "http://127.0.0.1:8000";
const timeout =
  Number(import.meta.env.VITE_APP_API_TIMEOUT) > 0
    ? Number(import.meta.env.VITE_APP_API_TIMEOUT)
    : 10000; // 10s default

const ADMIN_TOKEN_KEY = "voiceorchid_admin_token";

export const getAdminToken = () => localStorage.getItem(ADMIN_TOKEN_KEY) || "";

export const setAdminToken = (token) => {
  if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
  else localStorage.removeItem(ADMIN_TOKEN_KEY);
};

// Reads/voice-demo routes are public; only mutations need the token. Picking it
// up from ?admin_token=... lets an operator enrol a browser from a link without
// a login screen, then strips it from the URL so it isn't left in history.
const tokenFromUrl = new URLSearchParams(window.location.search).get(
  "admin_token",
);
if (tokenFromUrl) {
  setAdminToken(tokenFromUrl);
  const url = new URL(window.location.href);
  url.searchParams.delete("admin_token");
  window.history.replaceState({}, "", url.toString());
}

export const apiClient = axios.create({
  baseURL,
  timeout,
});

apiClient.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) config.headers["X-Admin-Token"] = token;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    // Turn the raw 401/503 into something actionable — without this an
    // operator whose token is missing just sees edits silently fail.
    if (status === 401) {
      error.userMessage = getAdminToken()
        ? "Your admin token was rejected. Re-open the app with ?admin_token=<token>."
        : "This action needs an admin token. Open the app with ?admin_token=<token>.";
    } else if (status === 503) {
      error.userMessage =
        "Editing is disabled: the server has no ADMIN_API_TOKEN configured.";
    } else if (status === 429) {
      error.userMessage =
        error.response?.data?.detail ||
        "Too many requests — please wait and try again.";
    }
    return Promise.reject(error);
  },
);
