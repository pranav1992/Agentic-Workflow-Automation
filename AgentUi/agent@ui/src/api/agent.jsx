import { apiClient } from "./client";

export const createAgent = async (payload) => {
    const { data } = await apiClient.post("/agents/", payload);
    return data;
};

export const updateAgent = async (payload) => {
    const { data } = await apiClient.put("/agents/", payload);
    return data;
};

export const getAgent = async (agentId) => {
    const { data } = await apiClient.get(`/agents/${agentId}`);
    return data;
};
