import { apiClient } from "./client";


export const createEdge = async (payload) => {
    const { data } = await apiClient.post("/edges", payload);
    return data;
};

export const updateEdge = async (payload) => {
    const { data } = await apiClient.put("/edges", payload);
    return data;
};

export const deleteEdge = async (edgeId) => {
    const { data } = await apiClient.delete(`/edges/${edgeId}`);
    return data;
};

export const get_all_edges = async (workflowId) => {
    const { data } = await apiClient.get(`/edges/${workflowId}`);
    return data;
}
