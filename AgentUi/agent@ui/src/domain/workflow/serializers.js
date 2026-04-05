import {
  DEFAULT_AGENT_DATA,
  DEFAULT_HANDOFF_DATA,
  DEFAULT_TOOL_DATA,
} from "../../constants";

export function agentSerializer(agentData) {
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

export function toolSerializer(toolData, { agentId, agentForFallback } = {}) {
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

export function edgeSerializer(edgeData, nodesList) {
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
