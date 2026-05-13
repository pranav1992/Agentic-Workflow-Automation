import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getWorkflowSessions } from "../../api/workflow";
import theme from "../../theme";

function formatDuration(seconds) {
  if (seconds == null) return "Ongoing";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function WorkflowHistoryDrawer({ workflowId, onClose }) {
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["workflowSessions", workflowId],
    queryFn: () => getWorkflowSessions(workflowId),
    refetchOnWindowFocus: false,
  });

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 360,
        background: theme.surface,
        boxShadow: theme.shadowElevated,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 56,
          padding: "0 20px",
          borderBottom: `1px solid ${theme.border}`,
          borderLeft: `4px solid ${theme.primary}`,
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 15, color: theme.textPrimary }}>
          Session History
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontSize: 20,
            cursor: "pointer",
            color: theme.textSecondary,
            lineHeight: 1,
            padding: "2px 6px",
            borderRadius: 4,
          }}
        >
          ×
        </button>
      </div>

      {/* Session list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {isLoading ? (
          <div style={{ color: theme.textDisabled, fontSize: 13 }}>Loading…</div>
        ) : sessions.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: theme.textDisabled,
              fontSize: 13,
              marginTop: 40,
            }}
          >
            No sessions yet.
          </div>
        ) : (
          sessions.map((s) => {
            const active = s.status === "active";
            return (
              <div
                key={s.id}
                style={{
                  borderRadius: theme.radius,
                  border: `1px solid ${active ? theme.primary : theme.border}`,
                  borderLeft: `4px solid ${active ? theme.primary : theme.border}`,
                  padding: "10px 14px",
                  marginBottom: 10,
                  background: active ? theme.primaryLight : theme.surface,
                  boxShadow: theme.shadow,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 5,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: active ? theme.success : theme.textSecondary,
                    }}
                  >
                    {active ? "● Active" : "○ Stopped"}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: theme.textSecondary,
                      background: theme.surfaceAlt,
                      border: `1px solid ${theme.border}`,
                      padding: "2px 8px",
                      borderRadius: 10,
                    }}
                  >
                    {formatDuration(s.duration_seconds)}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: theme.textSecondary }}>
                  {formatTime(s.started_at)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
