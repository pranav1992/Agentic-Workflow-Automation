import { Handle, Position } from "@xyflow/react";
import theme from "../../../theme";

export default function AgentNode({ id, data }) {
  return (
    <div
      style={{
        width: 200,
        background: theme.surface,
        borderRadius: theme.radiusLg,
        boxShadow: theme.shadow,
        border: `1px solid ${theme.border}`,
        borderTop: `4px solid ${theme.primary}`,
        overflow: "visible",
        position: "relative",
      }}
    >
      {/* Header */}
      <div style={{ padding: "10px 12px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>🤖</span>
          <span
            style={{
              fontWeight: 600,
              fontSize: 13,
              color: theme.textPrimary,
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {data.name || "Agent"}
          </span>
          {data.isInitial && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: theme.primary,
                background: theme.primaryLight,
                padding: "2px 6px",
                borderRadius: 10,
                letterSpacing: "0.3px",
                whiteSpace: "nowrap",
              }}
            >
              ENTRY
            </span>
          )}
        </div>
        {data.model && (
          <div style={{ fontSize: 11, color: theme.textSecondary, marginTop: 3, paddingLeft: 25 }}>
            {data.model}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "7px 10px",
          borderTop: `1px solid #f1f3f4`,
        }}
      >
        <button
          onClick={() => data.addNode(id)}
          style={{
            flex: 1,
            padding: "5px 4px",
            fontSize: 11,
            fontWeight: 500,
            borderRadius: 6,
            border: `1px solid ${theme.border}`,
            background: theme.surfaceAlt,
            color: theme.textSecondary,
            cursor: "pointer",
          }}
        >
          + Agent
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); data.openAgentConfig(id); }}
          style={{
            flex: 1,
            padding: "5px 4px",
            fontSize: 11,
            fontWeight: 500,
            borderRadius: 6,
            border: `1px solid ${theme.primary}`,
            background: theme.primaryLight,
            color: theme.primary,
            cursor: "pointer",
          }}
        >
          ⚙ Config
        </button>
      </div>

      {/* Add Tool chip — floats below */}
      <div
        onClick={(e) => { e.stopPropagation(); data.addToolNode(id); }}
        style={{
          position: "absolute",
          bottom: -26,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 11,
          fontWeight: 500,
          cursor: "pointer",
          background: theme.successLight,
          color: theme.success,
          border: `1px solid ${theme.success}`,
          padding: "2px 10px",
          borderRadius: 10,
          whiteSpace: "nowrap",
        }}
      >
        + Tool
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Bottom}
        id="tools"
        style={{ left: 60, background: theme.success, width: 10, height: 10, border: "2px solid white" }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="prev"
        style={{
          top: 40,
          background: theme.primary,
          width: 10,
          height: 10,
          border: "2px solid white",
          opacity: data.isInitial ? 0.3 : 1,
          pointerEvents: data.isInitial ? "none" : "auto",
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="next"
        style={{ top: 40, background: theme.primary, width: 10, height: 10, border: "2px solid white" }}
      />
    </div>
  );
}
