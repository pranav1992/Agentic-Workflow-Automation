import { useState, useCallback, useEffect, useRef } from "react";
import { CreateWorkflowDialog } from "../components/workflow";
import { getWorkflows, deleteWorkflow, getWorkflowStatus } from "../api/workflow";
import createWorkflowService from "../service/workflow_service";
import { useNavigate } from "react-router";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import WorkflowHistoryDrawer from "../components/workflow/WorkflowHistoryDrawer";
import theme from "../theme";

function WorkflowStatusBadge({ workflowId }) {
  const { data } = useQuery({
    queryKey: ["workflowStatus", workflowId],
    queryFn: () => getWorkflowStatus(workflowId),
    refetchInterval: 10_000,
    refetchOnWindowFocus: false,
  });
  const active = data?.status === "active";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 12,
        background: active ? theme.successLight : theme.surfaceAlt,
        color: active ? theme.success : theme.textDisabled,
        border: `1px solid ${active ? "#b7dfb9" : theme.border}`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: active ? theme.success : theme.textDisabled,
          display: "inline-block",
        }}
      />
      {active ? "Running" : "Idle"}
    </span>
  );
}

function CreateWorkFlowPage() {
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [historyWorkflowId, setHistoryWorkflowId] = useState(null);
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
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!isFetchingWorkflows) return undefined;
    const timer = setTimeout(() => {
      setStatusMessage(
        "Still loading… check that the backend is running at " +
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
    const timer = setTimeout(() => setShowLoading(false), remaining);
    return () => clearTimeout(timer);
  }, [isFetchingWorkflows, showLoading]);

  const createWorkflowMutation = useMutation({
    mutationFn: createWorkflowService,
    onSuccess: (_, variables) => {
      setStatusMessage(`Created "${variables?.name}"`);
      setShowNewDialog(false);
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
    onError: (err) => {
      setStatusMessage(err.response?.data?.detail || err.message || "Failed to create workflow.");
    },
  });

  const workflowDeleteMutation = useMutation({
    mutationFn: deleteWorkflow,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflows"] }),
    onError: (err) => {
      setStatusMessage(err.response?.data?.detail || err.message || "Failed to delete.");
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

  const handleOpenWorkflow = useCallback((id) => navigate(`/workflows/${id}`), [navigate]);
  const startNewWorkflow = useCallback(() => {
    setNameInput(""); setDescInput(""); setStatusMessage(""); setShowNewDialog(true);
  }, []);

  const confirmNewWorkflow = useCallback(async () => {
    const name = (nameInput || "").trim();
    if (!name) { setStatusMessage("Workflow name is required."); return; }
    const taken = workflows.some((wf) => wf.name?.toLowerCase() === name.toLowerCase());
    if (taken) { setStatusMessage("Workflow name already exists. Pick a different name."); return; }
    setStatusMessage("Creating workflow…");
    createWorkflowMutation.mutate({ name, description: descInput.trim() });
  }, [createWorkflowMutation, descInput, nameInput, workflows]);

  return (
    <>
      <style>{`
        @keyframes wf-spin { to { transform: rotate(360deg); } }
        @keyframes wf-shimmer { to { transform: translateX(100%); } }
        .wf-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .wf-card:hover { transform: translateY(-2px); box-shadow: ${theme.shadowElevated}; }
      `}</style>

      {/* Top App Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 60,
          padding: "0 28px",
          background: theme.surface,
          borderBottom: `1px solid ${theme.border}`,
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🎙️</span>
          <span style={{ fontWeight: 700, fontSize: 18, color: theme.textPrimary, letterSpacing: "-0.3px" }}>
            VoiceOrchid
          </span>
        </div>
        <button
          onClick={startNewWorkflow}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 18px",
            borderRadius: theme.radius,
            border: "none",
            background: theme.primary,
            color: "white",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: "0.1px",
          }}
        >
          + New Workflow
        </button>
      </div>

      {/* Page body */}
      <div style={{ padding: "28px 28px 48px", background: theme.surfaceAlt, minHeight: "calc(100vh - 60px)" }}>
        <h2
          style={{
            margin: "0 0 6px",
            fontSize: 22,
            fontWeight: 700,
            color: theme.textPrimary,
            letterSpacing: "-0.3px",
          }}
        >
          Workflows
        </h2>
        <p style={{ margin: "0 0 22px", fontSize: 13, color: theme.textSecondary }}>
          Build and manage your AI agent workflows.
        </p>

        {statusMessage && (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 14px",
              borderRadius: theme.radius,
              background: theme.primaryLight,
              border: `1px solid ${theme.border}`,
              color: theme.primary,
              fontSize: 13,
            }}
          >
            {statusMessage}
          </div>
        )}

        {showLoading ? (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 20,
                color: theme.textSecondary,
                fontSize: 13,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: `2px solid ${theme.border}`,
                  borderTopColor: theme.primary,
                  animation: "wf-spin 0.9s linear infinite",
                }}
              />
              Loading workflows…
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    borderRadius: theme.radiusLg,
                    padding: 16,
                    background: theme.surface,
                    border: `1px solid ${theme.border}`,
                    overflow: "hidden",
                    position: "relative",
                    height: 110,
                  }}
                >
                  <div style={{ position: "absolute", inset: 0, transform: "translateX(-100%)", background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.7),transparent)", animation: "wf-shimmer 1.4s ease-in-out infinite" }} />
                  {[70, 45, 100, 80].map((w, j) => (
                    <div key={j} style={{ height: 10, width: `${w}%`, borderRadius: 6, background: theme.border, marginBottom: 10 }} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : workflows.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: theme.textSecondary,
              fontSize: 14,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
            <div style={{ fontWeight: 600, color: theme.textPrimary, marginBottom: 6 }}>No workflows yet</div>
            <div>Create your first workflow to get started building AI agents.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {workflows.map((wf) => (
              <div
                key={wf.id}
                className="wf-card"
                style={{
                  border: `1px solid ${theme.border}`,
                  borderTop: `3px solid ${theme.primary}`,
                  borderRadius: theme.radiusLg,
                  padding: 16,
                  background: theme.surface,
                  boxShadow: theme.shadow,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 15,
                      color: theme.textPrimary,
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      marginRight: 8,
                    }}
                  >
                    {wf.name || "Untitled"}
                  </div>
                  <WorkflowStatusBadge workflowId={wf.id} />
                </div>
                <div style={{ fontSize: 11, color: theme.textDisabled, marginBottom: 14, fontFamily: "monospace" }}>
                  {wf.id}
                </div>
                <div style={{ display: "flex", gap: 7 }}>
                  <button
                    onClick={() => handleOpenWorkflow(wf.id)}
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      borderRadius: theme.radius,
                      border: "none",
                      background: theme.primary,
                      color: "white",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Open
                  </button>
                  <button
                    onClick={() => setHistoryWorkflowId(wf.id)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: theme.radius,
                      border: `1px solid ${theme.primary}`,
                      background: theme.primaryLight,
                      color: theme.primary,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    History
                  </button>
                  <button
                    onClick={() => {
                      if (!confirm("Delete this workflow permanently?")) return;
                      workflowDeleteMutation.mutate(wf.id);
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: theme.radius,
                      border: "none",
                      background: "none",
                      color: theme.error,
                      fontSize: 12,
                      fontWeight: 500,
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

      {showNewDialog && (
        <CreateWorkflowDialog
          setShowNewDialog={setShowNewDialog}
          newNameInput={nameInput}
          setNewNameInput={setNameInput}
          newDescInput={descInput}
          setNewDescInput={setDescInput}
          confirmNewWorkflow={confirmNewWorkflow}
        />
      )}

      {historyWorkflowId && (
        <WorkflowHistoryDrawer
          workflowId={historyWorkflowId}
          onClose={() => setHistoryWorkflowId(null)}
        />
      )}
    </>
  );
}

export default CreateWorkFlowPage;
