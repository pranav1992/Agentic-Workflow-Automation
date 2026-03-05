export const DEFAULT_AGENT_DATA = {
  model: "gpt-4",
  temperature: 0.7,
  maxTokens: 1024,
  systemPrompt: ""
};

export const DEFAULT_TOOL_DATA = {
  label: "HTTP Request",
  method: "GET",
  url: "",
  headers: "",
  body: ""
};

export const DEFAULT_HANDOFF_DATA = {
  handoffType: "always",
  condition: "",
  timeoutSeconds: 0,
  notes: ""
};

export const SIDEBAR_STYLE = {
  position: "absolute",
  right: 0,
  top: 0,
  height: "100%",
  width: 260,
  background: "white",
  borderLeft: "1px solid #ddd",
  padding: 20,
  boxShadow: "-4px 0 10px rgba(0,0,0,0.1)"
};
