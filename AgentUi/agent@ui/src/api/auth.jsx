import { apiClient } from "./client";

export const login = async (email, password) => {
  const { data } = await apiClient.post("/auth/login", { email, password });
  return data;
};

// Always creates a brand-new tenant with this user as its first admin —
// there's no "join an existing organization" flow. Backend seeds the
// demo workflow into it and signs the user in immediately, same
// response shape as login.
export const register = async (email, password, tenantName, fullName) => {
  const { data } = await apiClient.post("/auth/register", {
    email,
    password,
    tenant_name: tenantName,
    full_name: fullName || undefined,
  });
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
