import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router";
import { login } from "../api/auth";
import { setAuthSession } from "../api/client";
import LabeledInput from "../ui/LabeledInput";
import theme from "../theme";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  const loginMutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (data) => {
      setAuthSession(data.access_token, data.user);
      navigate(from, { replace: true });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    loginMutation.mutate();
  };

  const errorMessage =
    loginMutation.error?.response?.data?.detail ||
    (loginMutation.isError ? "Sign in failed. Check your credentials." : "");

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
          width: 340,
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
          Sign in to manage workflows.
        </p>

        <LabeledInput
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoFocus
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
          disabled={loginMutation.isPending}
          style={{
            width: "100%",
            padding: "10px 0",
            borderRadius: theme.radius,
            border: "none",
            background: theme.primary,
            color: "white",
            fontSize: 13,
            fontWeight: 600,
            cursor: loginMutation.isPending ? "default" : "pointer",
            opacity: loginMutation.isPending ? 0.7 : 1,
          }}
        >
          {loginMutation.isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
