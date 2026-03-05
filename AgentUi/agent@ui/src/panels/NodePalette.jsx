export default function NodePalette({ onAddAgent }) {
  return (
    <>
      <h3>Nodes</h3>
      <div
        onClick={onAddAgent}
        style={{
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 6,
          cursor: "pointer",
          marginTop: 10
        }}
      >
        OpenAI Agent
      </div>
    </>
  );
}
