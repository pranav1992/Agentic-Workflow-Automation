import DangerButton from "../../../ui/DangerButton";
import LabeledInput from "../../../ui/LabeledInput";
import LabeledTextarea from "../../../ui/LabeledTextarea";
import theme from "../../../theme";

const styledSelect = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  fontSize: 13,
  color: theme.textPrimary,
  background: theme.surfaceAlt,
  border: `1.5px solid ${theme.border}`,
  borderRadius: theme.radius,
  outline: "none",
  marginBottom: 14,
};

export default function HandoffPanel({ edge, onChange, onDelete, onSave = () => {}, onClose = () => {} }) {
  return (
    <>
      {/* Flow chip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: theme.primaryLight,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radiusLg,
          padding: "8px 12px",
          marginBottom: 16,
          fontSize: 12,
          color: theme.textSecondary,
          fontFamily: "monospace",
        }}
      >
        <span
          style={{
            background: theme.primary,
            color: "white",
            padding: "2px 8px",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {edge.source}
        </span>
        <span style={{ color: theme.textSecondary }}>→</span>
        <span
          style={{
            background: theme.primary,
            color: "white",
            padding: "2px 8px",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {edge.target}
        </span>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            color: theme.textSecondary,
            marginBottom: 4,
          }}
        >
          Handoff Type
        </label>
        <select
          value={edge.data?.handoffType || "always"}
          onChange={(e) => onChange(edge.id, { handoffType: e.target.value })}
          style={styledSelect}
        >
          <option value="always">Always</option>
          <option value="condition">When Condition True</option>
          <option value="fallback">On Failure</option>
        </select>
      </div>

      <LabeledTextarea
        label="Condition"
        value={edge.data?.condition || ""}
        onChange={(v) => onChange(edge.id, { condition: v })}
        placeholder="e.g., user intent == billing"
        rows={3}
      />

      <LabeledInput
        label="Timeout Seconds"
        type="number"
        min="0"
        value={edge.data?.timeoutSeconds ?? 0}
        onChange={(v) => onChange(edge.id, { timeoutSeconds: parseInt(v, 10) || 0 })}
      />

      <LabeledTextarea
        label="Notes"
        value={edge.data?.notes || ""}
        onChange={(v) => onChange(edge.id, { notes: v })}
        rows={3}
      />

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          onClick={onSave}
          style={{
            flex: 1,
            padding: "9px 12px",
            borderRadius: theme.radius,
            border: "none",
            background: theme.primary,
            color: "white",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Save
        </button>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            padding: "9px 12px",
            borderRadius: theme.radius,
            border: `1px solid ${theme.border}`,
            background: theme.surface,
            color: theme.textPrimary,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>

      <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${theme.border}` }}>
        <DangerButton label="Delete Handoff Edge" onClick={() => onDelete(edge.id)} />
      </div>
    </>
  );
}
