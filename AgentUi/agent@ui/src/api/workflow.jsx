import { apiClient } from "./client";

export const getWorkflow = async (workflowId) => {
    const { data } = await apiClient.get(`/workflows/get/${workflowId}`);
    return data;
};

export const createWorkflow = async (payload) => {
    const { data } = await apiClient.post("/workflows/", payload);
    return data;
};

export const get_all_nodes = async (workflowId) => {
    const { data } = await apiClient.get(`/workflows/get_all_nodes/${workflowId}`);
    return data;
}

export const get_all_agents = async (workflowId) => {
    const { data } = await apiClient.get(`/workflows/get_all_agent/${workflowId}`);
    return data;
}

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

export const launchWorkflow = async (id) => {
    const { data } = await apiClient.post(`/workflows/${id}/launch`);
    return data;
};

export const stopWorkflow = async (id) => {
    const { data } = await apiClient.post(`/workflows/${id}/stop`);
    return data;
};

export const getWorkflowStatus = async (id) => {
    const { data } = await apiClient.get(`/workflows/${id}/status`);
    return data;
};

export const getWorkflowSessions = async (id) => {
    const { data } = await apiClient.get(`/workflows/${id}/sessions`);
    return data;
};
