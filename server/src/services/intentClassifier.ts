import OpenAI from 'openai';

const isOR = (process.env.OPENAI_API_KEY || '').startsWith('sk-or');
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy_key_for_build',
    ...(isOR ? { baseURL: "https://openrouter.ai/api/v1" } : {})
});

export type Intent = 'PAYMENT_PROMISED' | 'EXTENSION_REQUESTED' | 'DISPUTE' | 'UNKNOWN';

export interface IntentAnalysisResult {
    intent: Intent;
    promisedDate: Date | null;
    confidence: number;
    needsConfirmation: boolean;
    normalizedText: string;
}

function parseNaturalPromiseDate(messageBody: string): Date | null {
    const text = messageBody.toLowerCase();
    const now = new Date();

    if (text.includes('today') || text.includes('aaj') || text.includes('ivala')) {
        return now;
    }

    if (text.includes('tomorrow') || text.includes('kal') || text.includes('repu') || text.includes('repu') || text.includes('tom')) {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        return d;
    }

    if (text.includes('day after tomorrow') || text.includes('parso') || text.includes('marnadu')) {
        const d = new Date(now);
        d.setDate(d.getDate() + 2);
        return d;
    }

    const inDaysMatch = text.match(/(?:in|after)?\s*(\d{1,2})\s*(?:day|days|din|roj|roju)/);
    if (inDaysMatch && inDaysMatch[1]) {
        const days = Number.parseInt(inDaysMatch[1], 10);
        if (days > 0 && days <= 30) {
            const d = new Date(now);
            d.setDate(d.getDate() + days);
            return d;
        }
    }

    const ddMatch = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b(?:\s*(?:tarikh|date|ko))?/);
    if (ddMatch && ddMatch[1]) {
        const day = Number.parseInt(ddMatch[1], 10);
        if (day >= 1 && day <= 31) {
            const d = new Date(now);
            d.setDate(day);
            if (d < now) {
                d.setMonth(d.getMonth() + 1);
            }
            return d;
        }
    }

    const weekdayMap: Record<string, number> = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
    };

    for (const [dayName, dayIndex] of Object.entries(weekdayMap)) {
        if (text.includes(dayName)) {
            const currentDay = now.getDay();
            let diff = dayIndex - currentDay;
            if (diff <= 0) diff += 7;
            const d = new Date(now);
            d.setDate(d.getDate() + diff);
            return d;
        }
    }

    return null;
}

export async function classifyIntent(messageBody: string): Promise<Intent> {
    const systemPrompt = `You are a debt collection assistant intent classifier.
    Read the following incoming customer message and classify its intent.
    You MUST respond with exactly one of these strings, and absolutely nothing else:
    PAYMENT_PROMISED
    EXTENSION_REQUESTED
    DISPUTE
    UNKNOWN

    If they explicitly promise to pay soon (e.g. "I will pay tomorrow", "Paying shortly", "Sent the money"): PAYMENT_PROMISED
    If they ask for more time or a delay (e.g. "Can I pay next week?", "Need a few days"): EXTENSION_REQUESTED
    If they disagree with the bill (e.g. "I already paid this!", "This amount is wrong"): DISPUTE
    If it's anything else, generic, or unintelligible: UNKNOWN
    `;

    try {
        if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'dummy_key_for_build') {
            const response = await openai.chat.completions.create({
                model: isOR ? 'openai/gpt-4o-mini' : 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: messageBody }
                ],
                max_tokens: 10,
                temperature: 0.1,
            });

            const rawIntent = response.choices[0].message?.content?.trim().toUpperCase() || 'UNKNOWN';

            if (['PAYMENT_PROMISED', 'EXTENSION_REQUESTED', 'DISPUTE', 'UNKNOWN'].includes(rawIntent)) {
                return rawIntent as Intent;
            }
            return 'UNKNOWN';

        } else {
            // Local fallback logic if API key isn't present
            const lowerMsg = messageBody.toLowerCase();
            if (lowerMsg.includes('pay') || lowerMsg.includes('sent') || lowerMsg.includes('done')) {
                if (lowerMsg.includes('wait') || lowerMsg.includes('next') || lowerMsg.includes('later')) {
                    return 'EXTENSION_REQUESTED';
                }
                return 'PAYMENT_PROMISED';
            }
            if (lowerMsg.includes('wrong') || lowerMsg.includes('already') || lowerMsg.includes('mistake')) {
                return 'DISPUTE';
            }
            return 'UNKNOWN';
        }
    } catch (error) {
        console.error('Intent Classification Error:', error);
        return 'UNKNOWN';
    }
}

export async function classifyIntentAndPromise(messageBody: string): Promise<IntentAnalysisResult> {
    const normalizedText = messageBody.trim();

    const fallback = async (): Promise<IntentAnalysisResult> => {
        const intent = await classifyIntent(messageBody);
        const promisedDate = parseNaturalPromiseDate(messageBody);
        const confidence = promisedDate ? 0.82 : 0.68;
        return {
            intent,
            promisedDate,
            confidence,
            needsConfirmation: confidence < 0.75,
            normalizedText,
        };
    };

    try {
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy_key_for_build') {
            return fallback();
        }

        const systemPrompt = `You are an intent and payment-date extraction engine for multilingual Indian debt-recovery calls.
Return ONLY strict JSON with this schema:
{
  "intent": "PAYMENT_PROMISED" | "EXTENSION_REQUESTED" | "DISPUTE" | "UNKNOWN",
  "promisedDate": string | null,
  "confidence": number,
  "needsConfirmation": boolean
}

Rules:
- Understand English, Hinglish, Hindi words (kal, parso, aaj), Telugu words (repu/ivala), mixed sentences.
- If customer promises to pay and gives a date/time window, set promisedDate to ISO-8601 date string.
- If extension requested with date, set intent EXTENSION_REQUESTED and date.
- If they dispute amount/payment, intent DISPUTE.
- If date is unclear, promisedDate=null and needsConfirmation=true.
- confidence is 0..1.`;

        const response = await openai.chat.completions.create({
            model: isOR ? 'openai/gpt-4o-mini' : 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: normalizedText }
            ],
            max_tokens: 120,
            temperature: 0.1,
        });

        const raw = response.choices[0].message?.content?.trim() || '{}';
        const parsed = JSON.parse(raw) as {
            intent?: Intent;
            promisedDate?: string | null;
            confidence?: number;
            needsConfirmation?: boolean;
        };

        const intent = parsed.intent && ['PAYMENT_PROMISED', 'EXTENSION_REQUESTED', 'DISPUTE', 'UNKNOWN'].includes(parsed.intent)
            ? parsed.intent
            : await classifyIntent(messageBody);

        const llmDate = parsed.promisedDate ? new Date(parsed.promisedDate) : null;
        const ruleDate = parseNaturalPromiseDate(messageBody);
        const promisedDate = llmDate && !Number.isNaN(llmDate.getTime()) ? llmDate : ruleDate;
        const confidence = typeof parsed.confidence === 'number'
            ? Math.max(0, Math.min(1, parsed.confidence))
            : promisedDate
                ? 0.84
                : 0.7;

        return {
            intent,
            promisedDate,
            confidence,
            needsConfirmation: typeof parsed.needsConfirmation === 'boolean' ? parsed.needsConfirmation : confidence < 0.75,
            normalizedText,
        };
    } catch (error) {
        console.error('Intent Analysis Error:', error);
        return fallback();
    }
}
