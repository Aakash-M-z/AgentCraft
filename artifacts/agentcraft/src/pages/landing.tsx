import { Link } from "wouter";
import { motion, useScroll, useTransform } from "framer-motion";
import { 
  Terminal, Zap, BrainCircuit, Lock, Play, 
  ArrowRight, Activity, GitBranch, Cpu,
  MessageSquareCode, Globe, Github
} from "lucide-react";

const row1 = [
  { name: "OpenAI", icon: <BrainCircuit size={18} className="text-emerald-400" /> },
  { name: "Slack", icon: <MessageSquareCode size={18} className="text-amber-400" /> },
  { name: "Discord", icon: <Globe size={18} className="text-indigo-400" /> },
  { name: "WhatsApp", icon: <Activity size={18} className="text-green-400" /> },
  { name: "Gmail", icon: <Cpu size={18} className="text-red-400" /> },
  { name: "Notion", icon: <Lock size={18} className="text-slate-300" /> },
  { name: "PostgreSQL", icon: <GitBranch size={18} className="text-blue-400" /> },
  { name: "Redis", icon: <Zap size={18} className="text-red-400" /> },
  { name: "GitHub", icon: <Github size={18} className="text-purple-400" /> },
];

const row2 = [
  { name: "Playwright", icon: <Globe size={18} className="text-cyan-400" /> },
  { name: "Stripe", icon: <Zap size={18} className="text-violet-400" /> },
  { name: "Hubspot", icon: <Activity size={18} className="text-orange-400" /> },
  { name: "Webhooks", icon: <GitBranch size={18} className="text-yellow-400" /> },
  { name: "Google Drive", icon: <Cpu size={18} className="text-emerald-400" /> },
  { name: "Jira", icon: <Lock size={18} className="text-blue-400" /> },
  { name: "Shopify", icon: <Zap size={18} className="text-emerald-300" /> },
  { name: "Airtable", icon: <BrainCircuit size={18} className="text-red-300" /> },
];

