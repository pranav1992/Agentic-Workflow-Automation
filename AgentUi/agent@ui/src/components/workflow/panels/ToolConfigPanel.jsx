import { useEffect, useState } from "react";
import DangerButton from "../../../ui/DangerButton";
import LabeledInput from "../../../ui/LabeledInput";
import LabeledTextarea from "../../../ui/LabeledTextarea";

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
      if (Array.isArray(parsed)) {
        onChange(tool.id, { [field]: parsed });
      }
    } catch {
      // ignore invalid JSON, keep text so user can fix it
    }
  };

  const clearIfPlaceholder = (value, setter) => () => {
    if (value.trim() === "[]") {
      setter("");
    }
  };

  return (
    <>
      <h3>HTTP Tool</h3>

      <LabeledInput
        label="Label"
        value={tool.data.label || ""}
        onChange={(v) => onChange(tool.id, { label: v })}
        placeholder="HTTP Request"
      />

      <label style={{ fontSize: 12, color: "#444" }}>Method</label>
      <select
        value={tool.data.method}
        onChange={(e) => onChange(tool.id, { method: e.target.value })}
        style={{ width: "100%", marginBottom: 10 }}
      >
        <option>GET</option>
        <option>POST</option>
        <option>PUT</option>
        <option>PATCH</option>
        <option>DELETE</option>
      </select>

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

      <LabeledTextarea
        label="Path Params (JSON array)"
        value={pathParamsText}
        onChange={handleArrayChange("pathParams", setPathParamsText)}
        onFocus={() => {
          if (pathParamsText.trim() === "[]") setPathParamsText("");
        }}
        placeholder={`[
  {"name":"city","type":"string","description":"City name","required":true,"value":""}
]`}
        rows={6}
      />

      <LabeledTextarea
        label="Query Params (JSON array)"
        value={queryParamsText}
        onChange={handleArrayChange("queryParams", setQueryParamsText)}
        onFocus={() => {
          if (queryParamsText.trim() === "[]") setQueryParamsText("");
        }}
        placeholder={`[
  {"name":"units","type":"string","description":"metric|imperial","required":false,"value":""}
]`}
        rows={6}
      />

      <LabeledTextarea
        label="Headers (JSON array)"
        value={headersText}
        onChange={handleArrayChange("headers", setHeadersText)}
        onFocus={() => {
          if (headersText.trim() === "[]") setHeadersText("");
        }}
        placeholder={`[
  {"name":"Authorization","description":"API Key","value":""}
]`}
        rows={5}
      />

      {["POST", "PUT", "PATCH"].includes(tool.data.method) && (
        <LabeledTextarea
          label="Body Params (JSON array)"
          value={bodyParamsText}
          onChange={handleArrayChange("bodyParams", setBodyParamsText)}
          onFocus={() => {
            if (bodyParamsText.trim() === "[]") setBodyParamsText("");
          }}
          placeholder={`[\n  {\"name\":\"name\",\"type\":\"string\",\"description\":\"Full name\",\"required\":true,\"value\":\"\"}\n]`}
          rows={6}
        />
      )}

      <LabeledTextarea
        label="Body"
        value={tool.data.body ?? ""}
        onChange={(v) => onChange(tool.id, { body: v })}
        placeholder='{"key": "value"}'
        rows={4}
      />

      <LabeledTextarea
        label="System Prompt (when to use this tool)"
        value={tool.data.systemPrompt || ""}
        onChange={(v) => onChange(tool.id, { systemPrompt: v })}
        placeholder="Use this tool when..."
        rows={4}
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
          <DangerButton label="Delete Tool" onClick={() => onDelete(tool.id)} />
        </div>
      </div>
    </>
  );
}
