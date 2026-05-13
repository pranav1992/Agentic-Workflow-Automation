import theme from "../theme";

export default function DangerButton({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "9px 12px",
        background: theme.errorLight,
        border: `1px solid ${theme.error}`,
        borderRadius: theme.radiusLg,
        color: theme.error,
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        letterSpacing: "0.1px",
      }}
    >
      {label}
    </button>
  );
}
