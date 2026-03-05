import { Handle, Position } from "@xyflow/react";

export default function ToolNode() {
  return (
    <div
      style={{
        padding: 10,
        border: "1px solid #888",
        borderRadius: 6,
        background: "#f8f8f8",
        width: 160
      }}
    >
      🔧 HTTP Tool

      <div style={{ marginTop: 6, fontSize: 12, color: "#555" }}>
        API / HTTP Request
      </div>

      <Handle
        type="source"
        position={Position.Top}
        id="tool-output"
      />
    </div>
  );
}
