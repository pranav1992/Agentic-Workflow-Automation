import React, { Suspense } from "react";
import theme from "../../theme";

const PANEL_TITLES = {
  tool: "HTTP Tool",
  agent: "Agent Settings",
  edge: "Handoff",
};

function SidebarSkeleton() {
  return (
    <div style={{ padding: 20 }}>
      {[80, 50, 100, 60].map((w, i) => (
        <div
          key={i}
          style={{
            height: 12,
            width: `${w}%`,
            borderRadius: 6,
            background: theme.border,
            marginBottom: 14,
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  );
}

export default function WorkflowSidebar({
  show,
  selectedTool,
  selectedAgent,
  selectedEdge,
  ToolConfigPanel,
  AgentConfigPanel,
  HandoffPanel,
  updateToolData,
  deleteTool,
  updateAgentData,
  deleteAgent,
  updateEdgeData,
  handleDeleteEdge,
  onSavePanel,
  onCloseSidebar,
}) {
  if (!show) return null;

  const panelType = selectedTool ? "tool" : selectedAgent ? "agent" : "edge";
  const title = PANEL_TITLES[panelType];

  return (
    <div
      style={{
        width: 300,
        display: "flex",
        flexDirection: "column",
        background: theme.surface,
        borderLeft: `1px solid ${theme.border}`,
        overflowY: "auto",
      }}
    >
      {/* Panel header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 56,
          padding: "0 20px",
          borderBottom: `1px solid ${theme.border}`,
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14, color: theme.textPrimary }}>
          {title}
        </span>
        <button
          onClick={onCloseSidebar}
          style={{
            background: "none",
            border: "none",
            fontSize: 20,
            color: theme.textSecondary,
            cursor: "pointer",
            lineHeight: 1,
            padding: "2px 4px",
            borderRadius: 4,
          }}
        >
          ×
        </button>
      </div>

      {/* Panel body */}
      <div style={{ padding: 20, flex: 1 }}>
        <Suspense fallback={<SidebarSkeleton />}>
          {selectedTool ? (
            <ToolConfigPanel
              tool={selectedTool}
              onChange={updateToolData}
              onDelete={deleteTool}
              onSave={onSavePanel}
              onClose={onCloseSidebar}
            />
          ) : selectedAgent ? (
            <AgentConfigPanel
              agent={selectedAgent}
              onChange={updateAgentData}
              onDelete={deleteAgent}
              canDelete={!selectedAgent.data?.isInitial}
              onSave={onSavePanel}
              onClose={onCloseSidebar}
            />
          ) : selectedEdge ? (
            <HandoffPanel
              edge={selectedEdge}
              onChange={updateEdgeData}
              onDelete={handleDeleteEdge}
              onSave={onSavePanel}
              onClose={onCloseSidebar}
            />
          ) : null}
        </Suspense>
      </div>
    </div>
  );
}
