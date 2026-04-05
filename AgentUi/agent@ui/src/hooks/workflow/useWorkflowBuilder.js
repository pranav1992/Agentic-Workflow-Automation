import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  useReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  addEdge,
  reconnectEdge,
} from "@xyflow/react";
import { getWorkflow, get_all_nodes } from "../../api/workflow";
import { createAgent, deleteAgentApi } from "../../api/agent";
import { createTool, deleteTool as deleteToolApi } from "../../api/tool";
import { updatePosition, updatePositionsBulk } from "../../api/position";
import {
  createEdge,
  deleteEdge as deleteEdgeApi,
  get_all_edges,
  updateEdge,
} from "../../api/edge";
import {
  agentSerializer,
  toolSerializer,
  edgeSerializer,
} from "../../domain/workflow/serializers";
import { normalizePositions } from "../../domain/workflow/normalizers";
import { DEFAULT_HANDOFF_DATA, DEFAULT_TOOL_DATA } from "../../constants";

export function useWorkflowBuilder(routeWorkflowId) {
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
  const initialAgentIdRef = useRef(null);
  const didFitRef = useRef(false);
  const loadingStartRef = useRef(0);
  const [showLoading, setShowLoading] = useState(false);

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
  const pendingPositionsRef = useRef({});
  const debounceTimerRef = useRef(null);
  const viewportKey = workflowId ? `workflowViewport:${workflowId}` : null;

  // keep the fetched nodes reference stable so effects don't loop endlessly
  const {
    data: fetchedNodes,
    isFetching,
    isLoading,
  } = useQuery({
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
      const source =
        variables?.sourceId && nodes.length
          ? nodes.find((n) => n.id === variables.sourceId)
          : null;

      // plan a fallback position when API returns origin (0,0)
      const agentNodes = nodes.filter((n) => n.type === "agent");
      const totalAgents = agentNodes.length;
      // stagger horizontally with modest vertical drift
      const defaultSpread = {
        x: 180 + totalAgents * 220,
        y: 180 + (totalAgents % 4) * 80,
      };
      // place new agent to the right of the source agent if provided
      if (source) {
        newNode.position = {
          x: (source.position?.x ?? 0) + 220,
          y: source.position?.y ?? 0,
        };
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
      const detail =
        err?.response?.data?.detail || err.message || "Failed to create agent";
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
    const storedViewport =
      viewportKey && typeof window !== "undefined"
        ? window.localStorage.getItem(viewportKey)
        : null;
    const parsed = storedViewport ? JSON.parse(storedViewport) : null;
    const t = setTimeout(() => {
      try {
        if (parsed && parsed.x !== undefined && parsed.y !== undefined) {
          reactFlow.setViewport(parsed, { duration: 0 });
        } else {
          reactFlow.fitView({ padding: 0.25 });
        }
      } catch (_err) {
        /* ignore */
      }
    }, 80);
    return () => clearTimeout(t);
  }, [fetchedNodes, reactFlow, viewportKey]);

  const handleMoveEnd = useCallback(
    (_event, viewport) => {
      if (!viewportKey || typeof window === "undefined") return;
      try {
        window.localStorage.setItem(viewportKey, JSON.stringify(viewport));
      } catch (_err) {
        /* ignore storage errors */
      }
    },
    [viewportKey],
  );

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
          }, 800); // more aggressive debouncing to reduce chatter
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

  const deleteTool = useCallback(
    (toolId) => {
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
            err?.response?.data?.detail ||
            err.message ||
            "Failed to delete tool";
          setStatusMessage(detail);
        })
        .finally(() => {
          setSelectedToolId(null);
          setSidebarOpen(false);
        });
    },
    [],
  );

  const updateAgentData = useCallback((agentId, updates) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === agentId ? { ...n, data: { ...n.data, ...updates } } : n,
      ),
    );
  }, []);

  const updateEdgeData = useCallback(
    (edgeId, updates) => {
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
    },
    [edges, buildEdgePayload, updateEdgeMutation],
  );

  const handleDeleteEdge = useCallback(
    (edgeId) => {
      deleteEdgeMutation.mutate(edgeId);
    },
    [deleteEdgeMutation],
  );

  const deleteAgent = useCallback(
    (agentId) => {
      const node = nodes.find((n) => n.id === agentId);
      if (node?.data?.isInitial || agentId === initialAgentIdRef.current) {
        setStatusMessage("The initial agent cannot be deleted.");
        return;
      }

      deleteAgentMutation.mutate(agentId);
    },
    [deleteAgentMutation, nodes],
  );

  useEffect(() => {
    const fetching = isLoading || isFetching;
    if (fetching) {
      loadingStartRef.current = Date.now();
      setShowLoading(true);
      return undefined;
    }

    if (!showLoading) return undefined;
    const elapsed = Date.now() - loadingStartRef.current;
    const remaining = Math.max(1000 - elapsed, 0);
    const timer = setTimeout(() => {
      setShowLoading(false);
    }, remaining);
    return () => clearTimeout(timer);
  }, [isLoading, isFetching, showLoading]);

  return {
    workflowId,
    workflowName,
    setWorkflowName,
    workflowDescription,
    setWorkflowDescription,
    workflowList,
    setWorkflowList,
    isSaving,
    setIsSaving,
    statusMessage,
    nodes,
    edges,
    nodesWithHandlers,
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
  };
}
