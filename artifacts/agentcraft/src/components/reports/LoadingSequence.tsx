import { useEffect, useState } from 'react';
import { Loader2, FileSearch, Sparkles, BarChart3, FileCheck, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const steps = [
    { id: 1, label: 'Generating Report...', icon: FileSearch },
    { id: 2, label: 'Analyzing Results...', icon: FileCheck },
    { id: 3, label: 'Creating Executive Summary...', icon: Sparkles },
    { id: 4, label: 'Rendering Charts...', icon: BarChart3 },
    { id: 5, label: 'Completed Successfully', icon: CheckCircle },
];

export function LoadingSequence() {
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentStep((prev) => {
                if (prev < steps.length - 1) {
                    return prev + 1;
                }
                return prev;
            });
        }, 400);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed inset-0 bg-[#030303] flex items-center justify-center z-50">
            <div className="w-full max-w-md px-6">
                <div className="text-center mb-12 animate-in fade-in duration-500">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/30 mb-4">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                        Generating Enterprise Report
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Creating your professional executive-ready report...
                    </p>
                </div>

                <div className="space-y-4">
                    {steps.map((step, index) => {
                        const Icon = step.icon;
                        const isActive = index === currentStep;
                        const isCompleted = index < currentStep;

                        return (
                            <div
                                key={step.id}
                                className={cn(
                                    'flex items-center gap-4 p-4 rounded-xl border transition-all duration-300',
                                    isActive && 'bg-primary/10 border-primary/30 scale-105',
                                    isCompleted && 'bg-emerald-500/10 border-emerald-500/30',
                                    !isActive && !isCompleted && 'bg-card border-border opacity-40'
                                )}
                                style={{
                                    animationDelay: `${index * 100}ms`,
                                }}
                            >
                                <div
                                    className={cn(
                                        'flex items-center justify-center w-10 h-10 rounded-lg transition-colors',
                                        isActive && 'bg-primary/20 text-primary',
                                        isCompleted && 'bg-emerald-500/20 text-emerald-400',
                                        !isActive && !isCompleted && 'bg-muted text-muted-foreground'
                                    )}
                                >
                                    {isActive && <Icon className="w-5 h-5 animate-pulse" />}
                                    {isCompleted && <CheckCircle className="w-5 h-5" />}
                                    {!isActive && !isCompleted && <Icon className="w-5 h-5" />}
                                </div>

                                <div className="flex-1">
                                    <p
                                        className={cn(
                                            'font-semibold text-sm transition-colors',
                                            isActive && 'text-primary',
                                            isCompleted && 'text-emerald-400',
                                            !isActive && !isCompleted && 'text-muted-foreground'
                                        )}
                                    >
                                        {step.label}
                                    </p>
                                </div>

                                {isActive && (
                                    <div className="flex gap-1">
                                        {[0, 1, 2].map((i) => (
                                            <span
                                                key={i}
                                                className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                                                style={{ animationDelay: `${i * 150}ms` }}
                                            />
                                        ))}
                                    </div>
                                )}

                                {isCompleted && (
                                    <div className="text-emerald-400">
                                        <CheckCircle className="w-5 h-5" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Progress Bar */}
                <div className="mt-8">
                    <div className="h-2 bg-card rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-300 ease-out"
                            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                        />
                    </div>
                    <p className="text-center text-xs text-muted-foreground mt-2">
                        {Math.round(((currentStep + 1) / steps.length) * 100)}% Complete
                    </p>
                </div>
            </div>
        </div>
    );
}
