import React from "react";
import { useState, useCallback, useEffect } from "react";
import { useParams } from "react-router";
import NodePalette from "../panels/NodePalette";
import ToolConfigPanel from "../panels/ToolConfigPanel";
import AgentConfigPanel from "../panels/AgentConfigPanel";
import HandoffPanel from "../panels/HandoffPanel";
import { ReactFlow, Controls } from "@xyflow/react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  useReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  addEdge,
  reconnectEdge,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getWorkflow, get_all_agents } from "../api/workflow";
import { createAgent, deleteAgentApi } from "../api/agent";
import { createTool } from "../api/tool";
import { updatePosition, updatePositionsBulk } from "../api/position";

import AgentNode from "../components/AgentNode";
import ToolNode from "../components/ToolNode";

import {
  DEFAULT_AGENT_DATA,
  DEFAULT_HANDOFF_DATA,
  DEFAULT_TOOL_DATA,
} from "../constants";

function FlowCanvas() {
  const { workflowId: routeWorkflowId } = useParams();
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
  const selectedTool = nodes.find((n) => n.id === selectedToolId);
  const selectedAgent = nodes.find((n) => n.id === selectedAgentId);
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);

  // keep sidebar visible as soon as an id is set, even if node lookup resolves next tick
  const showSidebar =
    sidebarOpen &&
    (Boolean(selectedToolId) ||
      Boolean(selectedAgentId) ||
      Boolean(selectedEdgeId));
  const gridTemplateColumns = `1fr${showSidebar ? " 320px" : ""}`;
  const queryClient = useQueryClient();
  const pendingPositionsRef = React.useRef({});
  const debounceTimerRef = React.useRef(null);

  const { data: initialNodes = [], isFetching, isError, error } = useQuery({
    queryKey: ["nodes", workflowId],
    enabled: Boolean(workflowId),
    queryFn: async () => {
      const data = await get_all_agents(workflowId);
      return Array.isArray(data)
        ? data.map(agentSerializer)
        : data?.id
          ? [agentSerializer(data)]
          : [];
    },
  });

  const reactFlow = useReactFlow();

  const createAgentMutation = useMutation({
    mutationFn: ({ sourceId, name }) => {
      const safeName = name || `Agent ${nodes.length + 1}`;
      const payload = {
        agent: {
          name: safeName,
          workflow_id: workflowId,
        },
        agent_config: {
          type: "agent",
          workflow_id: workflowId,
          config: {},
        },
      };
      return createAgent(payload);
    },
    onSuccess: (agent, variables) => {
      const newNode = agentSerializer(agent);
      setNodes((nds) => [...nds, newNode]);

      // attach edge from the source node that triggered creation, if provided
      if (variables?.sourceId) {
        const newEdge = {
          id: `${variables.sourceId}-${newNode.id}`,
          source: variables.sourceId,
          target: newNode.id,
          sourceHandle: "next",
          targetHandle: "prev",
          data: { ...DEFAULT_HANDOFF_DATA },
        };
        setEdges((eds) => [...eds, newEdge]);
      }
      setStatusMessage("Agent created");
    },
    onError: (err) => {
      const detail = err?.response?.data?.detail || err.message || "Failed to create agent";
      setStatusMessage(detail);
    },
  });

  const deleteAgentMutation = useMutation({
    mutationFn: (agentId) => deleteAgentApi(agentId),
    onSuccess: (_data, agentId) => {
      setNodes((nds) => nds.filter((n) => n.id !== agentId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== agentId && e.target !== agentId),
      );
      setSelectedAgentId(null);
      setSidebarOpen(false);
      setStatusMessage("Agent deleted");
    },
    onError: (err) => {
      const detail =
        err?.response?.data?.detail || err.message || "Failed to delete agent";
      setStatusMessage(detail);
    },
  });

  const createToolMutation = useMutation({
    mutationFn: (payload) => createTool(payload),
    onSuccess: (tool) => {
      const toolId =
        tool?.id ?? tool?.tool?.id ?? tool?.data?.id;
      const agentId =
        tool?.agent_id ?? tool?.agentId ?? tool?.agent?.id;
      if (!toolId || !agentId) {
        setStatusMessage("Tool creation returned missing ids; edge not added.");
        return;
      }
      const positionId =
        tool?.position_node?.id ||
        tool?.position ||
        tool?.position_id ||
        tool?.positionId;
      const toolNode = {
        id: String(toolId),
        type: "tool",
        position: {
          x: tool?.position_node?.x ?? tool?.x ?? 0,
          y: tool?.position_node?.y ?? tool?.y ?? 0,
        },
        data: {
          ...DEFAULT_TOOL_DATA,
          label: tool?.name || tool?.tool?.name || DEFAULT_TOOL_DATA.label,
          method: tool?.method || tool?.tool?.method || DEFAULT_TOOL_DATA.method,
          positionId,
        },
      };
      setNodes((nds) => [...nds, toolNode]);
      setEdges((eds) => [
        ...eds,
        {
          id: `${toolNode.id}-${agentId}`,
          source: toolNode.id,
          target: String(agentId),
          targetHandle: "tools",
        },
      ]);
    },
    onError: (err) => {
      const detail =
        err?.response?.data?.detail || err.message || "Failed to create tool";
      setStatusMessage(detail);
    },
  });

  // fetch workflow meta to display name
  const { data: workflowMeta } = useQuery({
    queryKey: ["workflow", workflowId],
    enabled: Boolean(workflowId),
    queryFn: () => getWorkflow(workflowId),
  });

  // mirror query data into editable React Flow state (works even if onSuccess is skipped)
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes]);

  // track the agent marked as initial so we can guard deletes
  useEffect(() => {
    const initial = nodes.find((n) => n.data?.isInitial);
    if (initial) {
      initialAgentIdRef.current = initial.id;
    }
  }, [nodes]);

  // populate workflow name when opening builder
  useEffect(() => {
    if (workflowMeta?.name) {
      setWorkflowName(workflowMeta.name);
    }
  }, [workflowMeta]);



  // keep local workflowId in sync with the route param
  useEffect(() => {
    if (routeWorkflowId && routeWorkflowId !== workflowId) {
      setWorkflowId(routeWorkflowId);
    }
  }, [routeWorkflowId, workflowId]);

  const clearSelection = useCallback(() => {
    setSelectedToolId(null);
    setSelectedAgentId(null);
    setSelectedEdgeId(null);
  }, []);

  const onCloseSidebar = useCallback(() => {
    clearSelection();
    setSidebarOpen(false);
  }, [clearSelection]);

  const onSavePanel = useCallback(() => {
    setSidebarOpen(false);
    clearSelection();
  }, [clearSelection]);

  const openAgentConfig = useCallback((agentId) => {
    console.log("openAgentConfig", agentId);
    setSelectedAgentId(agentId);
    setSelectedToolId(null);
    setSelectedEdgeId(null);
    setSidebarOpen(true);
  }, []);

  const openToolConfig = useCallback((toolId) => {
    setSelectedToolId(toolId);
    setSelectedAgentId(null);
    setSelectedEdgeId(null);
    setSidebarOpen(true);
  }, []);

  const nodesWithHandlers = nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      addNode,
      addToolNode,
      openAgentConfig,
      openToolConfig,
    },
  }));

  // serialize server agent payload into React Flow node shape
  function agentSerializer(agentData) {
    const positionNode = agentData?.position || agentData?.position_node;
    const x = positionNode?.x ?? 200;
    const y = positionNode?.y ?? 200;
    const config = agentData?.node_config?.config ?? {};
    return {
      id: String(agentData.id),
      type: "agent",
      position: { x, y },
      data: {
        ...DEFAULT_AGENT_DATA,
        ...config,
        name: agentData.name ?? DEFAULT_AGENT_DATA.name,
        isInitial: Boolean(agentData.isInitial),
        // prefer the related node id; fall back to foreign key on agent
        positionId: positionNode?.id ?? agentData?.position ?? agentData?.position_id,
      },
    };
  }

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

  const positionMutation = useMutation({
    mutationFn: (payload) => updatePosition(payload),
    onError: (err) => {
      const detail =
        err?.response?.data?.detail ||
        err.message ||
        "Failed to update position";
      setStatusMessage(detail);
    },
  });

  const bulkPositionMutation = useMutation({
    mutationFn: (positions) => updatePositionsBulk(positions),
    onError: (err) => {
      const detail =
        err?.response?.data?.detail ||
        err.message ||
        "Failed to update positions";
      setStatusMessage(detail);
    },
  });

  const onNodesChange = useCallback(
    (changes) =>
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);

        const moved = changes.filter(
          (c) => c.type === "position" && c.position,
        );
        if (moved.length && workflowId) {
          const pending = { ...pendingPositionsRef.current };
          moved.forEach((c) => {
            const node = updated.find((n) => n.id === c.id);
            if (!node) return;
            const positionId = node?.data?.positionId;
            if (!positionId) return;
            pending[positionId] = {
              id: positionId,
              workflow_id: workflowId,
              x: node.position.x,
              y: node.position.y,
              agent_id: node.type === "agent" ? node.id : null,
              tool_id: node.type === "tool" ? node.id : null,
            };
          });
          pendingPositionsRef.current = pending;

          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(() => {
            const payload = Object.values(pendingPositionsRef.current);
            pendingPositionsRef.current = {};
            if (payload.length) bulkPositionMutation.mutate(payload);
          }, 400);
        }

        return updated;
      }),
    [workflowId, bulkPositionMutation],
  );

  const persistNodePosition = useCallback(
    (node) => {
      const positionId = node?.data?.positionId;
      if (!positionId || !workflowId) return;

      positionMutation.mutate({
        id: positionId,
        workflow_id: workflowId,
        x: node.position.x,
        y: node.position.y,
        agent_id: node.type === "agent" ? node.id : null,
        tool_id: node.type === "tool" ? node.id : null,
      });
    },
    [positionMutation, workflowId],
  );

  const onNodeDragStop = useCallback(
    (_event, node) => {
      persistNodePosition(node);
    },
    [persistNodePosition],
  );

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  const isValidConnection = useCallback(
    (connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      // allow agent-to-agent links only and prevent self loops
      return (
        sourceNode?.type === "agent" &&
        targetNode?.type === "agent" &&
        connection.source !== connection.target
      );
    },
    [nodes],
  );

  const onConnect = useCallback(
    (params) => {
      if (!isValidConnection(params)) return;
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            data: { ...DEFAULT_HANDOFF_DATA },
          },
          eds,
        ),
      );
    },
    [isValidConnection],
  );

  const onReconnect = useCallback((oldEdge, newConnection) => {
    if (!isValidConnection(newConnection)) return;
    setEdges((eds) => {
      const updated = reconnectEdge(oldEdge, newConnection, eds);
      return updated.map((e) =>
        e.id === oldEdge.id
          ? { ...e, data: oldEdge.data ?? DEFAULT_HANDOFF_DATA }
          : e,
      );
    });
  }, []);

  const onNodeClick = useCallback(
    (_, node) => {
      if (node.type === "agent") {
        openAgentConfig(node.id);
      } else if (node.type === "tool") {
        openToolConfig(node.id);
      }
    },
    [openAgentConfig, openToolConfig],
  );

  const onEdgeClick = useCallback(
    (_, edge) => {
      // only allow editing agent-to-agent edges
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);
      if (sourceNode?.type !== "agent" || targetNode?.type !== "agent") return;

      setSelectedEdgeId(edge.id);
      setSelectedAgentId(null);
      setSelectedToolId(null);
      setSidebarOpen(true);
    },
    [nodes],
  );

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

  function addToolNode(agentId) {
    if (!workflowId) {
      setStatusMessage("Select or create a workflow before adding tools.");
      return;
    }
    const agent = nodes.find((n) => n.id === agentId);
    if (!agent) return;

    const payload = {
      tool: {
        name: DEFAULT_TOOL_DATA.label || "HTTP Tool",
        workflow_id: workflowId,
        agent_id: agentId,
        method: DEFAULT_TOOL_DATA.method || "GET",
      },
      tool_config: {
        type: "tool",
        workflow_id: workflowId,
        config: { ...DEFAULT_TOOL_DATA },
      },
    };

    createToolMutation.mutate(payload);
  }

  function addNode(sourceId) {
    if (!workflowId) {
      setStatusMessage("Select or create a workflow before adding agents.");
      return;
    }
    // optimistic message only; node is added after API success
    createAgentMutation.mutate({ sourceId });
  }

  const updateToolData = useCallback((toolId, updates) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === toolId ? { ...n, data: { ...n.data, ...updates } } : n,
      ),
    );
  }, []);

  const deleteTool = useCallback((toolId) => {
    setNodes((nds) => nds.filter((n) => n.id !== toolId));
    setEdges((eds) =>
      eds.filter((e) => e.source !== toolId && e.target !== toolId),
    );
    setSelectedToolId(null);
    setSidebarOpen(false);
  }, []);

  const updateAgentData = useCallback((agentId, updates) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === agentId ? { ...n, data: { ...n.data, ...updates } } : n,
      ),
    );
  }, []);

  const updateEdgeData = useCallback((edgeId, updates) => {
    setEdges((eds) =>
      eds.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, ...updates } } : e,
      ),
    );
  }, []);

  const deleteEdge = useCallback((edgeId) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    setSelectedEdgeId(null);
    setSidebarOpen(false);
  }, []);

  const deleteAgent = useCallback((agentId) => {
    const node = nodes.find((n) => n.id === agentId);
    if (node?.data?.isInitial || agentId === initialAgentIdRef.current) {
      setStatusMessage("The initial agent cannot be deleted.");
      return;
    }

    deleteAgentMutation.mutate(agentId);
  }, [deleteAgentMutation, nodes]);

  // const serializeWorkflow = useCallback(() => {
  //   const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));

  // // helper to strip functions from data
  // const cleanData = (data = {}) =>
  //   Object.fromEntries(
  //     Object.entries(data).filter(([, value]) => typeof value !== "function"),
  //   );

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

  // payload.nodes.forEach((n) => {
  //   const { tools = [], ...restData } = n.data || {};
  //   agentNodes.push({
  //     ...n,
  //     data: {
  //       ...restData,
  //       type: "agent",
  //     },
  //   });
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
            width: 260,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
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
          onClick={
            () => {}
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
          onClick={
            workflowId
              ? // updateExistingWorkflow
                () => {}
              : () => {}
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
        <div style={{ position: "relative" }}>
          <ReactFlow
            nodes={nodesWithHandlers}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            fitView
            style={{ width: "100%", height: "100%" }}
          >
            <Controls />
          </ReactFlow>
        </div>
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
                onDelete={deleteEdge}
                onSave={onSavePanel}
                onClose={onCloseSidebar}
              />
            ) : null}
          </div>
        ) : null}
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
