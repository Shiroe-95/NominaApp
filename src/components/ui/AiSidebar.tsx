'use client';

import { useRef, useEffect, useState } from 'react';
import { Bot, Send, X, Activity, CheckCircle2, AlertCircle, BookOpen, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionPerformed {
    herramienta: string;
    exito: boolean;
    resumen: string;
}

interface Message {
    role: 'user' | 'assistant';
    text: string;
    actions?: ActionPerformed[];
}

const TOOL_LABELS: Record<string, string> = {
    listar_reglas: 'Consulta de reglas',
    actualizar_regla: 'Actualización de regla',
    crear_regla: 'Creación de regla',
    eliminar_regla: 'Eliminación de regla',
};

const SUGGESTIONS = [
    'Lista todas las reglas de Colombia',
    'Agrega el campo gross_pay a Colombia 2026',
    'Agrega verificación "Fondo solidaridad: 1% si IBC > 4 SMMLV" a Colombia 2026',
    'Explica cómo se calcula el IBC con la Ley 1393',
    'Crea una regla para Colombia 2027',
    'Quita el cálculo tope_40_no_salarial de Colombia 2025',
];

interface AiSidebarProps {
    context?: string;
}

export default function AiSidebar({ context }: AiSidebarProps = {}) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            text: 'Hola, soy tu Auditor IA de NóminaSmart.\n\nPuedo gestionar las reglas normativas directamente desde aquí: consultarlas, agregar o quitar campos/cálculos/verificaciones, crear nuevas reglas o eliminar existentes.\n\nTambién puedo explicar conceptos de nómina colombiana (IBC, UGPP, prestaciones, horas extras, Ley 1393 y más).',
        },
    ]);
    const [input, setInput] = useState('');
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const handleSend = async (text: string = input) => {
        const trimmed = text.trim();
        if (!trimmed || isLoading) return;

        const updated: Message[] = [...messages, { role: 'user', text: trimmed }];
        setMessages(updated);
        setInput('');
        setIsLoading(true);

        try {
            const apiMessages = updated.slice(1).map((m) => ({ role: m.role, content: m.text }));

            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: apiMessages, context }),
            });

            const data = await res.json() as { reply?: string; actionsPerformed?: ActionPerformed[]; error?: string };

            if (!res.ok) throw new Error(data.error ?? 'Error desconocido');

            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    text: data.reply ?? 'Acción completada.',
                    actions: data.actionsPerformed?.length ? data.actionsPerformed : undefined,
                },
            ]);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', text: 'No pude completar la solicitud. Intenta nuevamente.' },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-40 bg-gradient-to-br from-violet to-violet-dark text-white rounded-2xl p-3.5 shadow-lg shadow-violet/30 transition-all hover:scale-105 hover:shadow-xl hover:shadow-violet/30 active:scale-95 flex items-center gap-2"
                >
                    <Bot className="w-5 h-5" />
                    <span className="text-sm font-semibold pr-0.5">IA</span>
                </button>
            )}

            {isOpen && (
                <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right-full duration-300">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-navy-dark text-white shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/10 p-2 rounded-lg">
                                <Bot className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">Auditor IA</h3>
                                <div className="flex items-center gap-1.5 text-xs text-slate-300">
                                    <Activity className="w-3 h-3 text-emerald-400" />
                                    GPT-4o-mini · Gestión de reglas activa
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={cn('flex flex-col max-w-[90%]', msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start')}
                            >
                                <div
                                    className={cn(
                                        'p-3 rounded-2xl text-sm whitespace-pre-line leading-relaxed',
                                        msg.role === 'user'
                                            ? 'bg-violet text-white rounded-tr-sm'
                                            : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm'
                                    )}
                                >
                                    {msg.text}
                                </div>

                                {/* Action chips — shown after assistant messages that triggered tools */}
                                {msg.actions && msg.actions.length > 0 && (
                                    <div className="mt-2 flex flex-col gap-1.5 w-full">
                                        {msg.actions.map((action, ai) => (
                                            <div
                                                key={ai}
                                                className={cn(
                                                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border',
                                                    action.exito
                                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                                        : 'bg-rose-50 border-rose-200 text-rose-800'
                                                )}
                                            >
                                                {action.exito
                                                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                    : <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                                                <span className="font-semibold shrink-0">
                                                    {TOOL_LABELS[action.herramienta] ?? action.herramienta}:
                                                </span>
                                                <span>{action.resumen}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Suggestions on first welcome message */}
                                {msg.role === 'assistant' && i === 0 && (
                                    <div className="mt-3 flex flex-col gap-1.5 w-full">
                                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mb-0.5">
                                            <Sparkles className="w-3 h-3" /> Sugerencias
                                        </p>
                                        {SUGGESTIONS.map((s) => (
                                            <button
                                                key={s}
                                                disabled={isLoading}
                                                onClick={() => void handleSend(s)}
                                                className="text-left text-xs bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg hover:bg-violet/5 hover:border-violet/30 hover:text-violet transition-colors flex items-center gap-2 group"
                                            >
                                                <BookOpen className="w-3 h-3 text-slate-400 group-hover:text-violet shrink-0" />
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Loading indicator */}
                        {isLoading && (
                            <div className="flex items-center gap-2 mr-auto">
                                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm shadow-sm px-4 py-3 flex items-center gap-2">
                                    <div className="flex gap-1">
                                        {[0, 150, 300].map((delay) => (
                                            <span
                                                key={delay}
                                                className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                                                style={{ animationDelay: `${delay}ms` }}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-xs text-slate-400">Procesando...</span>
                                </div>
                            </div>
                        )}

                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                        <div className="relative flex items-center">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && void handleSend()}
                                placeholder={isLoading ? 'Procesando...' : 'Escribe un mensaje o instrucción...'}
                                disabled={isLoading}
                                className="w-full pr-12 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-violet focus:border-transparent transition-all disabled:opacity-70 disabled:bg-slate-100"
                            />
                            <button
                                onClick={() => void handleSend()}
                                disabled={!input.trim() || isLoading}
                                className="absolute right-2 p-2 bg-violet hover:bg-violet-dark disabled:opacity-50 text-white rounded-full transition-colors flex items-center justify-center h-8 w-8 my-auto top-0 bottom-0"
                            >
                                {isLoading ? (
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Send className="w-3.5 h-3.5" />
                                )}
                            </button>
                        </div>
                        <p className="text-[10px] text-center text-slate-400 mt-2 flex items-center justify-center gap-1">
                            <Bot className="w-3 h-3" /> Verifica los cambios en la página de Reglas Normativas.
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
