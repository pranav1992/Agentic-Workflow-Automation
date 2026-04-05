import React, { lazy } from "react";
import { useParams } from "react-router";
const ToolConfigPanel = lazy(() =>
  import("../components/workflow/panels").then((m) => ({
    default: m.ToolConfigPanel,
  })),
);
const AgentConfigPanel = lazy(() =>
  import("../components/workflow/panels").then((m) => ({
    default: m.AgentConfigPanel,
  })),
);
const HandoffPanel = lazy(() =>
  import("../components/workflow/panels").then((m) => ({
    default: m.HandoffPanel,
  })),
);
import { ReactFlowProvider } from "@xyflow/react";
import "./workflowBuilderPage.css";
import "@xyflow/react/dist/style.css";
import { useWorkflowBuilder } from "../hooks/workflow/useWorkflowBuilder";
import { AgentNode, ToolNode } from "../components/workflow/nodes";
import {
  WorkflowToolbar,
  WorkflowCanvas,
  WorkflowSidebar,
} from "../components/workflow";

function FlowCanvas() {
  const { workflowId: routeWorkflowId } = useParams();
  const {
    workflowId,
    workflowName,
    isSaving,
    statusMessage,
    nodesWithHandlers,
    edges,
    selectedTool,
    selectedAgent,
    selectedEdge,
    showSidebar,
    gridTemplateColumns,
    showLoading,
    onNodesChange,
    onNodeDragStop,
    onEdgesChange,
    onConnect,
    onReconnect,
    onNodeClick,
    onEdgeClick,
    handleMoveEnd,
    onCloseSidebar,
    onSavePanel,
    updateToolData,
    deleteTool,
    updateAgentData,
    deleteAgent,
    updateEdgeData,
    handleDeleteEdge,
    reactFlow,
  } = useWorkflowBuilder(routeWorkflowId);

  const nodeTypes = { agent: AgentNode, tool: ToolNode };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <WorkflowToolbar
        workflowName={workflowName}
        onFitView={() => reactFlow.fitView()}
        isSaving={isSaving}
      />

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns,
          gap: 0,
          minHeight: 0,
        }}
      >
        <WorkflowCanvas
          nodes={nodesWithHandlers}
          edges={edges}
          nodeTypes={nodeTypes}
          showLoading={showLoading}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={onReconnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onMoveEnd={handleMoveEnd}
        />
        <WorkflowSidebar
          show={showSidebar}
          selectedTool={selectedTool}
          selectedAgent={selectedAgent}
          selectedEdge={selectedEdge}
          ToolConfigPanel={ToolConfigPanel}
          AgentConfigPanel={AgentConfigPanel}
          HandoffPanel={HandoffPanel}
          updateToolData={updateToolData}
          deleteTool={deleteTool}
          updateAgentData={updateAgentData}
          deleteAgent={deleteAgent}
          updateEdgeData={updateEdgeData}
          handleDeleteEdge={handleDeleteEdge}
          onSavePanel={onSavePanel}
          onCloseSidebar={onCloseSidebar}
        />
      </div>

      {statusMessage && (
        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid #eee",
            background: "#fafafa",
          }}
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
}

export default function WorkFlowBuilderPage() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}
