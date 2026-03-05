export default function LabeledInput({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  ...rest
}) {
  return (
    <>
      <label style={{ fontSize: 12, color: "#444" }}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        style={{ width: "100%", marginBottom: 10 }}
        {...rest}
      />
    </>
  );
}
