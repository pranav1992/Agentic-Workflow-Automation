import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getWorkflowSessions } from "../../api/workflow";

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
        width: 340,
        background: "white",
        boxShadow: "-4px 0 20px rgba(0,0,0,0.12)",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid #eee",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 16 }}>Session History</span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontSize: 20,
            cursor: "pointer",
            color: "#666",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
        {isLoading ? (
          <div style={{ color: "#888", fontSize: 14 }}>Loading…</div>
        ) : sessions.length === 0 ? (
          <div style={{ color: "#888", fontSize: 14 }}>No sessions yet.</div>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              style={{
                borderRadius: 8,
                border: "1px solid #eee",
                padding: "10px 12px",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: s.status === "active" ? "#16a34a" : "#888",
                  }}
                >
                  {s.status === "active" ? "● Active" : "○ Stopped"}
                </span>
                <span style={{ fontSize: 12, color: "#888" }}>
                  {formatDuration(s.duration_seconds)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#555" }}>
                {formatTime(s.started_at)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
