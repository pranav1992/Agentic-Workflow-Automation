
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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CreateWorkFlowPage/>} />
      <Route path="/workflows/:workflowId" element={<WorkflowBuilderPage />} />
      <Route path="/dumy" element={<Dumy />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}



