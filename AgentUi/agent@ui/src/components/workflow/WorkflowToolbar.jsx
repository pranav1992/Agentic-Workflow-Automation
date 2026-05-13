import React from "react";
import { useNavigate } from "react-router";
import theme from "../../theme";

export default function WorkflowToolbar({
  workflowName,
  onFitView,
  isSaving,
  isSessionActive,
  onLaunch,
  onStop,
}) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        height: 56,
        padding: "0 20px",
        borderBottom: `1px solid ${theme.border}`,
        background: theme.surface,
        flexShrink: 0,
      }}
    >
      {/* Back */}
      <button
        onClick={() => navigate("/")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "6px 10px",
          borderRadius: theme.radius,
          border: "none",
          background: "none",
          color: theme.textSecondary,
          fontSize: 13,
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        ← Workflows
      </button>

      <div style={{ width: 1, height: 24, background: theme.border }} />

      {/* Workflow name */}
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: theme.textPrimary,
          maxWidth: 240,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {workflowName || "Untitled Workflow"}
      </span>

      {isSaving && (
        <span style={{ fontSize: 11, color: theme.textDisabled }}>Saving…</span>
      )}

      {/* Fit view */}
      <button
        onClick={onFitView}
        style={{
          marginLeft: 8,
          padding: "6px 14px",
          borderRadius: theme.radius,
          border: `1px solid ${theme.border}`,
          background: theme.surface,
          color: theme.textSecondary,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        ⊹ Fit View
      </button>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Session status dot */}
      {isSessionActive && (
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: theme.success }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: theme.success,
              display: "inline-block",
              animation: "pulse 1.4s ease-in-out infinite",
            }}
          />
          Session active
        </span>
      )}

      {/* Launch / Stop */}
      {isSessionActive ? (
        <button
          onClick={onStop}
          style={{
            padding: "8px 20px",
            borderRadius: theme.radius,
            border: "none",
            background: theme.error,
            color: "white",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ■ Stop
        </button>
      ) : (
        <button
          onClick={onLaunch}
          style={{
            padding: "8px 20px",
            borderRadius: theme.radius,
            border: "none",
            background: theme.primary,
            color: "white",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ▶ Launch
        </button>
      )}
    </div>
  );
}
