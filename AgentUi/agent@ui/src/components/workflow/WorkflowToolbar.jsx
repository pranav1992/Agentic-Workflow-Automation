import React from "react";

export default function WorkflowToolbar({ workflowName, onFitView, isSaving }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderBottom: "1px solid #eee",
        background: "#fafafa",
      }}
    >
      <input
        value={workflowName}
        onChange={() => {}}
        placeholder="Workflow name"
        style={{
          width: 260,
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #ddd",
        }}
      />
      <button
        onClick={onFitView}
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #ddd",
          background: "white",
          cursor: "pointer",
        }}
      >
        Fit View
      </button>
      <button
        onClick={() => {}}
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #ddd",
          background: "white",
          cursor: "pointer",
        }}
      >
        Back to List
      </button>
      <button
        onClick={() => {}}
        disabled={isSaving}
        style={{
          padding: "10px 14px",
          borderRadius: 8,
          border: "none",
          background: "#111",
          color: "white",
          cursor: "pointer",
          opacity: isSaving ? 0.7 : 1,
        }}
      >
        Update Workflow
      </button>
    </div>
  );
}
