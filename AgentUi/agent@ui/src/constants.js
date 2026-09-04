export const DEFAULT_AGENT_DATA = {
  name: "New Agent",
  model: "gpt-realtime",
  language: "en",
  temperature: 0.7,
  maxTokens: 1024,
  systemPrompt:
    "You are the manager of a call center, you are speaking to a customer. " +
    "You goal is to help answer their questions or direct them to the correct department. " +
    "Start by collecting or looking up their car information. Once you have the car information, " +
    "you can answer their questions or direct them to the correct department.",
  welcomeMessage:
    "Begin by welcoming the user to our auto service center and ask them to provide the VIN " +
    "of their vehicle to lookup their profile. If they dont have a profile ask them to say create profile.",
};

export const DEFAULT_TOOL_DATA = {
  label: "HTTP Request",
  method: "GET",
  baseUrl: "",
  path: "",
  systemPrompt: "",
  pathParams: [],
  queryParams: [],
  headers: [],
  body: null,
  bodyParams: []
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
