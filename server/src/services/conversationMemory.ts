/**
 * In-memory conversation history store.
 * Key = invoice_id, Value = array of OpenAI chat messages
 * Persists for the lifetime of the server process (fine for hackathon demo).
 */

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.js';

const store = new Map<string, ChatCompletionMessageParam[]>();

export function getHistory(invoiceId: string): ChatCompletionMessageParam[] {
    return store.get(invoiceId) || [];
}

export function appendToHistory(invoiceId: string, role: 'assistant' | 'user', content: string) {
    const history = store.get(invoiceId) || [];
    history.push({ role, content });
    // Keep last 10 messages to avoid token overflow
    if (history.length > 10) history.splice(0, history.length - 10);
    store.set(invoiceId, history);
}

export function clearHistory(invoiceId: string) {
    store.delete(invoiceId);
}
