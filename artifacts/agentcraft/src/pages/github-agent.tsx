import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Github, GitBranch, GitCommit, GitPullRequest, ShieldCheck, ShieldAlert,
  AlertTriangle, CheckCircle2, XCircle, Clock, RefreshCw, Search,
  ExternalLink, Play, SlidersHorizontal, ChevronRight, ChevronLeft, Activity,
  Lock, FolderGit2, Info, Copy, Check, Filter, X, ChevronDown,
  LogOut, Layers, Zap, Workflow, ArrowRight, BookOpen, Code2, Terminal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const API = import.meta.env.VITE_API_URL ?? "";

// ── Status Badges & Helpers ──────────────────────────────────────────────────

function CiBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    PASS: { label: "PASS", cls: "text-emerald-400/75 bg-emerald-500/[0.06] border-emerald-500/20", icon: CheckCircle2 },
    FAILED: { label: "FAIL", cls: "text-red-400/75 bg-red-500/[0.06] border-red-500/20", icon: XCircle },
    WARNING: { label: "WARN", cls: "text-amber-400/75 bg-amber-500/[0.06] border-amber-500/20", icon: AlertTriangle },
    UNKNOWN: { label: "UNKNOWN", cls: "text-white/30 bg-white/[0.02] border-white/[0.07]", icon: Clock },
  };
  const cfg = map[status] || map.UNKNOWN;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border", cfg.cls)}>
      <Icon size={10} className="shrink-0" />
      {cfg.label}
    </span>
  );
}

function SecurityBadge({ status }: { status: string }) {
  if (status === "CRITICAL") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-red-400/75 bg-red-500/[0.06] border border-red-500/20">
        <ShieldAlert size={10} />
        ALERT
      </span>
    );
  }
  if (status === "WARNING") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-amber-400/75 bg-amber-500/[0.06] border border-amber-500/20">
        <AlertTriangle size={10} />
        WARN
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-emerald-400/75 bg-emerald-500/[0.06] border border-emerald-500/20">
      <ShieldCheck size={10} />
      PASS
    </span>
  );
}

function HealthScorePill({ score }: { score: number }) {
  let color = "text-emerald-400/75 bg-emerald-500/[0.06] border-emerald-500/20";
  if (score < 60) {
    color = "text-red-400/75 bg-red-500/[0.06] border-red-500/20";
  } else if (score < 80) {
    color = "text-amber-400/75 bg-amber-500/[0.06] border-amber-500/20";
  }
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold border", color)}>
      {score}
    </span>
  );
}

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return "Never";
  const delta = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (delta < 60) return "just now";
  if (delta < 3600) return `${Math.floor(delta / 60)} min ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)} hr ago`;
  return `${Math.floor(delta / 86400)} d ago`;
}

// ── Main Page Component ──────────────────────────────────────────────────────

