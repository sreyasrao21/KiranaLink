import express from 'express';
import OpenAI from 'openai';
import { auth } from '../middleware/auth.js';

const router = express.Router();

let openai: OpenAI | null = null;
try {
    if (process.env.OPENAI_API_KEY) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
} catch (e) {
    console.error('OpenAI init failed in AI router:', e);
}

const translationCache = new Map<string, string>();

router.post('/translate', auth, async (req, res) => {
    try {
        const { text, targetLanguage } = req.body;

        if (!text || !targetLanguage) {
            return res.status(400).json({ message: 'Text and targetLanguage are required' });
        }

        if (targetLanguage === 'en') {
            return res.json({ translatedText: text });
        }

        const cacheKey = `${text}_${targetLanguage}`;
        if (translationCache.has(cacheKey)) {
            return res.json({ translatedText: translationCache.get(cacheKey) });
        }

        if (!openai) {
            return res.status(503).json({ message: 'AI Translation service not available' });
        }

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a professional translator for a Kirana/MSME shop application. 
                    Translate the text to ${targetLanguage}.
                    CONSTRAINTS:
                    - Keep the meaning exactly the same.
                    - DO NOT translate numbers, currency symbols (like ₹), dates, phone numbers, customer names, or transaction IDs.
                    - Only translate descriptive text, product names, categories, and UI labels.
                    - Return ONLY the translated string.`
                },
                {
                    role: "user",
                    content: text
                }
            ],
            temperature: 0,
        });

        const translatedText = response.choices[0].message.content?.trim() || text;
        translationCache.set(cacheKey, translatedText);

        res.json({ translatedText });
    } catch (err: any) {
        console.error('Translation error:', err.message);
        res.status(500).json({ message: 'Translation failed' });
    }
});

router.post('/batch-translate', auth, async (req, res) => {
    try {
        const { texts, targetLanguage } = req.body;

        if (!Array.isArray(texts) || !targetLanguage) {
            return res.status(400).json({ message: 'Texts array and targetLanguage are required' });
        }

        if (targetLanguage === 'en') {
            const result: Record<string, string> = {};
            texts.forEach(t => result[t] = t);
            return res.json({ translations: result });
        }

        const translations: Record<string, string> = {};
        const toTranslate: string[] = [];

        texts.forEach(text => {
            const cacheKey = `${text}_${targetLanguage}`;
            if (translationCache.has(cacheKey)) {
                translations[text] = translationCache.get(cacheKey)!;
            } else {
                toTranslate.push(text);
            }
        });

        if (toTranslate.length === 0) {
            return res.json({ translations });
        }

        if (!openai) {
            return res.status(503).json({ message: 'AI Translation service not available' });
        }

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a professional translator for a Kirana/MSME shop application. 
                    Translate the provided list of strings into ${targetLanguage}.
                    CONSTRAINTS:
                    - Keep the meaning exactly the same.
                    - DO NOT translate numbers, currency symbols (₹), dates, phone numbers, customer names, or transaction IDs.
                    - Return a JSON object where keys are the original strings and values are the translations.`
                },
                {
                    role: "user",
                    content: JSON.stringify(toTranslate)
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0,
        });

        const content = response.choices[0].message.content;
        if (content) {
            const batchResult = JSON.parse(content);
            // The AI might return an object where keys are the strings.
            // Let's merge them into our translations object and update cache.
            Object.entries(batchResult).forEach(([original, translated]) => {
                const trans = String(translated);
                translations[original] = trans;
                translationCache.set(`${original}_${targetLanguage}`, trans);
            });
        }

        // Ensure all requested texts have an entry (fallback to original if missing)
        texts.forEach(t => {
            if (!translations[t]) translations[t] = t;
        });

        res.json({ translations });
    } catch (err: any) {
        console.error('Batch translation error:', err.message);
        res.status(500).json({ message: 'Batch translation failed' });
    }
});

export { router as aiRouter };
