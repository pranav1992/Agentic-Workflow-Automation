import { useState, useCallback, useEffect, useRef } from "react";
import { CreateWorkflowDialog } from "../components/workflow";
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
  const loadingStartRef = useRef(0);
  const [showLoading, setShowLoading] = useState(false);

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
    // prevent endless retries and focus refetch loops from masking failures
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 15_000,
  });

  // show a friendly hint if loading takes unusually long (likely API unreachable)
  useEffect(() => {
    if (!isFetchingWorkflows) return undefined;
    const timer = setTimeout(() => {
      setStatusMessage(
        "Still loading workflows… check that the backend is running at " +
          (import.meta.env.VITE_APP_BASE_URL || "http://127.0.0.1:8000"),
      );
    }, 5000);
    return () => clearTimeout(timer);
  }, [isFetchingWorkflows]);

  useEffect(() => {
    if (isFetchingWorkflows) {
      loadingStartRef.current = Date.now();
      setShowLoading(true);
      return undefined;
    }

    if (!showLoading) return undefined;
    const elapsed = Date.now() - loadingStartRef.current;
    const remaining = Math.max(3000 - elapsed, 0);
    const timer = setTimeout(() => {
      setShowLoading(false);
    }, remaining);
    return () => clearTimeout(timer);
  }, [isFetchingWorkflows, showLoading]);

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
      <style>{`
        .wf-loading {
          display: grid;
          gap: 16px;
          justify-items: center;
          padding: 24px 8px;
        }
        .wf-spinner {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 3px solid rgba(0, 0, 0, 0.1);
          border-top-color: #111;
          animation: wf-spin 0.9s linear infinite;
        }
        .wf-loading-text {
          font-size: 14px;
          letter-spacing: 0.2px;
          color: #444;
        }
        .wf-skeleton-grid {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 12px;
        }
        .wf-skeleton-card {
          border-radius: 12px;
          padding: 14px;
          background: #f7f7f7;
          box-shadow: inset 0 0 0 1px #ededed;
          position: relative;
          overflow: hidden;
        }
        .wf-skeleton-card::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.6) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          animation: wf-shimmer 1.4s ease-in-out infinite;
        }
        .wf-skeleton-line {
          height: 12px;
          border-radius: 8px;
          background: #e9e9e9;
          margin-bottom: 10px;
        }
        .wf-skeleton-line.short {
          width: 55%;
        }
        .wf-skeleton-line.tiny {
          width: 35%;
        }
        .wf-skeleton-actions {
          display: grid;
          grid-template-columns: 1fr 80px;
          gap: 8px;
        }
        .wf-skeleton-pill {
          height: 30px;
          border-radius: 8px;
          background: #e2e2e2;
        }
        @keyframes wf-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes wf-shimmer {
          to { transform: translateX(100%); }
        }
      `}</style>
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
          {showLoading ? (
            <div className="wf-loading">
              <div className="wf-spinner" />
              <div className="wf-loading-text">
                Loading workflows…
              </div>
              <div className="wf-skeleton-grid">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div className="wf-skeleton-card" key={`wf-skel-${index}`}>
                    <div className="wf-skeleton-line short" />
                    <div className="wf-skeleton-line tiny" />
                    <div className="wf-skeleton-line" />
                    <div className="wf-skeleton-actions">
                      <div className="wf-skeleton-pill" />
                      <div className="wf-skeleton-pill" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
