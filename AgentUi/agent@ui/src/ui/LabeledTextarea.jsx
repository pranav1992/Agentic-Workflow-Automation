import { useState } from "react";
import theme from "../theme";

export default function LabeledTextarea({
  label,
  value,
  onChange,
  rows = 4,
  placeholder = "",
  onFocus: externalOnFocus,
  onBlur: externalOnBlur,
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ marginBottom: 14 }}>
      <label
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.6px",
          textTransform: "uppercase",
          color: focused ? theme.primary : theme.textSecondary,
          marginBottom: 4,
          transition: "color 0.15s",
        }}
      >
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        onFocus={(e) => { setFocused(true); externalOnFocus?.(e); }}
        onBlur={(e) => { setFocused(false); externalOnBlur?.(e); }}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "8px 10px",
          fontSize: 13,
          color: theme.textPrimary,
          background: theme.surfaceAlt,
          border: `1.5px solid ${focused ? theme.borderFocus : theme.border}`,
          borderRadius: theme.radius,
          outline: "none",
          resize: "vertical",
          fontFamily: "inherit",
          lineHeight: 1.5,
          transition: "border-color 0.15s",
        }}
      />
    </div>
  );
}
