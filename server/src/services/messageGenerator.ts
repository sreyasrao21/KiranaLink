import OpenAI from 'openai';
import { IInvoice } from '../models/Invoice.js';

// Setup OpenAI client. In hackathon mode with missing keys, it may throw if invoked without one,
// so ensure process.env.OPENAI_API_KEY is available or gracefully handled.
const isOR = (process.env.OPENAI_API_KEY || '').startsWith('sk-or');
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy_key_for_build',
    ...(isOR ? { baseURL: "https://openrouter.ai/api/v1" } : {})
});

export async function generateMessage(invoice: IInvoice, tone: string, channel: string): Promise<string> {
    const paymentLink = invoice.payment_link || `https://sdukaan.in/pay/${invoice.invoice_id}`;

    let systemPrompt = `You are an AI debt collection assistant for a small business owner. 
    You need to generate a strictly professional, culturally appropriate collection message in English.
    The customer name is ${invoice.client_name}.
    The amount owed is ₹${invoice.amount}.
    The due date was ${invoice.due_date.toDateString()}.
    The requested tone of the message is: "${tone}".
    Always include this payment link: ${paymentLink}
    `;

    if (channel === 'call') {
        systemPrompt += `\nConstraint: This is the OPENING LINE of a live phone call. You are a local shopkeeper calling your customer. You must start the conversation natively like "Hello ji, this is Smart Dukaan shop, calling for [name]..." Keep it VERY short (1-2 sentences) and end with a question like "When are you planning to pay the ₹[amount]?" Do NOT include URLs or emojis.`;
    } else if (channel === 'sms') {
        systemPrompt += `\nConstraint: Keep the message under 160 characters. Be extremely brief.`;
    } else if (channel === 'whatsapp') {
        systemPrompt += `\nConstraint: Format nicely suitable for WhatsApp. You can use mild emojis.`;
    } else if (channel === 'email') {
        systemPrompt += `\nConstraint: Format this as a formal email with a subject line at the very top (Subject: ...), dear/hi, and a sign-off.`;
    }

    try {
        if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'dummy_key_for_build') {
            const response = await openai.chat.completions.create({
                model: isOR ? 'openai/gpt-4o-mini' : 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Draft the ${channel} message now.` }
                ],
                max_tokens: 150,
                temperature: 0.7,
            });

            return response.choices[0].message?.content?.trim() || `Fallback: Please pay your pending amount of ₹${invoice.amount} via ${paymentLink}`;

        } else {
            // Fallback mock generator if no real API key is injected for the localhost run
            if (channel === 'sms') {
                return `Hi ${invoice.client_name}, you have a pending invoice of ₹${invoice.amount} (${tone}). Pay here: ${paymentLink}`;
            } else {
                return `Dear ${invoice.client_name},\n\nThis is a ${tone} that your invoice of ₹${invoice.amount} due on ${invoice.due_date.toDateString()} is pending.\n\nPlease pay using this link: ${paymentLink}\n\nThank you,\nSmart Dukaan Stores`;
            }
        }
    } catch (error) {
        console.error('LLM Generation Error:', error);
        return `Hi ${invoice.client_name}, please pay your pending amount of ₹${invoice.amount} here: ${paymentLink}`;
    }
}