export default function GitHubAgentPage() {
  const queryClient = useQueryClient();

  // State
  const [activeTab, setActiveTab] = useState<"all" | "my_projects" | "collaborative" | "archived">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showPipelineDiagram, setShowPipelineDiagram] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [webhookSecretInput, setWebhookSecretInput] = useState("");
  const [analyzingProjectId, setAnalyzingProjectId] = useState<number | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<"summary" | "overview" | "report" | "history">("summary");
  const [connectedBanner, setConnectedBanner] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedProject(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Check URL query parameters for ?connected=true or ?error=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      setConnectedBanner(true);
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => setConnectedBanner(false), 5000);
    }
    const err = params.get("error");
    if (err) {
      setErrorMessage(err === "oauth_processing_failed" ? "GitHub OAuth could not be completed." : `OAuth Error: ${err}`);
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => setErrorMessage(null), 6000);
    }
  }, []);

  // Fetch account status
  const { data: accountData, isLoading: accountLoading } = useQuery({
    queryKey: ["github-account"],
    queryFn: async () => {
      const res = await fetch(`${API}/api/github/account`);
      if (!res.ok) throw new Error("Failed to load account");
      return res.json();
    },
  });

  // Fetch OAuth configuration
  const { data: oauthConfig } = useQuery({
    queryKey: ["github-oauth-config"],
    queryFn: async () => {
      const res = await fetch(`${API}/api/github/oauth/config`);
      if (!res.ok) return { oauthAvailable: false };
      return res.json();
    },
  });

  // Fetch dashboard overview metrics
  const { data: dashboardData } = useQuery({
    queryKey: ["github-dashboard"],
    queryFn: async () => {
      const res = await fetch(`${API}/api/github/dashboard`);
      if (!res.ok) throw new Error("Failed to load dashboard metrics");
      return res.json();
    },
    enabled: !!accountData?.connected,
  });

  // Fetch projects portfolio
  const { data: projects = [], isLoading: projectsLoading, refetch: refetchProjects } = useQuery({
    queryKey: ["github-projects", activeTab, selectedLanguage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTab !== "all") params.append("category", activeTab);
      if (selectedLanguage !== "all") params.append("language", selectedLanguage);
      const res = await fetch(`${API}/api/github/projects?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load projects");
      return res.json();
    },
    enabled: !!accountData?.connected,
  });

  // Fetch selected project details & analyses
  const { data: projectDetail, refetch: refetchDetail } = useQuery({
    queryKey: ["github-project-detail", selectedProject?.id],
    queryFn: async () => {
      if (!selectedProject?.id) return null;
      const res = await fetch(`${API}/api/github/projects/${selectedProject.id}`);
      if (!res.ok) throw new Error("Failed to load project details");
      return res.json();
    },
    enabled: !!selectedProject?.id,
  });

  // Fetch AI Project Explanation & Architecture Summary
  const { data: explanationData, isLoading: explanationLoading, refetch: refetchExplanation } = useQuery({
    queryKey: ["github-project-explanation", selectedProject?.id],
    queryFn: async () => {
      if (!selectedProject?.id) return null;
      const res = await fetch(`${API}/api/github/projects/${selectedProject.id}/explanation`);
      if (!res.ok) throw new Error("Failed to load explanation");
      return res.json();
    },
    enabled: !!selectedProject?.id,
  });

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: async (payload: { token?: string; webhook_secret?: string }) => {
      const res = await fetch(`${API}/api/github/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Connection failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["github-account"] });
      queryClient.invalidateQueries({ queryKey: ["github-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["github-projects"] });
      setShowConnectModal(false);
      setTokenInput("");
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/api/github/disconnect`, { method: "POST" });
      if (!res.ok) throw new Error("Disconnect failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["github-account"] });
      queryClient.invalidateQueries({ queryKey: ["github-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["github-projects"] });
      setSelectedProject(null);
      setShowDisconnectModal(false);
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/api/github/sync`, { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      return res.json();
    },
    onSuccess: () => {
      refetchProjects();
      queryClient.invalidateQueries({ queryKey: ["github-dashboard"] });
    },
  });

  // Toggle monitoring mutation
  const toggleMonitoringMutation = useMutation({
    mutationFn: async ({ projectId, enabled }: { projectId: number; enabled: boolean }) => {
      const res = await fetch(`${API}/api/github/projects/${projectId}/monitoring`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monitoring_enabled: enabled }),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: () => {
      refetchProjects();
    },
  });

  // Trigger analysis mutation
  const analyzeMutation = useMutation({
    mutationFn: async ({ projectId }: { projectId: number }) => {
      setAnalyzingProjectId(projectId);
      const res = await fetch(`${API}/api/github/projects/${projectId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Analysis failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setAnalyzingProjectId(null);
      refetchProjects();
      if (selectedProject) {
        refetchDetail();
      }
    },
    onError: () => {
      setAnalyzingProjectId(null);
    }
  });

  // Start OAuth Authorization flow
  const handleStartOAuth = async () => {
    try {
      const returnUrl = `${window.location.origin}/github-agent`;
      const res = await fetch(`${API}/api/github/oauth/authorize?redirect_url=${encodeURIComponent(returnUrl)}`);
      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || "GitHub App OAuth is not yet configured with Client ID/Secret.");
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e: any) {
      alert("Failed to initiate OAuth: " + e.message);
    }
  };

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p: any) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [projects, searchQuery]);

  // Unique languages
  const languages = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p: any) => {
      if (p.language && p.language !== "Other") set.add(p.language);
    });
    return Array.from(set).sort();
  }, [projects]);

  const isConnected = accountData?.connected && accountData?.account;
  const account = accountData?.account;
  const metrics = dashboardData?.metrics || {
    totalProjects: 0,
    healthyProjects: 0,
    needsAttention: 0,
    criticalProjects: 0,
    buildFailures: 0,
    highRiskFindings: 0,
    overallHealth: 0,
  };

  const webhookUrl = `${window.location.origin}/api/github/webhook`;

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col h-full bg-[#0b0b0d] text-foreground overflow-y-auto font-sans antialiased">

        {/* ── Top Header ─────────────────────────────────────────────── */}
        <div className="px-6 py-3.5 border-b border-white/[0.06] flex items-center justify-between shrink-0 bg-[#0e0e11]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-white/85 tracking-tight">GitHub Engineering Agent</span>
              <span className="text-[9.5px] font-mono text-white/30 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-white/40 mt-0.5">
              Connect your GitHub account to continuously discover projects, audit CI failures, and monitor code changes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <button
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono text-white/55 hover:text-white/85 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] transition-colors cursor-pointer disabled:opacity-40"
                  title="Re-synchronize accessible repositories"
                >
                  <RefreshCw size={11} className={syncMutation.isPending ? "animate-spin" : ""} />
                  Sync
                </button>
                <button
                  onClick={() => setShowWebhookModal(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono text-white/55 hover:text-white/85 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] transition-colors cursor-pointer"
                  title="View Webhook Receiver"
                >
                  <Activity size={11} />
                  Webhook
                </button>
                <button
                  onClick={() => setShowDisconnectModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono text-white/40 hover:text-red-400/80 hover:bg-red-500/[0.06] border border-white/[0.07] hover:border-red-500/20 transition-colors cursor-pointer"
                  title="Disconnect GitHub Account"
                >
                  <LogOut size={11} />
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowConnectModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11.5px] font-medium text-white/90 bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.1] transition-colors cursor-pointer shadow-sm"
              >
                <Github size={12} />
                Connect GitHub
              </button>
            )}
          </div>
        </div>

        {/* ── Success Toast Banner ────────────────────────────────────── */}
        {connectedBanner && (
          <div className="px-6 py-2 bg-emerald-500/[0.08] border-b border-emerald-500/20 text-[11.5px] text-emerald-400/90 font-mono flex items-center justify-between">
            <span>✓ GitHub Account connected and accessible projects discovered.</span>
            <button onClick={() => setConnectedBanner(false)} className="text-emerald-400/60 hover:text-emerald-300">
              <X size={13} />
            </button>
          </div>
        )}

        {/* ── Error Toast Banner ──────────────────────────────────────── */}
        {errorMessage && (
          <div className="px-6 py-2 bg-red-500/[0.08] border-b border-red-500/20 text-[11.5px] text-red-400/90 font-mono flex items-center justify-between">
            <span>⚠ {errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-red-400/60 hover:text-red-300">
              <X size={13} />
            </button>
          </div>
        )}

        {/* ── Main Content Area ────────────────────────────────────────── */}
        <div className="p-6 space-y-5 flex-1">

          {/* ── Account Identity Strip (When Connected) ──────────────── */}
          {isConnected ? (
            <div className="p-3.5 rounded-lg bg-[#111113] border border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-3">
                {account.avatarUrl ? (
                  <img src={account.avatarUrl} alt={account.username} className="w-8 h-8 rounded-full border border-white/10" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <Github size={14} className="text-white/60" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-semibold text-white/85">@{account.username}</span>
                    {account.name && <span className="text-[11px] text-white/40">({account.name})</span>}
                    <span className="text-[9px] font-mono uppercase text-emerald-400/80 bg-emerald-500/[0.08] border border-emerald-500/20 px-1.5 py-0.5 rounded">
                      Connected
                    </span>
                    <span className="text-[9px] font-mono text-white/30 bg-white/[0.03] border border-white/[0.06] px-1.5 py-0.5 rounded">
                      {account.accountType}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10.5px] text-white/35 mt-0.5 font-mono">
                    <span>{account.projectCount} Projects authorized</span>
                    <span>•</span>
                    <span>Last synchronized: {timeAgo(account.lastSyncedAt)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px] text-white/40 font-mono">Monitoring</span>
                  <button
                    onClick={() => {
                      fetch(`${API}/api/github/account/monitoring`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ monitoring_enabled: !account.monitoringEnabled })
                      }).then(() => queryClient.invalidateQueries({ queryKey: ["github-account"] }));
                    }}
                    className={cn(
                      "px-2 py-0.5 rounded text-[9.5px] font-mono transition-colors border cursor-pointer",
                      account.monitoringEnabled
                        ? "text-emerald-400/80 bg-emerald-500/[0.08] border-emerald-500/20"
                        : "text-white/30 bg-white/[0.03] border-white/[0.08]"
                    )}
                  >
                    {account.monitoringEnabled ? "ENABLED" : "PAUSED"}
                  </button>
                </div>

                {/* Minimal Font Disconnect Button on Account Card */}
                <button
                  onClick={() => setShowDisconnectModal(true)}
                  className="px-2 py-0.5 rounded text-[10.5px] font-mono text-white/40 hover:text-red-400/80 hover:bg-red-500/[0.06] border border-white/[0.08] hover:border-red-500/20 transition-colors cursor-pointer flex items-center gap-1"
                  title="Disconnect GitHub Account"
                >
                  <LogOut size={10} />
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            /* Disconnected Callout */
            <div className="p-6 rounded-lg bg-[#111113] border border-white/[0.06] text-center max-w-lg mx-auto my-8">
              <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-3">
                <Github size={18} className="text-white/50" />
              </div>
              <h3 className="text-sm font-semibold text-white/85">Connect GitHub Account</h3>
              <p className="text-xs text-white/40 mt-1 max-w-sm mx-auto leading-relaxed">
                Connect your account to discover all your authorized repositories, monitor code changes, and audit CI failures automatically.
              </p>
              <button
                onClick={() => setShowConnectModal(true)}
                className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-medium text-white/90 bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.1] transition-colors cursor-pointer shadow-sm"
              >
                <Github size={13} />
                Connect Account
              </button>
            </div>
          )}

          {/* ── Architecture Pipeline Flow Strip (Collapsible) ──────── */}
          <div className="rounded-lg bg-[#111113] border border-white/[0.06] overflow-hidden">
            <button
              onClick={() => setShowPipelineDiagram(!showPipelineDiagram)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-[11px] font-mono text-white/40 hover:text-white/60 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Layers size={12} className="text-white/30" />
                Architecture Pipeline: Connect GitHub ➔ Authorized Projects ➔ Autonomous Agent ➔ CI/Diff Analysis ➔ Report
              </span>
              <ChevronDown size={12} className={cn("transition-transform", showPipelineDiagram && "rotate-180")} />
            </button>

            {showPipelineDiagram && (
              <div className="p-4 pt-2 border-t border-white/[0.05] bg-[#0e0e11] overflow-x-auto">
                <div className="min-w-[680px] flex items-center justify-between text-[10px] font-mono text-white/50 gap-2 py-2">
                  <div className="p-2 rounded bg-white/[0.03] border border-white/[0.06] text-center shrink-0">
                    <span className="text-white/80 block font-semibold">AGENTCRAFT</span>
                    <span className="text-[9px] text-white/30">Visual Automation</span>
                  </div>
                  <span className="text-white/20">➔</span>
                  <div className="p-2 rounded bg-white/[0.03] border border-white/[0.06] text-center shrink-0">
                    <span className="text-white/80 block font-semibold">GitHub App Auth</span>
                    <span className="text-[9px] text-white/30">User / Organization</span>
                  </div>
                  <span className="text-white/20">➔</span>
                  <div className="p-2 rounded bg-white/[0.03] border border-white/[0.06] text-center shrink-0">
                    <span className="text-white/80 block font-semibold">Authorized Projects</span>
                    <span className="text-[9px] text-white/30">Auto-Discovered Portfolio</span>
                  </div>
                  <span className="text-white/20">➔</span>
                  <div className="p-2 rounded bg-white/[0.03] border border-white/[0.06] text-center shrink-0">
                    <span className="text-white/80 block font-semibold">Engineering Agent</span>
                    <span className="text-[9px] text-white/30">Changes • CI/CD • Issues</span>
                  </div>
                  <span className="text-white/20">➔</span>
                  <div className="p-2 rounded bg-white/[0.03] border border-white/[0.06] text-center shrink-0">
                    <span className="text-white/80 block font-semibold">AI Analysis</span>
                    <span className="text-[9px] text-white/30">Health • Bugs • Security</span>
                  </div>
                  <span className="text-white/20">➔</span>
                  <div className="p-2 rounded bg-white/[0.03] border border-white/[0.06] text-center shrink-0">
                    <span className="text-emerald-400/80 block font-semibold">Report & Fixes</span>
                    <span className="text-[9px] text-white/30">Enterprise Audit</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Engineering Overview Strip (KPIs) ────────────────────── */}
          {isConnected && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
              <div className="p-3 rounded-lg bg-[#111113] border border-white/[0.06]">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest block font-mono">Total Projects</span>
                <span className="text-base font-semibold text-white/90 mt-1 block font-mono">{metrics.totalProjects}</span>
              </div>
              <div className="p-3 rounded-lg bg-[#111113] border border-white/[0.06]">
                <span className="text-[10px] font-semibold text-emerald-400/60 uppercase tracking-widest block font-mono">Healthy</span>
                <span className="text-base font-semibold text-emerald-400/90 mt-1 block font-mono">{metrics.healthyProjects}</span>
              </div>
              <div className="p-3 rounded-lg bg-[#111113] border border-white/[0.06]">
                <span className="text-[10px] font-semibold text-amber-400/60 uppercase tracking-widest block font-mono">Needs Attention</span>
                <span className="text-base font-semibold text-amber-400/90 mt-1 block font-mono">{metrics.needsAttention}</span>
              </div>
              <div className="p-3 rounded-lg bg-[#111113] border border-white/[0.06]">
                <span className="text-[10px] font-semibold text-red-400/60 uppercase tracking-widest block font-mono">Critical</span>
                <span className="text-base font-semibold text-red-400/90 mt-1 block font-mono">{metrics.criticalProjects}</span>
              </div>
              <div className="p-3 rounded-lg bg-[#111113] border border-white/[0.06]">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest block font-mono">Build Failures</span>
                <span className="text-base font-semibold text-white/80 mt-1 block font-mono">{metrics.buildFailures}</span>
              </div>
              <div className="p-3 rounded-lg bg-[#111113] border border-white/[0.06]">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest block font-mono">High-Risk</span>
                <span className="text-base font-semibold text-white/80 mt-1 block font-mono">{metrics.highRiskFindings}</span>
              </div>
              <div className="p-3 rounded-lg bg-[#111113] border border-white/[0.06]">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest block font-mono">Overall Health</span>
                <span className="text-base font-semibold text-white/90 mt-1 block font-mono">
                  {metrics.overallHealth} <span className="text-[11px] text-white/30">/ 100</span>
                </span>
              </div>
            </div>
          )}

          {/* ── Project Portfolio Table ──────────────────────────────── */}
          {isConnected && (
            <div className="rounded-lg bg-[#111113] border border-white/[0.06] overflow-hidden">

              {/* Table Controls / Filters Bar */}
              <div className="p-3 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
                {/* Category tabs */}
                <div className="flex items-center gap-1 bg-white/[0.02] p-0.5 rounded border border-white/[0.05]">
                  {[
                    { id: "all", label: "All Projects" },
                    { id: "my_projects", label: "My Projects" },
                    { id: "collaborative", label: "Collaborative" },
                    { id: "archived", label: "Archived" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={cn(
                        "px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer",
                        activeTab === tab.id
                          ? "bg-white/[0.08] text-white/90"
                          : "text-white/40 hover:text-white/65"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Search & Language Filter */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      type="text"
                      placeholder="Filter projects..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-white/[0.03] border border-white/[0.06] rounded px-2.5 pl-7 py-1 text-[11px] text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/20 w-44"
                    />
                  </div>

                  {languages.length > 0 && (
                    <select
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                      className="bg-white/[0.03] border border-white/[0.06] rounded px-2 py-1 text-[11px] text-white/60 focus:outline-none focus:border-white/20 cursor-pointer"
                    >
                      <option value="all" className="bg-[#16161a]">All Languages</option>
                      {languages.map((l) => (
                        <option key={l} value={l} className="bg-[#16161a]">{l}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px] border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[10px] font-semibold text-white/30 uppercase tracking-wider font-mono">
                      <th className="py-2.5 px-4">Project</th>
                      <th className="py-2.5 px-3">Health</th>
                      <th className="py-2.5 px-3">CI Status</th>
                      <th className="py-2.5 px-3">Security</th>
                      <th className="py-2.5 px-3">Issues</th>
                      <th className="py-2.5 px-3">Last Analysis</th>
                      <th className="py-2.5 px-3">Monitoring</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {projectsLoading ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-white/30 text-xs font-mono">
                          <RefreshCw size={12} className="animate-spin inline mr-2" />
                          Discovering repositories...
                        </td>
                      </tr>
                    ) : filteredProjects.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-white/30 text-xs">
                          No projects match the current filter.
                        </td>
                      </tr>
                    ) : (
                      filteredProjects.map((p: any) => {
                        const isAnalyzing = analyzingProjectId === p.id;
                        return (
                          <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
                            {/* Project Name & Info */}
                            <td className="py-2.5 px-4 min-w-[220px]">
                              <div className="flex items-center gap-2">
                                <span
                                  className="font-medium text-white/85 group-hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                                  onClick={() => {
                                    setSelectedProject(p);
                                    setActiveDetailTab("summary");
                                  }}
                                >
                                  {p.name}
                                  <ChevronRight size={11} className="text-white/25 group-hover:text-white/60 transition-colors" />
                                </span>
                                {p.isPrivate && (
                                  <span title="Private Repository" className="inline-flex">
                                    <Lock size={10} className="text-white/30 shrink-0" />
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[10.5px] text-white/35 font-mono">
                                <span>{p.owner}</span>
                                {p.language && p.language !== "Other" && (
                                  <>
                                    <span>•</span>
                                    <span>{p.language}</span>
                                  </>
                                )}
                                <span>•</span>
                                <span>{p.defaultBranch}</span>
                              </div>
                            </td>

                            {/* Health */}
                            <td className="py-2.5 px-3">
                              <HealthScorePill score={p.healthScore} />
                            </td>

                            {/* CI Status */}
                            <td className="py-2.5 px-3">
                              <CiBadge status={p.ciStatus} />
                            </td>

                            {/* Security */}
                            <td className="py-2.5 px-3">
                              <SecurityBadge status={p.securityStatus} />
                            </td>

                            {/* Open Issues */}
                            <td className="py-2.5 px-3 font-mono text-white/60">
                              {p.openIssuesCount}
                            </td>

                            {/* Last Analysis */}
                            <td className="py-2.5 px-3 text-white/40 text-[11px] whitespace-nowrap font-mono">
                              {timeAgo(p.lastAnalyzedAt)}
                            </td>

                            {/* Monitoring Toggle */}
                            <td className="py-2.5 px-3">
                              <button
                                onClick={() => toggleMonitoringMutation.mutate({ projectId: p.id, enabled: !p.monitoringEnabled })}
                                className={cn(
                                  "text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors cursor-pointer",
                                  p.monitoringEnabled
                                    ? "text-emerald-400/80 bg-emerald-500/[0.08] border-emerald-500/20"
                                    : "text-white/30 bg-white/[0.03] border-white/[0.08]"
                                )}
                              >
                                {p.monitoringEnabled ? "ON" : "OFF"}
                              </button>
                            </td>

                            {/* Actions */}
                            <td className="py-2.5 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  onClick={() => analyzeMutation.mutate({ projectId: p.id })}
                                  disabled={isAnalyzing}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/60 hover:text-white/90 transition-colors cursor-pointer disabled:opacity-40"
                                  title="Analyze latest commit"
                                >
                                  {isAnalyzing ? (
                                    <RefreshCw size={10} className="animate-spin text-cyan-400" />
                                  ) : (
                                    <Play size={10} className="text-white/40" />
                                  )}
                                  {isAnalyzing ? "Analyzing..." : "Analyze"}
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedProject(p);
                                    setActiveDetailTab("summary");
                                  }}
                                  className="px-2 py-1 rounded text-[11px] font-mono text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors cursor-pointer"
                                >
                                  Summary
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Project Details / Engineering Report Drawer Modal ────── */}
        <AnimatePresence>
          {selectedProject && (
            <div className="fixed inset-0 z-50 flex justify-end">
              {/* Backdrop: Clicking anywhere on backdrop or left sidebar immediately closes the slide! */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-[2px] cursor-pointer"
                onClick={() => setSelectedProject(null)}
                title="Click outside to close slide"
              />

              {/* Drawer Container */}
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 280 }}
                className="relative z-10 w-full max-w-2xl h-full bg-[#111113] border-l border-white/[0.08] flex flex-col shadow-2xl overflow-hidden"
              >
                {/* Floating Left-Edge Closing Arrow (Slide collapse trigger) */}
                <button
                  onClick={() => setSelectedProject(null)}
                  className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#16161a] border border-white/20 text-white/60 hover:text-white hover:bg-[#202025] flex items-center justify-center shadow-lg transition-all cursor-pointer z-20 group"
                  title="Close slide"
                >
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* Drawer Header */}
                <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between shrink-0 bg-[#0e0e11]">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-white/90">{selectedProject.fullName}</h2>
                      {selectedProject.htmlUrl && (
                        <a href={selectedProject.htmlUrl} target="_blank" rel="noreferrer" className="text-white/30 hover:text-white/70 transition-colors">
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                    <p className="text-[11px] text-white/40 mt-0.5">
                      {selectedProject.description || "Project repository discovered under authenticated account."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => analyzeMutation.mutate({ projectId: selectedProject.id })}
                      disabled={analyzingProjectId === selectedProject.id}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/80 transition-colors cursor-pointer"
                    >
                      <Play size={10} />
                      {analyzingProjectId === selectedProject.id ? "Analyzing..." : "Re-Analyze"}
                    </button>
                    {/* Explicit Closing Arrow in Header */}
                    <button
                      onClick={() => setSelectedProject(null)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono text-white/50 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors cursor-pointer"
                      title="Close drawer"
                    >
                      <span>Close</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>

                {/* Sub-Header Tabs */}
                <div className="px-5 border-b border-white/[0.06] flex gap-4 bg-[#0e0e11] text-[11.5px] font-mono shrink-0">
                  <button
                    onClick={() => setActiveDetailTab("summary")}
                    className={cn(
                      "py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5",
                      activeDetailTab === "summary"
                        ? "border-white/80 text-white/90"
                        : "border-transparent text-white/40 hover:text-white/60"
                    )}
                  >
                    <BookOpen size={11} />
                    Project Explanation
                  </button>
                  <button
                    onClick={() => setActiveDetailTab("overview")}
                    className={cn(
                      "py-2.5 border-b-2 transition-colors cursor-pointer",
                      activeDetailTab === "overview"
                        ? "border-white/80 text-white/90"
                        : "border-transparent text-white/40 hover:text-white/60"
                    )}
                  >
                    Engineering Overview
                  </button>
                  <button
                    onClick={() => setActiveDetailTab("report")}
                    className={cn(
                      "py-2.5 border-b-2 transition-colors cursor-pointer",
                      activeDetailTab === "report"
                        ? "border-white/80 text-white/90"
                        : "border-transparent text-white/40 hover:text-white/60"
                    )}
                  >
                    Engineering Report
                  </button>
                  <button
                    onClick={() => setActiveDetailTab("history")}
                    className={cn(
                      "py-2.5 border-b-2 transition-colors cursor-pointer",
                      activeDetailTab === "history"
                        ? "border-white/80 text-white/90"
                        : "border-transparent text-white/40 hover:text-white/60"
                    )}
                  >
                    History ({projectDetail?.analyses?.length || 0})
                  </button>
                </div>

                {/* Drawer Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">

                  {/* ── TAB 1: FULL PROJECT EXPLANATION & ARCHITECTURE SUMMARY ── */}
                  {activeDetailTab === "summary" && (
                    <div className="space-y-4">
                      {explanationLoading ? (
                        <div className="py-16 text-center text-white/30 text-xs font-mono space-y-2">
                          <RefreshCw size={14} className="animate-spin inline mr-2 text-cyan-400" />
                          <p>Synthesizing repository architecture, README, and dependencies with AI...</p>
                        </div>
                      ) : explanationData?.explanation ? (
                        (() => {
                          const exp = explanationData.explanation;
                          return (
                            <div className="space-y-4">
                              {/* Executive Mission */}
                              <div className="p-3.5 rounded-lg bg-[#16161a] border border-white/[0.06] space-y-1.5">
                                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block font-mono">
                                  Core Objective & Purpose
                                </span>
                                <p className="text-xs text-white/90 leading-relaxed font-medium">
                                  {exp.core_purpose || selectedProject.description || "Autonomous software repository."}
                                </p>
                              </div>

                              {/* Project Overview Explanation */}
                              <div className="p-3.5 rounded-lg bg-[#16161a] border border-white/[0.06] space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block font-mono">
                                    Project Explanation
                                  </span>
                                  <button
                                    onClick={() => refetchExplanation()}
                                    className="text-[10px] font-mono text-white/40 hover:text-white/80 flex items-center gap-1 cursor-pointer"
                                  >
                                    <RefreshCw size={9} /> Re-Generate
                                  </button>
                                </div>
                                <p className="text-xs text-white/80 leading-relaxed whitespace-pre-line">
                                  {exp.summary}
                                </p>
                              </div>

                              {/* Architecture & Tech Stack */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="p-3.5 rounded-lg bg-[#16161a] border border-white/[0.06] space-y-2">
                                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block font-mono">
                                    Architecture Pattern
                                  </span>
                                  <p className="text-xs text-white/80 font-mono text-[11.5px]">
                                    {exp.architecture || "Modular software component architecture"}
                                  </p>
                                </div>

                                <div className="p-3.5 rounded-lg bg-[#16161a] border border-white/[0.06] space-y-2">
                                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block font-mono">
                                    Tech Stack & Frameworks
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {exp.tech_stack?.length > 0 ? (
                                      exp.tech_stack.map((tech: string, i: number) => (
                                        <span key={i} className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/[0.04] text-white/70 border border-white/[0.06]">
                                          {tech}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-xs text-white/40 font-mono">{selectedProject.language}</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Key Components & Structure */}
                              {exp.key_components?.length > 0 && (
                                <div className="p-3.5 rounded-lg bg-[#16161a] border border-white/[0.06] space-y-2.5">
                                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block font-mono">
                                    Key Codebase Modules & Structure
                                  </span>
                                  <div className="space-y-1.5">
                                    {exp.key_components.map((comp: any, i: number) => (
                                      <div key={i} className="p-2 rounded bg-white/[0.02] border border-white/[0.04] flex items-start gap-2 text-xs">
                                        <Code2 size={12} className="text-white/30 shrink-0 mt-0.5" />
                                        <div>
                                          <span className="font-mono text-white/85 text-[11px] font-semibold block">{comp.name}</span>
                                          <span className="text-white/50 text-[11px] leading-relaxed">{comp.role}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Getting Started & Execution Instructions */}
                              {exp.getting_started && (
                                <div className="p-3.5 rounded-lg bg-[#16161a] border border-white/[0.06] space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-white/40">
                                    <Terminal size={12} />
                                    <span className="text-[10px] font-semibold uppercase tracking-wider font-mono">
                                      Execution & Run Model
                                    </span>
                                  </div>
                                  <p className="text-xs text-white/70 leading-relaxed font-mono text-[11px] whitespace-pre-wrap">
                                    {exp.getting_started}
                                  </p>
                                </div>
                              )}

                              {/* Action Footer */}
                              <div className="pt-2 flex items-center justify-between">
                                <span className="text-[11px] text-white/40 font-mono">
                                  Ready to audit code changes and pipeline health?
                                </span>
                                <button
                                  onClick={() => {
                                    setActiveDetailTab("overview");
                                    analyzeMutation.mutate({ projectId: selectedProject.id });
                                  }}
                                  className="px-3 py-1.5 rounded text-xs font-mono font-medium text-white/90 bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] transition-colors cursor-pointer flex items-center gap-1.5"
                                >
                                  <Play size={10} />
                                  Run Continuous Engineering Audit
                                </button>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="py-12 text-center text-white/30 text-xs font-mono space-y-2">
                          <p>Could not automatically load explanation for this repository.</p>
                          <button
                            onClick={() => refetchExplanation()}
                            className="px-3 py-1.5 rounded text-xs font-mono bg-white/[0.06] hover:bg-white/[0.1] text-white/80 cursor-pointer"
                          >
                            Retry Generating Explanation
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── TAB 2: ENGINEERING OVERVIEW ── */}
                  {activeDetailTab === "overview" && (
                    <div className="space-y-3.5">
                      {projectDetail?.latestAnalysis ? (
                        (() => {
                          const an = projectDetail.latestAnalysis;
                          return (
                            <>
                              {/* Metadata Strip */}
                              <div className="p-3 rounded-lg bg-[#16161a] border border-white/[0.06] flex items-center justify-between text-[11px]">
                                <div className="space-y-0.5">
                                  <span className="text-white/30 text-[9.5px] uppercase tracking-wider block font-mono">Commit</span>
                                  <span className="font-mono text-white/85">{an.commitShortSha} — {an.commitMessage}</span>
                                </div>
                                <div className="text-right space-y-0.5">
                                  <span className="text-white/30 text-[9.5px] uppercase tracking-wider block font-mono">Author</span>
                                  <span className="text-white/70 font-mono">{an.authorName}</span>
                                </div>
                              </div>

                              {/* Matrix Pill Cards */}
                              <div className="grid grid-cols-4 gap-2 text-center">
                                <div className="p-2.5 rounded bg-[#16161a] border border-white/[0.06]">
                                  <span className="text-[10px] font-mono text-white/30 block">Health</span>
                                  <span className="text-sm font-mono font-semibold text-white/90 mt-0.5 block">{an.healthScore}/100</span>
                                </div>
                                <div className="p-2.5 rounded bg-[#16161a] border border-white/[0.06]">
                                  <span className="text-[10px] font-mono text-white/30 block">CI Build</span>
                                  <div className="mt-1"><CiBadge status={an.buildStatus} /></div>
                                </div>
                                <div className="p-2.5 rounded bg-[#16161a] border border-white/[0.06]">
                                  <span className="text-[10px] font-mono text-white/30 block">Security</span>
                                  <div className="mt-1"><SecurityBadge status={an.securityStatus} /></div>
                                </div>
                                <div className="p-2.5 rounded bg-[#16161a] border border-white/[0.06]">
                                  <span className="text-[10px] font-mono text-white/30 block">Risk</span>
                                  <span className="text-[11px] font-mono font-medium text-white/70 mt-1 block uppercase">{an.riskLevel}</span>
                                </div>
                              </div>

                              {/* What Changed & Why */}
                              <div className="p-3.5 rounded-lg bg-[#16161a] border border-white/[0.06] space-y-2">
                                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block font-mono">What Changed</span>
                                <p className="text-xs text-white/80 leading-relaxed">{an.whatChanged}</p>
                                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block pt-1 font-mono">Architectural Intent</span>
                                <p className="text-xs text-white/60 leading-relaxed">{an.whyChanged}</p>
                              </div>

                              {/* Affected Components */}
                              {an.affectedComponents?.length > 0 && (
                                <div className="p-3.5 rounded-lg bg-[#16161a] border border-white/[0.06] space-y-1.5">
                                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block font-mono">Impacted Components</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {an.affectedComponents.map((c: string, idx: number) => (
                                      <span key={idx} className="px-2 py-0.5 rounded text-[10.5px] font-mono bg-white/[0.04] text-white/65 border border-white/[0.06]">
                                        {c}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Potential Bugs / Code Anomalies */}
                              <div className="p-3.5 rounded-lg bg-[#16161a] border border-white/[0.06] space-y-2">
                                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block font-mono">Code Anomalies & Potential Bugs</span>
                                {an.potentialBugs?.length > 0 ? (
                                  <div className="space-y-2">
                                    {an.potentialBugs.map((bug: any, i: number) => (
                                      <div key={i} className="p-2.5 rounded bg-white/[0.02] border border-white/[0.05] space-y-1 text-xs">
                                        <div className="flex items-center justify-between">
                                          <span className="font-mono text-white/70 text-[11px]">{bug.location}</span>
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-amber-500/[0.08] text-amber-400 border border-amber-500/20">
                                              {bug.confidence} Confidence
                                            </span>
                                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-red-500/[0.08] text-red-400 border border-red-500/20">
                                              {bug.severity} Severity
                                            </span>
                                          </div>
                                        </div>
                                        <p className="text-white/60 text-[11.5px] leading-relaxed">{bug.description}</p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-white/40 font-mono">Zero high-confidence code anomalies detected.</p>
                                )}
                              </div>

                              {/* Root Cause Analysis (if any) */}
                              {an.rootCauseAnalysis && (
                                <div className="p-3.5 rounded-lg bg-[#16161a] border border-white/[0.06] space-y-1.5">
                                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block font-mono">Root Cause & Remediation</span>
                                  <p className="text-xs text-white/70 leading-relaxed whitespace-pre-wrap font-mono text-[11px]">
                                    {an.rootCauseAnalysis}
                                  </p>
                                </div>
                              )}

                              {/* Recommendations */}
                              {an.recommendations?.length > 0 && (
                                <div className="p-3.5 rounded-lg bg-[#16161a] border border-white/[0.06] space-y-2">
                                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block font-mono">Engineering Recommendations</span>
                                  <ul className="space-y-1.5 text-xs text-white/70">
                                    {an.recommendations.map((rec: string, i: number) => (
                                      <li key={i} className="flex items-start gap-2">
                                        <span className="text-white/30 font-mono">•</span>
                                        <span>{rec}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </>
                          );
                        })()
                      ) : (
                        <div className="py-12 text-center text-white/30 text-xs font-mono space-y-2">
                          <p>No engineering analysis recorded yet for this project.</p>
                          <button
                            onClick={() => analyzeMutation.mutate({ projectId: selectedProject.id })}
                            className="mt-3 px-3 py-1.5 rounded text-xs font-mono bg-white/[0.08] hover:bg-white/[0.12] text-white/80 cursor-pointer"
                          >
                            Run Initial Analysis
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── TAB 3: FULL REPORT ── */}
                  {activeDetailTab === "report" && (
                    <div className="space-y-3">
                      {projectDetail?.latestAnalysis ? (
                        <>
                          <div className="flex items-center justify-end">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(projectDetail.latestAnalysis.engineeringReport);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/60 cursor-pointer"
                            >
                              <Copy size={11} />
                              Copy Markdown
                            </button>
                          </div>
                          <div className="p-4 rounded-lg bg-[#16161a] border border-white/[0.06] font-mono text-[11.5px] text-white/75 leading-relaxed whitespace-pre-wrap select-text">
                            {projectDetail.latestAnalysis.engineeringReport}
                          </div>
                        </>
                      ) : (
                        <div className="py-12 text-center text-white/30 text-xs font-mono">
                          <p>No analysis report available. Run an analysis to generate the report.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── TAB 4: HISTORY ── */}
                  {activeDetailTab === "history" && (
                    <div className="space-y-2">
                      {projectDetail?.analyses?.length > 0 ? (
                        projectDetail.analyses.map((hist: any) => (
                          <div key={hist.id} className="p-3 rounded-lg bg-[#16161a] border border-white/[0.06] flex items-center justify-between text-xs">
                            <div>
                              <div className="flex items-center gap-2 font-mono">
                                <span className="text-white/80">{hist.commitShortSha}</span>
                                <span className="text-white/40 truncate max-w-xs">{hist.commitMessage}</span>
                              </div>
                              <span className="text-[10px] text-white/30 block mt-0.5 font-mono">
                                {hist.authorName} • {timeAgo(hist.createdAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <HealthScorePill score={hist.healthScore} />
                              <CiBadge status={hist.buildStatus} />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-12 text-center text-white/30 text-xs font-mono">
                          <p>No historical analyses recorded for this repository.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── Connect Account Modal ────────────────────────────────────── */}
        <AnimatePresence>
          {showConnectModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md rounded-lg bg-[#111113] border border-white/[0.08] p-5 shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Github size={15} className="text-white/80" />
                    <h3 className="text-sm font-semibold text-white/90">Connect GitHub Account</h3>
                  </div>
                  <button onClick={() => setShowConnectModal(false)} className="text-white/30 hover:text-white/70">
                    <X size={15} />
                  </button>
                </div>

                <p className="text-xs text-white/40 leading-relaxed">
                  Authenticate your GitHub account or Organization. AgentCraft will automatically discover all accessible repositories.
                </p>

                <div className="pt-1">
                  <button
                    onClick={handleStartOAuth}
                    className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-sm font-medium text-white transition-all cursor-pointer shadow-md group"
                  >
                    <Github size={16} className="text-white/90 group-hover:scale-105 transition-transform" />
                    <span>Authorize with GitHub</span>
                  </button>
                  <p className="text-[11px] font-mono text-white/35 text-center mt-3 leading-relaxed">
                    Grants access to authorized repositories, organizations, workflow statuses, and commit history.
                  </p>
                </div>

                <div className="flex items-center justify-end pt-2">
                  <button
                    onClick={() => setShowConnectModal(false)}
                    className="px-3.5 py-1.5 rounded text-xs font-mono text-white/40 hover:text-white/70 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── Disconnect Confirmation Modal ────────────────────────────── */}
        <AnimatePresence>
          {showDisconnectModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm rounded-lg bg-[#111113] border border-white/[0.08] p-5 shadow-2xl space-y-3"
              >
                <div className="flex items-center gap-2 text-red-400/80">
                  <LogOut size={16} />
                  <h3 className="text-sm font-semibold text-white/90">Disconnect GitHub Account</h3>
                </div>

                <p className="text-xs text-white/50 leading-relaxed font-mono text-[11px]">
                  Are you sure you want to disconnect @{account?.username}? This will halt autonomous monitoring for all projects. Existing reports will be preserved in audit history.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowDisconnectModal(false)}
                    className="px-3 py-1.5 rounded text-[11px] font-mono text-white/40 hover:text-white/70 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                    className="px-3 py-1.5 rounded text-[11px] font-mono font-medium text-red-400 bg-red-500/[0.08] hover:bg-red-500/[0.15] border border-red-500/25 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    {disconnectMutation.isPending ? "Disconnecting..." : "Yes, Disconnect"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── Webhook Info Modal ────────────────────────────────────────── */}
        <AnimatePresence>
          {showWebhookModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-lg rounded-lg bg-[#111113] border border-white/[0.08] p-5 shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity size={15} className="text-cyan-400/80" />
                    <h3 className="text-sm font-semibold text-white/90">Autonomous Webhook Receiver</h3>
                  </div>
                  <button onClick={() => setShowWebhookModal(false)} className="text-white/30 hover:text-white/70">
                    <X size={15} />
                  </button>
                </div>

                <p className="text-xs text-white/50 leading-relaxed font-mono text-[11px]">
                  Configure this webhook URL in your GitHub repository or organization settings to trigger continuous analysis on push events and workflow runs.
                </p>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-white/30 uppercase tracking-wider font-mono">Payload URL</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={webhookUrl}
                      className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded px-3 py-1.5 text-xs font-mono text-white/80 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(webhookUrl);
                        setCopiedWebhook(true);
                        setTimeout(() => setCopiedWebhook(false), 2000);
                      }}
                      className="px-2.5 py-1.5 rounded text-xs font-mono font-medium bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/70 transition-colors cursor-pointer"
                    >
                      {copiedWebhook ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded bg-white/[0.02] border border-white/[0.05] space-y-1 text-xs text-white/40 font-mono text-[11px]">
                  <p className="font-semibold text-white/60">Recommended GitHub Settings:</p>
                  <p>• Content type: <span className="text-white/70">application/json</span></p>
                  <p>• Events: <span className="text-white/70">Pushes</span>, <span className="text-white/70">Workflow runs</span></p>
                  <p>• Response: Returns 202 Accepted in &lt;50ms, analyzes in background.</p>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => setShowWebhookModal(false)}
                    className="px-3.5 py-1.5 rounded text-xs font-mono font-medium text-white/80 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </AppLayout>
  );
}
