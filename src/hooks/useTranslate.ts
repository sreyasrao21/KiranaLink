import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * useTranslate — Translation middleware hook for dynamic database data.
 *
 * Usage:
 *   const translatedProducts = useTranslate(products, ['name', 'category']);
 *   const translatedQueue = useTranslate(queue, ['productId.name', 'suggestedAction']);
 *
 * Rules:
 *   - Only translates when language is NOT 'en'.
 *   - Returns original data immediately; translated version arrives asynchronously.
 *   - Skips translation for fields that look like: phone numbers, IDs, currency, numbers.
 *   - Uses the batchTranslate function from LanguageContext (which has its own cache).
 *   - Keeps the original data object references intact — only creates translated copies.
 *
 * @param data    The array of objects from the database.
 * @param fields  The object keys or paths (e.g. 'productId.name') whose string values should be translated.
 */
export function useTranslate<T extends object>(data: T[], fields: string[]): T[] {
    const { language, batchTranslate } = useLanguage();
    const [translatedData, setTranslatedData] = useState<T[]>(data);

    // Stable serialised key for fields
    const fieldsKey = fields.join(',');
    const prevDataRef = useRef<T[] | null>(null);
    const prevLangRef = useRef<string>('');
    const prevFieldsKeyRef = useRef<string>('');

    // Helper to get nested value
    const getNestedValue = (obj: any, path: string) => {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    };

    // Helper to set nested value on a clone (efficient shallow copies)
    const setNestedValue = (obj: any, path: string, value: string): any => {
        const parts = path.split('.');
        const result = { ...obj };
        let current = result;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            current[part] = { ...current[part] };
            current = current[part];
        }

        current[parts[parts.length - 1]] = value;
        return result;
    };

    useEffect(() => {
        const dataChanged = data !== prevDataRef.current;
        const langChanged = language !== prevLangRef.current;
        const fieldsChanged = fieldsKey !== prevFieldsKeyRef.current;

        if (!dataChanged && !langChanged && !fieldsChanged) return;

        prevDataRef.current = data;
        prevLangRef.current = language;
        prevFieldsKeyRef.current = fieldsKey;

        if (language === 'en' || !data || data.length === 0) {
            setTranslatedData(data);
            return;
        }

        const SKIP_PATTERN = /^[\d₹+\-\s().]*$|^\+?[\d\s\-().]{7,}$/;
        const stringsToTranslate = new Set<string>();

        data.forEach(item => {
            fields.forEach(field => {
                const val = getNestedValue(item, field);
                if (typeof val === 'string' && val.trim() && !SKIP_PATTERN.test(val.trim())) {
                    stringsToTranslate.add(val.trim());
                }
            });
        });

        if (stringsToTranslate.size === 0) {
            setTranslatedData(data);
            return;
        }

        let isMounted = true;

        const translateAsync = async () => {
            try {
                const translations = await batchTranslate(Array.from(stringsToTranslate));

                if (!isMounted) return;

                let overallChanged = false;
                const newData = data.map(item => {
                    let itemChanged = false;
                    let newItem = item;

                    fields.forEach(field => {
                        const val = getNestedValue(item, field);
                        if (typeof val === 'string' && val.trim()) {
                            const translated = translations[val.trim()];
                            if (translated && translated !== val) {
                                newItem = setNestedValue(newItem, field, translated);
                                itemChanged = true;
                            }
                        }
                    });

                    if (itemChanged) overallChanged = true;
                    return itemChanged ? newItem : item;
                });

                if (overallChanged) {
                    setTranslatedData(newData);
                } else {
                    setTranslatedData(data);
                }
            } catch (err) {
                console.warn('[useTranslate] Translation failed, using original data:', err);
                if (isMounted) setTranslatedData(data);
            }
        };

        translateAsync();
        return () => { isMounted = false; };
    }, [data, language, fieldsKey, batchTranslate]);

    return translatedData;
}
