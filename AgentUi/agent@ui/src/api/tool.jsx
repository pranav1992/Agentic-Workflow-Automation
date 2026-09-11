import { apiClient } from "./client";

export const createTool = async (payload) => {
  const { data } = await apiClient.post("/tools/", payload);
  return data;
};

export const updateTool = async (payload) => {
  const { data } = await apiClient.put("/tools/", payload);
  return data;
};

export const deleteTool = async (toolId) => {
  const { data } = await apiClient.delete(`/tools/${toolId}`);
  return data;
};
