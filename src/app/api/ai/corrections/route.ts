import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

export interface AiCorrectionSuggestion {
    rowIndex: number;
    field: string;
    currentValue: unknown;
    suggestedValue: unknown;
    reason: string;
}

function getOpenAI() {
    if (!process.env.OPENAI_API_KEY) return null;
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function getGroq() {
    if (!process.env.GROQ_API_KEY) return null;
    return createGroq({ apiKey: process.env.GROQ_API_KEY });
}

export async function POST(req: Request) {
    try {
        const openai = getOpenAI();
        const groq = getGroq();

        if (!openai && !groq) {
            return NextResponse.json({ suggestions: [], error: 'No AI provider configured' });
        }

        const body = await req.json();
        const rows: Record<string, unknown>[] = Array.isArray(body.rows) ? body.rows : [];
        const findings: string[] = Array.isArray(body.findings) ? body.findings : [];
        const headers: string[] = Array.isArray(body.headers) ? body.headers : [];
        const countryCode: string = typeof body.countryCode === 'string' ? body.countryCode : 'CO';
        const year: number = Number(body.year) || 2026;

        if (rows.length === 0) {
            return NextResponse.json({ suggestions: [] });
        }

        const prompt = `Eres un experto en nómina colombiana (${countryCode} ${year}). Analiza las filas de nómina con errores detectados por el motor de validación y sugiere correcciones precisas.

Encabezados del archivo: ${headers.join(', ')}

Filas con errores (por índice):
${rows.map((r, i) => `Fila ${i}: ${JSON.stringify(r)}`).join('\n')}

Hallazgos del motor de validación para estas filas:
${findings.join('\n')}

Para cada error encontrado, sugiere el valor correcto del campo específico.
- Basa tus correcciones en las fórmulas normativas colombianas vigentes
- Solo sugiere cambios donde el valor correcto sea determinable con certeza matemática
- NO sugiertas cambios especulativos
- Los valores sugeridos deben ser numéricos cuando corresponda

Responde ÚNICAMENTE con JSON válido:
{"suggestions":[{"rowIndex":0,"field":"nombre_del_campo","currentValue":"valor_actual","suggestedValue":"valor_correcto","reason":"explicación concisa"}]}

Si no hay correcciones claras posibles, responde: {"suggestions":[]}`;

        let content = '{"suggestions":[]}';

        // Try OpenAI first
        if (openai) {
            try {
                const completion = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: 'json_object' },
                    temperature: 0,
                    max_tokens: 2048,
                });
                content = completion.choices[0]?.message?.content ?? '{"suggestions":[]}';
            } catch (openaiError) {
                console.error('OpenAI corrections error, trying Groq:', openaiError);
            }
        }

        // Fallback to Groq
        if (content === '{"suggestions":[]}' && groq) {
            try {
                const result = await generateText({
                    model: groq('llama-3.3-70b-versatile'),
                    prompt: prompt + '\n\nIMPORTANT: Respond ONLY with valid JSON, no markdown or explanations.',
                    maxTokens: 2048,
                });
                let jsonStr = result.text.trim();
                // Handle potential markdown code blocks
                if (jsonStr.startsWith('```')) {
                    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
                }
                content = jsonStr;
            } catch (groqError) {
                console.error('Groq corrections error:', groqError);
            }
        }

        const parsed = JSON.parse(content) as { suggestions?: AiCorrectionSuggestion[] };
        return NextResponse.json({ suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [] });
    } catch (error) {
        console.error('AI corrections error:', error);
        return NextResponse.json({ suggestions: [] });
    }
}
