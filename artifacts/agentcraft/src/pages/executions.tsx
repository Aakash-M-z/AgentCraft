import { AppLayout } from "@/components/layout/AppLayout";
import { useListExecutions } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { Activity, Clock, CheckCircle2, XCircle, Loader2, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ExecutionsPage() {
  const { data: executions, isLoading } = useListExecutions();

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed': return { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-500/20' };
      case 'failed': return { icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-400/10 border-rose-500/20' };
      case 'running': return { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-500/20', animate: 'animate-spin' };
      case 'pending': return { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-500/20' };
      default: return { icon: Activity, color: 'text-muted-foreground', bg: 'bg-secondary border-border' };
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto">
        <div className="max-w-7xl mx-auto w-full px-8 py-12">
          <div className="mb-10">
            <h1 className="text-4xl font-display font-extrabold text-foreground tracking-tight flex items-center gap-4">
              <Activity className="text-primary w-8 h-8" /> Execution History
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">Monitor live runs and review past workflow logs.</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
          ) : !executions?.length ? (
            <div className="text-center py-20 bg-card rounded-3xl border border-border">
              <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground">No executions yet</h3>
              <p className="text-muted-foreground mt-2">Run a workflow to see its execution history here.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
              <div className="grid grid-cols-12 gap-4 p-4 border-b border-border bg-secondary/50 font-semibold text-sm text-foreground">
                <div className="col-span-1">ID</div>
                <div className="col-span-3">Workflow ID</div>
                <div className="col-span-3">Status</div>
                <div className="col-span-3">Started At</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              
              <div className="divide-y divide-border">
                {executions.map((exec) => {
                  const StatusIcon = getStatusConfig(exec.status).icon;
                  const config = getStatusConfig(exec.status);
                  
                  return (
                    <div key={exec.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-secondary/30 transition-colors">
                      <div className="col-span-1 font-mono text-sm text-muted-foreground">#{exec.id}</div>
                      <div className="col-span-3">
                        <Link href={`/workflows/${exec.workflowId}`} className="text-primary hover:underline font-medium">
                          Workflow #{exec.workflowId}
                        </Link>
                      </div>
                      <div className="col-span-3">
                        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", config.bg, config.color)}>
                          <StatusIcon size={14} className={config.animate} />
                          <span className="capitalize">{exec.status}</span>
                        </span>
                      </div>
                      <div className="col-span-3 text-sm text-muted-foreground">
                        {format(new Date(exec.createdAt), 'MMM d, yyyy HH:mm:ss')}
                      </div>
                      <div className="col-span-2 text-right">
                        <Link 
                          href={`/executions/${exec.id}`}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-secondary text-foreground hover:bg-muted border border-border transition-colors"
                        >
                          View Logs
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
