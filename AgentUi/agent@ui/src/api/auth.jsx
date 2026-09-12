import { apiClient } from "./client";

export const login = async (email, password) => {
  const { data } = await apiClient.post("/auth/login", { email, password });
  return data;
};

// Round-trips the stored token through the backend (signature + expiry +
// user-still-exists) rather than trusting that its mere presence in
// localStorage means it's still good.
export const getMe = async () => {
  const { data } = await apiClient.get("/auth/me");
  return data;
};

// Invalidates every token issued to this user server-side (not just this
// browser's copy) — without this, "sign out" only forgot the token
// locally while it stayed valid until expiry.
export const logout = async () => {
  await apiClient.post("/auth/logout");
};
