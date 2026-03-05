export default function DangerButton({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        marginTop: 6,
        width: "100%",
        background: "#ffe8e8",
        border: "1px solid #f5b5b5",
        padding: "8px 10px",
        cursor: "pointer"
      }}
    >
      {label}
    </button>
  );
}
