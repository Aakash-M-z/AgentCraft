import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  Code, Award, Flame, Calendar, BookOpen, 
  ChevronRight, Terminal, Plus, Loader2, AlertCircle, Copy, Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LeetCodeSubmission {
  id: number;
  title: string;
  slug: string;
  difficulty: "Easy" | "Medium" | "Hard";
  solution: string;
  status: "solved" | "missed";
  date: string;
  createdAt: string;
}

interface StreakStats {
  totalSolved: number;
  easy: number;
  medium: number;
  hard: number;
  streak: number;
  missedCount: number;
}

export default function LeetCodePage() {
  const [submissions, setSubmissions] = useState<LeetCodeSubmission[]>([]);
  const [stats, setStats] = useState<StreakStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState<LeetCodeSubmission | null>(null);
  
  // Create Manual Submission Form State
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">("Medium");
  const [solution, setSolution] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchLeetCodeData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/life-os/leetcode");
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
        setStats(data.stats || null);
        
        // Default select the most recent submission if any
        if (data.submissions && data.submissions.length > 0) {
          setSelectedSub(data.submissions[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load LeetCode data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeetCodeData();
  }, []);

  const handleCreateSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !solution.trim()) return;
    
    // Generate clean slug from title if empty
    const cleanSlug = slug.trim() || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    try {
      setSaving(true);
      const res = await fetch("/api/life-os/leetcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug: cleanSlug,
          difficulty,
          solution,
          status: "solved"
        })
      });

      if (res.ok) {
        setShowModal(false);
        setTitle("");
        setSlug("");
        setDifficulty("Medium");
        setSolution("");
        fetchLeetCodeData();
      }
    } catch (err) {
      console.error("Failed to record solve:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCopySolution = () => {
    if (!selectedSub) return;
    navigator.clipboard.writeText(selectedSub.solution);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff.toLowerCase()) {
      case "easy": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "hard": return "text-rose-400 bg-rose-500/10 border-rose-500/20";
      default: return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col h-full bg-[#030303] overflow-y-auto relative pb-12 select-none">
        {/* Glow Effects */}
        <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-7xl mx-auto w-full px-8 py-10 relative z-10">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
            <div>
              <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight flex items-center gap-3">
                <span className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-amber-500/20">
                  <Flame className="w-6 h-6 animate-pulse" />
                </span>
                LeetCode Solved Hub
              </h1>
              <p className="text-muted-foreground mt-2 text-sm max-w-xl">
                Observe continuous coding streaking. Daily questions solved by AI agent triggers and logged cleanly.
              </p>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-lg shadow-amber-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shrink-0"
            >
              <Plus size={14} />
              Add Solve
            </button>
          </div>

          {/* KPI Widget Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {/* Current Streak */}
            <div className="bg-[#09090b]/40 backdrop-blur border border-border/60 rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-amber-500/20 transition-all">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Solving Streak</span>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-bold font-display text-amber-400">{stats ? stats.streak : "0"}</span>
                <span className="text-amber-400 text-xs font-bold font-mono">Days</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Consecutive active dates</p>
            </div>

            {/* Total Solved */}
            <div className="bg-[#09090b]/40 backdrop-blur border border-border/60 rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-amber-500/20 transition-all">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Total Challenges</span>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-bold font-display text-foreground">{stats ? stats.totalSolved : "0"}</span>
                <span className="text-emerald-400 text-[10px] font-bold font-mono">Solved</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Verified solved queries</p>
            </div>

            {/* Easy Count */}
            <div className="bg-[#09090b]/40 backdrop-blur border border-border/60 rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-emerald-500/20 transition-all">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Easy Level</span>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-bold font-display text-emerald-400">{stats ? stats.easy : "0"}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Warm-ups and fundamentals</p>
            </div>

            {/* Medium Count */}
            <div className="bg-[#09090b]/40 backdrop-blur border border-border/60 rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-amber-500/20 transition-all">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Medium Level</span>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-bold font-display text-amber-400">{stats ? stats.medium : "0"}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Core data structures</p>
            </div>

            {/* Hard Count */}
            <div className="bg-[#09090b]/40 backdrop-blur border border-border/60 rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-rose-500/20 transition-all">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Hard Level</span>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-bold font-display text-rose-400">{stats ? stats.hard : "0"}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Algorithms and optimization</p>
            </div>
          </div>

          {/* Central Workspace layout (Left: Solved List, Right: Code editor) */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="animate-spin text-amber-500 w-8 h-8" />
              <span className="text-xs text-muted-foreground">Checking submission databases...</span>
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-20 bg-[#09090b]/20 border border-border/40 rounded-2xl">
              <Code className="w-8 h-8 text-muted-foreground/60 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">No Submissions Logged Yet</p>
              <p className="text-xs text-muted-foreground mt-1">Configure your daily workflow trigger or add your first manual solve above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* Solves list */}
              <div className="lg:col-span-1 bg-[#09090b]/40 backdrop-blur border border-border/60 rounded-2xl p-4 space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 px-2">Solve Log Timeline</h3>
                {submissions.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setSelectedSub(sub)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                      selectedSub?.id === sub.id
                        ? "bg-[#121214] border-amber-500/40 text-foreground"
                        : "bg-[#0c0c0e]/30 border-border/60 hover:bg-[#121214]/50 hover:border-border text-muted-foreground"
                    }`}
                  >
                    <div className="space-y-1.5 max-w-[85%]">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${getDifficultyColor(sub.difficulty)}`}>
                          {sub.difficulty}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">{new Date(sub.date).toLocaleDateString([], { dateStyle: "short" })}</span>
                      </div>
                      <h4 className="text-xs font-bold text-foreground truncate">{sub.title}</h4>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </button>
                ))}
              </div>

              {/* Code viewer console */}
              <div className="lg:col-span-2 bg-[#09090b]/40 backdrop-blur border border-border/60 rounded-2xl p-6 shadow-xl flex flex-col h-[580px]">
                {selectedSub ? (
                  <div className="flex flex-col h-full">
                    {/* Console Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-border/40 mb-4 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                          <Terminal size={16} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            {selectedSub.title}
                            <a 
                              href={`https://leetcode.com/problems/${selectedSub.slug}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[10px] font-mono text-amber-400 hover:underline hover:scale-105 transition-transform"
                            >
                              ({selectedSub.slug})
                            </a>
                          </h3>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            Status: <span className="text-emerald-400 font-bold uppercase">{selectedSub.status}</span> | Recorded: {new Date(selectedSub.date).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handleCopySolution}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold bg-[#121214] border border-border hover:bg-[#1c1c1f] transition-all cursor-pointer text-foreground"
                      >
                        {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        {copied ? "Copied" : "Copy Solution"}
                      </button>
                    </div>

                    {/* Syntax Code Editor Block */}
                    <div className="flex-1 overflow-auto rounded-xl border border-border/30 bg-[#050506] p-4 text-xs font-mono text-[#d4d4d8] select-text relative">
                      <div className="absolute top-3 right-3 text-[9px] font-bold font-mono text-muted-foreground uppercase bg-[#121214] border border-border px-2 py-0.5 rounded-md">
                        C++ / Python / Java
                      </div>
                      <pre className="whitespace-pre">{selectedSub.solution}</pre>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <BookOpen size={30} className="text-muted-foreground/40 mb-3" />
                    <p className="text-xs text-muted-foreground">Select a submission from the timeline to observe compiled solutions.</p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Create Modal */}
          <AnimatePresence>
            {showModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-[#09090b] border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl relative"
                >
                  <h3 className="text-lg font-bold text-foreground mb-4">Record LeetCode Challenge</h3>
                  
                  <form onSubmit={handleCreateSubmission} className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <label className="block text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1.5">Challenge Title</label>
                        <input
                          type="text"
                          required
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="e.g. Reverse Integer"
                          className="w-full bg-[#121214] border border-border/80 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1.5">Difficulty</label>
                        <select
                          value={difficulty}
                          onChange={(e) => setDifficulty(e.target.value as any)}
                          className="w-full bg-[#121214] border border-border/80 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-amber-500"
                        >
                          <option value="Easy">Easy</option>
                          <option value="Medium">Medium</option>
                          <option value="Hard">Hard</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1.5">LeetCode Slug (Optional)</label>
                      <input
                        type="text"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="e.g. reverse-integer (autogenerated if left blank)"
                        className="w-full bg-[#121214] border border-border/80 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1.5">Solution Code</label>
                      <textarea
                        required
                        rows={10}
                        value={solution}
                        onChange={(e) => setSolution(e.target.value)}
                        placeholder="Paste verified compiled C++, Python, or Java solution code here..."
                        className="w-full bg-[#121214] border border-border/80 rounded-xl p-3 text-xs font-mono focus:outline-none focus:border-amber-500 resize-none"
                      />
                    </div>

                    <div className="flex gap-3 justify-end pt-4 border-t border-border/40">
                      <button
                        type="button"
                        onClick={() => setShowModal(false)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#121214] border border-border/60 hover:bg-[#1c1c1f] text-foreground transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/25 cursor-pointer disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Record Solve"}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </AppLayout>
  );
}
