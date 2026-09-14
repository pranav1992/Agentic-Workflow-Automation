
import {
  useQuery,
  useMutation,
  useQueryClient,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { Routes, Route } from "react-router";
import WorkflowBuilderPage from "./pages/workflowBuilderPage";
import CreateWorkFlowPage from "./pages/createWorkFlowPage";
import PageNotFound from "./pages/pageNotFound";
import Dumy from "./pages/dumy";
import SignInPage from "./pages/signInPage";
import RegisterPage from "./pages/registerPage";
import RequireAuth from "./components/RequireAuth";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<SignInPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* Every other route — known or not — requires a verified access
          token; RequireAuth redirects to /login otherwise. Wrapping here
          instead of per-route means a new page can't be added without it. */}
      <Route
        path="*"
        element={
          <RequireAuth>
            <Routes>
              <Route path="/" element={<CreateWorkFlowPage />} />
              <Route path="/workflows/:workflowId" element={<WorkflowBuilderPage />} />
              <Route path="/dumy" element={<Dumy />} />
              <Route path="*" element={<PageNotFound />} />
            </Routes>
          </RequireAuth>
        }
      />
    </Routes>
  );
}



