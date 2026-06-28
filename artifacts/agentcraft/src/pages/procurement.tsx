import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, TrendingUp, DollarSign, CheckCircle2, XCircle, Clock,
  ShieldAlert, Package, Users, BarChart3, FileText, Store,
  Search, AlertTriangle, ChevronRight, Sparkles, RefreshCw,
  ArrowUpRight, Activity, ClipboardList, Loader2
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const API = import.meta.env.VITE_API_URL ?? "";

function fetchDashboard() {
  return fetch(`${API}/api/procurement/dashboard`).then(r => {
    if (!r.ok) throw new Error("Failed to fetch dashboard");
    return r.json();
  });
}
function fetchRequests() {
  return fetch(`${API}/api/procurement/requests?limit=20`).then(r => r.json());
}
function fetchVendors() {
  return fetch(`${API}/api/procurement/vendors`).then(r => r.json());
}
function fetchAudit() {
  return fetch(`${API}/api/procurement/audit?limit=15`).then(r => r.json());
}
function fetchBudgets() {
  return fetch(`${API}/api/procurement/budgets`).then(r => r.json());
}

const statusColors: Record<string, string> = {
  pending:      "bg-amber-500/15 text-amber-300 border-amber-500/30",
  analyzing:    "bg-blue-500/15 text-blue-300 border-blue-500/30",
  approved:     "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  po_generated: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  rejected:     "bg-rose-500/15 text-rose-300 border-rose-500/30",
};
const riskColors: Record<string, string> = {
  Low:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  Medium: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  High:   "text-rose-400 bg-rose-500/10 border-rose-500/30",
};
const tierColors: Record<string, string> = {
  L1: "bg-emerald-500/15 text-emerald-300",
  L2: "bg-blue-500/15 text-blue-300",
  L3: "bg-amber-500/15 text-amber-300",
  L4: "bg-rose-500/15 text-rose-300",
};

function KPICard({ title, value, subtitle, icon: Icon, color, delay = 0 }: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ElementType; color: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="relative overflow-hidden rounded-2xl bg-card/60 backdrop-blur-xl border border-border/60 p-5 group hover:border-border transition-all duration-300"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">{title}</p>
          <p className={cn("text-2xl font-display font-extrabold mt-1 tracking-tight", color)}>{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{subtitle}</p>}
        </div>
        <div className={cn("p-2.5 rounded-xl shrink-0", color.replace("text-", "bg-").replace("-400", "-400/10").replace("-300", "-300/10"))}>
          <Icon size={18} className={color} />
        </div>
      </div>
    </motion.div>
  );
}

function RiskGauge({ score, level }: { score: number; level: string }) {
  const pct = Math.min(score, 100);
  const color = level === "High" ? "#f43f5e" : level === "Medium" ? "#f59e0b" : "#10b981";
  const radius = 40;
  const circumference = Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="100" height="60" viewBox="0 0 100 60">
          <path d="M10,50 A40,40 0 0,1 90,50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round" />
          <path d="M10,50 A40,40 0 0,1 90,50" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="text-xl font-display font-bold" style={{ color }}>{score}</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">/100</span>
        </div>
      </div>
      <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border mt-1", riskColors[level] || "text-muted-foreground bg-secondary/40 border-border")}>{level} Risk</span>
    </div>
  );
}

function BudgetBar({ dept, used, total }: { dept: string; used: number; total: number }) {
  const pct = Math.min((used / total) * 100, 100);
  const color = pct > 80 ? "bg-rose-500" : pct > 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-foreground">{dept}</span>
        <span className="text-xs font-mono text-muted-foreground">{pct.toFixed(0)}% used</span>
      </div>
      <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>₹{(used / 1000).toFixed(0)}K</span>
        <span>₹{(total / 1000).toFixed(0)}K budget</span>
      </div>
    </div>
  );
}

function EmptyState({ onRun }: { onRun?: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600/20 to-violet-600/20 border border-blue-500/20 flex items-center justify-center mb-4">
        <Building2 size={28} className="text-blue-400" />
      </div>
      <h3 className="text-lg font-display font-bold text-foreground mb-2">No Procurement Data Yet</h3>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
        Run the <strong className="text-foreground">Enterprise AI Procurement Orchestrator</strong> workflow with a purchase request to see live analytics here.
      </p>
      <div className="bg-secondary/30 border border-border rounded-xl p-4 text-left max-w-sm w-full">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Example Input</p>
        <p className="text-xs text-foreground font-mono leading-relaxed">
          "I need a Dell laptop for Android development, worth ₹85,000 for the Engineering department with high priority."
        </p>
      </div>
    </motion.div>
  );
}

