export default function LabeledTextarea({
  label,
  value,
  onChange,
  rows = 4,
  placeholder = ""
}) {
  return (
    <>
      <label style={{ fontSize: 12, color: "#444" }}>{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        style={{ width: "100%", marginBottom: 10 }}
        placeholder={placeholder}
      />
    </>
  );
}
