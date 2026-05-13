import { useState } from "react";
import DangerButton from "../../../ui/DangerButton";
import LabeledInput from "../../../ui/LabeledInput";
import LabeledTextarea from "../../../ui/LabeledTextarea";
import theme from "../../../theme";

function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.8px",
        textTransform: "uppercase",
        color: theme.primary,
        marginBottom: 10,
        marginTop: 4,
        paddingBottom: 6,
        borderBottom: `1px solid ${theme.border}`,
      }}
    >
      {children}
    </div>
  );
}

export default function AgentConfigPanel({
  agent,
  onChange,
  onDelete,
  canDelete,
  onSave = () => {},
  onClose = () => {},
}) {
  const [isInitialFocused, setIsInitialFocused] = useState(false);

  return (
    <>
      <SectionLabel>Identity</SectionLabel>

      <LabeledInput
        label="Agent Name"
        value={agent.data.name || ""}
        onChange={(v) => onChange(agent.id, { name: v })}
        placeholder="Support Bot"
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
          padding: "8px 10px",
          background: isInitialFocused ? theme.primaryLight : theme.surfaceAlt,
          borderRadius: theme.radius,
          border: `1.5px solid ${isInitialFocused ? theme.borderFocus : theme.border}`,
          cursor: "pointer",
          transition: "background 0.15s, border-color 0.15s",
        }}
        onClick={() => onChange(agent.id, { isInitial: !agent.data.isInitial })}
        onMouseEnter={() => setIsInitialFocused(true)}
        onMouseLeave={() => setIsInitialFocused(false)}
      >
        <input
          id={`initial-${agent.id}`}
          type="checkbox"
          checked={Boolean(agent.data.isInitial)}
          onChange={(e) => onChange(agent.id, { isInitial: e.target.checked })}
          onClick={(e) => e.stopPropagation()}
          style={{ accentColor: theme.primary, width: 15, height: 15 }}
        />
        <label
          htmlFor={`initial-${agent.id}`}
          style={{ fontSize: 13, color: theme.textPrimary, cursor: "pointer", flex: 1 }}
        >
          Entry point agent
        </label>
        {agent.data.isInitial && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: theme.primary,
              background: theme.primaryLight,
              padding: "2px 7px",
              borderRadius: 10,
            }}
          >
            ACTIVE
          </span>
        )}
      </div>

      <SectionLabel>Model Config</SectionLabel>

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
          Model
        </label>
        <select
          value={agent.data.model || "gpt-4o-realtime-preview"}
          onChange={(e) => onChange(agent.id, { model: e.target.value })}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "8px 10px",
            fontSize: 13,
            color: theme.textPrimary,
            background: theme.surfaceAlt,
            border: `1.5px solid ${theme.border}`,
            borderRadius: theme.radius,
            outline: "none",
          }}
        >
          <option value="gpt-4o-realtime-preview">gpt-4o-realtime-preview</option>
          <option value="gpt-4o-mini-realtime-preview">gpt-4o-mini-realtime-preview</option>
        </select>
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
          Language
        </label>
        <select
          value={agent.data.language || "en"}
          onChange={(e) => onChange(agent.id, { language: e.target.value })}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "8px 10px",
            fontSize: 13,
            color: theme.textPrimary,
            background: theme.surfaceAlt,
            border: `1.5px solid ${theme.border}`,
            borderRadius: theme.radius,
            outline: "none",
          }}
        >
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="it">Italian</option>
          <option value="pt">Portuguese</option>
          <option value="hi">Hindi</option>
          <option value="ja">Japanese</option>
          <option value="ko">Korean</option>
          <option value="zh">Chinese (Mandarin)</option>
          <option value="ar">Arabic</option>
          <option value="ru">Russian</option>
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
          onChange={(v) => onChange(agent.id, { maxTokens: parseInt(v, 10) || 0 })}
        />
      </div>

      <SectionLabel>Prompt</SectionLabel>

      <LabeledTextarea
        label="Greeting"
        value={agent.data.welcomeMessage || ""}
        onChange={(v) => onChange(agent.id, { welcomeMessage: v })}
        placeholder="Begin by welcoming the user..."
        rows={3}
      />

      <LabeledTextarea
        label="System Prompt"
        value={agent.data.systemPrompt}
        onChange={(v) => onChange(agent.id, { systemPrompt: v })}
        placeholder="You are a helpful assistant..."
        rows={6}
      />

      {/* Actions */}
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
        {canDelete ? (
          <DangerButton label="Delete Agent" onClick={() => onDelete(agent.id)} />
        ) : (
          <p style={{ fontSize: 12, color: theme.textDisabled, margin: 0, textAlign: "center" }}>
            Entry point agent cannot be deleted.
          </p>
        )}
      </div>
    </>
  );
}
