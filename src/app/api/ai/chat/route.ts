/**
 * API Route: POST /api/ai/chat
 *
 * Chat conversacional con IA para gestión de reglas normativas de nómina.
 * Soporta function calling (OpenAI) con fallback a generación de texto (Groq).
 *
 * Proveedores de IA (en orden de prioridad):
 * 1. OpenAI (gpt-4o-mini) — soporta tool/function calling para CRUD de reglas.
 * 2. Groq (llama-3.3-70b-versatile) — solo texto, sin herramientas.
 *
 * Herramientas disponibles (solo con OpenAI):
 * - `listar_reglas` — Consulta reglas por país/año.
 * - `actualizar_regla` — Modifica campos, cálculos o verificaciones de una regla.
 * - `crear_regla` — Crea una nueva regla normativa.
 * - `eliminar_regla` — Elimina una regla (requiere confirmación del usuario).
 *
 * Body esperado (JSON):
 * - `messages` (ChatMessage[], requerido) — Historial de conversación.
 * - `context` (string, opcional) — Contexto del dashboard para enriquecer respuestas.
 *
 * Respuesta exitosa (200):
 * ```json
 * { "reply": "string", "actionsPerformed": [{ "herramienta": "string", "exito": boolean, "resumen": "string" }] }
 * ```
 *
 * Errores:
 * - 400 — `messages` no es un array válido.
 * - 500 — Error interno del proveedor de IA.
 */
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth, applyRateLimit, RATE_LIMITS } from '@/lib/api/guard';

/**
 * Inicializa el cliente de OpenAI si la API key está configurada.
 * @returns Instancia de OpenAI o null si no hay key.
 */
