import { AppLayout } from "@/components/layout/AppLayout";
import { useListWorkflows, useCreateWorkflow, useDeleteWorkflow } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";
import { GitMerge, Plus, Trash2, Loader2, CalendarClock, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

function TriggerBadge({ type }: { type: string }) {
  if (type === "schedule") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300">
        <CalendarClock size={10} />
        Scheduled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400">
      Manual
    </span>
  );
}

export default function WorkflowsPage() {
  const { data: workflowsRaw, isLoading, refetch } = useListWorkflows();
  const workflows = Array.isArray(workflowsRaw) ? workflowsRaw : [];
  const createMut = useCreateWorkflow();
  const deleteMut = useDeleteWorkflow();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  const handleCreateNew = () => {
    createMut.mutate(
      { data: { name: "New Workflow", nodes: [], edges: [] } },
      { onSuccess: (res) => navigate(`/workflows/${res.id}`) }
    );
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Delete this workflow? This action cannot be undone.")) {
      deleteMut.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Workflow deleted" });
          refetch();
        }
      });
    }
  };

  const filtered = workflows.filter(wf =>
    wf.name.toLowerCase().includes(search.toLowerCase()) ||
    (wf.description || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto">
        <div className="max-w-6xl mx-auto w-full px-8 py-8">

          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-xl font-semibold text-foreground tracking-tight">Workflow Library</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {workflows.length} workflow{workflows.length !== 1 ? "s" : ""} configured
              </p>
            </div>
            <button
              onClick={handleCreateNew}
              disabled={createMut.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-foreground text-background rounded-md hover:bg-foreground/90 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {createMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              New Workflow
            </button>
          </div>

          {/* Metrics strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Workflows", value: workflows.length },
              { label: "Scheduled", value: workflows.filter(w => w.triggerType === "schedule").length },
              { label: "Success Rate", value: "98.6%" },
              { label: "Avg Runtime", value: "1.4s" },
            ].map(({ label, value }) => (
              <div key={label} className="border border-border rounded-lg p-4 bg-card">
                <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
                <p className="text-2xl font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search workflows..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-lg text-center">
              <GitMerge className="w-8 h-8 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">
                {search ? "No workflows match your search" : "No workflows yet"}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {search ? "Try a different search term" : "Create your first workflow to get started"}
              </p>
              {!search && (
                <button
                  onClick={handleCreateNew}
                  className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded-md hover:bg-foreground/90 transition-colors cursor-pointer"
                >
                  New Workflow
                </button>
              )}
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Nodes</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Trigger</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Updated</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((wf) => (
                    <tr
                      key={wf.id}
                      onClick={() => navigate(`/workflows/${wf.id}`)}
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-md border border-border bg-background flex items-center justify-center shrink-0 group-hover:border-primary/30 transition-colors">
                            <GitMerge className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                              {wf.name}
                            </p>
                            {wf.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{wf.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <span className="text-sm text-muted-foreground font-mono">{wf.nodes.length}</span>
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <TriggerBadge type={wf.triggerType ?? ""} />
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(wf.updatedAt), "MMM d, yyyy")}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={(e) => handleDelete(e, wf.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
