import { Navigate, useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken, clearAuthSession } from "../api/client";
import { getMe } from "../api/auth";

export default function RequireAuth({ children }) {
  const location = useLocation();
  const token = getAuthToken();

  // A token in localStorage only proves someone signed in at some point —
  // it may since have expired or been forged, so every protected route
  // re-verifies it against the backend rather than trusting its presence.
  const { isLoading, isError } = useQuery({
    queryKey: ["auth", "me", token],
    queryFn: getMe,
    enabled: !!token,
    retry: false,
    staleTime: 60_000,
  });

  if (!token) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (isLoading) {
    return null;
  }

  if (isError) {
    clearAuthSession();
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
}
