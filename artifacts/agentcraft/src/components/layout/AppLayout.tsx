import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity, GitMerge, LayoutDashboard,
  ChevronDown, Database, Cpu, MessageSquare, Globe, Bot, Shield, Check,
  BookOpen, Briefcase, Code, Building2, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

const WORKSPACES = [
  { id: "personal", name: "Personal Sandbox", icon: Bot, role: "Creator" },
  { id: "team", name: "Aakash's Dev Team", icon: Cpu, role: "Admin" },
  { id: "enterprise", name: "Production Enterprise", icon: Shield, role: "Owner" }
];

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState(WORKSPACES[0]);

  const navSections = [
    {
      label: "Orchestration",
      items: [
        { href: "/builder", label: "Visual Canvas" },
        { href: "/workflows", label: "Workflows" },
        { href: "/executions", label: "Executions" },
      ]
    },
    {
      label: "Life OS",
      items: [
        { href: "/life-os", label: "Command Center" },
        { href: "/life-os/assignments", label: "Assignments" },
        { href: "/life-os/placements", label: "Placements" },
        { href: "/life-os/leetcode", label: "LeetCode Solver" },
      ]
    },
    {
      label: "Enterprise",
      items: [
        { href: "/procurement", label: "Procurement Hub" },
      ]
    }
  ];

  const systemStatus = [
    { label: "Redis", value: "<1.8ms", ok: true },
    { label: "Database", value: "Connected", ok: true },
    { label: "WhatsApp", value: "Active", ok: true },
    { label: "Browser", value: "Standby", ok: null },
    { label: "Groq Core", value: "99.9%", ok: true },
  ];

  return (
    <div className="flex h-screen w-full bg-[#0b0b0d] text-foreground overflow-hidden font-sans antialiased">

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside className="w-[220px] flex flex-col bg-[#111113] border-r border-white/[0.06] shrink-0 select-none z-40">

        {/* Brand + Workspace */}
        <div className="px-4 pt-5 pb-4 border-b border-white/[0.06]">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center shrink-0">
              <GitMerge className="w-3.5 h-3.5 text-white/70" />
            </div>
            <span className="text-sm font-semibold text-white/90 tracking-tight">AgentCraft</span>
          </div>

          {/* Workspace switcher */}
          <div className="relative">
            <button
              onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-white/[0.05] transition-colors duration-150 group cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-5 h-5 rounded bg-white/[0.08] flex items-center justify-center shrink-0">
                  <selectedWorkspace.icon className="w-3 h-3 text-white/50" />
                </div>
                <div className="flex flex-col text-left min-w-0">
                  <span className="text-[11px] font-medium text-white/70 truncate leading-none">{selectedWorkspace.name}</span>
                  <span className="text-[10px] text-white/30 leading-none mt-0.5">{selectedWorkspace.role}</span>
                </div>
              </div>
              <ChevronDown className={cn("w-3 h-3 text-white/30 transition-transform shrink-0", showWorkspaceDropdown && "rotate-180")} />
            </button>

            {showWorkspaceDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowWorkspaceDropdown(false)} />
                <div className="absolute left-0 right-0 top-full mt-1 p-1 bg-[#1a1a1e] border border-white/[0.08] rounded-lg shadow-2xl z-50">
                  {WORKSPACES.map((ws) => {
                    const isSelected = ws.id === selectedWorkspace.id;
                    return (
                      <button
                        key={ws.id}
                        onClick={() => { setSelectedWorkspace(ws); setShowWorkspaceDropdown(false); }}
                        className={cn(
                          "flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-left text-[11px] font-medium transition-colors cursor-pointer",
                          isSelected ? "bg-white/[0.07] text-white/80" : "text-white/40 hover:bg-white/[0.04] hover:text-white/60"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ws.icon className="w-3 h-3 shrink-0" />
                          <span className="truncate">{ws.name}</span>
                        </div>
                        {isSelected && <Check className="w-3 h-3 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Navigation ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-none">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest px-2 mb-1">
                {section.label}
              </p>
              <nav className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                  return (
                    <Link key={item.href} href={item.href} className="block">
                      <div className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md text-[12.5px] font-medium transition-all duration-150 cursor-pointer",
                        isActive
                          ? "bg-orange-500/15 text-orange-400 border-l-2 border-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.15)]"
                          : "text-white/40 hover:bg-white/[0.04] hover:text-white/65 border-l-2 border-transparent"
                      )}>
                        <div className={cn(
                          "w-1 h-1 rounded-full shrink-0 transition-all duration-150",
                          isActive ? "bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.6)]" : "bg-white/15"
                        )} />
                        {item.label}
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* ── System Health ───────────────────────────────────────────── */}
        <div className="px-3 pb-4 pt-3 border-t border-white/[0.06]">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-semibold text-white/25 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 inline-block" />
              Systems
            </span>
            <span className="text-[9px] font-mono text-white/20 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded">
              v1.4.2
            </span>
          </div>
          <div className="space-y-1.5">
            {systemStatus.map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-[10px] text-white/30">{s.label}</span>
                <span className={cn(
                  "text-[10px] font-mono flex items-center gap-1",
                  s.ok === true ? "text-emerald-400/70" : s.ok === false ? "text-red-400/70" : "text-blue-400/70"
                )}>
                  <span className={cn("w-1 h-1 rounded-full", s.ok === true ? "bg-emerald-400/80" : s.ok === false ? "bg-red-400/80" : "bg-blue-400/60")} />
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#0b0b0d]">
        {children}
      </main>
    </div>
  );
}
