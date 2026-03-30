import { useState, useCallback, useEffect } from "react";
import CreateWorkflowDialog from "../components/createWorkflowDialog";
import { getWorkflows, deleteWorkflow } from "../api/workflow";
import createWorkflowService from "../service/workflow_service";
import { useNavigate } from "react-router";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
// Lightweight workflows list + create flow
function CreateWorkFlowPage() {
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const {
    data: workflows = [],
    isFetching: isFetchingWorkflows,
    isError: isErrorWorkflows,
    error: errorWorkflows,
  } = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => {
      const data = await getWorkflows();
      return Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
          ? data.data
          : [];
    },
  });

  const createWorkflowMutation = useMutation({
    mutationFn: createWorkflowService,
    onSuccess: (_, variables) => {
      setStatusMessage(`Created workflow "${variables?.name}"`);
      setShowNewDialog(false);
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
    onError: (err) => {
      setStatusMessage(
        err.response?.data?.detail ||
          err.message ||
          "Failed to create workflow.",
      );
    },
  });


  const workflowDeleteMutation = useMutation({
    mutationFn: deleteWorkflow,
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
    onError: (err) => {
      setStatusMessage(
        err.response?.data?.detail || err.message || "Failed to delete.",
      );
    },
  });

  useEffect(() => {
    if (isErrorWorkflows && errorWorkflows) {
      setStatusMessage(
        errorWorkflows.response?.data?.detail ||
          errorWorkflows.message ||
          "Failed to load workflows.",
      );
    }
  }, [errorWorkflows, isErrorWorkflows]);

  const handleOpenWorkflow = useCallback(
    (id) => {
      navigate(`/workflows/${id}`);
    },
    [navigate],
  );


  const startNewWorkflow = useCallback(() => {
    setNameInput("");
    setDescInput("");
    setStatusMessage("");
    setShowNewDialog(true);
  }, []);

  const confirmNewWorkflow = useCallback(async () => {
    const name = (nameInput || "").trim();
    if (!name) {
      setStatusMessage("Workflow name is required.");
      return;
    }
    const taken = workflows.some(
      (wf) => wf.name?.toLowerCase() === name.toLowerCase(),
    );
    if (taken) {
      setStatusMessage("Workflow name already exists. Pick a different name.");
      return;
    }

    setStatusMessage("Creating workflow…");
    createWorkflowMutation.mutate({ name, description: descInput.trim() });
  }, [createWorkflowMutation, descInput, nameInput, workflows]);

  const renderNewDialog = () =>
    showNewDialog ? (
      <CreateWorkflowDialog
        setShowNewDialog={setShowNewDialog}
        newNameInput={nameInput}
        setNewNameInput={setNameInput}
        newDescInput={descInput}
        setNewDescInput={setDescInput}
        confirmNewWorkflow={confirmNewWorkflow}
      />
    ) : null;

  return (
    <>
      <div style={{ padding: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0 }}>Workflows</h2>
          <button
            onClick={() => startNewWorkflow()}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "none",
              background: "#111",
              color: "white",
              cursor: "pointer",
            }}
          >
            + New Workflow
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          {statusMessage && (
            <div style={{ marginBottom: 8, color: "#444" }}>
              {statusMessage}
            </div>
          )}
          {isFetchingWorkflows ? (
            <div>Loading workflows…</div>
          ) : workflows.length === 0 ? (
            <div>No workflows yet. Create one to get started.</div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 12,
              }}
            >
              {workflows.map((wf) => (
                <div
                  key={wf.id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 10,
                    padding: 12,
                    boxShadow: "0 6px 14px rgba(0,0,0,0.05)",
                    background: "white",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{wf.name || "Untitled"}</div>
                  <div style={{ fontSize: 12, color: "#666", margin: "4px 0" }}>
                    id: {wf.id} {wf.version ? `• v${wf.version}` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      onClick={() => handleOpenWorkflow(wf.id)}
                      style={{
                        flex: 1,
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #111",
                        background: "white",
                        cursor: "pointer",
                      }}
                    >
                      Open
                    </button>
                    <button
                      onClick={() => {
                        if (!confirm("Delete this workflow permanently?")) return;
                        workflowDeleteMutation.mutate(wf.id)
                      }}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #e33",
                        background: "#ffecec",
                        color: "#c00",
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {renderNewDialog()}
    </>
  );
}

export default CreateWorkFlowPage;
