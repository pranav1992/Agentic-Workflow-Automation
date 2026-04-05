import React, { Suspense } from "react";

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

  return (
    <div
      style={{
        padding: 16,
        marginRight: 16,
        borderLeft: "1px solid #eee",
        overflowY: "auto",
      }}
    >
      <Suspense fallback={<div>Loading…</div>}>
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
  );
}
