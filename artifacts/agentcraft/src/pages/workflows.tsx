import { AppLayout } from "@/components/layout/AppLayout";
import { useListWorkflows, useCreateWorkflow, useDeleteWorkflow } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";
import { 
  GitMerge, Plus, Trash2, Copy, Loader2, Sparkles, 
  CalendarClock, Activity, BarChart2, TrendingUp, ShieldAlert, Cpu
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function WorkflowsPage() {
  const { data: workflowsRaw, isLoading, refetch } = useListWorkflows();
  const workflows = Array.isArray(workflowsRaw) ? workflowsRaw : [];
  const createMut = useCreateWorkflow();
  const deleteMut = useDeleteWorkflow();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleCreateNew = () => {
    createMut.mutate(
      { data: { name: "AgentCraft", nodes: [], edges: [] } },
      {
        onSuccess: (res) => {
          navigate(`/workflows/${res.id}`);
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
          toast({ title: "✓ Workflow deleted" });
          refetch();
        }
      });
    }
  };

  // Activity SVG sparkline data coordinates (7 days activity trend)
  const activityData = [35, 62, 45, 90, 75, 120, 115];
  const chartWidth = 500;
  const chartHeight = 80;
  const points = activityData.map((val, index) => {
    const x = (index / (activityData.length - 1)) * chartWidth;
    const y = chartHeight - (val / 150) * chartHeight;
    return `${x},${y}`;
  }).join(" ");

  const fillPoints = `0,${chartHeight} ${points} ${chartWidth},${chartHeight}`;

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col h-full bg-[#030303] overflow-y-auto relative pb-12 select-none">
        {/* Background ambient glows */}
        <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-100px] left-[-100px] w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-7xl mx-auto w-full px-8 py-10 relative z-10">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
            <div>
              <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight flex items-center gap-3">
                <span className="p-2 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white shrink-0 shadow-lg shadow-primary/20">
                  <Cpu className="w-6 h-6" />
                </span>
                Operations Command
              </h1>
              <p className="text-muted-foreground mt-2 text-sm max-w-xl">
                Observe autonomous agent analytics and configure execution pipelines.
              </p>
            </div>
            
            <button
              onClick={handleCreateNew}
              disabled={createMut.isPending}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer disabled:opacity-50 shrink-0"
            >
              {createMut.isPending ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
              Deploy Agent Workflow
            </button>
          </div>

          {/* SaaS KPI Dashboard Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {/* Total Workflows */}
            <div className="bg-[#09090b]/40 backdrop-blur border border-border/60 rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-primary/20 transition-all">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Total Pipelines</span>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-bold font-display">{workflows.length}</span>
                <span className="text-emerald-400 text-xs font-bold font-mono">Active</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Active in server instance</p>
            </div>

            {/* Active Automations */}
            <div className="bg-[#09090b]/40 backdrop-blur border border-border/60 rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-primary/20 transition-all">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Running Execs</span>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-bold font-display">4</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Currently processing in node map</p>
            </div>

            {/* AI Requests Today */}
            <div className="bg-[#09090b]/40 backdrop-blur border border-border/60 rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-primary/20 transition-all">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">AI Requests</span>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-bold font-display">1,284</span>
                <span className="text-purple-400 text-[10px] font-bold font-mono flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" /> +12%
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Token operations today</p>
            </div>

            {/* Success Rate */}
            <div className="bg-[#09090b]/40 backdrop-blur border border-border/60 rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-primary/20 transition-all">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Success Rate</span>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-bold font-display">98.6%</span>
                <span className="text-emerald-400 text-[10px] font-bold font-mono">Optimal</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Node traversal efficiency</p>
            </div>

            {/* Average Runtime */}
            <div className="bg-[#09090b]/40 backdrop-blur border border-border/60 rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-primary/20 transition-all">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Avg Runtime</span>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-bold font-display">1.4s</span>
                <span className="text-cyan-400 text-[10px] font-mono">Fast</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Response latency average</p>
            </div>
          </div>

          {/* Interactive Chart & Provider Health */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
            
            {/* SVG Activity Trend */}
            <div className="lg:col-span-2 bg-[#09090b]/30 backdrop-blur border border-border/60 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">Agent Operations Trend</span>
                </div>
                <span className="text-[10px] text-muted-foreground">Last 7 Days Activity</span>
              </div>
              
              {/* SVG Line Graph */}
              <div className="w-full h-24 mt-2">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(262, 83%, 58%)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="hsl(262, 83%, 58%)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  
                  {/* Filled Area under line */}
                  <polygon points={fillPoints} fill="url(#chartGradient)" />

                  {/* Glowing Stroke line */}
                  <polyline
                    fill="none"
                    stroke="hsl(262, 83%, 58%)"
                    strokeWidth="2.5"
                    points={points}
                    className="drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]"
                  />
                  
                  {/* Data Points */}
                  {activityData.map((val, index) => {
                    const x = (index / (activityData.length - 1)) * chartWidth;
                    const y = chartHeight - (val / 150) * chartHeight;
                    return (
                      <circle
                        key={index}
                        cx={x}
                        cy={y}
                        r="3.5"
                        fill="#030303"
                        stroke="hsl(189, 94%, 43%)"
                        strokeWidth="2"
                        className="hover:r-5 hover:fill-primary transition-all duration-200 cursor-pointer"
                      />
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* AI Provider & Endpoint Health */}
            <div className="bg-[#09090b]/30 backdrop-blur border border-border/60 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4 border-b border-border/40 pb-2">
                <span className="text-xs font-bold text-foreground">API Provider Health Status</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              <div className="space-y-3.5 flex-1 flex flex-col justify-center">
                {/* Groq */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Groq AI Engine</span>
                  <span className="font-mono text-[10px] font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    100.0% Uptime
                  </span>
                </div>
                
                {/* OpenAI */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">OpenAI Core</span>
                  <span className="font-mono text-[10px] font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    99.8% Uptime
                  </span>
                </div>

                {/* WhatsApp */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">WhatsApp Hook Gateway</span>
                  <span className="font-mono text-[10px] font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Operational
                  </span>
                </div>

                {/* DB */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Drizzle ORM Engine</span>
                  <span className="font-mono text-[10px] font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Active Connection
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-border/40 mb-8" />

          {/* Workflow Library Section */}
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-foreground/90 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Active Automations Library
            </h2>
            <span className="text-xs text-muted-foreground font-medium bg-secondary/30 border border-border/60 px-2 py-0.5 rounded-full">
              {workflows.length} workflows
            </span>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : workflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 rounded-3xl border border-dashed border-border/80 bg-card/25 backdrop-blur text-center">
              <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-6">
                <Sparkles className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Deploy your first pipeline</h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
                Construct autonomous AI agents, triggers, delay configurations, and webhook nodes.
              </p>
              <button
                onClick={handleCreateNew}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-secondary/80 text-foreground hover:bg-muted border border-border/80 cursor-pointer shadow transition-all duration-200"
              >
                Assemble Map
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {workflows.map((wf) => (
                <Link key={wf.id} href={`/workflows/${wf.id}`} className="block group">
                  <div className="bg-card/45 backdrop-blur rounded-2xl p-6 border border-border hover:border-primary/40 hover:bg-secondary/25 transition-all duration-300 relative overflow-hidden h-full flex flex-col shadow-lg hover:shadow-2xl">
                    
                    {/* Top sliding gradient line */}
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary to-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    <div className="flex justify-between items-start mb-4">
                      <div className="w-11 h-11 rounded-xl bg-background border border-border flex items-center justify-center shadow-inner group-hover:bg-primary/10 group-hover:border-primary/20 transition-all shrink-0">
                        <GitMerge className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button 
                          onClick={(e) => handleDelete(e, wf.id)} 
                          className="p-1.5 rounded-lg bg-background border border-border text-muted-foreground hover:text-rose-400 hover:border-rose-400/30 hover:bg-rose-950/20 transition-all cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-foreground/95 mb-2 line-clamp-1 flex items-center gap-2 group-hover:text-primary transition-colors">
                      {wf.name}
                      {wf.triggerType === "schedule" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 align-middle">
                          <CalendarClock size={10} />
                          Scheduled
                        </span>
                      )}
                    </h3>
                    
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-6 flex-1 leading-relaxed">
                      {wf.description || 'Pipelines triggering modular AI automation processes.'}
                    </p>

                    <div className="flex items-center justify-between pt-4 border-t border-border/50 mt-auto">
                      <div className="flex gap-4 text-[11px] font-mono text-muted-foreground">
                        <span className="flex items-center gap-1"><GitMerge size={12} /> {wf.nodes.length} nodes</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        Updated {format(new Date(wf.updatedAt), 'MMM d, yyyy')}
                      </span>
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
