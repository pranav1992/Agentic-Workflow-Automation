import LabeledInput from "../ui/LabeledInput";
import LabeledTextarea from "../ui/LabeledTextarea";

export default function ToolConfigPanel({ tool, onChange }) {
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
        label="URL"
        value={tool.data.url}
        onChange={(v) => onChange(tool.id, { url: v })}
        placeholder="https://api.example.com/resource"
      />

      <LabeledTextarea
        label="Headers"
        value={tool.data.headers}
        onChange={(v) => onChange(tool.id, { headers: v })}
        placeholder={`Content-Type: application/json\nAuthorization: Bearer ...`}
        rows={3}
      />

      <LabeledTextarea
        label="Body"
        value={tool.data.body}
        onChange={(v) => onChange(tool.id, { body: v })}
        placeholder='{"key": "value"}'
        rows={4}
      />
    </>
  );
}
