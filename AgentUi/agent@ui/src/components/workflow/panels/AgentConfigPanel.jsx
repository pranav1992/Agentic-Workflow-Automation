import DangerButton from "../../../ui/DangerButton";
import LabeledInput from "../../../ui/LabeledInput";
import LabeledTextarea from "../../../ui/LabeledTextarea";

export default function AgentConfigPanel({
  agent,
  onChange,
  onDelete,
  canDelete,
  onSave = () => {},
  onClose = () => {},
}) {
  return (
    <>
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Agent Settings</h3>

      <LabeledInput
        label="Agent Name"
        value={agent.data.name || ""}
        onChange={(v) => onChange(agent.id, { name: v })}
        placeholder="Support Bot"
      />

      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <input
          id={`initial-${agent.id}`}
          type="checkbox"
          checked={Boolean(agent.data.isInitial)}
          onChange={(e) => onChange(agent.id, { isInitial: e.target.checked })}
          style={{ marginRight: 8 }}
        />
        <label htmlFor={`initial-${agent.id}`} style={{ fontSize: 12 }}>
          Treat as initial entry point
        </label>
      </div>

      <LabeledInput
        label="Model"
        value={agent.data.model || ""}
        onChange={(v) => onChange(agent.id, { model: v })}
        placeholder="gpt-4"
      />

      <LabeledInput
        label="Temperature"
        type="number"
        step="0.1"
        min="0"
        max="1"
        value={agent.data.temperature}
        onChange={(v) => onChange(agent.id, { temperature: parseFloat(v) })}
      />

      <LabeledInput
        label="Max Tokens"
        type="number"
        min="1"
        value={agent.data.maxTokens}
        onChange={(v) =>
          onChange(agent.id, { maxTokens: parseInt(v, 10) || 0 })
        }
      />

      <LabeledTextarea
        label="System Prompt"
        value={agent.data.systemPrompt}
        onChange={(v) => onChange(agent.id, { systemPrompt: v })}
        placeholder="You are a helpful assistant..."
        rows={5}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 14 }}>
          <button
            onClick={onSave}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #111",
              background: "#111",
              color: "white",
              cursor: "pointer",
            }}
          >
            Save
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          {canDelete ? (
            <DangerButton
              label="Delete Agent"
              onClick={() => onDelete(agent.id)}
            />
          ) : (
            <span style={{ color: "#666", fontSize: 12 }}>
              Initial agent cannot be deleted.
            </span>
          )}
        </div>
      </div>
    </>
  );
}
