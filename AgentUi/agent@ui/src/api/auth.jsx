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
