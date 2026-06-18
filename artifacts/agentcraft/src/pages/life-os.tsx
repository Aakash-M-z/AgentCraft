import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  Cpu, Sparkles, Send, Loader2, Calendar, 
  Briefcase, Code, Bell, RefreshCw, MessageSquare, 
  Award, TrendingUp, CheckCircle, Clock, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SummaryData {
  assignments: {
    total: number;
    active: number;
    completed: number;
    overdue: number;
  };
  placements: {
    total: number;
    active: number;
    applied: number;
  };
  leetcode: {
    totalSolved: number;
    easy: number;
    medium: number;
    hard: number;
    streak: number;
    missedCount: number;
  };
  last_briefing: string;
}

interface ChatMessage {
  sender: "user" | "ai";
  text: string;
  timestamp: string;
}

export default function PersonalLifeOSPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      sender: "ai",
      text: "Good day, Aakash. I am your Executive AI Chief of Staff. I have synthesized your assignment logs, placement pipeline, and LeetCode streak. How may I assist your operations today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [aiTyping, setAiTyping] = useState(false);
  const [triggeringBriefing, setTriggeringBriefing] = useState(false);
  const [triggeringReminders, setTriggeringReminders] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchSummary = async () => {
    try {
      setLoadingSummary(true);
      const res = await fetch("/api/life-os/summary");
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.error("Failed to load Life OS summary:", err);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, aiTyping]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || aiTyping) return;

    const userMsg = chatInput.trim();
    setChatInput("");
    
    const newHistory = [
      ...chatHistory,
      {
        sender: "user" as const,
        text: userMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
    setChatHistory(newHistory);
    setAiTyping(true);

    try {
      const res = await fetch("/api/life-os/chief-of-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userMsg })
      });

      if (res.ok) {
        const data = await res.json();
        setChatHistory([
          ...newHistory,
          {
            sender: "ai",
            text: data.response || "No response received.",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        throw new Error("Chat failed");
      }
    } catch (err) {
      setChatHistory([
        ...newHistory,
        {
          sender: "ai",
          text: "💥 Connection timeout. Unable to establish link with AI Chief of Staff. Please verify FastAPI backend service is running.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setAiTyping(false);
    }
  };

  // We can pass stringified request body for fetch using standard syntax
  const handleTriggerBriefing = async () => {
    try {
      setTriggeringBriefing(true);
      const res = await fetch("/api/life-os/briefings/trigger", { method: "POST" });
      if (res.ok) {
        alert("✓ Daily Briefing dispatched in background to WhatsApp!");
      }
    } catch (e) {
      alert("Failed to trigger briefing");
    } finally {
      setTriggeringBriefing(false);
    }
  };

  const handleTriggerReminders = async () => {
    try {
      setTriggeringReminders(true);
      const res = await fetch("/api/life-os/reminders/trigger", { method: "POST" });
      if (res.ok) {
        alert("✓ Smart Reminders scan initialized! Checking for near-deadline notifications.");
      }
    } catch (e) {
      alert("Failed to trigger reminders");
    } finally {
      setTriggeringReminders(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col h-full bg-[#030303] overflow-y-auto relative pb-12 select-none">
        {/* Glow Effects */}
        <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-100px] left-[-100px] w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-7xl mx-auto w-full px-8 py-10 relative z-10">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
            <div>
              <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight flex items-center gap-3">
                <span className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/20">
                  <Cpu className="w-6 h-6 animate-pulse" />
                </span>
                Personal Life OS
              </h1>
              <p className="text-muted-foreground mt-2 text-sm max-w-xl">
                Aakash's Flagship Automation Command Center. Monitored by the AI Chief of Staff.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleTriggerBriefing}
                disabled={triggeringBriefing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#09090b]/80 border border-border hover:border-indigo-500/30 text-foreground transition-all cursor-pointer disabled:opacity-50"
              >
                {triggeringBriefing ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : <Bell size={14} className="text-indigo-400" />}
                Trigger Daily Briefing
              </button>
              <button
                onClick={handleTriggerReminders}
                disabled={triggeringReminders}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#09090b]/80 border border-border hover:border-purple-500/30 text-foreground transition-all cursor-pointer disabled:opacity-50"
              >
                {triggeringReminders ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : <RefreshCw size={14} className="text-purple-400" />}
                Scan Reminders
              </button>
            </div>
          </div>

          {/* Telemetry Matrix Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Academic Operations */}
            <div className="bg-[#09090b]/40 backdrop-blur border border-border/60 rounded-2xl p-6 shadow-xl flex flex-col justify-between hover:border-indigo-500/20 transition-all group">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Academic Assignments</span>
                  <h3 className="text-3xl font-extrabold font-display mt-3 text-white">
                    {loadingSummary ? "..." : summary?.assignments.active}
                  </h3>
                </div>
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                  <Calendar size={18} />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between text-[11px]">
                <span className="text-emerald-400 font-mono font-semibold">✓ {summary?.assignments.completed || 0} Completed</span>
                <span className="text-rose-400 font-mono font-semibold">🚨 {summary?.assignments.overdue || 0} Overdue</span>
              </div>
            </div>

            {/* Placement Pipeline */}
            <div className="bg-[#09090b]/40 backdrop-blur border border-border/60 rounded-2xl p-6 shadow-xl flex flex-col justify-between hover:border-purple-500/20 transition-all group">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Career Opportunities</span>
                  <h3 className="text-3xl font-extrabold font-display mt-3 text-white">
                    {loadingSummary ? "..." : summary?.placements.active}
                  </h3>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
                  <Briefcase size={18} />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Active in Pipelines</span>
                <span className="text-purple-400 font-mono font-semibold">{summary?.placements.applied || 0} Applied</span>
              </div>
            </div>

            {/* LeetCode Solved Hub */}
            <div className="bg-[#09090b]/40 backdrop-blur border border-border/60 rounded-2xl p-6 shadow-xl flex flex-col justify-between hover:border-amber-500/20 transition-all group">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">LeetCode Daily Streak</span>
                  <h3 className="text-3xl font-extrabold font-display mt-3 text-white flex items-baseline gap-2">
                    {loadingSummary ? "..." : summary?.leetcode.streak}
                    <span className="text-xs text-amber-400 font-mono font-bold uppercase tracking-wider">Days</span>
                  </h3>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
                  <Code size={18} />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between text-[11px]">
                <span className="text-amber-400 font-mono font-semibold">{summary?.leetcode.totalSolved || 0} Solved</span>
                <span className="text-muted-foreground font-mono">Missed: {summary?.leetcode.missedCount || 0}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* AI Chief of Staff Chat - Glassmorphic Console */}
            <div className="lg:col-span-2 bg-[#09090b]/40 backdrop-blur border border-border/60 rounded-2xl p-6 shadow-xl flex flex-col h-[520px]">
              <div className="flex items-center justify-between pb-4 border-b border-border/40">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">AI Chief of Staff</h3>
                    <p className="text-[10px] text-muted-foreground">Autonomous context-aware executive</p>
                  </div>
                </div>
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Sparkles size={14} />
                </div>
              </div>

              {/* Chat stream */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 select-text">
                {chatHistory.map((msg, i) => (
                  <div 
                    key={i} 
                    className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                      msg.sender === "user" 
                        ? "bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/10" 
                        : "bg-[#121214] text-[#d4d4d8] rounded-tl-none border border-border/40"
                    }`}>
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                      <span className="block text-[9px] text-muted-foreground/60 mt-1.5 text-right">{msg.timestamp}</span>
                    </div>
                  </div>
                ))}
                {aiTyping && (
                  <div className="flex justify-start">
                    <div className="bg-[#121214] border border-border/40 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input section */}
              <form onSubmit={handleSendMessage} className="flex gap-2 pt-4 border-t border-border/40">
                <input
                  type="text"
                  placeholder="Ask Chief of Staff (e.g. 'What is my priority high assignment?')"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 bg-[#121214] border border-border/60 hover:border-border rounded-xl px-4 py-3 text-xs text-foreground focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || aiTyping}
                  className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Send size={15} />
                </button>
              </form>
            </div>

            {/* Daily Briefing Digest Logger Widget */}
            <div className="bg-[#09090b]/40 backdrop-blur border border-border/60 rounded-2xl p-6 shadow-xl flex flex-col h-[520px]">
              <div className="flex items-center gap-2 pb-4 border-b border-border/40">
                <Award className="text-amber-400 w-4 h-4" />
                <h3 className="text-sm font-bold text-foreground">Latest Morning Dispatch</h3>
              </div>

              <div className="flex-1 overflow-y-auto mt-4 pr-1 text-xs select-text leading-relaxed text-[#a1a1aa] font-mono whitespace-pre-wrap bg-[#050506] border border-border/30 rounded-xl p-4">
                {summary ? summary.last_briefing : "No briefings logs present. Trigger your morning briefing above to generate logs."}
              </div>
              <div className="mt-4 pt-4 border-t border-border/40 text-[10px] text-muted-foreground flex justify-between items-center">
                <span>Auto-Dispatches 8:00 AM daily</span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> WhatsApp Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
