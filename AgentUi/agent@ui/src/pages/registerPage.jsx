import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router";
import { register } from "../api/auth";
import { setAuthSession } from "../api/client";
import LabeledInput from "../ui/LabeledInput";
import theme from "../theme";

export default function RegisterPage() {
  const [tenantName, setTenantName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const registerMutation = useMutation({
    mutationFn: () => register(email, password, tenantName, fullName),
    onSuccess: (data) => {
      setAuthSession(data.access_token, data.user);
      navigate("/", { replace: true });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!tenantName.trim() || !email.trim() || !password) return;
    registerMutation.mutate();
  };

  const errorMessage =
    registerMutation.error?.response?.data?.detail ||
    (registerMutation.isError ? "Registration failed. Please try again." : "");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: theme.surfaceAlt,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 360,
          padding: 28,
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radiusLg,
          boxShadow: theme.shadow,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 22 }}>🎙️</span>
          <span style={{ fontWeight: 700, fontSize: 18, color: theme.textPrimary, letterSpacing: "-0.3px" }}>
            VoiceOrchid
          </span>
        </div>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: theme.textSecondary }}>
          Create your organization and get started — we'll set you up with a demo workflow to explore.
        </p>

        <LabeledInput
          label="Organization name"
          value={tenantName}
          onChange={setTenantName}
          placeholder="Acme Auto Service"
          autoFocus
        />
        <LabeledInput
          label="Your name (optional)"
          value={fullName}
          onChange={setFullName}
          placeholder="Jane Doe"
        />
        <LabeledInput
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
        />
        <LabeledInput
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
        />

        {errorMessage && (
          <div
            style={{
              marginBottom: 14,
              padding: "8px 10px",
              borderRadius: theme.radius,
              background: theme.errorLight,
              color: theme.error,
              fontSize: 12,
            }}
          >
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={registerMutation.isPending}
          style={{
            width: "100%",
            padding: "10px 0",
            borderRadius: theme.radius,
            border: "none",
            background: theme.primary,
            color: "white",
            fontSize: 13,
            fontWeight: 600,
            cursor: registerMutation.isPending ? "default" : "pointer",
            opacity: registerMutation.isPending ? 0.7 : 1,
            marginBottom: 14,
          }}
        >
          {registerMutation.isPending ? "Creating your organization…" : "Create account"}
        </button>

        <p style={{ margin: 0, fontSize: 12, color: theme.textSecondary, textAlign: "center" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: theme.primary, fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
