import { Handle, Position } from "@xyflow/react";
import theme from "../../../theme";

const METHOD_COLORS = {
  GET:    { bg: "#e6f4ea", color: "#1e8e3e" },
  POST:   { bg: "#e8f0fe", color: "#1a73e8" },
  PUT:    { bg: "#fff3e0", color: "#e65100" },
  PATCH:  { bg: "#fce8e6", color: "#d93025" },
  DELETE: { bg: "#fce8e6", color: "#d93025" },
};

export default function ToolNode({ id, data }) {
  const method = (data.method || "GET").toUpperCase();
  const methodStyle = METHOD_COLORS[method] || METHOD_COLORS.GET;

  return (
    <div
      onClick={() => data.openToolConfig(id)}
      style={{
        width: 180,
        background: theme.surface,
        borderRadius: theme.radiusLg,
        boxShadow: theme.shadow,
        border: `1px solid ${theme.border}`,
        borderTop: `4px solid ${theme.success}`,
        cursor: "pointer",
        padding: "10px 12px 10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
        <span style={{ fontSize: 16, lineHeight: 1 }}>🔧</span>
        <span
          style={{
            fontWeight: 600,
            fontSize: 12,
            color: theme.textPrimary,
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {data.label || "HTTP Tool"}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: 6,
            background: methodStyle.bg,
            color: methodStyle.color,
            letterSpacing: "0.5px",
          }}
        >
          {method}
        </span>
        <span style={{ fontSize: 11, color: theme.textSecondary }}>
          {data.path || "API / HTTP Request"}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Top}
        id="tool-output"
        style={{ background: theme.success, width: 10, height: 10, border: "2px solid white" }}
      />
    </div>
  );
}
