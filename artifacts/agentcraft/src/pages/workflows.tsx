import { AppLayout } from "@/components/layout/AppLayout";
import { useListWorkflows, useCreateWorkflow, useDeleteWorkflow } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { GitMerge, Plus, Trash2, Copy, Play, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function WorkflowsPage() {
  const { data: workflowsRaw, isLoading, refetch } = useListWorkflows();
  const workflows = Array.isArray(workflowsRaw) ? workflowsRaw : [];
  const createMut = useCreateWorkflow();
  const deleteMut = useDeleteWorkflow();
  const { toast } = useToast();

  const handleCreateNew = () => {
    createMut.mutate(
      { data: { name: "New Workflow", nodes: [], edges: [] } },
      {
        onSuccess: (res) => {
          window.location.href = `/workflows/${res.id}`;
        }
      }
    );
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this workflow?')) {
      deleteMut.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Workflow deleted" });
          refetch();
        }
      });
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto relative">
        {/* Background ambient glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto w-full px-8 py-12 relative z-10">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h1 className="text-4xl font-display font-extrabold text-foreground tracking-tight">Workflows Library</h1>
              <p className="text-muted-foreground mt-2 text-lg">Manage your AI automation agents and data pipelines.</p>
            </div>
            <button
              onClick={handleCreateNew}
              disabled={createMut.isPending}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-primary text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-200"
            >
              {createMut.isPending ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
              Create Workflow
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
          ) : workflows?.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 rounded-3xl border border-dashed border-border bg-card/50 backdrop-blur text-center">
              <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mb-6">
                <Sparkles className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">No workflows yet</h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-8">Build your first AI-native automation workflow using our visual drag-and-drop canvas.</p>
              <button
                onClick={handleCreateNew}
                className="px-6 py-3 rounded-xl font-semibold bg-secondary text-foreground hover:bg-muted transition-colors border border-border shadow-sm"
              >
                Start Building
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {workflows?.map((wf) => (
                <Link key={wf.id} href={`/workflows/${wf.id}`} className="block group">
                  <div className="bg-card rounded-2xl p-6 border border-border shadow-lg hover:shadow-xl hover:border-primary/50 hover:bg-secondary/30 transition-all duration-300 relative overflow-hidden h-full flex flex-col">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center shadow-inner group-hover:bg-primary/10 group-hover:border-primary/30 transition-colors">
                        <GitMerge className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.preventDefault(); /* Duplicate logic */ }} className="p-2 rounded-lg bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                          <Copy size={16} />
                        </button>
                        <button onClick={(e) => handleDelete(e, wf.id)} className="p-2 rounded-lg bg-background text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-foreground mb-2 line-clamp-1">{wf.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-6 flex-1">
                      {wf.description || 'No description provided.'}
                    </p>

                    <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><GitMerge size={14} /> {wf.nodes.length} nodes</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Updated {format(new Date(wf.updatedAt), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
