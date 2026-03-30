import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Activity, GitMerge, LayoutDashboard, TerminalSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: GitMerge, label: "Builder" },
    { href: "/workflows", icon: LayoutDashboard, label: "Library" },
    { href: "/executions", icon: Activity, label: "Executions" },
  ];

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Sidebar Nav */}
      <aside className="w-16 flex flex-col items-center py-6 bg-card border-r border-border shadow-2xl z-50">
        <div className="w-10 h-10 mb-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
          <TerminalSquare className="text-white w-6 h-6" />
        </div>
        
        <nav className="flex flex-col gap-4 flex-1 w-full px-2">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className="w-full">
                <div
                  className={cn(
                    "flex items-center justify-center w-full aspect-square rounded-xl transition-all duration-300 group relative",
                    isActive 
                      ? "bg-primary/15 text-primary shadow-[0_0_15px_rgba(139,92,246,0.15)]" 
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5 transition-transform group-hover:scale-110" />
                  {/* Tooltip */}
                  <div className="absolute left-14 px-2 py-1 bg-popover border border-border text-popover-foreground text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                    {item.label}
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}
