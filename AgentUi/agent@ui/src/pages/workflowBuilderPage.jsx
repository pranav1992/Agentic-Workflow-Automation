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
import { getWorkflow, get_all_nodes } from "../api/workflow";
import { createAgent, deleteAgentApi } from "../api/agent";
import { createTool, deleteTool as deleteToolApi } from "../api/tool";
import { updatePosition, updatePositionsBulk } from "../api/position";
import {
  createEdge,
  deleteEdge as deleteEdgeApi,
  get_all_edges,
  updateEdge,
} from "../api/edge";
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
  const didFitRef = React.useRef(false);

  const nodeTypes = { agent: AgentNode, tool: ToolNode };
  const selectedTool = nodes.find((n) => n.id === selectedToolId);
  const selectedAgent = nodes.find((n) => n.id === selectedAgentId);
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);

  // keep sidebar visible as soon as an id is set, even if node 
  // lookup resolves next tick
  const showSidebar =
    sidebarOpen &&
    (Boolean(selectedToolId) ||
      Boolean(selectedAgentId) ||
      Boolean(selectedEdgeId));
  const gridTemplateColumns = `1fr${showSidebar ? " 320px" : ""}`;
  const queryClient = useQueryClient();
  const pendingPositionsRef = React.useRef({});
  const debounceTimerRef = React.useRef(null);

  // keep the fetched nodes reference stable so effects don't loop endlessly
  const { data: fetchedNodes, isFetching, isError, error } = useQuery({
    queryKey: ["nodes", workflowId],
    enabled: Boolean(workflowId),
    queryFn: async () => {
      const data = await get_all_nodes(workflowId);
      const agents = Array.isArray(data?.agents) ? data.agents : [];
      const tools = Array.isArray(data?.tools) ? data.tools : [];
      return [
        ...agents.map(agentSerializer),
        ...tools.map((t) =>
          toolSerializer(t, {
            agentId: t?.agent_id ?? t?.agentId ?? t?.agent?.id,
          }),
        ),
      ];
    },
  });

  const { data: fetchedEdges } = useQuery({
    queryKey: ["edges", workflowId],
    enabled: Boolean(workflowId),
    queryFn: async () => {
      const data = await get_all_edges(workflowId);
      return Array.isArray(data) ? data : [];
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
      // plan a fallback position when API returns origin (0,0)
      const agentNodes = nodes.filter((n) => n.type === "agent");
      const totalAgents = agentNodes.length;
      // stagger horizontally with modest vertical drift
      const defaultSpread = {
        x: 180 + totalAgents * 220,
        y: 180 + (totalAgents % 4) * 80,
      };
      // place new agent to the right of the source agent if provided
      if (variables?.sourceId) {
        const source = nodes.find((n) => n.id === variables.sourceId);
        if (source) {
          newNode.position = {
            x: (source.position?.x ?? 0) + 220,
            y: source.position?.y ?? 0,
          };
        }
      } else if (
        Number(newNode.position?.x ?? 0) === 0 &&
        Number(newNode.position?.y ?? 0) === 0
      ) {
        newNode.position = defaultSpread;
      }
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
        // persist the new edge if positions are available
        const sourcePosId =
          source?.data?.positionId ?? getPositionId(variables.sourceId);
        const targetPosId = newNode?.data?.positionId;
        if (sourcePosId && targetPosId) {
          createEdgeMutation.mutate({
            source: sourcePosId,
            target: targetPosId,
            workflow_id: workflowId,
            data: newEdge.data,
            tempId: newEdge.id,
          });
        } else {
          setStatusMessage(
            "Edge not persisted: missing positions for new agent link.",
          );
        }
      }
      // persist position if available
      persistNodePosition({
        ...newNode,
        type: "agent",
        data: { ...newNode.data },
      });
      setStatusMessage("Agent created");
    },
    onError: (err) => {
      const detail = err?.response?.data?.detail || err.message ||
       "Failed to create agent";
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
    onSuccess: (tool, variables) => {
      const agentId =
        tool?.agent_id ??
        tool?.agentId ??
        tool?.agent?.id ??
        variables?.tool?.agent_id ??
        variables?.agent_id;

      if (!agentId) {
        setStatusMessage("Tool creation returned missing ids; edge not added.");
        return;
      }

      const agent = nodes.find((n) => n.id === String(agentId));
      const toolNode = toolSerializer(tool, {
        agentId,
        agentForFallback: agent,
      });

      setNodes((nds) => [...nds, toolNode]);
      const tempEdgeId = `${toolNode.id}-${agentId}`;
      const edgeForUi = {
        id: tempEdgeId,
        source: toolNode.id,
        target: String(agentId),
        targetHandle: "tools",
      };
      setEdges((eds) => [...eds, edgeForUi]);

      // persist tool->agent edge if we have both position ids
      const sourcePosId = toolNode?.data?.positionId;
      const targetPosId = agent?.data?.positionId ?? agent?.position?.id;
      if (sourcePosId && targetPosId && workflowId) {
        createEdge({
          source: sourcePosId,
          target: targetPosId,
          workflow_id: workflowId,
          data: {},
        })
          .then((saved) => {
            setEdges((eds) =>
              eds.map((e) =>
                e.id === tempEdgeId
                  ? {
                      ...e,
                      id: String(saved.id),
                    }
                  : e,
              ),
            );
            queryClient.invalidateQueries({ queryKey: ["edges", workflowId] });
          })
          .catch((err) => {
            const detail =
              err?.response?.data?.detail ||
              err.message ||
              "Failed to persist tool edge";
            setStatusMessage(detail);
          });
      } else {
        setStatusMessage(
          "Tool edge not persisted: missing position ids for tool or agent.",
        );
      }
      setStatusMessage("Tool created");
    },
    onError: (err) => {
      const detail =
        err?.response?.data?.detail || err.message || "Failed to create tool";
      setStatusMessage(detail);
    },
  });


  const createEdgeMutation = useMutation({
    mutationFn: (payload) => createEdge(payload),
    onSuccess: (edgeData, variables) => {
      setEdges((eds) => {
        // replace temp edge (if any) that matches source/target from variables.tempId
        const mapped = eds.map((e) =>
          e.id === variables?.tempId ? edgeSerializer(edgeData, nodes) ?? e : e,
        );
        const maybeEdge = edgeSerializer(edgeData, nodes);
        if (maybeEdge && !mapped.find((e) => e.id === maybeEdge.id)) {
          mapped.push(maybeEdge);
        }
        return mapped;
      });
      queryClient.invalidateQueries({ queryKey: ["edges", workflowId] });
      setStatusMessage("Edge created");
    },
    onError: (err) => {
      const detail =
        err?.response?.data?.detail || err.message || "Failed to create edge";
      setStatusMessage(detail);
      // rollback any temp edge
      setEdges((eds) => eds.filter((e) => !e.temp));
    },
  });

  const updateEdgeMutation = useMutation({
    mutationFn: (payload) => updateEdge(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["edges", workflowId] });
    },
    onError: (err) => {
      const detail =
        err?.response?.data?.detail || err.message || "Failed to update edge";
      setStatusMessage(detail);
    },
  });

  const deleteEdgeMutation = useMutation({
    mutationFn: (edgeId) => deleteEdgeApi(edgeId),
    onSuccess: (_data, edgeId) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      setSelectedEdgeId(null);
      setSidebarOpen(false);
      setStatusMessage("Edge deleted");
      queryClient.invalidateQueries({ queryKey: ["edges", workflowId] });
    },
    onError: (err) => {
      const detail =
        err?.response?.data?.detail || err.message || "Failed to delete edge";
      setStatusMessage(detail);
    },
  });

  // fetch workflow meta to display name
  const { data: workflowMeta } = useQuery({
    queryKey: ["workflow", workflowId],
    enabled: Boolean(workflowId),
    queryFn: () => getWorkflow(workflowId),
  });

  // mirror query data into editable React Flow state (works even if onSuccess is 
  // skipped)
  useEffect(() => {
    // react-query returns a new empty array on each render before data arrives
    // which previously retriggered this effect and caused a render loop.
    // Using the raw fetchedNodes reference stops the loop.
    setNodes(normalizePositions(fetchedNodes ?? []));
    // ensure edges from tool->agent exist when loading from backend
    if (fetchedNodes?.length) {
      const toolNodes = fetchedNodes.filter((n) => n.type === "tool");
      const autoEdges = toolNodes
        .filter((t) => t.data?.agentId)
        .map((t) => ({
          id: `${t.id}-${t.data.agentId}`,
          source: t.id,
          target: String(t.data.agentId),
          targetHandle: "tools",
        }));
      setEdges((eds) => {
        const existingIds = new Set(eds.map((e) => e.id));
        const merged = [...eds];
        autoEdges.forEach((e) => {
          if (!existingIds.has(e.id)) merged.push(e);
        });
        return merged;
      });
    }
    didFitRef.current = false;
  }, [fetchedNodes]);


    // load persisted agent-agent edges once nodes are available to map positions
  useEffect(() => {
    if (!fetchedEdges || !nodes.length) return;
    const mapped = fetchedEdges
      .map((e) => edgeSerializer(e, nodes))
      .filter(Boolean);
    setEdges((eds) => {
      // preserve tool edges and replace agent-agent edges from server
      const nonAgentEdges = eds.filter(
        (e) => nodes.find((n) => n.id === e.source)?.type !== "agent",
      );
      const merged = [...nonAgentEdges, ...mapped];
      const seen = new Set();
      const deduped = [];
      merged.forEach((edge) => {
        if (!edge?.id) return;
        if (seen.has(edge.id)) return;
        seen.add(edge.id);
        deduped.push(edge);
      });
      return deduped;
    });
  }, [fetchedEdges, nodes]);

  // refit view after nodes load/update to keep new nodes in sight
  useEffect(() => {
    if (!fetchedNodes?.length) return;
    const t = setTimeout(() => {
      try {
        reactFlow.fitView({ padding: 0.25 });
      } catch (_err) {
        /* ignore */
      }
    }, 80);
    return () => clearTimeout(t);
  }, [fetchedNodes, reactFlow]);



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
      didFitRef.current = false;
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
    const serverAtOrigin =
      positionNode &&
      Number(positionNode.x ?? 0) === 0 &&
      Number(positionNode.y ?? 0) === 0;
    const safe = (v, fallback) => {
      const num = Number(v);
      if (!Number.isFinite(num)) return fallback;
      // clamp extreme values that push nodes off-canvas
      const clamped = Math.max(Math.min(num, 2000), -2000);
      return clamped;
    };
    const x = serverAtOrigin ? 200 : safe(positionNode?.x, 200);
    const y = serverAtOrigin ? 200 : safe(positionNode?.y, 200);
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

  // normalize tool payloads from API/mutation into React Flow node shape
  function toolSerializer(toolData, { agentId, agentForFallback } = {}) {
    const positionNode = toolData?.position || toolData?.position_node;
    const meta =
      toolData?.config?.metadata ||
      toolData?.tool_config?.config ||
      toolData?.config ||
      {};
    const safe = (v, fallback) => {
      const num = Number(v);
      if (!Number.isFinite(num)) return fallback;
      return Math.max(Math.min(num, 2000), -2000);
    };
    const resolvedAgentId =
      toolData?.agent_id ??
      toolData?.agentId ??
      toolData?.agent?.id ??
      agentId;

    // place tools beneath the agent by default
    const fallbackX = agentForFallback?.position?.x ?? 0;
    const fallbackY = (agentForFallback?.position?.y ?? 0) + 180;

    const hasServerPos =
      positionNode && (positionNode.x !== undefined || positionNode.y !== undefined);
    const serverAtOrigin =
      hasServerPos &&
      Number(positionNode.x ?? 0) === 0 &&
      Number(positionNode.y ?? 0) === 0;
    const xPos =
      !hasServerPos || serverAtOrigin
        ? fallbackX
        : safe(positionNode.x ?? toolData?.x, fallbackX);
    const yPos =
      !hasServerPos || serverAtOrigin
        ? fallbackY
        : safe(positionNode.y ?? toolData?.y, fallbackY);

    return {
      id: String(toolData?.id ?? toolData?.tool?.id ?? toolData?.data?.id),
      type: "tool",
      position: {
        x: xPos,
        y: yPos,
      },
      data: {
        ...DEFAULT_TOOL_DATA,
        ...meta,
        label:
          meta?.label ??
          toolData?.name ??
          toolData?.tool?.name ??
          DEFAULT_TOOL_DATA.label,
        method:
          meta?.method ??
          toolData?.method ??
          toolData?.tool?.method ??
          DEFAULT_TOOL_DATA.method,
        positionId:
          positionNode?.id ??
          toolData?.position_id ??
          toolData?.positionId ??
          toolData?.position?.id,
        agentId: resolvedAgentId ? String(resolvedAgentId) : undefined,
      },
    };
  }

  // ensure nodes have reasonable finite positions; recenters if spread is huge
  function normalizePositions(nodesList) {
    if (!Array.isArray(nodesList) || !nodesList.length) return nodesList ?? [];
    const cleaned = nodesList.map((n) => {
      const x = Number(n.position?.x ?? 0);
      const y = Number(n.position?.y ?? 0);
      const bad = !Number.isFinite(x) || !Number.isFinite(y);
      const tooFar = Math.abs(x) > 2000 || Math.abs(y) > 2000;
      if (bad || tooFar) {
        return { ...n, position: { x: 200, y: 200 } };
      }
      return n;
    });

    const xs = cleaned.map((n) => n.position.x);
    const ys = cleaned.map((n) => n.position.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY);
    const needsShift =
      span > 2000 || Math.abs(minX) > 1500 || Math.abs(minY) > 1500;
    if (!needsShift) return cleaned;

    const shiftX = 200 - minX;
    const shiftY = 200 - minY;
    return cleaned.map((n) => ({
      ...n,
      position: {
        x: n.position.x + shiftX,
        y: n.position.y + shiftY,
      },
    }));
  }

   // translate backend edge (position ids) into React Flow edge (agent ids)
  function edgeSerializer(edgeData, nodesList) {
    const sourceNode = nodesList.find(
      (n) => n.data?.positionId && n.data.positionId === edgeData.source,
    );
    const targetNode = nodesList.find(
      (n) => n.data?.positionId && n.data.positionId === edgeData.target,
    );
    if (!sourceNode || !targetNode) return null;
    const isToolToAgent =
      sourceNode.type === "tool" && targetNode.type === "agent";
    return {
      id: String(edgeData.id),
      source: String(sourceNode.id),
      target: String(targetNode.id),
      sourceHandle: isToolToAgent ? undefined : "next",
      targetHandle: isToolToAgent ? "tools" : "prev",
      data: edgeData.data ?? (isToolToAgent ? {} : { ...DEFAULT_HANDOFF_DATA }),
    };
  }
  

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


  const getPositionId = useCallback(
    (nodeId) => nodes.find((n) => n.id === nodeId)?.data?.positionId,
    [nodes],
  );

  const buildEdgePayload = useCallback(
    (edge, includeId = true) => {
      const sourcePos = getPositionId(edge.source);
      const targetPos = getPositionId(edge.target);
      if (!sourcePos || !targetPos) {
        throw new Error("Missing position for edge endpoints");
      }
      const payload = {
        source: sourcePos,
        target: targetPos,
        workflow_id: workflowId,
        data: edge.data ?? { ...DEFAULT_HANDOFF_DATA },
      };
      if (includeId && edge.id) {
        payload.id = edge.id;
      }
      return payload;
    },
    [getPositionId, workflowId],
  );

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
            const tempId = `temp-${Date.now()}`;
      try {
        const newEdge = {
          id: tempId,
          source: params.source,
          target: params.target,
          sourceHandle: "next",
          targetHandle: "prev",
          data: { ...DEFAULT_HANDOFF_DATA },
          temp: true,
        };
        // optimistic UI
        setEdges((eds) => addEdge(newEdge, eds));

        const payload = buildEdgePayload(newEdge, false);
        createEdgeMutation.mutate({ ...payload, tempId });
      } catch (err) {
        setStatusMessage(err.message);
        setEdges((eds) => eds.filter((e) => e.id !== tempId));
      }
    },
    [isValidConnection, buildEdgePayload, createEdgeMutation],
  );

