import React from "react";
import { ReactFlow, Controls } from "@xyflow/react";
import WorkflowLoadingOverlay from "./WorkflowLoadingOverlay";

export default function WorkflowCanvas({
  nodes,
  edges,
  nodeTypes,
  showLoading,
  onNodesChange,
  onNodeDragStop,
  onEdgesChange,
  onConnect,
  onReconnect,
  onNodeClick,
  onEdgeClick,
  onMoveEnd,
}) {
  return (
    <div style={{ position: "relative" }}>
      <WorkflowLoadingOverlay show={showLoading} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onMoveEnd={onMoveEnd}
        fitView
        style={{ width: "100%", height: "100%" }}
      >
        <Controls />
      </ReactFlow>
    </div>
  );
}
