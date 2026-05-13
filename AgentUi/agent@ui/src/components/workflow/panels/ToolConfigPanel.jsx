import { useEffect, useState } from "react";
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

export default function ToolConfigPanel({
  tool,
  onChange,
  onDelete = () => {},
  onSave = () => {},
  onClose = () => {},
}) {
  const [pathParamsText, setPathParamsText] = useState("");
  const [queryParamsText, setQueryParamsText] = useState("");
  const [headersText, setHeadersText] = useState("");
  const [bodyParamsText, setBodyParamsText] = useState("");

  useEffect(() => {
    const stringifyOrEmpty = (arr) =>
      Array.isArray(arr) && arr.length > 0 ? JSON.stringify(arr, null, 2) : "";
    setPathParamsText(stringifyOrEmpty(tool.data.pathParams));
    setQueryParamsText(stringifyOrEmpty(tool.data.queryParams));
    setHeadersText(stringifyOrEmpty(tool.data.headers));
    setBodyParamsText(stringifyOrEmpty(tool.data.bodyParams));
  }, [tool]);

  const handleArrayChange = (field, setter) => (value) => {
    setter(value);
    try {
      const parsed = JSON.parse(value || "[]");
      if (Array.isArray(parsed)) onChange(tool.id, { [field]: parsed });
    } catch { /* keep text so user can fix */ }
  };

  return (
    <>
      <SectionLabel>Endpoint</SectionLabel>

      <LabeledInput
        label="Label"
        value={tool.data.label || ""}
        onChange={(v) => onChange(tool.id, { label: v })}
        placeholder="HTTP Request"
      />

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
          Method
        </label>
        <select
          value={tool.data.method}
          onChange={(e) => onChange(tool.id, { method: e.target.value })}
          style={styledSelect}
        >
          <option>GET</option>
          <option>POST</option>
          <option>PUT</option>
          <option>PATCH</option>
          <option>DELETE</option>
        </select>
      </div>

      <LabeledInput
        label="Base URL"
        value={tool.data.baseUrl || ""}
        onChange={(v) => onChange(tool.id, { baseUrl: v })}
        placeholder="https://api.example.com"
      />

      <LabeledInput
        label="Path"
        value={tool.data.path || ""}
        onChange={(v) => onChange(tool.id, { path: v })}
        placeholder="/weather/{city}"
      />

      <SectionLabel>Parameters</SectionLabel>

      <LabeledTextarea
        label="Path Params (JSON array)"
        value={pathParamsText}
        onChange={handleArrayChange("pathParams", setPathParamsText)}
        onFocus={() => { if (pathParamsText.trim() === "[]") setPathParamsText(""); }}
        placeholder={`[{"name":"city","type":"string","description":"City name","required":true,"value":""}]`}
        rows={5}
      />

      <LabeledTextarea
        label="Query Params (JSON array)"
        value={queryParamsText}
        onChange={handleArrayChange("queryParams", setQueryParamsText)}
        onFocus={() => { if (queryParamsText.trim() === "[]") setQueryParamsText(""); }}
        placeholder={`[{"name":"units","type":"string","description":"metric|imperial","required":false,"value":""}]`}
        rows={5}
      />

      <LabeledTextarea
        label="Headers (JSON array)"
        value={headersText}
        onChange={handleArrayChange("headers", setHeadersText)}
        onFocus={() => { if (headersText.trim() === "[]") setHeadersText(""); }}
        placeholder={`[{"name":"Authorization","description":"API Key","value":""}]`}
        rows={4}
      />

      {["POST", "PUT", "PATCH"].includes(tool.data.method) && (
        <LabeledTextarea
          label="Body Params (JSON array)"
          value={bodyParamsText}
          onChange={handleArrayChange("bodyParams", setBodyParamsText)}
          onFocus={() => { if (bodyParamsText.trim() === "[]") setBodyParamsText(""); }}
          placeholder={`[{"name":"name","type":"string","description":"Full name","required":true,"value":""}]`}
          rows={5}
        />
      )}

      <LabeledTextarea
        label="Body"
        value={tool.data.body ?? ""}
        onChange={(v) => onChange(tool.id, { body: v })}
        placeholder='{"key": "value"}'
        rows={4}
      />

      <SectionLabel>Prompt</SectionLabel>

      <LabeledTextarea
        label="System Prompt (when to use this tool)"
        value={tool.data.systemPrompt || ""}
        onChange={(v) => onChange(tool.id, { systemPrompt: v })}
        placeholder="Use this tool when..."
        rows={4}
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
        <DangerButton label="Delete Tool" onClick={() => onDelete(tool.id)} />
      </div>
    </>
  );
}
