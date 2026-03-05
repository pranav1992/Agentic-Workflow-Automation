import DangerButton from "../ui/DangerButton";
import LabeledInput from "../ui/LabeledInput";
import LabeledTextarea from "../ui/LabeledTextarea";

export default function AgentConfigPanel({ agent, onChange, onDelete }) {
  return (
    <>
      <h3>Agent Model</h3>

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

      <DangerButton label="Delete Agent" onClick={() => onDelete(agent.id)} />
    </>
  );
}
