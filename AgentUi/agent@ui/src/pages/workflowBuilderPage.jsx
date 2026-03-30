import React from "react";
import { useState, useCallback } from "react";
import NodePalette from "../panels/NodePalette";
import ToolConfigPanel from "../panels/ToolConfigPanel";
import AgentConfigPanel from "../panels/AgentConfigPanel";
import HandoffPanel from "../panels/HandoffPanel";
import { ReactFlow, Controls } from "@xyflow/react";
import {
  useReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  addEdge,
  reconnectEdge,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";


import AgentNode from "../components/AgentNode";
import ToolNode from "../components/ToolNode";
import {
  createWorkflow,
  updateWorkflow,
  getWorkflows,
  deleteWorkflow,
  getWorkflow,
} from "../api/workflow";

import {
  DEFAULT_AGENT_DATA,
  DEFAULT_HANDOFF_DATA,
  DEFAULT_TOOL_DATA,
} from "../constants";

function FlowCanvas() {
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [selectedToolId, setSelectedToolId] = useState(null);
  const [workflowName, setWorkflowName] = useState("My workflow");
  const [workflowId, setWorkflowId] = useState("");
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [edges, setEdges] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [workflowList, setWorkflowList] = useState([]);
  const initialAgentIdRef = React.useRef(null);

  const nodeTypes = { agent: AgentNode, tool: ToolNode };

  const showSidebar =
    sidebarOpen && (selectedTool || selectedAgent || selectedEdge);
  const leftColWidth = paletteOpen ? "240px" : "40px";
  const gridTemplateColumns = `${leftColWidth} 1fr${
    showSidebar ? " 320px" : ""
  }`;

  


  // const clearSelection = useCallback(() => {
  //     setSelectedToolId(null);
  //     setSelectedAgentId(null);
  //     setSelectedEdgeId(null);
  //   }, []);
  
  //   const onCloseSidebar = useCallback(() => {
  //     clearSelection();
  //     setSidebarOpen(false);
  //   }, [clearSelection]);
  
  //   const saveAndCloseSidebar = useCallback(() => {
  //     setSidebarOpen(false);
  //     clearSelection();
  //   }, [clearSelection]);
  
  //   const openAgentConfig = useCallback((agentId) => {
  //     setSelectedAgentId(agentId);
  //     setSelectedToolId(null);
  //     setSelectedEdgeId(null);
  //     setSidebarOpen(true);
  //   }, []);
  
    // const nodesWithHandlers = nodes.map((n) => ({
    //   ...n,
    //   data: {
    //     ...n.data,
    //     addNode,
    //     addToolNode,
    //     openAgentConfig,
    //     isInitial: n.id === initialAgentIdRef.current,
    //   },
    // }));
  
    // const selectedTool = nodes.find((n) => n.id === selectedToolId);
    // const selectedAgent = nodes.find((n) => n.id === selectedAgentId);
    // const selectedEdge = edges.find((e) => e.id === selectedEdgeId);
  
    // const onNodesChange = useCallback(
    //   (changes) =>
    //     setNodes((nds) =>
    //       applyNodeChanges(
    //         changes.filter(
    //           (change) =>
    //             !(
    //               change.type === "remove" &&
    //               change.id === initialAgentIdRef.current
    //             ),
    //         ),
    //         nds,
    //       ),
    //     ),
    //   [],
    // );
  
    // const onEdgesChange = useCallback(
    //   (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    //   [],
    // );
  
    // const isValidConnection = useCallback(
    //   (connection) => {
    //     const sourceNode = nodes.find((n) => n.id === connection.source);
    //     const targetNode = nodes.find((n) => n.id === connection.target);
    //     return sourceNode?.type === "agent" && targetNode?.type === "agent";
    //   },
    //   [nodes],
    // );
  
    // const onConnect = useCallback(
    //   (params) => {
    //     if (!isValidConnection(params)) return;
    //     setEdges((eds) =>
    //       addEdge(
    //         {
    //           ...params,
    //           data: { ...DEFAULT_HANDOFF_DATA },
    //         },
    //         eds,
    //       ),
    //     );
    //   },
    //   [isValidConnection],
    // );
  
    // const onReconnect = useCallback((oldEdge, newConnection) => {
    //   setEdges((eds) => {
    //     const updated = reconnectEdge(oldEdge, newConnection, eds);
    //     return updated.map((e) =>
    //       e.id === oldEdge.id
    //         ? { ...e, data: oldEdge.data ?? DEFAULT_HANDOFF_DATA }
    //         : e,
    //     );
    //   });
    // }, []);
  
    // const onEdgeClick = useCallback(
    //   (_, edge) => {
    //     const sourceNode = nodes.find((n) => n.id === edge.source);
    //     const targetNode = nodes.find((n) => n.id === edge.target);
    //     if (sourceNode?.type === "agent" && targetNode?.type === "agent") {
    //       setSelectedEdgeId(edge.id);
    //       setSelectedToolId(null);
    //       setSelectedAgentId(null);
    //       setSidebarOpen(true);
    //     }
    //   },
    //   [nodes],
    // );
  
    // const onNodeClick = useCallback((_, node) => {
    //   if (node.type === "tool") {
    //     setSelectedToolId(node.id);
    //     setSelectedAgentId(null);
    //     setSelectedEdgeId(null);
    //     setSidebarOpen(true);
    //   }
    // }, []);
  
    // function addAgentNode() {
    //   const newNode = {
    //     id: crypto.randomUUID(),
    //     type: "agent",
    //     position: {
    //       x: 200 + Math.random() * 200,
    //       y: 200 + Math.random() * 200,
    //     },
    //     data: { ...DEFAULT_AGENT_DATA },
    //   };
    //   setNodes((nds) => [...nds, newNode]);
    //   setSidebarOpen(false);
    // }
  
    // function addToolNode(agentId) {
    //   const agent = nodes.find((n) => n.id === agentId);
    //   if (!agent) return;
  
    //   const toolId = crypto.randomUUID();
    //   const toolNode = {
    //     id: toolId,
    //     type: "tool",
    //     position: { x: agent.position.x, y: agent.position.y + 150 },
    //     data: { ...DEFAULT_TOOL_DATA },
    //   };
    //   const edge = {
    //     id: `${toolId}-${agentId}`,
    //     source: toolId,
    //     target: agentId,
    //     targetHandle: "tools",
    //   };
  
    //   setNodes((nds) => [...nds, toolNode]);
    //   setEdges((eds) => [...eds, edge]);
    // }
  
    // function addNode(sourceId) {
    //   const newId = crypto.randomUUID();
    //   const newAgent = {
    //     id: newId,
    //     type: "agent",
    //     position: { x: 400, y: 200 },
    //     data: { ...DEFAULT_AGENT_DATA },
    //   };
  
    //   const newEdge = {
    //     id: `${sourceId}-${newId}`,
    //     source: sourceId,
    //     target: newId,
    //     sourceHandle: "next",
    //     targetHandle: "prev",
    //     data: { ...DEFAULT_HANDOFF_DATA },
    //   };
  
    //   setNodes((nds) => [...nds, newAgent]);
    //   setEdges((eds) => [...eds, newEdge]);
    // }
  
    // const updateToolData = useCallback((toolId, updates) => {
    //   setNodes((nds) =>
    //     nds.map((n) =>
    //       n.id === toolId ? { ...n, data: { ...n.data, ...updates } } : n,
    //     ),
    //   );
    // }, []);
  
    // const updateAgentData = useCallback((agentId, updates) => {
    //   setNodes((nds) =>
    //     nds.map((n) =>
    //       n.id === agentId ? { ...n, data: { ...n.data, ...updates } } : n,
    //     ),
    //   );
    // }, []);
  
    // const updateEdgeData = useCallback((edgeId, updates) => {
    //   setEdges((eds) =>
    //     eds.map((e) =>
    //       e.id === edgeId ? { ...e, data: { ...e.data, ...updates } } : e,
    //     ),
    //   );
    // }, []);
  
    // const deleteEdge = useCallback((edgeId) => {
    //   setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    //   setSelectedEdgeId(null);
    //   setSidebarOpen(false);
    // }, []);
  
    // const deleteAgent = useCallback((agentId) => {
    //   if (agentId === initialAgentIdRef.current) return;
  
    //   setNodes((nds) => nds.filter((n) => n.id !== agentId));
    //   setEdges((eds) =>
    //     eds.filter((e) => e.source !== agentId && e.target !== agentId),
    //   );
    //   setSelectedAgentId(null);
    //   setSidebarOpen(false);
    // }, []);
  
    // const serializeWorkflow = useCallback(() => {
    //   const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));
  
    //   // helper to strip functions from data
    //   const cleanData = (data = {}) =>
    //     Object.fromEntries(
    //       Object.entries(data).filter(([, value]) => typeof value !== "function"),
    //     );
  
    //   // group tool nodes that are connected to an agent via the "tools" handle
    //   const agentToolsMap = {};
    //   edges.forEach((e) => {
    //     const sourceNode = nodeById[e.source];
    //     const targetNode = nodeById[e.target];
    //     if (sourceNode?.type === "tool" && targetNode?.type === "agent") {
    //       if (!agentToolsMap[targetNode.id]) agentToolsMap[targetNode.id] = [];
    //       agentToolsMap[targetNode.id].push({
    //         id: sourceNode.id,
    //         type: sourceNode.type,
    //         data: cleanData(sourceNode.data),
    //       });
    //     }
    //   });
  
    //   // build serialized nodes: agents with embedded tools, plus any non-tool nodes
    //   const serializedNodes = nodes
    //     .filter((n) => n.type !== "tool") // tools are nested under their agent
    //     .map(({ data, ...rest }) => ({
    //       ...rest,
    //       data: {
    //         ...cleanData(data),
    //         type: rest.type,
    //         tools: agentToolsMap[rest.id] || [],
    //       },
    //     }));
  
    //   // keep edges that do not involve nested tool nodes and add type + cleaned data
    //   const serializedEdges = edges
    //     .filter((e) => {
    //       const sourceNode = nodeById[e.source];
    //       const targetNode = nodeById[e.target];
    //       return sourceNode?.type !== "tool" && targetNode?.type !== "tool";
    //     })
    //     .map((e) => ({
    //       ...e,
    //       type: e.type || "default",
    //       data: cleanData(e.data),
    //     }));
  
    //   const meta = {};
    //   if (workflowDescription.trim())
    //     meta.description = workflowDescription.trim();
  
    //   return {
    //     ...(Object.keys(meta).length ? { meta } : {}),
    //     nodes: serializedNodes,
    //     edges: serializedEdges,
    //   };
    // }, [nodes, edges, workflowDescription]);
  
    // const loadWorkflowIntoCanvas = useCallback((payload) => {
    //   if (!payload?.nodes) return;
    //   // reconstruct agents and tools
    //   const agentNodes = [];
    //   const toolNodes = [];
    //   const edgesFromTools = [];
  
    //   payload.nodes.forEach((n) => {
    //     const { tools = [], ...restData } = n.data || {};
    //     agentNodes.push({
    //       ...n,
    //       data: {
    //         ...restData,
    //         type: "agent",
    //       },
    //     });
    //     tools.forEach((t) => {
    //       const toolId = t.id || crypto.randomUUID();
    //       toolNodes.push({
    //         id: toolId,
    //         type: "tool",
    //         position: { x: n.position?.x || 0, y: (n.position?.y || 0) + 150 },
    //         data: t.data || {},
    //       });
    //       edgesFromTools.push({
    //         id: `${toolId}-${n.id}`,
    //         source: toolId,
    //         target: n.id,
    //         targetHandle: "tools",
    //       });
    //     });
    //   });
  
    //   const filteredEdges =
    //     payload.edges?.filter(
    //       (e) =>
    //         agentNodes.find((a) => a.id === e.source) &&
    //         agentNodes.find((a) => a.id === e.target),
    //     ) || [];
  
    //   setNodes([...agentNodes, ...toolNodes]);
    //   setEdges([...filteredEdges, ...edgesFromTools]);
    // }, []);
  
    // const saveNewWorkflow = useCallback(async () => {
    //   const name = workflowName.trim();
    //   if (!name) {
    //     setStatusMessage("Please enter a workflow name before saving.");
    //     return;
    //   }
    //   const taken = workflowList.some(
    //     (wf) => wf.name?.toLowerCase() === name.toLowerCase(),
    //   );
    //   if (taken) {
    //     setStatusMessage(
    //       "Workflow name already exists. Choose a different name.",
    //     );
    //     return;
    //   }
    //   setIsSaving(true);
    //   try {
    //     const payload = serializeWorkflow();
    //     const res = await createWorkflow({ name, payload });
    //     setWorkflowId(res.id);
    //     setStatusMessage(`Saved new workflow "${name}" (id: ${res.id}).`);
    //     setView("list");
    //     fetchWorkflowList();
    //   } catch (err) {
    //     console.error(err);
    //     setStatusMessage(
    //       err.response?.data?.detail || err.message || "Failed to save.",
    //     );
    //   } finally {
    //     setIsSaving(false);
    //   }
    // }, [serializeWorkflow, workflowName]);
  
    // const updateExistingWorkflow = useCallback(async () => {
    //   const name = workflowName.trim();
    //   if (!name) {
    //     setStatusMessage("Please enter a workflow name before updating.");
    //     return;
    //   }
    //   if (!workflowId) {
    //     setStatusMessage("Provide a workflow ID to update.");
    //     return;
    //   }
    //   const taken = workflowList.some(
    //     (wf) =>
    //       String(wf.id) !== String(workflowId) &&
    //       wf.name?.toLowerCase() === name.toLowerCase(),
    //   );
    //   if (taken) {
    //     setStatusMessage("Another workflow already uses this name.");
    //     return;
    //   }
    //   setIsSaving(true);
    //   try {
    //     const payload = serializeWorkflow();
    //     const res = await updateWorkflow(workflowId, { name, payload });
    //     setStatusMessage(`Updated workflow "${res.name}" (id: ${res.id}).`);
    //     setView("list");
    //     fetchWorkflowList();
    //   } catch (err) {
    //     console.error(err);
    //     setStatusMessage(
    //       err.response?.data?.detail || err.message || "Failed to update.",
    //     );
    //   } finally {
    //     setIsSaving(false);
    //   }
    // }, [serializeWorkflow, workflowId, workflowName]);


  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          borderBottom: "1px solid #eee",
          background: "#fafafa",
        }}
      >
        <input
          value={workflowName}
          onChange={
            () => {}
            // (e) => setWorkflowName(e.target.value)
          }
          placeholder="Workflow name"
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
          }}
        />
        <textarea
          value={workflowDescription}
          onChange={(e) => ()=>{}
            // setWorkflowDescription(e.target.value)

          }
          placeholder="Short description"
          rows={1}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            resize: "vertical",
            minHeight: 42,
          }}
        />
        <button
          onClick={() => reactFlow.fitView()}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
          }}
        >
          Fit View
        </button>
        <button
          onClick={() => {}
            // setView("list")
            }
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
          }}
        >
          Back to List
        </button>
        <button
          onClick={workflowId ? 
            // updateExistingWorkflow 
            ()=>{}
            : 
            ()=>{}
            // saveNewWorkflow
          }
          disabled={isSaving}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "none",
            background: "#111",
            color: "white",
            cursor: "pointer",
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          {workflowId ? "Update Workflow" : "Save Workflow"}
        </button>
      </div>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns,
          gap: 0,
          minHeight: 0,
        }}
      >
        <div
          style={{
            padding: paletteOpen ? 16 : 8,
            borderRight: "1px solid #eee",
            overflowY: "auto",
            position: "relative",
          }}
        >
          <button
            onClick={() => setPaletteOpen((v) => !v)}
            title={paletteOpen ? "Hide palette" : "Show palette"}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 24,
              height: 24,
              borderRadius: 6,
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {paletteOpen ? "◀" : "▶"}
          </button>
          {paletteOpen ? (
            <NodePalette onAddAgent={
              ()=>{}
              // addAgentNode
            } />
          ) : (
            <div style={{ width: 8 }} />
          )}
        </div>

        <div style={{ position: "relative" }}>
          <ReactFlow
            nodes={()=>{}
              // nodesWithHandlers
            }
            edges={
              ()=>{}
              // edges
            }
            nodeTypes={
              ()=>{}
              // nodeTypes
            }
            onNodesChange={
              ()=>{}
              // onNodesChange
            }
            onEdgesChange={
              ()=>{}
              // onEdgesChange
            }
            onConnect={
              ()=>{}
              //onConnect
              }
            onReconnect={
              ()=>{}
              //onReconnect
              }
            onEdgeClick={()=>{}
            //onEdgeClick
            }
            onNodeClick={
              ()=>{}
              //onNodeClick
              }
            fitView
            style={{ width: "100%", height: "100%" }}
          >
            <Controls />
          </ReactFlow>
        </div>
{/* 
        {showSidebar ? (
          <div
            style={{
              padding: 16,
              marginRight: 16,
              borderLeft: "1px solid #eee",
              overflowY: "auto",
            }}
          >
            {selectedTool ? (
              <ToolConfigPanel
                tool={selectedTool}
                onChange={updateToolData}
                onSave={onSavePanel}
                onClose={onCloseSidebar}
              />
            ) : selectedAgent ? (
              <AgentConfigPanel
                agent={selectedAgent}
                onChange={updateAgentData}
                onDelete={deleteAgent}
                canDelete={selectedAgent.id !== initialAgentIdRef.current}
                onSave={onSavePanel}
                onClose={onCloseSidebar}
              />
            ) : selectedEdge ? (
              <HandoffPanel
                edge={selectedEdge}
                onChange={updateEdgeData}
                onDelete={deleteEdge}
                onSave={onSavePanel}
                onClose={onCloseSidebar}
              />
            ) : null}
          </div>
        ) : null} */}

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
