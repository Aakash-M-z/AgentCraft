import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import BuilderPage from "@/pages/builder";
import WorkflowsPage from "@/pages/workflows";
import ExecutionsPage from "@/pages/executions";
import ExecutionDetailPage from "@/pages/execution-detail";
import PersonalLifeOSPage from "@/pages/life-os";
import AssignmentsPage from "@/pages/assignments";
import PlacementsPage from "@/pages/placements";
import LeetCodePage from "@/pages/leetcode";
import ProcurementPage from "@/pages/procurement";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    }
  }
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/builder" component={BuilderPage} />
      <Route path="/workflows" component={WorkflowsPage} />
      <Route path="/workflows/:id" component={BuilderPage} />
      <Route path="/executions" component={ExecutionsPage} />
      <Route path="/executions/:id" component={ExecutionDetailPage} />
      <Route path="/life-os" component={PersonalLifeOSPage} />
      <Route path="/life-os/assignments" component={AssignmentsPage} />
      <Route path="/life-os/placements" component={PlacementsPage} />
      <Route path="/life-os/leetcode" component={LeetCodePage} />
      <Route path="/procurement" component={ProcurementPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
