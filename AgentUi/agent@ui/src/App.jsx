import { useCallback, useState } from "react";
import {
  ReactFlow,
  Controls,
  useReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  addEdge,
  reconnectEdge,
  ReactFlowProvider
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import AgentNode from "./AgentNode";
import ToolNode from "./ToolNode";
import {
  DEFAULT_AGENT_DATA,
  DEFAULT_HANDOFF_DATA,
  DEFAULT_TOOL_DATA,
  SIDEBAR_STYLE
} from "./constants";
import NodePalette from "./panels/NodePalette";
import ToolConfigPanel from "./panels/ToolConfigPanel";
import AgentConfigPanel from "./panels/AgentConfigPanel";
import HandoffPanel from "./panels/HandoffPanel";

const nodeTypes = { agent: AgentNode, tool: ToolNode };

function FlowCanvas() {
  const reactFlow = useReactFlow();

  const [nodes, setNodes] = useState([
    {
      id: crypto.randomUUID(),
      position: { x: 0, y: 0 },
      type: "agent",
      data: { ...DEFAULT_AGENT_DATA }
    }
  ]);
  const [edges, setEdges] = useState([]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedToolId, setSelectedToolId] = useState(null);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);

  const clearSelection = useCallback(() => {
    setSelectedToolId(null);
    setSelectedAgentId(null);
    setSelectedEdgeId(null);
  }, []);

  const openAgentConfig = useCallback((agentId) => {
    setSelectedAgentId(agentId);
    setSelectedToolId(null);
    setSelectedEdgeId(null);
    setSidebarOpen(true);
  }, []);

  const nodesWithHandlers = nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      addNode,
      addToolNode,
      openAgentConfig
    }
  }));

  const selectedTool = nodes.find((n) => n.id === selectedToolId);
  const selectedAgent = nodes.find((n) => n.id === selectedAgentId);
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const isValidConnection = useCallback(
    (connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      return sourceNode?.type === "agent" && targetNode?.type === "agent";
    },
    [nodes]
  );

  const onConnect = useCallback(
    (params) => {
      if (!isValidConnection(params)) return;
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            data: { ...DEFAULT_HANDOFF_DATA }
          },
          eds
        )
      );
    },
    [isValidConnection]
  );

  const onReconnect = useCallback((oldEdge, newConnection) => {
    setEdges((eds) => {
      const updated = reconnectEdge(oldEdge, newConnection, eds);
      return updated.map((e) =>
        e.id === oldEdge.id ? { ...e, data: oldEdge.data ?? DEFAULT_HANDOFF_DATA } : e
      );
    });
  }, []);

  const onEdgeClick = useCallback(
    (_, edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);
      if (sourceNode?.type === "agent" && targetNode?.type === "agent") {
        setSelectedEdgeId(edge.id);
        setSelectedToolId(null);
        setSelectedAgentId(null);
        setSidebarOpen(true);
      }
    },
    [nodes]
  );

  const onNodeClick = useCallback((_, node) => {
    if (node.type === "tool") {
      setSelectedToolId(node.id);
      setSelectedAgentId(null);
      setSelectedEdgeId(null);
      setSidebarOpen(true);
    }
  }, []);
  
  function addAgentNode() {
    const newNode = {
      id: crypto.randomUUID(),
      type: "agent",
      position: {
        x: 200 + Math.random() * 200,
        y: 200 + Math.random() * 200
      },
      data: { ...DEFAULT_AGENT_DATA }
    };
    setNodes((nds) => [...nds, newNode]);
    setSidebarOpen(false);
  }

  function addToolNode(agentId) {
    const agent = nodes.find((n) => n.id === agentId);
    if (!agent) return;

    const toolId = crypto.randomUUID();
    const toolNode = {
      id: toolId,
      type: "tool",
      position: { x: agent.position.x, y: agent.position.y + 150 },
      data: { ...DEFAULT_TOOL_DATA }
    };
    const edge = {
      id: `${toolId}-${agentId}`,
      source: toolId,
      target: agentId,
      targetHandle: "tools"
    };

    setNodes((nds) => [...nds, toolNode]);
    setEdges((eds) => [...eds, edge]);
  }

  function addNode(sourceId) {
    const newId = crypto.randomUUID();
    const newAgent = {
      id: newId,
      type: "agent",
      position: { x: 400, y: 200 },
      data: { ...DEFAULT_AGENT_DATA }
    };

    const newEdge = {
      id: `${sourceId}-${newId}`,
      source: sourceId,
      target: newId,
      sourceHandle: "next",
      targetHandle: "prev",
      data: { ...DEFAULT_HANDOFF_DATA }
    };

    setNodes((nds) => [...nds, newAgent]);
    setEdges((eds) => [...eds, newEdge]);
  }

  const updateToolData = useCallback((toolId, updates) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === toolId ? { ...n, data: { ...n.data, ...updates } } : n
      )
    );
  }, []);

  const updateAgentData = useCallback((agentId, updates) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === agentId ? { ...n, data: { ...n.data, ...updates } } : n
      )
    );
  }, []);

  const updateEdgeData = useCallback((edgeId, updates) => {
    setEdges((eds) =>
      eds.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, ...updates } } : e
      )
    );
  }, []);

  const deleteEdge = useCallback((edgeId) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    setSelectedEdgeId(null);
    setSidebarOpen(false);
  }, []);

  const deleteAgent = useCallback((agentId) => {
    setNodes((nds) => nds.filter((n) => n.id !== agentId));
    setEdges((eds) =>
      eds.filter((e) => e.source !== agentId && e.target !== agentId)
    );
    setSelectedAgentId(null);
    setSidebarOpen(false);
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <ReactFlow
        nodes={nodesWithHandlers}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onEdgeClick={onEdgeClick}
        onNodeClick={onNodeClick}
        isValidConnection={isValidConnection}
        fitView
      >
        <Controls showInteractive={false} />
      </ReactFlow>

      <button
        onClick={() => {
          clearSelection();
          setSidebarOpen(true);
        }}
        style={{
          position: "absolute",
          right: 20,
          top: 20,
          padding: "10px 14px",
          borderRadius: 6,
          border: "none",
          background: "#111",
          color: "white",
          cursor: "pointer"
        }}
      >
        + Node
      </button>

      {sidebarOpen && (
        <div style={SIDEBAR_STYLE}>
          {!selectedTool && !selectedAgent && !selectedEdge && (
            <NodePalette onAddAgent={addAgentNode} />
          )}

          {selectedTool && (
            <ToolConfigPanel tool={selectedTool} onChange={updateToolData} />
          )}

          {selectedAgent && (
            <AgentConfigPanel
              agent={selectedAgent}
              onChange={updateAgentData}
              onDelete={deleteAgent}
            />
          )}

          {selectedEdge && (
            <HandoffPanel
              edge={selectedEdge}
              onChange={updateEdgeData}
              onDelete={deleteEdge}
            />
          )}

          <button
            onClick={() => {
              setSidebarOpen(false);
              clearSelection();
            }}
            style={{ marginTop: 20, padding: 8 }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}
