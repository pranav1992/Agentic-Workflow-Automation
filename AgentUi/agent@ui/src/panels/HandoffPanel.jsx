import DangerButton from "../ui/DangerButton";
import LabeledInput from "../ui/LabeledInput";
import LabeledTextarea from "../ui/LabeledTextarea";

export default function HandoffPanel({ edge, onChange, onDelete }) {
  return (
    <>
      <h3>Handoff</h3>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>
        {edge.source} ➜ {edge.target}
      </div>

      <label style={{ fontSize: 12, color: "#444" }}>Handoff Type</label>
      <select
        value={edge.data?.handoffType || "always"}
        onChange={(e) => onChange(edge.id, { handoffType: e.target.value })}
        style={{ width: "100%", marginBottom: 10 }}
      >
        <option value="always">Always</option>
        <option value="condition">When Condition True</option>
        <option value="fallback">On Failure</option>
      </select>

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
        onChange={(v) =>
          onChange(edge.id, { timeoutSeconds: parseInt(v, 10) || 0 })
        }
      />

      <LabeledTextarea
        label="Notes"
        value={edge.data?.notes || ""}
        onChange={(v) => onChange(edge.id, { notes: v })}
        rows={3}
      />

      <DangerButton
        label="Delete Handoff Edge"
        onClick={() => onDelete(edge.id)}
      />
    </>
  );
}
