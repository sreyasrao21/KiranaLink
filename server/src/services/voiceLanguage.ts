import OpenAI from 'openai';

export type VoiceLang = 'en' | 'hi' | 'te' | 'ta' | 'mr' | 'bn' | 'ur' | 'mixed';

export type VoiceLangDetection = {
    lang: VoiceLang;
    confidence: number;
    isCodeMixed: boolean;
    source: 'heuristic' | 'llm' | 'fallback';
};

const isOR = (process.env.OPENAI_API_KEY || '').startsWith('sk-or');

const TWILIO_GATHER_LANGUAGE_MAP: Record<VoiceLang, string> = {
    en: 'en-IN',
    hi: 'hi-IN',
    te: 'te-IN',
    ta: 'ta-IN',
    mr: 'mr-IN',
    bn: 'bn-IN',
    ur: 'ur-IN',
    mixed: 'en-IN',
};

const DEEPGRAM_LANGUAGE_MAP: Record<VoiceLang, string> = {
    en: 'en',
    hi: 'hi',
    te: 'te',
    ta: 'ta',
    mr: 'mr',
    bn: 'bn',
    ur: 'ur',
    mixed: 'multi',
};

export function normalizeLanguage(input?: string | null): VoiceLang {
    const value = String(input || '').trim().toLowerCase();
    if (!value) return 'en';
    if (value.startsWith('en')) return 'en';
    if (value.startsWith('hi')) return 'hi';
    if (value.startsWith('te')) return 'te';
    if (value.startsWith('ta')) return 'ta';
    if (value.startsWith('mr')) return 'mr';
    if (value.startsWith('bn')) return 'bn';
    if (value.startsWith('ur')) return 'ur';
    if (value === 'mixed' || value === 'hinglish' || value === 'code-mixed') return 'mixed';
    return 'en';
}

export function getTwilioGatherLanguage(lang: VoiceLang): string {
    return TWILIO_GATHER_LANGUAGE_MAP[lang] || 'en-IN';
}

export function getDeepgramLanguage(lang: VoiceLang): string {
    return DEEPGRAM_LANGUAGE_MAP[lang] || 'multi';
}

export function getVoiceLabel(lang: VoiceLang): string {
    if (lang === 'hi') return 'Hindi';
    if (lang === 'te') return 'Telugu';
    if (lang === 'ta') return 'Tamil';
    if (lang === 'mr') return 'Marathi';
    if (lang === 'bn') return 'Bengali';
    if (lang === 'ur') return 'Urdu';
    if (lang === 'mixed') return 'Mixed';
    return 'English';
}

function heuristicLanguage(text: string): VoiceLangDetection {
    const value = text.toLowerCase();
    if (!value.trim()) {
        return { lang: 'en', confidence: 0.2, isCodeMixed: false, source: 'fallback' };
    }

    const hasDevanagari = /[\u0900-\u097F]/.test(text);
    const hasTelugu = /[\u0C00-\u0C7F]/.test(text);
    const hasTamil = /[\u0B80-\u0BFF]/.test(text);
    const hasBengali = /[\u0980-\u09FF]/.test(text);
    const hasUrduAr = /[\u0600-\u06FF]/.test(text);

    if (hasTelugu) return { lang: 'te', confidence: 0.95, isCodeMixed: false, source: 'heuristic' };
    if (hasTamil) return { lang: 'ta', confidence: 0.95, isCodeMixed: false, source: 'heuristic' };
    if (hasBengali) return { lang: 'bn', confidence: 0.95, isCodeMixed: false, source: 'heuristic' };
    if (hasUrduAr) return { lang: 'ur', confidence: 0.95, isCodeMixed: false, source: 'heuristic' };
    if (hasDevanagari) {
        return { lang: 'hi', confidence: 0.9, isCodeMixed: /\b(pay|tomorrow|today|amount|date)\b/i.test(value), source: 'heuristic' };
    }

    const hindiWords = /(kal|aaj|parso|haan|nahi|abhi|paisa|rupay|tarikh|dunga|dungi)/i.test(value);
    const teluguWords = /(repu|ivala|dabbulu|istanu|ippudu|rendu rojulu|roju)/i.test(value);
    const marathiWords = /(udya|aaj|paise|dein|deto|kadhi)/i.test(value);
    const englishWords = /(today|tomorrow|pay|amount|date|cannot|week|month|full|partial)/i.test(value);

    if (hindiWords && englishWords) {
        return { lang: 'mixed', confidence: 0.72, isCodeMixed: true, source: 'heuristic' };
    }
    if (teluguWords && englishWords) {
        return { lang: 'mixed', confidence: 0.7, isCodeMixed: true, source: 'heuristic' };
    }
    if (hindiWords) return { lang: 'hi', confidence: 0.67, isCodeMixed: false, source: 'heuristic' };
    if (teluguWords) return { lang: 'te', confidence: 0.67, isCodeMixed: false, source: 'heuristic' };
    if (marathiWords) return { lang: 'mr', confidence: 0.64, isCodeMixed: false, source: 'heuristic' };

    return { lang: 'en', confidence: englishWords ? 0.64 : 0.45, isCodeMixed: false, source: 'heuristic' };
}

export async function detectLanguageFromTranscript(text: string): Promise<VoiceLangDetection> {
    const heuristic = heuristicLanguage(text);
    if (heuristic.confidence >= 0.85) return heuristic;

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy_key_for_build') {
        return heuristic;
    }

    try {
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            ...(isOR ? { baseURL: 'https://openrouter.ai/api/v1' } : {})
        });

        const systemPrompt = `Classify language used by a customer in an Indian debt-recovery phone transcript.
Return strict JSON only:
{"lang":"en|hi|te|ta|mr|bn|ur|mixed","confidence":0.0,"isCodeMixed":false}
Rules:
- If clearly mixed Hindi+English or Telugu+English, set lang=mixed and isCodeMixed=true.
- Keep confidence in 0..1.
- No extra keys.`;

        const response = await openai.chat.completions.create({
            model: isOR ? 'openai/gpt-4o-mini' : 'gpt-4o-mini',
            temperature: 0,
            max_tokens: 80,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ]
        });

        const raw = response.choices[0]?.message?.content?.trim() || '{}';
        const parsed = JSON.parse(raw) as { lang?: string; confidence?: number; isCodeMixed?: boolean };
        const lang = normalizeLanguage(parsed.lang);
        const confidence = typeof parsed.confidence === 'number'
            ? Math.max(0, Math.min(1, parsed.confidence))
            : heuristic.confidence;

        return {
            lang,
            confidence,
            isCodeMixed: Boolean(parsed.isCodeMixed) || lang === 'mixed',
            source: 'llm',
        };
    } catch (error) {
        console.warn('[VoiceLanguage] LLM language detection fallback:', error);
        return heuristic;
    }
}
