import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  Plus, Trash2, CheckCircle2, Clock, Calendar, 
  Tag, Filter, AlertTriangle, AlertCircle, Bookmark, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Assignment {
  id: number;
  title: string;
  subject: string;
  deadline: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "completed" | "overdue";
  source: string;
  createdAt: string;
  updatedAt: string;
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  // Create Assignment Form State
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [saving, setSaving] = useState(false);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/life-os/assignments");
      if (res.ok) {
        const data = await res.json();
        setAssignments(data);
      }
    } catch (err) {
      console.error("Failed to fetch assignments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subject.trim() || !deadline) return;

    try {
      setSaving(true);
      const res = await fetch("/api/life-os/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subject,
          deadline: new Date(deadline).toISOString(),
          priority,
          status: "pending",
          source: "manual"
        })
      });

      if (res.ok) {
        setShowModal(false);
        setTitle("");
        setSubject("");
        setDeadline("");
        setPriority("medium");
        fetchAssignments();
      }
    } catch (err) {
      console.error("Failed to create assignment:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (id: number, currentStatus: string) => {
    const nextStatus = currentStatus === "completed" ? "pending" : "completed";
    try {
      const res = await fetch(`/api/life-os/assignments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        fetchAssignments();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this assignment?")) return;
    try {
      const res = await fetch(`/api/life-os/assignments/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchAssignments();
      }
    } catch (err) {
      console.error("Failed to delete assignment:", err);
    }
  };

  const filteredAssignments = assignments.filter((asg) => {
    const statusMatch = filterStatus === "all" || asg.status === filterStatus;
    const priorityMatch = filterPriority === "all" || asg.priority === filterPriority;
    return statusMatch && priorityMatch;
  });

  const getPriorityColor = (p: string) => {
    switch (p) {
      case "high": return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "medium": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default: return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "completed":
        return <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20"><CheckCircle2 size={11} /> Completed</span>;
      case "overdue":
        return <span className="flex items-center gap-1 text-[10px] text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 animate-pulse"><AlertTriangle size={11} /> Overdue</span>;
      case "in_progress":
        return <span className="flex items-center gap-1 text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20"><Clock size={11} /> In Progress</span>;
      default:
        return <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold bg-[#121214] px-2 py-0.5 rounded-full border border-border"><Bookmark size={11} /> Pending</span>;
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
                <span className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/20">
                  <Bookmark className="w-6 h-6" />
                </span>
                Academic Assignments
              </h1>
              <p className="text-muted-foreground mt-2 text-sm max-w-xl">
                Sort, filter, and orchestrate assignment logs. Automatically checked by the background engine.
              </p>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white shadow-lg shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shrink-0"
            >
              <Plus size={14} />
              Add Assignment
            </button>
          </div>

          {/* Filtering Panel */}
          <div className="flex flex-wrap gap-4 mb-8 bg-[#09090b]/40 backdrop-blur border border-border/60 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold mr-2">
              <Filter size={14} className="text-indigo-400" />
              <span>Filters:</span>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Status</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-[#121214] border border-border/60 text-foreground text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Priority</span>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="bg-[#121214] border border-border/60 text-foreground text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="ml-auto text-[10px] text-muted-foreground font-mono flex items-center gap-1 bg-[#121214]/60 border border-border/40 px-3 py-1.5 rounded-xl">
              <span>Showing {filteredAssignments.length} of {assignments.length} Tasks</span>
            </div>
          </div>

          {/* List display */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="animate-spin text-indigo-500 w-8 h-8" />
              <span className="text-xs text-muted-foreground">Loading operations grid...</span>
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="text-center py-20 bg-[#09090b]/20 border border-border/40 rounded-2xl">
              <AlertCircle className="w-8 h-8 text-muted-foreground/60 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">No Assignments Found</p>
              <p className="text-xs text-muted-foreground mt-1">Try relaxing filters or add a new task.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAssignments.map((asg) => (
                <div 
                  key={asg.id}
                  className="bg-[#09090b]/40 backdrop-blur border border-border/60 rounded-2xl p-5 hover:border-indigo-500/25 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <span className="text-[10px] font-mono font-bold text-muted-foreground bg-[#121214] border border-border px-2 py-0.5 rounded-lg">
                        {asg.subject}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border ${getPriorityColor(asg.priority)}`}>
                          {asg.priority}
                        </span>
                        {getStatusBadge(asg.status)}
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-foreground mb-4 line-clamp-2">{asg.title}</h3>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4 font-mono">
                      <Calendar size={13} className="text-indigo-400" />
                      <span>Due: {new Date(asg.deadline).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>

                    <div className="flex items-center justify-between border-t border-border/40 pt-4">
                      <button
                        onClick={() => handleUpdateStatus(asg.id, asg.status)}
                        className={`text-[11px] font-bold flex items-center gap-1 px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                          asg.status === "completed" 
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/25 hover:bg-amber-500/20" 
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20"
                        }`}
                      >
                        {asg.status === "completed" ? "Re-open Task" : "Mark Solved"}
                      </button>

                      <button
                        onClick={() => handleDelete(asg.id)}
                        className="p-2 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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
                  className="bg-[#09090b] border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl relative"
                >
                  <h3 className="text-lg font-bold text-foreground mb-4">Track Assignment</h3>
                  
                  <form onSubmit={handleCreateAssignment} className="space-y-4">
                    <div>
                      <label className="block text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1.5">Assignment Title</label>
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Compiler Design Lab 4"
                        className="w-full bg-[#121214] border border-border/80 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1.5">Subject / Course</label>
                      <input
                        type="text"
                        required
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="e.g. CSE-402"
                        className="w-full bg-[#121214] border border-border/80 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1.5">Deadline</label>
                        <input
                          type="datetime-local"
                          required
                          value={deadline}
                          onChange={(e) => setDeadline(e.target.value)}
                          className="w-full bg-[#121214] border border-border/80 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1.5">Priority</label>
                        <select
                          value={priority}
                          onChange={(e) => setPriority(e.target.value as any)}
                          className="w-full bg-[#121214] border border-border/80 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
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
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save Assignment"}
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
