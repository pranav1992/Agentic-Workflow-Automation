import React, { lazy, useState } from "react";
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
import VoiceSessionPanel from "../components/workflow/VoiceSessionPanel";
import { launchWorkflow } from "../api/workflow";

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
  const [sessionState, setSessionState] = useState(null);

  const handleLaunch = async () => {
    try {
      const data = await launchWorkflow(workflowId);
      setSessionState(data);
    } catch (err) {
      console.error("Failed to launch workflow", err);
    }
  };

  const handleStop = () => setSessionState(null);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#1c2030",
      }}
    >
      <WorkflowToolbar
        workflowName={workflowName}
        onFitView={() => reactFlow.fitView()}
        isSaving={isSaving}
        isSessionActive={!!sessionState}
        onLaunch={handleLaunch}
        onStop={handleStop}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
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
            padding: "7px 20px",
            borderTop: "1px solid #dadce0",
            background: "#f8f9fa",
            fontSize: 12,
            color: "#5f6368",
            flexShrink: 0,
          }}
        >
          {statusMessage}
        </div>
      )}

      {sessionState && (
        <VoiceSessionPanel
          workflowId={workflowId}
          session={sessionState}
          onStop={handleStop}
        />
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
