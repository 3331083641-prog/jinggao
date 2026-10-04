import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { AppShell } from "./components/AppShell";
const Home = React.lazy(() =>
  import("./pages/Home").then((m) => ({ default: m.Home })),
);
const NewDetection = React.lazy(() =>
  import("./pages/NewDetection").then((m) => ({ default: m.NewDetection })),
);
const Workspace = React.lazy(() =>
  import("./pages/Workspace").then((m) => ({ default: m.Workspace })),
);
const Evidence = React.lazy(() =>
  import("./pages/Evidence").then((m) => ({ default: m.Evidence })),
);
const Rules = React.lazy(() =>
  import("./pages/Rules").then((m) => ({ default: m.Rules })),
);
const History = React.lazy(() =>
  import("./pages/History").then((m) => ({ default: m.History })),
);
const Reports = React.lazy(() =>
  import("./pages/Reports").then((m) => ({ default: m.Reports })),
);
import "./styles/app.css";
const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 1000 } },
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Home />} />
              <Route path="new" element={<NewDetection />} />
              <Route path="workspace" element={<Workspace />} />
              <Route path="workspace/:runId" element={<Workspace />} />
              <Route path="workbench" element={<Workspace />} />
              <Route path="workbench/:taskId" element={<Workspace />} />
              <Route path="scan/:runId" element={<Workspace scanning />} />
              <Route path="evidence/:runId" element={<Evidence />} />
              <Route path="rules" element={<Rules />} />
              <Route path="history" element={<History />} />
              <Route path="reports" element={<Reports />} />
              <Route path="*" element={<Home />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </MotionConfig>
    </QueryClientProvider>
  </React.StrictMode>,
);
