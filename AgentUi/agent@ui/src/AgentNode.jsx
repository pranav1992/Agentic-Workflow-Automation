import { Handle, Position } from "@xyflow/react";

export default function AgentNode({ id, data }) {
  return (
    <div
      style={{
        padding: 12,
        border: "1px solid #555",
        borderRadius: 8,
        background: "white",
        width: 180,
        position: "relative"
      }}
    >
      <strong>Agent Node</strong>

      <div style={{ marginTop: 10 }}>
        <button onClick={() => data.addNode(id)}>+ Add Node</button>
      </div>

      {/* ADD TOOL BUTTON */}
      <div
        onClick={() => data.addToolNode(id)}
        style={{
          position: "absolute",
          bottom: -28,
          left: 40,
          fontSize: 12,
          cursor: "pointer",
          background: "#eee",
          padding: "2px 6px",
          borderRadius: 4
        }}
      >
        ➕ Tool
      </div>

      {/* EDIT MODEL CONFIG BUTTON */}
      <div
        onClick={() => data.openAgentConfig(id)}
        style={{
          position: "absolute",
          bottom: -28,
          right: 12,
          fontSize: 12,
          cursor: "pointer",
          background: "#eef3ff",
          padding: "2px 6px",
          borderRadius: 4,
          border: "1px solid #cbd6ff"
        }}
      >
        ✏️ Model
      </div>

      {/* TOOL HANDLE */}
      <Handle
        type="target"
        position={Position.Bottom}
        id="tools"
        style={{ left: 60, background: "#555" }}
      />

      {/* INPUT HANDLE FOR AGENT-TO-AGENT LINKS */}
      <Handle
        type="target"
        position={Position.Left}
        id="prev"
        style={{ top: 40, background: "#555" }}
      />

      {/* OUTPUT HANDLE */}
      <Handle
        type="source"
        position={Position.Right}
        id="next"
        style={{ top: 40, background: "#555" }}
      />
    </div>
  );
}