export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const y1 = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="min-h-screen bg-[#050507] text-foreground overflow-hidden selection:bg-primary/30 font-sans">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,79,26,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(249,115,22,0.08),transparent_50%)]" />
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
        <div className="absolute top-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#050507]/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-orange-500 p-px shadow-lg shadow-primary/20">
              <div className="w-full h-full bg-black/50 rounded-[7px] flex items-center justify-center backdrop-blur-md">
                <BrainCircuit size={18} className="text-white" />
              </div>
            </div>
            <span className="font-display font-bold text-lg tracking-tight">AgentCraft</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#architecture" className="hover:text-foreground transition-colors">Architecture</a>
            <a href="#performance" className="hover:text-foreground transition-colors">Performance</a>
          </div>

          <div className="flex items-center gap-4">
            <a 
              href="https://github.com/Aakash-M-z/AgentCraft" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center justify-center p-2"
              title="GitHub Repository"
            >
              <Github size={20} />
            </a>
            <Link href="/builder">
              <button className="hidden md:flex px-4 py-2 text-sm font-medium text-white/90 hover:text-white transition-colors cursor-pointer">
                Open Workspace
              </button>
            </Link>
            <Link href="/builder">
              <button className="px-5 py-2 text-sm font-bold bg-white text-black rounded-full hover:scale-105 hover:bg-neutral-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] cursor-pointer">
                Launch App
              </button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-32 pb-20">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 pt-16 pb-32 relative">
          <motion.div 
            style={{ y: y1, opacity }}
            className="absolute right-0 top-0 w-[600px] h-[600px] bg-primary/20 blur-[120px] rounded-full pointer-events-none"
          />
          
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="max-w-4xl"
          >
            <motion.div variants={item} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-primary mb-8 backdrop-blur-md">
              <Zap size={14} />
              <span>v2.0 is live: Groq Llama-3.3 Integration</span>
            </motion.div>

            <motion.h1 variants={item} className="text-6xl md:text-8xl font-display font-extrabold tracking-tighter leading-[1.1] mb-6">
              The OS for <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-500 to-amber-500">
                Autonomous Agents
              </span>
            </motion.h1>

            <motion.p variants={item} className="text-xl md:text-2xl text-muted-foreground font-light mb-10 max-w-2xl leading-relaxed">
              Beyond standard workflows. Orchestrate LLMs, automate browsers, and execute logic at the speed of thought. Code meets no-code without the vendor lock-in.
            </motion.p>

            <motion.div variants={item} className="flex flex-col sm:flex-row items-center gap-4">
              <Link href="/builder">
                <button className="h-14 px-8 rounded-full bg-gradient-to-r from-primary to-orange-600 text-white font-bold text-lg flex items-center gap-2 hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,79,26,0.3)] hover:shadow-[0_0_40px_rgba(255,79,26,0.5)] group cursor-pointer">
                  <Play size={20} className="fill-white group-hover:translate-x-1 transition-transform" />
                  Launch Command Center
                </button>
              </Link>
              <Link href="/life-os">
                <button className="h-14 px-8 rounded-full bg-white/5 border border-white/10 text-white font-medium text-lg flex items-center gap-2 hover:bg-white/10 transition-colors cursor-pointer">
                  Explore Life OS
                  <ArrowRight size={18} />
                </button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Abstract UI Preview */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 1, ease: "easeOut" }}
            className="mt-20 relative rounded-2xl border border-white/10 bg-[#0a0a0c]/80 backdrop-blur-2xl shadow-2xl overflow-hidden aspect-video max-h-[600px] w-full"
          >
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
            <div className="flex h-10 border-b border-white/5 items-center px-4 gap-2 bg-black/40">
              <div className="w-3 h-3 rounded-full bg-rose-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <div className="ml-4 text-xs font-mono text-muted-foreground flex items-center gap-2">
                <Terminal size={12} /> agentcraft-builder
              </div>
            </div>
            
            <div className="relative h-full w-full p-4 md:p-8 overflow-hidden flex items-center justify-center">
               <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none" />
               <div className="w-full max-w-[800px] h-full max-h-[400px] border border-white/5 rounded-xl bg-black/20 flex relative">
                  {/* Decorative workflow nodes */}
                  <div className="hidden md:block absolute top-20 left-10 w-48 h-24 bg-card border border-border rounded-xl shadow-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center"><Activity size={12} className="text-emerald-400" /></div>
                      <span className="text-xs font-semibold">Webhook Input</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full mb-1" />
                    <div className="h-1.5 w-2/3 bg-white/5 rounded-full" />
                  </div>

                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-32 md:left-72 md:transform-none w-56 h-32 bg-card border border-primary/40 rounded-xl shadow-[0_0_20px_rgba(255,79,26,0.15)] p-3 ring-1 ring-primary/20">
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.8)]" />
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center"><BrainCircuit size={12} className="text-primary" /></div>
                      <span className="text-xs font-bold text-primary">Llama 3.3 Router</span>
                    </div>
                    <div className="p-2 bg-black/40 rounded text-[10px] font-mono text-orange-400 mb-2 border border-white/5 overflow-hidden text-ellipsis whitespace-nowrap">
                      {"{ intent: \"schedule\" }"}
                    </div>
                    <div className="flex gap-1 mt-auto">
                      <div className="h-1 w-full bg-primary/40 rounded-full" />
                    </div>
                  </div>

                  <div className="hidden md:block absolute top-16 right-10 w-48 h-24 bg-card border border-border rounded-xl shadow-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded bg-rose-500/20 flex items-center justify-center"><Globe size={12} className="text-rose-400" /></div>
                      <span className="text-xs font-semibold">Browser Automation</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full mb-1" />
                    <div className="h-1.5 w-1/2 bg-white/5 rounded-full" />
                  </div>

                  <div className="hidden md:block absolute bottom-16 right-20 w-48 h-24 bg-card border border-border rounded-xl shadow-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center"><MessageSquareCode size={12} className="text-emerald-400" /></div>
                      <span className="text-xs font-semibold">WhatsApp Sender</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full mb-1" />
                    <div className="h-1.5 w-3/4 bg-white/5 rounded-full" />
                  </div>

                  {/* Edges */}
                  <svg className="hidden md:block absolute inset-0 w-full h-full pointer-events-none">
                    <path d="M 232 120 C 270 120, 270 180, 288 180" fill="none" stroke="rgba(255,79,26,0.6)" strokeWidth="2" strokeDasharray="4 4" className="animate-[dash_1s_linear_infinite]" />
                    <path d="M 512 160 C 550 160, 550 110, 576 110" fill="none" stroke="rgba(255,79,26,0.6)" strokeWidth="2" />
                    <path d="M 512 210 C 550 210, 550 300, 536 300" fill="none" stroke="rgba(255,79,26,0.6)" strokeWidth="2" />
                  </svg>
               </div>
            </div>
          </motion.div>
        </section>

        {/* Values Section */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-24 border-t border-white/5">
          <div className="mb-16 text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">Why AgentCraft?</h2>
            <p className="text-muted-foreground text-lg">
              We built AgentCraft because standard no-code tools are too limiting for AI, and coding everything from scratch is too slow.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard 
              icon={<BrainCircuit className="text-primary" />}
              title="AI-Native Architecture"
              description="Built from the ground up for LLMs. Seamlessly integrate Groq, Llama, OpenAI, and custom local models without wrappers."
            />
            <FeatureCard 
              icon={<GitBranch className="text-cyan-400" />}
              title="Code Meets No-Code"
              description="Visually orchestrate your logic, but drop down into raw Python or JS instantly when you need granular control."
            />
            <FeatureCard 
              icon={<Activity className="text-rose-400" />}
              title="Real-Time Telemetry"
              description="SSE-powered live execution logs. Watch data flow through your nodes in milliseconds. No more refreshing dashboards."
            />
            <FeatureCard 
              icon={<Lock className="text-amber-400" />}
              title="Zero Vendor Lock-in"
              description="Self-host easily. Use your own Redis and Postgres. Total control over your infrastructure and your agents' data."
            />
            <FeatureCard 
              icon={<Globe className="text-emerald-400" />}
              title="Browser Automation"
              description="Built-in Playwright integration. Let your AI agents navigate the real web, scrape dynamic data, and perform actions."
            />
            <FeatureCard 
              icon={<Cpu className="text-violet-400" />}
              title="High-Performance Engine"
              description="Powered by FastAPI async routes and Redis caching. Capable of handling thousands of parallel agent executions."
            />
          </div>
        </section>

        {/* Integrations Section (Infinite Scroll Marquee) */}
        <section className="py-24 border-t border-white/5 bg-[#050507] relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 mb-16 text-center">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-4 tracking-tight">
              Plug AI into your own data & <br/> over 500 integrations
            </h2>
            <p className="text-muted-foreground text-sm md:text-base max-w-2xl mx-auto">
              Use pre-built nodes for common apps. Custom API connections for everything else.
            </p>
          </div>

          <div className="space-y-6 overflow-hidden relative w-full">
            {/* Row 1 (Moving Left) */}
            <div className="marquee-container w-full">
              <div className="animate-marquee gap-4 flex flex-row">
                {[...row1, ...row1, ...row1, ...row1].map((item, idx) => (
                  <div 
                    key={`r1-${idx}`} 
                    className="flex items-center gap-3 px-5 py-3.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors shadow-lg min-w-[170px] justify-start shrink-0"
                  >
                    <div className="w-8 h-8 rounded-lg bg-black border border-white/10 flex items-center justify-center shadow-inner">
                      {item.icon}
                    </div>
                    <span className="text-xs font-semibold text-foreground/90">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Row 2 (Moving Right) */}
            <div className="marquee-container w-full">
              <div className="animate-marquee-reverse gap-4 flex flex-row">
                {[...row2, ...row2, ...row2, ...row2].map((item, idx) => (
                  <div 
                    key={`r2-${idx}`} 
                    className="flex items-center gap-3 px-5 py-3.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors shadow-lg min-w-[170px] justify-start shrink-0"
                  >
                    <div className="w-8 h-8 rounded-lg bg-black border border-white/10 flex items-center justify-center shadow-inner">
                      {item.icon}
                    </div>
                    <span className="text-xs font-semibold text-foreground/90">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link href="/builder">
              <button className="px-6 py-2.5 text-xs font-bold bg-gradient-to-r from-primary to-orange-500 text-white rounded-full hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,79,26,0.2)] cursor-pointer">
                Browse all integrations
              </button>
            </Link>
          </div>
        </section>
        
        {/* CTA Section */}
        <section className="max-w-7xl mx-auto px-6 py-24">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#0a0a0e] to-black p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />
            
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6 relative z-10">Ready to build the future?</h2>
            <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto relative z-10">
              Stop fighting with limited automation tools. Start building autonomous agents that actually understand context.
            </p>
            
            <Link href="/builder">
              <button className="h-14 px-10 rounded-full bg-white text-black font-bold text-lg hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] relative z-10 cursor-pointer">
                Enter Command Center
              </button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 bg-black">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BrainCircuit size={16} />
            <span className="font-semibold text-sm">AgentCraft Platform</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="https://github.com/Aakash-M-z/AgentCraft" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
            <a href="/docs" className="hover:text-foreground transition-colors">Documentation</a>
            <Link href="/life-os"><span className="hover:text-foreground transition-colors cursor-pointer">Life OS</span></Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors relative group overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="w-12 h-12 rounded-xl bg-black border border-white/10 flex items-center justify-center mb-6 shadow-inner relative z-10">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 relative z-10">{title}</h3>
      <p className="text-muted-foreground leading-relaxed text-sm relative z-10">
        {description}
      </p>
    </motion.div>
  );
}