export default function ProcurementPage() {
  const [activeTab, setActiveTab] = useState<"requests" | "vendors" | "audit" | "budgets">("requests");
  const { data: dash, isLoading: dashLoading, refetch: refetchDash } = useQuery({ queryKey: ["proc-dashboard"], queryFn: fetchDashboard, refetchInterval: 30000 });
  const { data: requests = [], isLoading: reqLoading } = useQuery({ queryKey: ["proc-requests"], queryFn: fetchRequests, refetchInterval: 15000 });
  const { data: vendors = [] } = useQuery({ queryKey: ["proc-vendors"], queryFn: fetchVendors });
  const { data: audit = [], isLoading: auditLoading } = useQuery({ queryKey: ["proc-audit"], queryFn: fetchAudit, refetchInterval: 15000 });
  const { data: budgets = [] } = useQuery({ queryKey: ["proc-budgets"], queryFn: fetchBudgets, refetchInterval: 30000 });

  const kpis = dash?.kpis ?? {};
  const hasData = (dash?.kpis?.totalRequests ?? 0) > 0;

  return (
    <AppLayout>
      <div className="flex-1 h-full overflow-y-auto bg-[#030308] relative pb-16">
        {/* Ambient glows */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-violet-600/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-8 py-10 relative z-10">

          {/* ── Header ── */}
          <div className="flex flex-col md:flex-row md:items-start justify-between mb-10 gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-600/25">
                  <Building2 size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-display font-extrabold text-foreground tracking-tight">
                    Enterprise Procurement Hub
                  </h1>
                  <p className="text-xs text-muted-foreground">AI Orchestrator · Real-time Dashboard</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
                Fully automated purchase lifecycle — from request to PO issuance — powered by AI vendor analysis, duplicate detection, budget verification, and immutable audit trails.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                AI Orchestrator Live
              </div>
              <button onClick={() => refetchDash()} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-secondary/30 hover:bg-secondary/60 border border-border px-3 py-1.5 rounded-full transition-colors">
                <RefreshCw size={12} />
                Refresh
              </button>
            </div>
          </div>

          {/* ── KPI Cards ── */}
          {dashLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="text-muted-foreground animate-spin" />
            </div>
          ) : !hasData ? (
            <EmptyState />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
                <KPICard title="Total Requests" value={kpis.totalRequests ?? 0} icon={Package} color="text-blue-400" delay={0} subtitle="All time" />
                <KPICard title="Pending Approval" value={kpis.pendingApproval ?? 0} icon={Clock} color="text-amber-400" delay={0.05} />
                <KPICard title="Approved" value={kpis.approved ?? 0} icon={CheckCircle2} color="text-emerald-400" delay={0.1} />
                <KPICard title="Rejected" value={kpis.rejected ?? 0} icon={XCircle} color="text-rose-400" delay={0.15} />
                <KPICard title="Total Spend" value={`₹${((kpis.totalSpend ?? 0) / 100000).toFixed(1)}L`} icon={DollarSign} color="text-violet-400" delay={0.2} subtitle={`₹${((kpis.totalSpendWithGST ?? 0) / 100000).toFixed(1)}L incl. GST`} />
                <KPICard title="AI Savings" value={`₹${((kpis.aiSavings ?? 0) / 1000).toFixed(0)}K`} icon={TrendingUp} color="text-cyan-400" delay={0.25} subtitle="Est. 12% via vendor AI" />
              </div>

              {/* ── Second row KPIs ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <KPICard title="Approval Rate" value={`${kpis.approvalRate ?? 0}%`} icon={Activity} color="text-emerald-400" delay={0.3} />
                <KPICard title="Duplicates Blocked" value={kpis.duplicatesBlocked ?? 0} icon={Search} color="text-orange-400" delay={0.35} subtitle="Prevented overspend" />
                <KPICard title="Avg Risk Score" value={`${kpis.avgRiskScore ?? 0}/100`} icon={ShieldAlert} color="text-rose-400" delay={0.4} />
                <KPICard title="Avg Delivery" value="5.8 days" icon={ArrowUpRight} color="text-sky-400" delay={0.45} subtitle="Via AI vendor selection" />
              </div>

              {/* ── Risk + Budget row ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Risk Distribution */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-card/60 backdrop-blur-xl border border-border/60 rounded-2xl p-5">
                  <h3 className="text-sm font-display font-bold text-foreground mb-4 flex items-center gap-2">
                    <ShieldAlert size={14} className="text-rose-400" />
                    Risk Distribution
                  </h3>
                  <div className="flex items-center justify-around">
                    {["Low", "Medium", "High"].map(level => {
                      const count = dash?.riskDistribution?.[level.toLowerCase()] ?? 0;
                      const total = (dash?.kpis?.totalRequests ?? 1);
                      const pct = total > 0 ? Math.round(count / total * 100) : 0;
                      return (
                        <div key={level} className="flex flex-col items-center gap-2">
                          <div className={cn("w-14 h-14 rounded-2xl flex flex-col items-center justify-center border", riskColors[level] || "")}>
                            <span className="text-lg font-display font-bold">{count}</span>
                          </div>
                          <span className={cn("text-[10px] font-semibold uppercase tracking-wider", level === "High" ? "text-rose-400" : level === "Medium" ? "text-amber-400" : "text-emerald-400")}>{level}</span>
                          <span className="text-[10px] text-muted-foreground">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>

                {/* Budget Utilization */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="lg:col-span-2 bg-card/60 backdrop-blur-xl border border-border/60 rounded-2xl p-5">
                  <h3 className="text-sm font-display font-bold text-foreground mb-4 flex items-center gap-2">
                    <BarChart3 size={14} className="text-blue-400" />
                    Department Budget Utilization
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(budgets as any[]).slice(0, 6).map((b: any) => (
                      <BudgetBar key={b.department} dept={b.department} used={b.used} total={b.total} />
                    ))}
                    {budgets.length === 0 && (
                      <p className="text-xs text-muted-foreground col-span-2 text-center py-4">No budget data yet. Run a procurement workflow.</p>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* ── Tabs ── */}
              <div className="border border-border/60 rounded-2xl bg-card/60 backdrop-blur-xl overflow-hidden">
                <div className="flex border-b border-border/50 overflow-x-auto">
                  {([
                    { key: "requests", label: "Live Requests", icon: Package },
                    { key: "vendors", label: "Vendor Matrix", icon: Store },
                    { key: "audit", label: "Audit Trail", icon: ClipboardList },
                    { key: "budgets", label: "Budget Details", icon: DollarSign },
                  ] as const).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        "flex items-center gap-2 px-5 py-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2",
                        activeTab === tab.key ? "text-primary border-primary bg-primary/5" : "text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/30"
                      )}
                    >
                      <tab.icon size={13} />
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="p-5">
                  <AnimatePresence mode="wait">
                    {/* Requests Tab */}
                    {activeTab === "requests" && (
                      <motion.div key="requests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {reqLoading ? (
                          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
                        ) : (requests as any[]).length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-12">No requests yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {(requests as any[]).map((req: any, i: number) => (
                              <motion.div
                                key={req.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.04 }}
                                className="flex items-center gap-4 p-4 rounded-xl bg-secondary/20 hover:bg-secondary/35 border border-border/50 hover:border-border transition-all"
                              >
                                <div className="shrink-0 w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/25 flex items-center justify-center">
                                  <Package size={14} className="text-blue-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-semibold text-foreground truncate">{req.itemName}</p>
                                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border capitalize", statusColors[req.status] ?? "bg-secondary text-muted-foreground border-border")}>{req.status?.replace("_", " ")}</span>
                                    {req.approvalTier && <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", tierColors[req.approvalTier] ?? "")}>{req.approvalTier}</span>}
                                    {req.duplicateDetected === "yes" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center gap-0.5"><AlertTriangle size={9} />Duplicate</span>}
                                  </div>
                                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                    <span className="text-xs text-muted-foreground">{req.department}</span>
                                    <span className="text-xs text-muted-foreground">·</span>
                                    <span className="text-xs text-muted-foreground">{req.requester}</span>
                                    {req.recommendedVendor && <><span className="text-xs text-muted-foreground">·</span><span className="text-xs text-muted-foreground flex items-center gap-1"><Store size={10} className="text-violet-400" />{req.recommendedVendor}</span></>}
                                    {req.riskLevel && <><span className="text-xs text-muted-foreground">·</span><span className={cn("text-[10px] font-semibold px-1 py-0.5 rounded border", riskColors[req.riskLevel] ?? "text-muted-foreground")}>{req.riskLevel} Risk</span></>}
                                  </div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-sm font-bold text-foreground">₹{(req.amount ?? 0).toLocaleString()}</p>
                                  {req.poNumber && <p className="text-[10px] font-mono text-muted-foreground">{req.poNumber}</p>}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Vendors Tab */}
                    {activeTab === "vendors" && (
                      <motion.div key="vendors" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border/50">
                                {["Vendor", "Category", "Quality", "Price", "Delivery", "Compliance", "Composite"].map(h => (
                                  <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(vendors as any[]).sort((a: any, b: any) => b.compositeScore - a.compositeScore).map((v: any, i: number) => (
                                <motion.tr key={v.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                                  <td className="py-3 px-3">
                                    <div className="flex items-center gap-2">
                                      {i === 0 && <span className="text-amber-400">★</span>}
                                      <span className="font-medium text-foreground">{v.name}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3"><span className="text-xs px-2 py-0.5 rounded bg-secondary/50 text-muted-foreground border border-border/50">{v.category}</span></td>
                                  <td className="py-3 px-3"><span className={cn("text-xs font-bold", v.qualityRating >= 90 ? "text-emerald-400" : v.qualityRating >= 80 ? "text-amber-400" : "text-muted-foreground")}>{v.qualityRating}</span></td>
                                  <td className="py-3 px-3"><span className={cn("text-xs font-bold", v.priceScore >= 80 ? "text-emerald-400" : v.priceScore >= 65 ? "text-amber-400" : "text-muted-foreground")}>{v.priceScore}</span></td>
                                  <td className="py-3 px-3"><span className="text-xs text-muted-foreground">{v.deliveryDays}d</span></td>
                                  <td className="py-3 px-3"><span className={cn("text-xs font-bold", v.complianceScore >= 95 ? "text-emerald-400" : "text-amber-400")}>{v.complianceScore}</span></td>
                                  <td className="py-3 px-3">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-1.5 bg-secondary/50 rounded-full overflow-hidden max-w-[60px]">
                                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${v.compositeScore}%` }} />
                                      </div>
                                      <span className="text-xs font-bold text-violet-400">{v.compositeScore}</span>
                                    </div>
                                  </td>
                                </motion.tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    )}

                    {/* Audit Trail Tab */}
                    {activeTab === "audit" && (
                      <motion.div key="audit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {auditLoading ? (
                          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
                        ) : (audit as any[]).length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-12">No audit entries yet.</p>
                        ) : (
                          <div className="relative">
                            <div className="absolute left-5 top-0 bottom-0 w-px bg-border/40" />
                            <div className="space-y-3 pl-12">
                              {(audit as any[]).map((entry: any, i: number) => (
                                <motion.div key={entry.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="relative">
                                  <div className="absolute -left-7 top-2.5 w-2 h-2 rounded-full bg-teal-400 border-2 border-[#030308]" />
                                  <div className="p-3 rounded-xl bg-secondary/20 border border-border/40 hover:border-border/70 transition-colors">
                                    <div className="flex items-start justify-between gap-2 flex-wrap">
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-xs font-semibold text-foreground capitalize">{entry.action?.replace(/_/g, " ")}</span>
                                          <span className="text-[10px] font-mono text-muted-foreground">{entry.requestId}</span>
                                          {entry.newStatus && <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border capitalize", statusColors[entry.newStatus] ?? "bg-secondary text-muted-foreground border-border")}>{entry.newStatus}</span>}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">by <span className="text-foreground font-medium">{entry.actor}</span></p>
                                        {entry.details && <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{entry.details}</p>}
                                      </div>
                                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">{new Date(entry.timestamp).toLocaleString()}</span>
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Budget Details Tab */}
                    {activeTab === "budgets" && (
                      <motion.div key="budgets" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border/50">
                                {["Department", "Total Budget", "Approved Spend", "Remaining", "Utilization"].map(h => (
                                  <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(budgets as any[]).map((b: any, i: number) => {
                                const pct = b.utilizationPct ?? 0;
                                const barColor = pct > 80 ? "bg-rose-500" : pct > 60 ? "bg-amber-500" : "bg-emerald-500";
                                return (
                                  <motion.tr key={b.department} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                                    <td className="py-3 px-3 font-medium text-foreground">{b.department}</td>
                                    <td className="py-3 px-3 text-muted-foreground font-mono text-xs">₹{(b.total / 1000).toFixed(0)}K</td>
                                    <td className="py-3 px-3 font-mono text-xs text-emerald-400">₹{(b.used / 1000).toFixed(0)}K</td>
                                    <td className="py-3 px-3 font-mono text-xs text-foreground">₹{(b.remaining / 1000).toFixed(0)}K</td>
                                    <td className="py-3 px-3">
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-secondary/50 rounded-full overflow-hidden max-w-[80px]">
                                          <div className={cn("h-full rounded-full", barColor)} style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className={cn("text-xs font-bold", pct > 80 ? "text-rose-400" : pct > 60 ? "text-amber-400" : "text-emerald-400")}>{pct.toFixed(0)}%</span>
                                      </div>
                                    </td>
                                  </motion.tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
