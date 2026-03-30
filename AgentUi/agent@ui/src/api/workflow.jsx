import { apiClient } from "./client";

export const getWorkflow = async (workflowId) => {
    const { data } = await apiClient.get(`/workflows/get/${workflowId}`);
    return data;
};

export const createWorkflow = async (payload) => {
    const { data } = await apiClient.post("/workflows/", payload);
    return data;
};

export const updateWorkflow = async (workflowId, payload) => {
    const { data } = await apiClient.put(`/workflows/update/${workflowId}`, payload);
    return data;
};

export const deleteWorkflow = async (workflowId) => {
    const { data } = await apiClient.delete(`/workflows/delete/${workflowId}`);
    return data;
};

export const getWorkflows = async () => {
    const { data } = await apiClient.get("/workflows/get_all");
    return data;
};
