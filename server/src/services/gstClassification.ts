import OpenAI from 'openai';
import { GSTProduct } from '../models/GSTProduct.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Types ─────────────────────────────────────────────────────────────────────
export interface GSTClassification {
    name: string;
    normalizedName: string;
    hsnCode: string;
    gstRate: number;
    category: string;
}

// ── Normalize a product name for DB lookup ────────────────────────────────────
export function normalizeName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// ── Core Classification Service ───────────────────────────────────────────────
export async function classifyProduct(productName: string): Promise<GSTClassification> {
    const normalized = normalizeName(productName);

    // 1. Check DB cache first
    const existing = await GSTProduct.findOne({ normalizedName: normalized });
    if (existing) {
        return {
            name: productName,
            normalizedName: existing.normalizedName,
            hsnCode: existing.hsnCode,
            gstRate: existing.gstRate,
            category: existing.category,
        };
    }

    // 2. Also check by partial match (handles "Amul Butter 500g" -> "amul butter")
    const words = normalized.split(' ').filter(w => w.length > 2);
    if (words.length > 0) {
        const partialMatch = await GSTProduct.findOne({
            normalizedName: { $in: words }
        });
        if (partialMatch) {
            return {
                name: productName,
                normalizedName: partialMatch.normalizedName,
                hsnCode: partialMatch.hsnCode,
                gstRate: partialMatch.gstRate,
                category: partialMatch.category,
            };
        }
    }

    // 3. Call OpenAI GPT-4o-mini
    const result = await classifyViaOpenAI(productName, normalized);

    // 4. Persist to DB for future lookups
    try {
        await GSTProduct.create({
            normalizedName: result.normalizedName,
            hsnCode: result.hsnCode,
            gstRate: result.gstRate,
            category: result.category,
        });
    } catch (e: any) {
        // Duplicate key is fine — another request may have already inserted it
        if (e.code !== 11000) console.error('[GST] Failed to cache classification:', e.message);
    }

    return result;
}

// ── OpenAI classification ─────────────────────────────────────────────────────
async function classifyViaOpenAI(productName: string, normalized: string): Promise<GSTClassification> {
    const prompt = `You are an Indian GST expert. Classify the following Smart Dukaan/grocery product for GST compliance.

Product name: "${productName}"

Return ONLY a valid JSON object with exactly these fields (no markdown, no extra text):
{
  "name": "<original product name>",
  "normalizedName": "<lowercase, simplified name without brand/size e.g. 'basmati rice'>",
  "hsnCode": "<4-digit HSN code>",
  "gstRate": <GST percentage as number: 0, 5, 12, 18, or 28>,
  "category": "<product category e.g. 'Food & Beverages', 'Spices', 'Dairy', 'Cleaning', etc.>"
}

Indian GST rules for common Smart Dukaan items:
- Unbranded food grains, pulses, flour: 0%
- Branded/packaged food: 5%
- Processed food, spices: 5%
- Dairy (milk, curd, paneer): 0% or 5%
- Edible oils: 5%
- Tea, coffee: 5%
- Cleaning products: 18%
- Personal care: 18%
- Beverages (aerated): 28%`;

    let raw = '';
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
            max_tokens: 200,
            response_format: { type: 'json_object' },
        });
        raw = response.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(raw);

        // Validate gstRate
        const validRates = [0, 5, 12, 18, 28];
        const gstRate = validRates.includes(Number(parsed.gstRate)) ? Number(parsed.gstRate) : 5;

        return {
            name: productName,
            normalizedName: (parsed.normalizedName || normalized).toLowerCase().trim(),
            hsnCode: String(parsed.hsnCode || '0000'),
            gstRate,
            category: parsed.category || 'General',
        };
    } catch (err: any) {
        console.error('[GST] OpenAI classification failed, using defaults. Raw:', raw, 'Error:', err.message);
        // Fallback: most Smart Dukaan products are 5% GST
        return {
            name: productName,
            normalizedName: normalized,
            hsnCode: '0000',
            gstRate: 5,
            category: 'General',
        };
    }
}