function getOpenAI() {
    if (!process.env.OPENAI_API_KEY) return null;
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/**
 * Inicializa el proveedor de Groq si la API key está configurada.
 * @returns Proveedor Groq o null si no hay key.
 */
function getGroq() {
    if (!process.env.GROQ_API_KEY) return null;
    return createGroq({ apiKey: process.env.GROQ_API_KEY });
}

/**
 * Verifica si al menos un proveedor de IA está disponible.
 * @returns `true` si OPENAI_API_KEY o GROQ_API_KEY están definidas.
 */
function isAIAvailable() {
    return !!(process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY);
}

/** Mensaje individual del chat. */
interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

/** Registro de una acción ejecutada por una herramienta durante el chat. */
export interface ActionPerformed {
    herramienta: string;
    exito: boolean;
    resumen: string;
}

/**
 * Extrae el mensaje de un error desconocido de forma segura.
 *
 * @param error - El error capturado (tipo desconocido).
 * @param fallback - Mensaje por defecto si no se puede extraer uno del error.
 * @returns El mensaje de error como string.
 */
function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'listar_reglas',
            description: 'Lista todas las reglas normativas configuradas en el sistema. Úsala cuando el usuario quiera ver qué reglas existen, o las reglas de un país/año específico.',
            parameters: {
                type: 'object',
                properties: {
                    countryCode: {
                        type: 'string',
                        description: 'Código de país (CO, MX). Omitir para listar todas.',
                    },
                    ruleYear: {
                        type: 'number',
                        description: 'Año de la regla (ej: 2026). Omitir para listar todos los años.',
                    },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'actualizar_regla',
            description: 'Modifica una regla normativa existente: agrega o quita campos requeridos, cálculos o verificaciones normativas. También puede cambiar la etiqueta. Úsala cuando el usuario pida agregar, quitar o modificar elementos de una regla.',
            parameters: {
                type: 'object',
                properties: {
                    countryCode: { type: 'string', description: 'Código de país (CO, MX)' },
                    ruleYear: { type: 'number', description: 'Año de la regla (ej: 2026)' },
                    nuevaEtiqueta: { type: 'string', description: 'Nueva etiqueta para la regla (opcional)' },
                    agregarCampos: {
                        type: 'array', items: { type: 'string' },
                        description: 'Campos a agregar a los campos requeridos (ej: ["overtime_hours_day"])',
                    },
                    quitarCampos: {
                        type: 'array', items: { type: 'string' },
                        description: 'Campos a quitar de los campos requeridos',
                    },
                    agregarCalculos: {
                        type: 'array', items: { type: 'string' },
                        description: 'Cálculos a agregar a los cálculos requeridos',
                    },
                    quitarCalculos: {
                        type: 'array', items: { type: 'string' },
                        description: 'Cálculos a quitar de los cálculos requeridos',
                    },
                    agregarVerificaciones: {
                        type: 'array', items: { type: 'string' },
                        description: 'Verificaciones normativas a agregar (texto descriptivo, ej: "Fondo solidaridad: 1% si IBC > 4 SMMLV")',
                    },
                    quitarVerificaciones: {
                        type: 'array', items: { type: 'string' },
                        description: 'Texto parcial de verificaciones a quitar (se eliminan las que contengan este texto)',
                    },
                },
                required: ['countryCode', 'ruleYear'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'crear_regla',
            description: 'Crea una nueva regla normativa completa para un país y año que aún no exista en el sistema.',
            parameters: {
                type: 'object',
                properties: {
                    countryCode: { type: 'string', description: 'Código de país (CO, MX)' },
                    ruleYear: { type: 'number', description: 'Año de la regla' },
                    etiqueta: { type: 'string', description: 'Nombre descriptivo (ej: "UGPP Colombia 2027")' },
                    camposRequeridos: {
                        type: 'array', items: { type: 'string' },
                        description: 'Lista de campos obligatorios para esta regla',
                    },
                    calculosRequeridos: {
                        type: 'array', items: { type: 'string' },
                        description: 'Lista de cálculos obligatorios para certificar',
                    },
                    verificaciones: {
                        type: 'array', items: { type: 'string' },
                        description: 'Lista de verificaciones normativas aplicables',
                    },
                },
                required: ['countryCode', 'ruleYear', 'etiqueta'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'eliminar_regla',
            description: 'Elimina permanentemente una regla normativa. Solo usar si el usuario lo confirma de forma explícita.',
            parameters: {
                type: 'object',
                properties: {
                    countryCode: { type: 'string', description: 'Código de país (CO, MX)' },
                    ruleYear: { type: 'number', description: 'Año de la regla a eliminar' },
                },
                required: ['countryCode', 'ruleYear'],
            },
        },
    },
];

// ── Tool executors ────────────────────────────────────────────────────────────

/**
 * Lista reglas normativas de la tabla `country_year_rules`.
 * Filtra opcionalmente por código de país y/o año.
 *
 * @param args - Filtros opcionales: countryCode (ISO alpha-2), ruleYear.
 * @returns Resultado con éxito/fallo, resumen y texto formateado de las reglas.
 */
async function toolListarReglas(args: { countryCode?: string; ruleYear?: number }): Promise<{ success: boolean; resumen: string; result: string }> {
    const supabase = createAdminClient();
    let query = supabase
        .from('country_year_rules')
        .select('country_code, rule_year, label, required_fields, required_calculations, checks')
        .order('country_code')
        .order('rule_year');

    if (args.countryCode) query = query.eq('country_code', args.countryCode.toUpperCase());
    if (args.ruleYear) query = query.eq('rule_year', args.ruleYear);

    const { data, error } = await query;
    if (error || !data) return { success: false, resumen: 'Error al leer reglas', result: 'Error al leer reglas de la base de datos.' };

    if (data.length === 0) return { success: true, resumen: 'Sin reglas', result: 'No hay reglas configuradas para ese filtro.' };

    const text = data.map((r) => {
        const fields = (r.required_fields as string[]).join(', ');
        const calcs = (r.required_calculations as string[]).join(', ');
        const checkCount = (r.checks as string[]).length;
        return `• ${r.label} (${r.country_code} - ${r.rule_year})\n  Campos: ${fields || 'ninguno'}\n  Cálculos: ${calcs || 'ninguno'}\n  Verificaciones: ${checkCount}`;
    }).join('\n\n');

    return { success: true, resumen: `${data.length} regla(s) encontrada(s)`, result: text };
}

/**
 * Actualiza una regla normativa existente. Permite agregar/quitar campos requeridos,
 * cálculos, verificaciones y cambiar la etiqueta.
 *
 * @param args - Datos de la regla a modificar (countryCode y ruleYear requeridos).
 * @returns Resultado con detalle de los cambios aplicados.
 */
async function toolActualizarRegla(args: {
    countryCode: string;
    ruleYear: number;
    nuevaEtiqueta?: string;
    agregarCampos?: string[];
    quitarCampos?: string[];
    agregarCalculos?: string[];
    quitarCalculos?: string[];
    agregarVerificaciones?: string[];
    quitarVerificaciones?: string[];
}): Promise<{ success: boolean; resumen: string; result: string }> {
    const supabase = createAdminClient();
    const cc = args.countryCode.toUpperCase();

    const { data: current, error: fetchErr } = await supabase
        .from('country_year_rules')
        .select('label, required_fields, required_calculations, checks')
        .eq('country_code', cc)
        .eq('rule_year', args.ruleYear)
        .single();

    if (fetchErr || !current) {
        return { success: false, resumen: 'Regla no encontrada', result: `No existe regla para ${cc} ${args.ruleYear}. Créala primero.` };
    }

    let fields = current.required_fields as string[];
    let calcs = current.required_calculations as string[];
    let checks = current.checks as string[];
    const changes: string[] = [];

    if (args.agregarCampos?.length) {
        const nuevos = args.agregarCampos.filter((f) => !fields.includes(f));
        fields = [...fields, ...nuevos];
        if (nuevos.length) changes.push(`+${nuevos.length} campo(s): ${nuevos.join(', ')}`);
    }
    if (args.quitarCampos?.length) {
        const prevLen = fields.length;
        fields = fields.filter((f) => !args.quitarCampos!.includes(f));
        if (fields.length < prevLen) changes.push(`-${prevLen - fields.length} campo(s)`);
    }
    if (args.agregarCalculos?.length) {
        const nuevos = args.agregarCalculos.filter((c) => !calcs.includes(c));
        calcs = [...calcs, ...nuevos];
        if (nuevos.length) changes.push(`+${nuevos.length} cálculo(s): ${nuevos.join(', ')}`);
    }
    if (args.quitarCalculos?.length) {
        const prevLen = calcs.length;
        calcs = calcs.filter((c) => !args.quitarCalculos!.includes(c));
        if (calcs.length < prevLen) changes.push(`-${prevLen - calcs.length} cálculo(s)`);
    }
    if (args.agregarVerificaciones?.length) {
        const nuevas = args.agregarVerificaciones.filter((v) => !checks.some((c) => c.toLowerCase() === v.toLowerCase()));
        checks = [...checks, ...nuevas];
        if (nuevas.length) changes.push(`+${nuevas.length} verificación(es)`);
    }
    if (args.quitarVerificaciones?.length) {
        const prevLen = checks.length;
        checks = checks.filter((c) => !args.quitarVerificaciones!.some((q) => c.toLowerCase().includes(q.toLowerCase())));
        if (checks.length < prevLen) changes.push(`-${prevLen - checks.length} verificación(es)`);
    }
    if (args.nuevaEtiqueta) changes.push(`etiqueta → "${args.nuevaEtiqueta}"`);

    const { error: updateErr } = await supabase
        .from('country_year_rules')
        .update({
            label: args.nuevaEtiqueta ?? current.label,
            required_fields: fields,
            required_calculations: calcs,
            checks,
            updated_at: new Date().toISOString(),
        })
        .eq('country_code', cc)
        .eq('rule_year', args.ruleYear);

    if (updateErr) return { success: false, resumen: 'Error al guardar', result: updateErr.message };

    const resumen = changes.length ? `Regla ${cc} ${args.ruleYear} actualizada: ${changes.join(', ')}` : 'Sin cambios aplicados.';
    return { success: true, resumen, result: resumen };
}

/**
 * Crea una nueva regla normativa (o la reemplaza si ya existe, vía upsert).
 *
 * @param args - Datos de la regla: countryCode, ruleYear, etiqueta (requeridos),
 *               camposRequeridos, calculosRequeridos, verificaciones (opcionales).
 * @returns Resultado con confirmación de creación.
 */
async function toolCrearRegla(args: {
    countryCode: string;
    ruleYear: number;
    etiqueta: string;
    camposRequeridos?: string[];
    calculosRequeridos?: string[];
    verificaciones?: string[];
}): Promise<{ success: boolean; resumen: string; result: string }> {
    const supabase = createAdminClient();
    const cc = args.countryCode.toUpperCase();

    const { error } = await supabase.from('country_year_rules').upsert(
        {
            country_code: cc,
            rule_year: args.ruleYear,
            label: args.etiqueta,
            required_fields: args.camposRequeridos ?? [],
            required_calculations: args.calculosRequeridos ?? [],
            checks: args.verificaciones ?? [],
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'country_code,rule_year' }
    );

    if (error) return { success: false, resumen: 'Error al crear', result: error.message };
    return {
        success: true,
        resumen: `Regla "${args.etiqueta}" creada para ${cc} ${args.ruleYear}`,
        result: `Regla "${args.etiqueta}" creada correctamente con ${args.camposRequeridos?.length ?? 0} campos, ${args.calculosRequeridos?.length ?? 0} cálculos y ${args.verificaciones?.length ?? 0} verificaciones.`,
    };
}

/**
 * Elimina permanentemente una regla normativa de la base de datos.
 *
 * @param args - countryCode y ruleYear de la regla a eliminar.
 * @returns Resultado con confirmación de eliminación.
 */
async function toolEliminarRegla(args: { countryCode: string; ruleYear: number }): Promise<{ success: boolean; resumen: string; result: string }> {
    const supabase = createAdminClient();
    const cc = args.countryCode.toUpperCase();

    const { error } = await supabase
        .from('country_year_rules')
        .delete()
        .eq('country_code', cc)
        .eq('rule_year', args.ruleYear);

    if (error) return { success: false, resumen: 'Error al eliminar', result: error.message };
    return { success: true, resumen: `Regla ${cc} ${args.ruleYear} eliminada`, result: `La regla ${cc} ${args.ruleYear} fue eliminada permanentemente.` };
}

/**
 * Dispatcher central de herramientas. Parsea los argumentos JSON y delega
 * la ejecución a la función correspondiente según el nombre de la herramienta.
 *
 * @param name - Nombre de la herramienta (debe coincidir con las definiciones en TOOLS).
 * @param argsJson - Argumentos serializados como JSON string.
 * @returns Resultado estandarizado con success, resumen y result.
 */
async function executeTool(name: string, argsJson: string): Promise<{ success: boolean; resumen: string; result: string }> {
    try {
        const args = JSON.parse(argsJson) as Record<string, unknown>;
        switch (name) {
            case 'listar_reglas':
                return toolListarReglas(args as Parameters<typeof toolListarReglas>[0]);
            case 'actualizar_regla':
                return toolActualizarRegla(args as Parameters<typeof toolActualizarRegla>[0]);
            case 'crear_regla':
                return toolCrearRegla(args as Parameters<typeof toolCrearRegla>[0]);
            case 'eliminar_regla':
                return toolEliminarRegla(args as Parameters<typeof toolEliminarRegla>[0]);
            default:
                return { success: false, resumen: 'Herramienta desconocida', result: `Herramienta "${name}" no implementada.` };
        }
    } catch (err) {
        return { success: false, resumen: 'Error de ejecución', result: getErrorMessage(err, 'Error al ejecutar herramienta') };
    }
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres el asistente de IA de NóminaSmart, experto en nómina colombiana y mexicana (UGPP, PILA, DIAN, Código Sustantivo del Trabajo).

CAPACIDADES DE GESTIÓN:
Tienes acceso a herramientas para gestionar las reglas normativas directamente desde este chat:
- listar_reglas: ver las reglas configuradas
- actualizar_regla: agregar/quitar campos, cálculos o verificaciones de una regla existente
- crear_regla: crear una nueva regla para un país/año
- eliminar_regla: eliminar una regla (solo si el usuario lo confirma explícitamente)

INSTRUCCIONES:
- Responde SIEMPRE en español, de forma clara y concisa.
- Cuando el usuario pida modificar una regla, usa las herramientas directamente — no le pidas que vaya a otra página.
- Para acciones destructivas (eliminar), pide confirmación antes de ejecutar.
- Al actualizar una regla, confirma qué cambios se aplicaron.
- Para explicaciones de conceptos (IBC, UGPP, prestaciones, ley 1393, etc.) responde directamente sin herramientas.
- Usa listas cuando sea útil. Sé conciso pero completo.`;

// ── Main handler ──────────────────────────────────────────────────────────────

/**
 * POST /api/ai/chat — Procesa un mensaje del chat de IA.
 *
 * Flujo con OpenAI (function calling):
 * 1. Envía el historial + system prompt al modelo.
 * 2. Si el modelo solicita tool_calls, ejecuta cada herramienta.
 * 3. Envía los resultados de vuelta al modelo para generar la respuesta final.
 *
 * Flujo con Groq (fallback, solo texto):
 * 1. Toma el último mensaje del usuario.
 * 2. Genera una respuesta de texto sin herramientas.
 *
 * @param req - Request HTTP con body JSON `{ messages: ChatMessage[], context?: string }`.
 * @returns JSON `{ reply: string, actionsPerformed: ActionPerformed[] }` o `{ error: string }`.
 */
export async function POST(req: Request) {
    const rl = applyRateLimit(req, 'ai/chat', RATE_LIMITS.aiChat);
    if (rl) return rl;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    try {
        if (!isAIAvailable()) {
            return NextResponse.json({ 
                reply: 'El servicio de IA no está configurado. Configura OPENAI_API_KEY o GROQ_API_KEY para habilitar esta funcionalidad.',
                actionsPerformed: [] 
            });
        }

        const { messages, context } = await req.json() as { messages: ChatMessage[], context?: string };
        if (!Array.isArray(messages)) {
            return NextResponse.json({ error: 'messages es requerido' }, { status: 400 });
        }

        const dynamicSystemPrompt = context
            ? `${SYSTEM_PROMPT}\n\nCONTEXTO ACTUAL DEL DASHBOARD:\n${context}\n\nUsa esta información para responder a las preguntas del usuario sobre el estado actual de la nómina y certificación.`
            : SYSTEM_PROMPT;

        const openai = getOpenAI();
        const groq = getGroq();
        const actionsPerformed: ActionPerformed[] = [];

        // Try OpenAI first (supports function calling)
        if (openai) {
            const systemMsg: OpenAI.Chat.Completions.ChatCompletionMessageParam = { role: 'system', content: dynamicSystemPrompt };
            const historyMsgs: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = messages.map((m) => ({
                role: m.role,
                content: m.content,
            }));

            const conversationMsgs: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [systemMsg, ...historyMsgs];

            // First call — may return tool_calls
            const firstResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: conversationMsgs,
                tools: TOOLS,
                tool_choice: 'auto',
                temperature: 0.3,
                max_tokens: 1000,
            });

            const firstChoice = firstResponse.choices[0];

            if (firstChoice?.finish_reason === 'tool_calls' && firstChoice.message.tool_calls?.length) {
                // Add assistant's tool_calls message
                conversationMsgs.push(firstChoice.message);

                // Execute each tool call
                for (const toolCall of firstChoice.message.tool_calls) {
                    if (!('function' in toolCall)) continue;
                    const fnCall = toolCall as { id: string; function: { name: string; arguments: string } };
                    const toolResult = await executeTool(fnCall.function.name, fnCall.function.arguments);

                    actionsPerformed.push({
                        herramienta: fnCall.function.name,
                        exito: toolResult.success,
                        resumen: toolResult.resumen,
                    });

                    conversationMsgs.push({
                        role: 'tool',
                        tool_call_id: fnCall.id,
                        content: toolResult.result,
                    });
                }

                // Second call — get final natural language response
                const secondResponse = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: conversationMsgs,
                    temperature: 0.3,
                    max_tokens: 800,
                });

                const reply = secondResponse.choices[0]?.message?.content ?? 'Acción completada.';
                return NextResponse.json({ reply, actionsPerformed });
            }

            // No tool calls — plain response
            const reply = firstChoice?.message?.content ?? 'No pude procesar la solicitud.';
            return NextResponse.json({ reply, actionsPerformed: [] });
        }

        // Fallback to Groq (no function calling, just text generation)
        if (groq) {
            const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content ?? '';
            
            const result = await generateText({
                model: groq('llama-3.3-70b-versatile'),
                system: dynamicSystemPrompt,
                prompt: lastUserMessage,
                maxTokens: 1000,
            });

            return NextResponse.json({ reply: result.text, actionsPerformed: [] });
        }

        return NextResponse.json({ 
            reply: 'No hay proveedor de IA disponible.',
            actionsPerformed: [] 
        });
    } catch (error: unknown) {
        console.error('Chat error:', error);
        return NextResponse.json({ error: getErrorMessage(error, 'Error en el chat de IA') }, { status: 500 });
    }
}
