import { apiClient } from "./client";

// Backend expects the position payload (including id) at /positions
export const updatePosition = async (payload) => {
  const { data } = await apiClient.put(`/positions`, payload);
  return data;
};

// Bulk update multiple positions in one request
export const updatePositionsBulk = async (positionsPayload) => {
  const { data } = await apiClient.put(`/positions/bulk`, positionsPayload);
  return data;
};