const onReconnect = useCallback(
    (oldEdge, newConnection) => {
      if (!isValidConnection(newConnection)) return;
      setEdges((eds) => {
        const updated = reconnectEdge(oldEdge, newConnection, eds);
        return updated.map((e) =>
          e.id === oldEdge.id
            ? { ...e, data: oldEdge.data ?? DEFAULT_HANDOFF_DATA }
            : e,
        );
      });
      try {
        const payload = buildEdgePayload({
          ...oldEdge,
          source: newConnection.source,
          target: newConnection.target,
        });
        updateEdgeMutation.mutate(payload);
      } catch (err) {
        setStatusMessage(err.message);
      }
    },
    [isValidConnection, buildEdgePayload, updateEdgeMutation],
  );


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
    console.log(payload)

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
    deleteToolApi(toolId)
      .then(() => {
        setNodes((nds) => nds.filter((n) => n.id !== toolId));
        setEdges((eds) =>
          eds.filter((e) => e.source !== toolId && e.target !== toolId),
        );
        setStatusMessage("Tool deleted");
      })
      .catch((err) => {
        const detail =
          err?.response?.data?.detail || err.message || "Failed to delete tool";
        setStatusMessage(detail);
      })
      .finally(() => {
        setSelectedToolId(null);
        setSidebarOpen(false);
      });
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
       const edge = edges.find((e) => e.id === edgeId);
    if (!edge) return;
    try {
      const payload = buildEdgePayload({
        ...edge,
        data: { ...edge.data, ...updates },
      });
      updateEdgeMutation.mutate(payload);
    } catch (err) {
      setStatusMessage(err.message);
    }
  },[edges, buildEdgePayload, updateEdgeMutation]);


 const handleDeleteEdge = useCallback(
    (edgeId) => {
      deleteEdgeMutation.mutate(edgeId);
    },
    [deleteEdgeMutation],
  );

  const deleteAgent = useCallback((agentId) => {
    const node = nodes.find((n) => n.id === agentId);
    if (node?.data?.isInitial || agentId === initialAgentIdRef.current) {
      setStatusMessage("The initial agent cannot be deleted.");
      return;
    }

    deleteAgentMutation.mutate(agentId);
  }, [deleteAgentMutation, nodes]);

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
                onDelete={handleDeleteEdge}
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
