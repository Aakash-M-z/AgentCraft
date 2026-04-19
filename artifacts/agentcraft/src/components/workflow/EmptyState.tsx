import { motion } from 'framer-motion';
import { Sparkles, Bot, Server, Play, Wand2, Mail, ArrowRight } from 'lucide-react';
import { useWorkflowStore } from '@/lib/store';
import { generateId } from '@/lib/utils';

type Template = {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    nodes: Array<{ type: string; label: string; x: number; y: number; config?: Record<string, any> }>;
    edges: Array<{ from: number; to: number }>;
};

const TEMPLATES: Template[] = [
    {
        id: 'summarizer',
        name: 'AI Text Summarizer',
        description: 'Input → AI summarizes → Output',
        icon: <Bot size={18} />,
        color: 'from-violet-500/20 to-violet-600/10 border-violet-500/30 hover:border-violet-500/60',
        nodes: [
            { type: 'input', label: 'Text Input', x: 80, y: 200 },
            { type: 'ai_agent', label: 'Summarizer', x: 360, y: 200, config: { instruction: 'Summarize the following text concisely:\n\n{{input}}', model: 'llama-3.3-70b-versatile' } },
            { type: 'output', label: 'Summary Output', x: 640, y: 200 },
        ],
        edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }],
    },
    {
        id: 'api-ai-output',
        name: 'API → AI → Output',
        description: 'Fetch data, process with AI, deliver result',
        icon: <Server size={18} />,
        color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:border-blue-500/60',
        nodes: [
            { type: 'input', label: 'Trigger', x: 80, y: 200 },
            { type: 'api_call', label: 'Fetch Data', x: 320, y: 200, config: { url: 'https://api.example.com/data', method: 'GET' } },
            { type: 'ai_agent', label: 'AI Processor', x: 560, y: 200, config: { instruction: 'Analyze this data and provide insights:\n\n{{input}}' } },
            { type: 'output', label: 'Result', x: 800, y: 200 },
        ],
        edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }],
    },
    {
        id: 'email-automation',
        name: 'Email Automation',
        description: 'AI drafts and sends an email',
        icon: <Mail size={18} />,
        color: 'from-sky-500/20 to-sky-600/10 border-sky-500/30 hover:border-sky-500/60',
        nodes: [
            { type: 'input', label: 'Topic Input', x: 80, y: 200 },
            { type: 'ai_agent', label: 'Email Writer', x: 340, y: 200, config: { instruction: 'Write a professional email about:\n\n{{input}}' } },
            { type: 'email', label: 'Send Email', x: 600, y: 200, config: { subject: 'AI Generated: {{input}}' } },
            { type: 'output', label: 'Confirmation', x: 860, y: 200 },
        ],
        edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }],
    },
    {
        id: 'research-writer',
        name: 'Research & Blog Writer',
        description: 'Plan → Write → Edit → Publish',
        icon: <Wand2 size={18} />,
        color: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 hover:border-amber-500/60',
        nodes: [
            { type: 'input', label: 'Topic', x: 80, y: 200 },
            { type: 'ai_agent', label: 'Planner', x: 300, y: 200, config: { instruction: 'Create a detailed outline for a blog post about:\n\n{{input}}', role: 'planner' } },
            { type: 'ai_agent', label: 'Writer', x: 520, y: 200, config: { instruction: 'Write a full blog post based on this outline:\n\n{{input}}', role: 'executor' } },
            { type: 'ai_agent', label: 'Editor', x: 740, y: 200, config: { instruction: 'Polish and improve this blog post:\n\n{{input}}', role: 'validator' } },
            { type: 'output', label: 'Final Post', x: 960, y: 200 },
        ],
        edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }, { from: 3, to: 4 }],
    },
];

interface EmptyStateProps {
    onOpenAIGenerate: () => void;
}

export function EmptyState({ onOpenAIGenerate }: EmptyStateProps) {
    const { setNodes, setEdges, setWorkflowMeta } = useWorkflowStore();

    const loadTemplate = (template: Template) => {
        const ids = template.nodes.map(() => generateId());
        const nodes = template.nodes.map((n, i) => ({
            id: ids[i],
            type: n.type as any,
            position: { x: n.x, y: n.y },
            data: { label: n.label, config: n.config ?? {} },
        }));
        const edges = template.edges.map((e, i) => ({
            id: `e-${i}`,
            source: ids[e.from],
            target: ids[e.to],
            animated: true,
        }));
        setNodes(nodes);
        setEdges(edges);
        setWorkflowMeta({ name: template.name });
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full h-full flex flex-col items-center justify-center pointer-events-none"
        >
            {/* Center prompt */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-center mb-10 pointer-events-none"
            >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/20 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-violet-500/10">
                    <Play size={28} className="text-violet-400 fill-violet-400/30" />
                </div>
                <h2 className="text-2xl font-display font-bold text-foreground mb-2">Start building your workflow</h2>
                <p className="text-muted-foreground text-sm max-w-xs">
                    Drag nodes from the palette, or pick a template below
                </p>
            </motion.div>

            {/* Templates */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex flex-wrap gap-3 justify-center max-w-2xl px-6 pointer-events-auto"
            >
                {TEMPLATES.map((t, i) => (
                    <motion.button
                        key={t.id}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.25 + i * 0.05 }}
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => loadTemplate(t)}
                        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border bg-gradient-to-r text-sm font-medium text-foreground transition-all duration-200 shadow-lg ${t.color}`}
                    >
                        <span className="opacity-80">{t.icon}</span>
                        <span>{t.name}</span>
                        <ArrowRight size={13} className="opacity-50" />
                    </motion.button>
                ))}

                {/* AI Generate CTA */}
                <motion.button
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onOpenAIGenerate}
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border bg-gradient-to-r from-amber-500/20 to-orange-500/10 border-amber-500/40 hover:border-amber-400/70 text-sm font-medium text-amber-300 transition-all duration-200 shadow-lg shadow-amber-500/10"
                >
                    <Sparkles size={16} />
                    Generate with AI
                    <ArrowRight size={13} className="opacity-50" />
                </motion.button>
            </motion.div>
        </motion.div>
    );
}
