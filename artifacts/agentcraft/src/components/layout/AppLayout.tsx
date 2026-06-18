import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  Activity, GitMerge, LayoutDashboard, TerminalSquare, 
  ChevronDown, Database, Cpu, MessageSquare, Globe, Bot, Shield, Check, Settings,
  BookOpen, Briefcase, Code
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

  const navItems = [
    { href: "/", icon: GitMerge, label: "Visual Canvas" },
    { href: "/workflows", icon: LayoutDashboard, label: "Library & Metrics" },
    { href: "/executions", icon: Activity, label: "Spacecraft Logs" },
  ];

  const lifeOsItems = [
    { href: "/life-os", icon: Cpu, label: "Command Center" },
    { href: "/life-os/assignments", icon: BookOpen, label: "Assignments" },
    { href: "/life-os/placements", icon: Briefcase, label: "Placement Pipeline" },
    { href: "/life-os/leetcode", icon: Code, label: "LeetCode Solver" },
  ];

  return (
    <div className="flex h-screen w-full bg-[#030303] text-foreground overflow-hidden font-sans antialiased">
      {/* Sidebar Nav */}
      <aside className="w-64 flex flex-col bg-card/60 backdrop-blur-xl border-r border-border/80 shadow-2xl relative z-40 select-none shrink-0">
        
        {/* Workspace Switcher */}
        <div className="p-4 border-b border-border/50 relative">
          <button 
            onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
            className="flex items-center justify-between w-full p-2 rounded-xl bg-secondary/30 hover:bg-secondary/60 border border-border/60 hover:border-primary/30 transition-all duration-300 cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs font-bold shadow-md shadow-primary/20 shrink-0">
                <selectedWorkspace.icon className="w-4 h-4" />
              </div>
              <div className="flex flex-col text-left min-w-0">
                <span className="text-xs font-bold text-foreground truncate leading-tight group-hover:text-primary transition-colors">{selectedWorkspace.name}</span>
                <span className="text-[10px] text-muted-foreground leading-none mt-0.5">{selectedWorkspace.role}</span>
              </div>
            </div>
            <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform duration-300 group-hover:text-foreground shrink-0", showWorkspaceDropdown && "rotate-180")} />
          </button>

          {/* Switcher Dropdown */}
          {showWorkspaceDropdown && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowWorkspaceDropdown(false)}
              />
              <div className="absolute left-4 right-4 mt-2 p-1.5 bg-popover/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider px-2.5 py-1.5">Select Workspace</p>
                <div className="space-y-0.5">
                  {WORKSPACES.map((ws) => {
                    const isSelected = ws.id === selectedWorkspace.id;
                    return (
                      <button
                        key={ws.id}
                        onClick={() => {
                          setSelectedWorkspace(ws);
                          setShowWorkspaceDropdown(false);
                        }}
                        className={cn(
                          "flex items-center justify-between w-full p-2 rounded-lg text-left text-xs font-medium cursor-pointer transition-all",
                          isSelected 
                            ? "bg-primary/10 text-primary" 
                            : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                           <ws.icon className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
                          <span className="truncate">{ws.name}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Navigation Section */}
        <div className="px-3 py-4 flex-1 overflow-y-auto space-y-6 scrollbar-none">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider px-3 mb-2">Orchestration</p>
            <nav className="space-y-1.5 w-full">
              {navItems.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href} className="block">
                    <div
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300 group cursor-pointer text-sm font-medium",
                        isActive 
                          ? "bg-primary/10 text-primary shadow-[0_0_15px_rgba(139,92,246,0.05)] border-l-2 border-primary" 
                          : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground border-l-2 border-transparent"
                      )}
                    >
                      <item.icon className={cn("w-4 h-4 transition-transform group-hover:scale-105", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div>
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider px-3 mb-2">Personal Life OS</p>
            <nav className="space-y-1.5 w-full">
              {lifeOsItems.map((item) => {
                const isActive = location === item.href || (item.href !== "/life-os" && location.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href} className="block">
                    <div
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300 group cursor-pointer text-sm font-medium",
                        isActive 
                          ? "bg-primary/10 text-primary shadow-[0_0_15px_rgba(139,92,246,0.05)] border-l-2 border-primary" 
                          : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground border-l-2 border-transparent"
                      )}
                    >
                      <item.icon className={cn("w-4 h-4 transition-transform group-hover:scale-105", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Live Systems Health Matrix */}
        <div className="p-4 border-t border-border/50 bg-[#060608]/40 mt-auto">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Operations Monitor
            </span>
            <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-1.5 py-0.5 rounded">
              v1.4.2
            </span>
          </div>

          <div className="space-y-2 bg-[#09090b]/80 border border-border/40 rounded-xl p-3 shadow-inner">
            {/* Redis health */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
                Redis Cache
              </span>
              <span className="font-mono text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" style={{ animationDuration: "1.5s" }} />
                &lt;1.8ms
              </span>
            </div>

            {/* DB status */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
                Drizzle DB
              </span>
              <span className="font-mono text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                Connected
              </span>
            </div>

            {/* WhatsApp gateway */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
                WhatsApp
              </span>
              <span className="font-mono text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                Active
              </span>
            </div>

            {/* Playwright status */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
                Browser Bot
              </span>
              <span className="font-mono text-[10px] font-bold text-blue-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
                Standby
              </span>
            </div>

            {/* AI provider health */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-2">
                <Bot className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
                Groq Core
              </span>
              <span className="font-mono text-[10px] font-bold text-purple-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                99.9% Up
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#040405]">
        {children}
      </main>
    </div>
  );
}

