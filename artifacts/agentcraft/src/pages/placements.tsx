import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  Plus, Trash2, Calendar, Link as LinkIcon, Briefcase, 
  DollarSign, GraduationCap, Filter, AlertTriangle, Loader2, CheckSquare
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Placement {
  id: number;
  company_name: string;
  package: string | null;
  deadline: string;
  eligibility: string | null;
  apply_url: string | null;
  status: "active" | "expired" | "applied" | "upcoming";
  createdAt: string;
  updatedAt: string;
}

export default function PlacementsPage() {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Create Placement Form State
  const [showModal, setShowModal] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [pkg, setPkg] = useState("");
  const [deadline, setDeadline] = useState("");
  const [eligibility, setEligibility] = useState("");
  const [applyUrl, setApplyUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchPlacements = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/life-os/placements");
      if (res.ok) {
        const data = await res.json();
        setPlacements(data);
      }
    } catch (err) {
      console.error("Failed to fetch placements:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlacements();
  }, []);

  const handleCreatePlacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !deadline) return;

    try {
      setSaving(true);
      const res = await fetch("/api/life-os/placements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName,
          package: pkg || null,
          deadline: new Date(deadline).toISOString(),
          eligibility: eligibility || null,
          apply_url: applyUrl || null,
          status: "active"
        })
      });

      if (res.ok) {
        setShowModal(false);
        setCompanyName("");
        setPkg("");
        setDeadline("");
        setEligibility("");
        setApplyUrl("");
        fetchPlacements();
      } else {
        const errData = await res.json();
        alert(errData.detail || "Failed to save opportunity.");
      }
    } catch (err) {
      console.error("Failed to create placement:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleApplied = async (id: number, currentStatus: string) => {
    const nextStatus = currentStatus === "applied" ? "active" : "applied";
    try {
      const res = await fetch(`/api/life-os/placements/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        fetchPlacements();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this placement opportunity?")) return;
    try {
      const res = await fetch(`/api/life-os/placements/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchPlacements();
      }
    } catch (err) {
      console.error("Failed to delete placement:", err);
    }
  };

  const filteredPlacements = placements.filter((p) => {
    return filterStatus === "all" || p.status === filterStatus;
  });

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "applied":
        return <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/25">Applied</span>;
      case "expired":
        return <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/25">Closed</span>;
      case "upcoming":
        return <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/25">Upcoming</span>;
      default:
        return <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/25 animate-pulse">Active</span>;
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
                <span className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-purple-500/20">
                  <Briefcase className="w-6 h-6 animate-pulse" />
                </span>
                Placement Intelligence
              </h1>
              <p className="text-muted-foreground mt-2 text-sm max-w-xl">
                Observe university and job placement campaigns. Extracted and cross-referenced in real-time.
              </p>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shrink-0"
            >
              <Plus size={14} />
              Add Placement
            </button>
          </div>

          {/* Filtering Panel */}
          <div className="flex flex-wrap gap-4 mb-8 bg-[#09090b]/40 backdrop-blur border border-border/60 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold mr-2">
              <Filter size={14} className="text-purple-400" />
              <span>Filters:</span>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Campaign Status</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-[#121214] border border-border/60 text-foreground text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-purple-500"
              >
                <option value="all">All Campaigns</option>
                <option value="active">Active</option>
                <option value="applied">Applied</option>
                <option value="expired">Closed</option>
              </select>
            </div>

            <div className="ml-auto text-[10px] text-muted-foreground font-mono flex items-center gap-1 bg-[#121214]/60 border border-border/40 px-3 py-1.5 rounded-xl">
              <span>Tracked Pipelines: {filteredPlacements.length} Total</span>
            </div>
          </div>

          {/* Pipeline Display */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="animate-spin text-purple-500 w-8 h-8" />
              <span className="text-xs text-muted-foreground">Syncing placement engines...</span>
            </div>
          ) : filteredPlacements.length === 0 ? (
            <div className="text-center py-20 bg-[#09090b]/20 border border-border/40 rounded-2xl">
              <Briefcase className="w-8 h-8 text-muted-foreground/60 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">No Campaign Opportunities</p>
              <p className="text-xs text-muted-foreground mt-1">AI monitors WhatsApp feeds dynamically to extract these logs.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPlacements.map((p) => (
                <div 
                  key={p.id}
                  className="bg-[#09090b]/40 backdrop-blur border border-border/60 rounded-2xl p-6 hover:border-purple-500/25 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start gap-4 mb-4">
                      <div>
                        <h3 className="text-base font-bold text-foreground">{p.company_name}</h3>
                        <div className="flex items-center gap-1 mt-1 text-xs text-[#a1a1aa] font-mono">
                          <DollarSign size={13} className="text-emerald-400 shrink-0" />
                          <span>Package: <strong className="text-foreground">{p.package || "Not Specified"}</strong></span>
                        </div>
                      </div>
                      {getStatusBadge(p.status)}
                    </div>

                    <div className="space-y-2 mb-6">
                      {p.eligibility && (
                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                          <GraduationCap size={14} className="text-purple-400 mt-0.5 shrink-0" />
                          <span>{p.eligibility}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                        <Calendar size={14} className="text-purple-400 shrink-0" />
                        <span>Deadline: {new Date(p.deadline).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between border-t border-border/40 pt-4 gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleApplied(p.id, p.status)}
                          className={`text-[11px] font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                            p.status === "applied"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/25 hover:bg-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20"
                          }`}
                        >
                          <CheckSquare size={13} />
                          {p.status === "applied" ? "Mark Active" : "Mark Applied"}
                        </button>

                        {p.apply_url && (
                          <a
                            href={p.apply_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121214] hover:bg-[#1c1c1f] text-foreground border border-border/60 transition-all"
                          >
                            <LinkIcon size={12} className="text-purple-400" />
                            Apply Link
                          </a>
                        )}
                      </div>

                      <button
                        onClick={() => handleDelete(p.id)}
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
                  <h3 className="text-lg font-bold text-foreground mb-4">Track Campaign Pipeline</h3>
                  
                  <form onSubmit={handleCreatePlacement} className="space-y-4">
                    <div>
                      <label className="block text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1.5">Company Name</label>
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g. TCS / Infosys"
                        className="w-full bg-[#121214] border border-border/80 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1.5">Package Details</label>
                        <input
                          type="text"
                          value={pkg}
                          onChange={(e) => setPkg(e.target.value)}
                          placeholder="e.g. 7.5 LPA"
                          className="w-full bg-[#121214] border border-border/80 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1.5">Closing Deadline</label>
                        <input
                          type="datetime-local"
                          required
                          value={deadline}
                          onChange={(e) => setDeadline(e.target.value)}
                          className="w-full bg-[#121214] border border-border/80 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1.5">Eligibility Criteria</label>
                      <input
                        type="text"
                        value={eligibility}
                        onChange={(e) => setEligibility(e.target.value)}
                        placeholder="e.g. B.Tech CSE (60% criteria)"
                        className="w-full bg-[#121214] border border-border/80 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1.5">Direct Application URL</label>
                      <input
                        type="url"
                        value={applyUrl}
                        onChange={(e) => setApplyUrl(e.target.value)}
                        placeholder="e.g. https://nextstep.tcs.com"
                        className="w-full bg-[#121214] border border-border/80 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-purple-500"
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
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20 cursor-pointer disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save Pipeline"}
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
