/**
 * translateDynamicText — Standalone utility for single-string dynamic translation.
 *
 * Use this when you need to translate a single string outside of a React component
 * (e.g. in utility functions, data processors, or where `useTranslate` is not practical).
 *
 * Features:
 *  - localStorage-backed cache using key pattern: "{text}__{lang}"
 *  - In-memory cache for current session (faster than localStorage)
 *  - Returns the original string immediately; translation is async (fire-and-forget)
 *  - Safe: never mutates the original data; never throws
 *
 * Cache Design:
 *  translationCache[key] = translatedString
 *  Key format: "Rice__hi" | "Oil__te"
 *
 * Usage:
 *  const name = await translateDynamicText('Rice', 'hi');  // 'चावल'
 *  const cat  = await translateDynamicText('Groceries', 'te'); // 'కిరాణా'
 */

// ─── In-Memory Cache ──────────────────────────────────────────────────────────
const memoryCache: Record<string, string> = {};

// ─── Persist / Restore Cache ─────────────────────────────────────────────────
const CACHE_KEY = 'dynamic_translations_v1';

function loadCache(): void {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            Object.assign(memoryCache, parsed);
        }
    } catch {
        // Corrupted cache — start fresh
    }
}

function saveCache(): void {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache));
    } catch {
        // Storage quota or SSR — ignore
    }
}

// Load cache on module init
loadCache();

// ─── Skip Patterns ────────────────────────────────────────────────────────────
const SKIP_PATTERN = /^[\d₹+\-\s().]*$|^\+?[\d\s\-().]{7,}$/;

function shouldSkip(text: string): boolean {
    if (!text || !text.trim()) return true;
    if (SKIP_PATTERN.test(text.trim())) return true;
    return false;
}

// ─── API Base ─────────────────────────────────────────────────────────────────
function getApiBase(): string {
    return (import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:5001/api';
}

// ─── Core Translation Function ────────────────────────────────────────────────

/**
 * Translate a single string to the target language.
 *
 * @param text           The string to translate.
 * @param targetLanguage 'en' | 'hi' | 'te'
 * @returns              Translated string (or original on error/skip).
 */
export async function translateDynamicText(text: string, targetLanguage: string): Promise<string> {
    if (!text || targetLanguage === 'en' || shouldSkip(text)) return text;

    const cacheKey = `${text.trim()}__${targetLanguage}`;
    if (memoryCache[cacheKey]) return memoryCache[cacheKey];

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${getApiBase()}/ai/translate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ text: text.trim(), targetLanguage }),
        });

        if (!res.ok) return text;

        const data = await res.json();
        const translated = data.translatedText || text;

        memoryCache[cacheKey] = translated;
        saveCache();

        return translated;
    } catch {
        return text;
    }
}

/**
 * Translate multiple strings in a single batch API call.
 *
 * @param texts          Array of strings to translate.
 * @param targetLanguage 'en' | 'hi' | 'te'
 * @returns              Map of original → translated string.
 */
export async function batchTranslateDynamic(
    texts: string[],
    targetLanguage: string
): Promise<Record<string, string>> {
    const result: Record<string, string> = {};

    if (targetLanguage === 'en') {
        texts.forEach(t => result[t] = t);
        return result;
    }

    const missing: string[] = [];

    texts.forEach(text => {
        if (!text || shouldSkip(text)) {
            result[text] = text;
            return;
        }
        const cacheKey = `${text.trim()}__${targetLanguage}`;
        if (memoryCache[cacheKey]) {
            result[text] = memoryCache[cacheKey];
        } else {
            missing.push(text);
        }
    });

    if (missing.length === 0) return result;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${getApiBase()}/ai/batch-translate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ texts: missing, targetLanguage }),
        });

        if (!res.ok) {
            missing.forEach(t => result[t] = t);
            return result;
        }

        const data = await res.json();
        const translations: Record<string, string> = data.translations || {};

        Object.entries(translations).forEach(([original, translated]) => {
            result[original] = String(translated);
            const cacheKey = `${original.trim()}__${targetLanguage}`;
            memoryCache[cacheKey] = String(translated);
        });

        // Fallback for any missing translations
        missing.forEach(t => {
            if (!result[t]) result[t] = t;
        });

        saveCache();
    } catch {
        missing.forEach(t => result[t] = t);
    }

    return result;
}

/**
 * Translate text fields on array of objects in-place (display copy only).
 *
 * @param items          Array of data objects from DB.
 * @param fields         Keys to translate.
 * @param targetLanguage Current language.
 * @returns              New array with translated field copies.
 */
export async function translateObjectArray<T extends object>(
    items: T[],
    fields: Array<keyof T>,
    targetLanguage: string
): Promise<T[]> {
    if (targetLanguage === 'en' || !items?.length) return items;

    const allTexts = new Set<string>();
    items.forEach(item => {
        fields.forEach(field => {
            const val = item[field];
            if (typeof val === 'string' && val.trim()) {
                allTexts.add(val.trim());
            }
        });
    });

    if (allTexts.size === 0) return items;

    const translations = await batchTranslateDynamic(Array.from(allTexts), targetLanguage);

    return items.map(item => {
        const newItem = { ...item };
        fields.forEach(field => {
            const val = item[field];
            if (typeof val === 'string' && val.trim() && translations[val.trim()]) {
                // @ts-ignore — safe display copy
                newItem[field] = translations[val.trim()];
            }
        });
        return newItem;
    });
}
