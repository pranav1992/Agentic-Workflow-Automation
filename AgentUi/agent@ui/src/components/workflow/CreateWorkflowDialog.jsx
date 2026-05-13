import { useState } from "react";
import theme from "../../theme";

function CreateWorkflowDialog({
  setShowNewDialog,
  newNameInput,
  setNewNameInput,
  newDescInput,
  setNewDescInput,
  confirmNewWorkflow,
}) {
  const [nameFocused, setNameFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);
  const canCreate = !!newNameInput.trim();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(32,33,36,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20,
      }}
    >
      <div
        style={{
          background: theme.surface,
          borderRadius: "16px",
          width: 420,
          boxShadow: theme.shadowElevated,
          overflow: "hidden",
        }}
      >
        {/* Dialog header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 22px 14px",
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 16, color: theme.textPrimary }}>
            New Workflow
          </span>
          <button
            onClick={() => setShowNewDialog(false)}
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              color: theme.textSecondary,
              cursor: "pointer",
              lineHeight: 1,
              padding: "2px 6px",
              borderRadius: 4,
            }}
          >
            ×
          </button>
        </div>

        {/* Dialog body */}
        <div style={{ padding: "20px 22px 22px" }}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              color: nameFocused ? theme.primary : theme.textSecondary,
              marginBottom: 5,
              transition: "color 0.15s",
            }}
          >
            Name *
          </label>
          <input
            value={newNameInput}
            onChange={(e) => setNewNameInput(e.target.value)}
            placeholder="e.g., Customer Support Bot"
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            autoFocus
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "9px 11px",
              fontSize: 13,
              color: theme.textPrimary,
              background: theme.surfaceAlt,
              border: `1.5px solid ${nameFocused ? theme.borderFocus : theme.border}`,
              borderRadius: theme.radius,
              outline: "none",
              marginBottom: 16,
              transition: "border-color 0.15s",
            }}
          />

          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              color: descFocused ? theme.primary : theme.textSecondary,
              marginBottom: 5,
              transition: "color 0.15s",
            }}
          >
            Description
          </label>
          <textarea
            value={newDescInput}
            onChange={(e) => setNewDescInput(e.target.value)}
            placeholder="What does this workflow do?"
            rows={3}
            onFocus={() => setDescFocused(true)}
            onBlur={() => setDescFocused(false)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "9px 11px",
              fontSize: 13,
              color: theme.textPrimary,
              background: theme.surfaceAlt,
              border: `1.5px solid ${descFocused ? theme.borderFocus : theme.border}`,
              borderRadius: theme.radius,
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
              lineHeight: 1.5,
              marginBottom: 22,
              transition: "border-color 0.15s",
            }}
          />

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={() => setShowNewDialog(false)}
              style={{
                padding: "9px 18px",
                borderRadius: theme.radius,
                border: `1px solid ${theme.border}`,
                background: theme.surface,
                color: theme.textPrimary,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={confirmNewWorkflow}
              disabled={!canCreate}
              style={{
                padding: "9px 22px",
                borderRadius: theme.radius,
                border: "none",
                background: canCreate ? theme.primary : theme.border,
                color: canCreate ? "white" : theme.textDisabled,
                fontSize: 13,
                fontWeight: 600,
                cursor: canCreate ? "pointer" : "not-allowed",
                transition: "background 0.15s",
              }}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateWorkflowDialog;
