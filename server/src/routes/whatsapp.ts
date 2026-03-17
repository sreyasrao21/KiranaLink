import express from 'express';
import twilio from 'twilio';
import OpenAI from 'openai';
import mongoose from 'mongoose';

import { Product } from '../models/Product.js';
import { Customer } from '../models/Customer.js';
import { CustomerAccount } from '../models/CustomerAccount.js';
import { User } from '../models/User.js';
import { WhatsAppOrder } from '../models/WhatsAppOrder.js';
import { Bill } from '../models/Bill.js';
import { LedgerEntry } from '../models/LedgerEntry.js';
import { auth } from '../middleware/auth.js';
import { consumeProductStockFEFO, releaseStockBackToBatch } from '../services/inventoryBatches.js';

const { MessagingResponse } = twilio.twiml;
const router = express.Router();

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy_key_for_build'
});

console.log('[WhatsApp] Loaded DB-backed router v2');

let cachedShopkeeperId: string | null = null;

const PHONE_NAME_OVERRIDES: Record<string, string> = {
    '+918712316204': 'Mohaneesh',
};

function normalizeIndianPhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    const last10 = digits.slice(-10);
    return `+91${last10}`;
}

function detectLanguage(message: string, fallback = 'en'): string {
    const msg = message.toLowerCase();
    if (/(hai|kal|kitna|bhejo|chahiye|bhaiya|rupey|paisa|udhar)/.test(msg)) return 'hi';
    if (/(repu|ivala|kavali|anna)/.test(msg)) return 'te';
    return fallback;
}

async function getDefaultShopkeeperId(): Promise<string | null> {
    if (cachedShopkeeperId) return cachedShopkeeperId;
    if (process.env.DEFAULT_SHOPKEEPER_ID) {
        cachedShopkeeperId = process.env.DEFAULT_SHOPKEEPER_ID;
        return cachedShopkeeperId;
    }

    const topProductOwner = await Product.aggregate([
        { $group: { _id: '$shopkeeperId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 }
    ]);

    if (topProductOwner.length > 0 && topProductOwner[0]?._id) {
        cachedShopkeeperId = String(topProductOwner[0]._id);
        return cachedShopkeeperId;
    }

    const latestUser = await User.findOne().sort({ createdAt: -1 }).select('_id');
    if (!latestUser) return null;
    cachedShopkeeperId = latestUser._id.toString();
    return cachedShopkeeperId;
}

async function resolveShopkeeperId(userId?: string): Promise<string | null> {
    if (userId) return userId;
    return getDefaultShopkeeperId();
}

function deriveCustomerName(phone: string): string {
    return PHONE_NAME_OVERRIDES[phone] || `Customer ${phone.slice(-4)}`;
}

async function transcribeAudio(mediaUrl: string): Promise<string | null> {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy_key_for_build') {
        return null;
    }

    try {
        const authHeader = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
        const mediaResponse = await fetch(mediaUrl, {
            headers: { Authorization: `Basic ${authHeader}` }
        });

        if (!mediaResponse.ok) return null;
        const arrayBuffer = await mediaResponse.arrayBuffer();
        const audioBlob = new Blob([arrayBuffer]);

        const transcription = await openai.audio.transcriptions.create({
            file: new File([audioBlob], 'whatsapp-audio.ogg', { type: 'audio/ogg' }),
            model: 'whisper-1',
        });

        return transcription.text?.trim() || null;
    } catch (error) {
        console.error('Audio transcription failed:', error);
        return null;
    }
}

type ParsedItem = { productId: string; name: string; quantity: number };
type ProductView = { _id: string; name: string; price: number; stock: number };
type ReviewState = 'none' | 'needs_manual_review' | 'awaiting_customer_choice';
type ResolutionSource = 'auto' | 'customer_choice' | 'shopkeeper_edit';

function generateReferenceCode(): string {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}

const GENERIC_PRODUCT_PREFERENCES: Record<string, string[]> = {
    rice: ['Basmati Rice', 'Sona Masuri Rice'],
    oil: ['Sunflower Oil', 'Mustard Oil', 'Groundnut Oil'],
    atta: ['Atta (Wheat Flour)'],
    dal: ['Toor Dal', 'Moong Dal', 'Chana Dal'],
    sugar: ['Sugar'],
    salt: ['Salt'],
    milk: ['Fresh Milk'],
    tea: ['Loose Tea'],
};

function extractQuantity(message: string, alias: string): number {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const qtyRegex = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:kg|kilo|packet|pack|litre|l|pcs|piece)?\\s*${escaped}`);
    const reverseQtyRegex = new RegExp(`${escaped}\\s*(\\d+(?:\\.\\d+)?)`);
    const match = message.match(qtyRegex) || message.match(reverseQtyRegex);
    const qty = match?.[1] ? Number.parseFloat(match[1]) : 1;
    return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

async function findRecentPreferredOption(args: {
    customerId: string;
    shopkeeperId: string;
    optionProductIds: string[];
}): Promise<string | null> {
    const { customerId, shopkeeperId, optionProductIds } = args;
    if (!optionProductIds.length) return null;

    const recentOrders = await WhatsAppOrder.find({ customerId, shopkeeperId })
        .select('items createdAt')
        .sort({ createdAt: -1 })
        .limit(3)
        .lean();

    if (!recentOrders.length) return null;

    const counts = new Map<string, number>();
    for (const order of recentOrders) {
        for (const item of order.items || []) {
            const productId = String(item.productId);
            if (!optionProductIds.includes(productId)) continue;
            counts.set(productId, (counts.get(productId) || 0) + 1);
        }
    }

    if (!counts.size) return null;

    const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const [topProductId, topCount] = ranked[0];
    const secondCount = ranked[1]?.[1] || 0;

    if (topCount >= 2 && topCount >= secondCount + 1) {
        return topProductId;
    }

    return null;
}

async function findAmbiguousAlias(args: {
    message: string;
    products: ProductView[];
    customerId: string;
    shopkeeperId: string;
}) {
    const { message, products, customerId, shopkeeperId } = args;
    const msg = message.toLowerCase();

    for (const [alias, preferredNames] of Object.entries(GENERIC_PRODUCT_PREFERENCES)) {
        if (!msg.includes(alias)) continue;

        const available = preferredNames
            .map((name) => products.find((p) => p.name === name && p.stock > 0))
            .filter((p): p is ProductView => Boolean(p));

        const specificallyMentioned = available.some((p) => msg.includes(p.name.toLowerCase()));
        if (specificallyMentioned) continue;

        if (available.length === 1) {
            return {
                alias,
                quantity: extractQuantity(msg, alias),
                options: available,
                autoSelected: available[0],
                reason: 'single_option_in_stock',
            };
        }

        if (available.length > 1) {
            const preferredProductId = await findRecentPreferredOption({
                customerId,
                shopkeeperId,
                optionProductIds: available.map((option) => option._id),
            });

            const preferredOption = preferredProductId
                ? available.find((option) => option._id === preferredProductId)
                : undefined;

            if (preferredOption) {
                return {
                    alias,
                    quantity: extractQuantity(msg, alias),
                    options: available,
                    autoSelected: preferredOption,
                    reason: 'recent_preference_confident',
                };
            }

            return {
                alias,
                quantity: extractQuantity(msg, alias),
                options: available,
                reason: 'needs_customer_choice',
            };
        }
    }

    return null;
}

function buildAmbiguityMessage(alias: string, quantity: number, options: ProductView[], lang: string) {
    const optionLines = options
        .map((option, idx) => `${idx + 1}️⃣ ${option.name} - Rs.${option.price} (${option.stock} in stock)`)
        .join('\n');

    if (lang === 'hi') {
        return `आपने *${alias}* मांगा है (${quantity}). कई विकल्प उपलब्ध हैं:\n${optionLines}\n\n⬇️ नीचे से विकल्प चुनें (1/2/3)\nउदा: "1" या "sunflower oil"`;
    }

    if (lang === 'te') {
        return `Meeru *${alias}* (${quantity}) adigaru. Chala options unnayi:\n${optionLines}\n\n⬇️ Option number (1/2/3) reply ivvandi\nEx: "1" or "sunflower oil"`;
    }

    return `You asked for *${alias}* (${quantity}) and multiple options are available:\n${optionLines}\n\n⬇️ Choose one by replying 1/2/3\nExample: "1" or "sunflower oil"`;
}

function parseSelectionChoice(message: string): number | null {
    const normalized = message.trim().toLowerCase();
    const direct = normalized.match(/^([1-9])$/);
    if (direct) return Number.parseInt(direct[1], 10);

    const optionPattern = normalized.match(/(?:option|choose|select)?\s*([1-9])/);
    if (optionPattern) return Number.parseInt(optionPattern[1], 10);

    const emojiMap: Record<string, number> = {
        '1️⃣': 1,
        '2️⃣': 2,
        '3️⃣': 3,
        '4️⃣': 4,
        '5️⃣': 5,
    };
    for (const [emoji, value] of Object.entries(emojiMap)) {
        if (normalized.includes(emoji)) return value;
    }

    return null;
}

async function createOrderAndRespond(args: {
    req: any;
    twiml: any;
    shopkeeperId: string;
    customer: any;
    rawBody: string;
    parsedText: string;
    isAudio: boolean;
    mediaUrl: string;
    language: string;
    items: Array<{ productId: string; name: string; quantity: number; unitPrice: number; lineTotal: number }>;
    unavailable?: string[];
    note?: string;
    referenceCode?: string;
    existingOrderId?: string;
    reviewState?: ReviewState;
    reviewReason?: string;
    autoDecisionReason?: string;
    resolutionSource?: ResolutionSource;
    res: any;
}) {
    const {
        req,
        twiml,
        shopkeeperId,
        customer,
        rawBody,
        parsedText,
        isAudio,
        mediaUrl,
        language,
        items,
        unavailable = [],
        note,
        referenceCode,
        existingOrderId,
        reviewState = 'none',
        reviewReason,
        autoDecisionReason,
        resolutionSource = 'auto',
        res,
    } = args;

    for (const item of items) {
        await consumeProductStockFEFO(shopkeeperId, item.productId, item.quantity);
    }

    const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const existingOrder = existingOrderId
        ? await WhatsAppOrder.findOne({ _id: existingOrderId, shopkeeperId, customerId: customer._id })
        : null;

    const resolvedReferenceCode = referenceCode || existingOrder?.referenceCode || generateReferenceCode();

    const order = existingOrder || new WhatsAppOrder({
        shopkeeperId,
        customerId: customer._id,
    });

    order.customerPhone = customer.phoneNumber;
    order.customerMessage = rawBody || parsedText;
    order.parsedText = parsedText;
    order.mediaUrl = isAudio ? mediaUrl : order.mediaUrl;
    order.channel = isAudio ? 'whatsapp_audio' : 'whatsapp_text';
    order.items = items as any;
    order.totalAmount = totalAmount;
    order.sourceWindow24h = true;
    order.referenceCode = resolvedReferenceCode;
    order.reviewState = reviewState;
    order.reviewReason = reviewReason;
    order.autoDecisionReason = autoDecisionReason;
    order.resolutionSource = resolutionSource;
    if (order.status === 'received' || !order.status) {
        order.status = 'confirmed';
    }

    await order.save();
    console.log(`[WhatsApp] Order saved id=${order._id} ref=${resolvedReferenceCode} items=${items.length} total=${totalAmount} shopkeeper=${shopkeeperId}`);

    if (req.io) {
        req.io.emit('whatsapp-event', {
            type: existingOrder ? 'ORDER_UPDATED' : 'NEW_ORDER',
            data: {
                orderId: order._id,
                referenceCode: order.referenceCode,
                customer: customer.name,
                phone: customer.phoneNumber,
                totalAmount,
                items,
                reviewState: order.reviewState,
                createdAt: order.createdAt,
            }
        });
    }

    const unavailableLine = unavailable.length
        ? `\nUnavailable: ${unavailable.join(', ')}`
        : '';
    const noteLine = note ? `${note}\n` : '';
    const refLine = `\nRef: ${resolvedReferenceCode}`;

    const itemLines = items.map((i) => `${i.name} x ${i.quantity}`).join(', ');
    if (language === 'hi') {
        twiml.message(`${noteLine}✅ ऑर्डर कन्फर्म\n${itemLines}\nकुल: ₹${totalAmount.toFixed(0)}\nपिकअप: 15-30 मिनट में${unavailableLine}${refLine}`);
    } else {
        twiml.message(`${noteLine}✅ Order confirmed\n${itemLines}\nTotal: ₹${totalAmount.toFixed(0)}\nPickup in 15-30 mins${unavailableLine}${refLine}`);
    }

    res.type('text/xml').send(twiml.toString());
}

function parseOrderFallback(message: string, products: Array<{ _id: string; name: string }>): ParsedItem[] {
    const msg = message.toLowerCase();
    const result: ParsedItem[] = [];
    const usedProductIds = new Set<string>();

    console.log(`[WhatsApp] Fallback parser: searching in "${msg}" among ${products.length} products`);

    for (const product of products) {
        if (usedProductIds.has(product._id)) continue;
        const name = product.name.toLowerCase();
        const aliases = Array.from(new Set([
            name,
            ...name.split(/[^a-z0-9]+/).filter((token) => token.length > 2),
            name.replace(/\s*\([^)]*\)/g, '').trim(),
        ])).filter(Boolean);

        const matchedAlias = aliases.find((alias) => msg.includes(alias));
        if (!matchedAlias) continue;
        console.log(`[WhatsApp] Fallback matched: "${product.name}" via alias "${matchedAlias}", quantity: ${extractQuantity(msg, matchedAlias)}`);
        result.push({ productId: product._id, name: product.name, quantity: extractQuantity(msg, matchedAlias) });
        usedProductIds.add(product._id);
    }

    console.log(`[WhatsApp] Fallback result: ${result.length} items parsed`);
    return result;
}

async function parseOrderItems(message: string, products: Array<{ _id: string; name: string }>): Promise<ParsedItem[]> {
    if (!products.length) return [];

    console.log(`[WhatsApp] parseOrderItems: checking ${products.length} products for message: "${message}"`);

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy_key_for_build') {
        console.log('[WhatsApp] No OpenAI key, using fallback parser');
        return parseOrderFallback(message, products);
    }

    try {
        const productList = products.map((p) => ({ id: p._id, name: p.name }));
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0,
            max_tokens: 220,
            messages: [
                {
                    role: 'system',
                    content: 'Extract order items from customer message. Return strict JSON array only: [{"productId":"...","quantity":number}]. Include only products from provided catalog. Quantity must be > 0.'
                },
                {
                    role: 'user',
                    content: `Catalog: ${JSON.stringify(productList)}\nMessage: ${message}`
                }
            ]
        });

        const raw = completion.choices[0]?.message?.content?.trim() || '[]';
        const extracted = JSON.parse(raw) as Array<{ productId?: string; quantity?: number }>;
        const byId = new Map(products.map((p) => [p._id, p.name]));

        const parsed: ParsedItem[] = [];
        for (const item of extracted) {
            if (!item.productId || !byId.has(item.productId)) continue;
            const quantity = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
            parsed.push({ productId: item.productId, name: byId.get(item.productId) || '', quantity });
        }

        return parsed.length ? parsed : parseOrderFallback(message, products);
    } catch {
        return parseOrderFallback(message, products);
    }
}

async function getPendingAmount(customerId: string, shopkeeperId: string): Promise<number> {
    const accounts = await CustomerAccount.find({ customerId, shopkeeperId, balance: { $gt: 0 } }).select('balance');
    return accounts.reduce((sum, account) => sum + (account.balance || 0), 0);
}

function duesMessage(name: string, pending: number, lang: string): string {
    if (lang === 'hi') {
        return `📒 ${name} जी, आपका बकाया *₹${pending.toFixed(0)}* है.\n\n'PAY' लिखें और UPI लिंक पाएँ.`;
    }
    if (lang === 'te') {
        return `📒 ${name}, mee pending amount *₹${pending.toFixed(0)}* undi.\n\n'PAY' ani reply ivvandi.`;
    }
    return `📒 ${name}, your pending amount is *₹${pending.toFixed(0)}*.\n\nReply 'PAY' to get UPI link.`;
}

function paymentMessage(amount: number, lang: string): string {
    const upiLink = `upi://pay?pa=sdukaan@oksbi&pn=SDukaan&am=${amount.toFixed(0)}&cu=INR`;
    if (lang === 'hi') {
        return `💳 तुरंत भुगतान करें: *₹${amount.toFixed(0)}*\n${upiLink}`;
    }
    if (lang === 'te') {
        return `💳 ippude payment cheyyandi: *₹${amount.toFixed(0)}*\n${upiLink}`;
    }
    return `💳 Pay instantly: *₹${amount.toFixed(0)}*\n${upiLink}`;
}

function buildOrderStatusMessage(name: string, status: string, lang: string): string {
    if (status === 'ready') {
        if (lang === 'hi') {
            return `✅ ${name || 'Customer'} जी, आपका ऑर्डर तैयार है। कृपया स्टोर से पिकअप कर लें।`;
        }
        if (lang === 'te') {
            return `✅ ${name || 'Customer'}, mee order ready undi. Dayachesi shop nundi pickup chesukondi.`;
        }
        return `✅ ${name || 'Customer'}, your order is ready for pickup.`;
    }

    if (lang === 'hi') {
        return `🎉 ${name || 'Customer'} जी, आपका ऑर्डर डिलीवर हो गया। धन्यवाद!`;
    }
    if (lang === 'te') {
        return `🎉 ${name || 'Customer'}, mee order delivered ayindi. Dhanyavadalu!`;
    }
    return `🎉 ${name || 'Customer'}, your order has been delivered. Thank you!`;
}

async function sendStatusUpdateOnWhatsApp(order: any, status: string) {
    if (!['ready', 'delivered'].includes(status)) {
        return { attempted: false, reason: 'status_not_notifiable' };
    }

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        return { attempted: false, reason: 'missing_twilio_credentials' };
    }

    const customer = await Customer.findById(order.customerId).select('name phoneNumber preferredLanguage whatsappLastInboundAt');
    if (!customer?.phoneNumber) {
        return { attempted: false, reason: 'customer_phone_missing' };
    }

    const lastInboundAt = customer.whatsappLastInboundAt ? new Date(customer.whatsappLastInboundAt).getTime() : 0;
    const in24hWindow = lastInboundAt > 0 && (Date.now() - lastInboundAt) <= (24 * 60 * 60 * 1000);
    if (!in24hWindow) {
        return { attempted: false, reason: 'outside_24h_window' };
    }

    const from = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
    const normalizedPhone = normalizeIndianPhone(String(customer.phoneNumber));
    const to = `whatsapp:${normalizedPhone}`;
    const body = buildOrderStatusMessage(customer.name || 'Customer', status, customer.preferredLanguage || 'en');

    await twilioClient.messages.create({ from, to, body });
    return { attempted: true, sent: true };
}

router.post('/webhook', async (req: any, res) => {
    const twiml = new MessagingResponse();

    try {
        const from = String(req.body.From || '');
        const rawBody = String(req.body.Body || '').trim();
        const numMedia = Number.parseInt(String(req.body.NumMedia || '0'), 10);
        const mediaType = String(req.body.MediaContentType0 || '');
        const mediaUrl = String(req.body.MediaUrl0 || '');

        const shopkeeperId = await getDefaultShopkeeperId();
        if (!shopkeeperId) {
            twiml.message('No shopkeeper account found in system.');
            res.type('text/xml').send(twiml.toString());
            return;
        }
        console.log(`[WhatsApp] Incoming webhook mapped to shopkeeperId=${shopkeeperId}`);

        const phone = normalizeIndianPhone(from);
        let customer = await Customer.findOne({ phoneNumber: phone });
        if (!customer) {
            customer = await Customer.create({
                phoneNumber: phone,
                name: deriveCustomerName(phone),
                preferredLanguage: 'en',
                whatsappLastInboundAt: new Date(),
            });
        }

        if (PHONE_NAME_OVERRIDES[phone] && (!customer.name || customer.name.startsWith('Customer ') || customer.name.includes('Raju'))) {
            customer.name = PHONE_NAME_OVERRIDES[phone];
        }

        let parsedText = rawBody;
        const isAudio = numMedia > 0 && mediaType.startsWith('audio/');
        if (isAudio && mediaUrl) {
            const transcript = await transcribeAudio(mediaUrl);
            if (!transcript) {
                const referenceCode = generateReferenceCode();
                const voiceReviewOrder = await WhatsAppOrder.create({
                    shopkeeperId,
                    customerId: customer._id,
                    customerPhone: customer.phoneNumber,
                    customerMessage: rawBody || 'Voice note received',
                    parsedText: 'Voice note needs manual review',
                    mediaUrl,
                    channel: 'whatsapp_audio',
                    status: 'received',
                    items: [],
                    totalAmount: 0,
                    sourceWindow24h: true,
                    referenceCode,
                    reviewState: 'needs_manual_review',
                    reviewReason: 'transcription_failed',
                    resolutionSource: 'shopkeeper_edit',
                });

                if (req.io) {
                    req.io.emit('whatsapp-event', {
                        type: 'NEW_ORDER',
                        data: {
                            orderId: voiceReviewOrder._id,
                            referenceCode,
                            customer: customer.name,
                            phone: customer.phoneNumber,
                            totalAmount: 0,
                            items: [],
                            needsManualReview: true,
                            reviewState: 'needs_manual_review',
                            createdAt: voiceReviewOrder.createdAt,
                        }
                    });
                }

                twiml.message(`Voice note received. We are confirming your order and will update you shortly. Ref: ${referenceCode}`);
                res.type('text/xml').send(twiml.toString());
                return;
            }
            parsedText = transcript;
        }

        const language = detectLanguage(parsedText, customer.preferredLanguage || 'en');
        customer.preferredLanguage = language;
        customer.whatsappLastInboundAt = new Date();
        await customer.save();

        const message = parsedText.toLowerCase();

        const products = await Product.find({ shopkeeperId, stock: { $gt: 0 } }).select('_id name price stock').lean();
        const normalizedProducts: ProductView[] = products.map((p) => ({ _id: String(p._id), name: p.name, price: p.price, stock: p.stock }));

        const pendingSelection = (customer as any).whatsappPendingSelection;
        if (pendingSelection?.optionProductIds?.length) {
            const options: ProductView[] = pendingSelection.optionProductIds
                .map((id: any) => normalizedProducts.find((p) => p._id === String(id)))
                .filter((p: any): p is ProductView => Boolean(p));

            if (!options.length) {
                (customer as any).whatsappPendingSelection = undefined;
                await customer.save();
                twiml.message(language === 'hi'
                    ? 'क्षमा करें, विकल्प अब उपलब्ध नहीं हैं। कृपया अपना ऑर्डर फिर से भेजें।'
                    : 'Sorry, those options are no longer available. Please send your order again.');
                res.type('text/xml').send(twiml.toString());
                return;
            }

            let chosen: ProductView | undefined;
            const numericChoice = parseSelectionChoice(message);
            if (numericChoice && numericChoice >= 1 && numericChoice <= options.length) {
                chosen = options[numericChoice - 1];
            }

            if (!chosen) {
                chosen = options.find((opt: ProductView) => message.includes(opt.name.toLowerCase()));
            }

            if (chosen) {
                (customer as any).whatsappPendingSelection = undefined;
                await customer.save();

                const quantity = pendingSelection.quantity || 1;
                if (chosen.stock < quantity) {
                    twiml.message(`Selected product ${chosen.name} has only ${chosen.stock} in stock now. Please choose another option.`);
                    res.type('text/xml').send(twiml.toString());
                    return;
                }

                await createOrderAndRespond({
                    req,
                    twiml,
                    shopkeeperId,
                    customer,
                    rawBody,
                    parsedText,
                    isAudio,
                    mediaUrl,
                    language,
                    items: [{
                        productId: chosen._id,
                        name: chosen.name,
                        quantity,
                        unitPrice: chosen.price,
                        lineTotal: Number((chosen.price * quantity).toFixed(2)),
                    }],
                    existingOrderId: pendingSelection.orderId ? String(pendingSelection.orderId) : undefined,
                    referenceCode: pendingSelection.referenceCode,
                    reviewState: 'none',
                    reviewReason: undefined,
                    resolutionSource: 'customer_choice',
                    res,
                });
                return;
            }

            const looksLikeFreshOrder = !numericChoice
                && !options.some((opt: ProductView) => message.includes(opt.name.toLowerCase()))
                && /(\d|kg|kilo|litre|l\b|packet|pack|pcs|piece|rice|oil|atta|dal|sugar|salt|milk|tea)/i.test(message);

            if (looksLikeFreshOrder) {
                (customer as any).whatsappPendingSelection = undefined;
                await customer.save();
                console.log('[WhatsApp] Cleared stale pending selection; treating message as fresh order');
            } else {
                const refHint = pendingSelection.referenceCode ? `\nRef: ${pendingSelection.referenceCode}` : '';
                twiml.message(`${buildAmbiguityMessage(pendingSelection.alias || 'item', pendingSelection.quantity || 1, options, language)}${refHint}`);
                res.type('text/xml').send(twiml.toString());
                return;
            }
        }

        if (/(due|pending|baki|kitna|udhar)/.test(message)) {
            const pendingAmount = await getPendingAmount(customer._id.toString(), shopkeeperId);
            twiml.message(duesMessage(customer.name || 'Customer', pendingAmount, language));
            res.type('text/xml').send(twiml.toString());
            return;
        }

        if (/(pay|upi|qr|paisa|rupee)/.test(message)) {
            const pendingAmount = await getPendingAmount(customer._id.toString(), shopkeeperId);
            if (pendingAmount <= 0) {
                twiml.message(language === 'hi' ? 'आपका कोई बकाया नहीं है। धन्यवाद!' : 'You have no pending dues. Thank you!');
            } else {
                twiml.message(paymentMessage(pendingAmount, language));
            }
            res.type('text/xml').send(twiml.toString());
            return;
        }

        if (/(tomorrow|kal|later|bad me|repu)/.test(message)) {
            customer.recoveryStatus = 'Promised';
            customer.nextCallDate = Date.now() + 24 * 60 * 60 * 1000;
            customer.recoveryNotes = `Promise captured via WhatsApp on ${new Date().toISOString()}`;
            await customer.save();
            twiml.message(language === 'hi' ? 'ठीक है, हमने कल के लिए नोट कर लिया है।' : 'Noted. We have marked your promise for tomorrow.');
            res.type('text/xml').send(twiml.toString());
            return;
        }

        const ambiguity = await findAmbiguousAlias({
            message: parsedText,
            products: normalizedProducts,
            customerId: customer._id.toString(),
            shopkeeperId,
        });
        if (ambiguity) {
            if (ambiguity.autoSelected) {
                const autoSelectNote = ambiguity.reason === 'recent_preference_confident'
                    ? (language === 'hi'
                        ? `ℹ️ आपकी पिछली पसंद के आधार पर ${ambiguity.autoSelected.name} चुना गया।`
                        : `ℹ️ Auto-selected your usual: ${ambiguity.autoSelected.name}.`)
                    : (language === 'hi'
                        ? `ℹ️ ${ambiguity.alias} का एक ही विकल्प स्टॉक में था, वही चुना गया।`
                        : `ℹ️ Only one ${ambiguity.alias} option was in stock, so it was selected.`);

                await createOrderAndRespond({
                    req,
                    twiml,
                    shopkeeperId,
                    customer,
                    rawBody,
                    parsedText,
                    isAudio,
                    mediaUrl,
                    language,
                    items: [{
                        productId: ambiguity.autoSelected._id,
                        name: ambiguity.autoSelected.name,
                        quantity: ambiguity.quantity,
                        unitPrice: ambiguity.autoSelected.price,
                        lineTotal: Number((ambiguity.autoSelected.price * ambiguity.quantity).toFixed(2)),
                    }],
                    note: autoSelectNote,
                    autoDecisionReason: ambiguity.reason,
                    resolutionSource: 'auto',
                    res,
                });
                return;
            }

            const referenceCode = generateReferenceCode();
            const pendingOrder = await WhatsAppOrder.create({
                shopkeeperId,
                customerId: customer._id,
                customerPhone: customer.phoneNumber,
                customerMessage: rawBody || parsedText,
                parsedText,
                mediaUrl: isAudio ? mediaUrl : undefined,
                channel: isAudio ? 'whatsapp_audio' : 'whatsapp_text',
                status: 'received',
                items: [],
                totalAmount: 0,
                sourceWindow24h: true,
                referenceCode,
                reviewState: 'awaiting_customer_choice',
                reviewReason: `ambiguous:${ambiguity.alias}`,
                resolutionSource: 'customer_choice',
            });

            (customer as any).whatsappPendingSelection = {
                alias: ambiguity.alias,
                quantity: ambiguity.quantity,
                optionProductIds: ambiguity.options.map((opt: ProductView) => opt._id),
                orderId: pendingOrder._id,
                referenceCode,
                requestedAt: new Date(),
            };
            await customer.save();

            if (req.io) {
                req.io.emit('whatsapp-event', {
                    type: 'NEW_ORDER',
                    data: {
                        orderId: pendingOrder._id,
                        referenceCode,
                        customer: customer.name,
                        phone: customer.phoneNumber,
                        totalAmount: 0,
                        items: [],
                        reviewState: 'awaiting_customer_choice',
                        createdAt: pendingOrder.createdAt,
                    }
                });
            }

            twiml.message(`${buildAmbiguityMessage(ambiguity.alias, ambiguity.quantity, ambiguity.options, language)}\nRef: ${referenceCode}`);
            res.type('text/xml').send(twiml.toString());
            return;
        }

        const parsedItems = await parseOrderItems(parsedText, normalizedProducts.map((p) => ({ _id: p._id, name: p.name })));
        if (!parsedItems.length) {
            twiml.message(language === 'hi'
                ? 'मुझे ऑर्डर समझ नहीं आया। कृपया ऐसे लिखें: 2kg rice, 1 oil.'
                : 'I could not parse your order. Please send like: 2kg rice, 1 oil.');
            res.type('text/xml').send(twiml.toString());
            return;
        }

        const productMap = new Map(normalizedProducts.map((p) => [p._id, p]));
        const orderItems: Array<{ productId: string; name: string; quantity: number; unitPrice: number; lineTotal: number }> = [];
        const unavailable: string[] = [];

        for (const item of parsedItems) {
            const product = productMap.get(item.productId);
            if (!product) continue;
            if (product.stock < item.quantity) {
                unavailable.push(`${product.name} (stock ${product.stock})`);
                continue;
            }

            orderItems.push({
                productId: product._id,
                name: product.name,
                quantity: item.quantity,
                unitPrice: product.price,
                lineTotal: Number((product.price * item.quantity).toFixed(2)),
            });
        }

        if (!orderItems.length) {
            twiml.message(language === 'hi'
                ? `माफ़ कीजिए, स्टॉक उपलब्ध नहीं है: ${unavailable.join(', ')}`
                : `Sorry, items currently unavailable: ${unavailable.join(', ')}`);
            res.type('text/xml').send(twiml.toString());
            return;
        }

        await createOrderAndRespond({
            req,
            twiml,
            shopkeeperId,
            customer,
            rawBody,
            parsedText,
            isAudio,
            mediaUrl,
            language,
            items: orderItems,
            unavailable,
            res,
        });
    } catch (error) {
        console.error('WhatsApp webhook error:', error);
        twiml.message('Something went wrong while processing your request. Please try again.');
        res.type('text/xml').send(twiml.toString());
    }
});

router.get('/version', (_req, res) => {
    res.json({ version: 'db-backed-v2' });
});

router.get('/analytics', auth, async (req, res) => {
    try {
        const shopkeeperId = await resolveShopkeeperId((req as any).auth?.userId);
        if (!shopkeeperId) {
            res.status(404).json({ message: 'No shopkeeper found for WhatsApp analytics' });
            return;
        }

        const accounts = await CustomerAccount.find({ shopkeeperId, balance: { $gt: 0 } }).select('balance');
        const pendingTotal = accounts.reduce((sum, account) => sum + (account.balance || 0), 0);

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const ordersToday = await WhatsAppOrder.countDocuments({
            shopkeeperId,
            createdAt: { $gte: startOfDay }
        });

        const [needsReviewCount, awaitingChoiceCount, readyToBillCount] = await Promise.all([
            WhatsAppOrder.countDocuments({ shopkeeperId, reviewState: 'needs_manual_review' }),
            WhatsAppOrder.countDocuments({ shopkeeperId, reviewState: 'awaiting_customer_choice' }),
            WhatsAppOrder.countDocuments({
                shopkeeperId,
                reviewState: 'none',
                convertedBillId: { $exists: false },
                totalAmount: { $gt: 0 },
                status: { $in: ['confirmed', 'preparing', 'ready', 'delivered'] },
            }),
        ]);

        res.json({
            pendingTotal,
            activeDebtors: accounts.length,
            ordersToday,
            needsReviewCount,
            awaitingChoiceCount,
            readyToBillCount,
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/broadcast-reminders', auth, async (req: any, res) => {
    try {
        const shopkeeperId = await resolveShopkeeperId(req.auth?.userId);
        if (!shopkeeperId) {
            res.status(404).json({ message: 'No shopkeeper found for WhatsApp reminders' });
            return;
        }

        const accounts = await CustomerAccount.find({ shopkeeperId, balance: { $gt: 0 } }).populate('customerId');
        let sentCount = 0;
        let skippedOutsideWindow = 0;
        const errors: Array<{ phone: string; error: string }> = [];

        const now = Date.now();
        const windowMs = 24 * 60 * 60 * 1000;
        const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

        for (const account of accounts) {
            const customer = account.customerId as any;
            if (!customer?.phoneNumber) continue;

            const lastInbound = customer.whatsappLastInboundAt ? new Date(customer.whatsappLastInboundAt).getTime() : 0;
            if (!lastInbound || (now - lastInbound) > windowMs) {
                skippedOutsideWindow += 1;
                continue;
            }

            const lang = customer.preferredLanguage || 'en';
            const text = duesMessage(customer.name || 'Customer', account.balance || 0, lang);

            try {
                await twilioClient.messages.create({
                    body: text,
                    from: fromNumber,
                    to: `whatsapp:${normalizeIndianPhone(customer.phoneNumber)}`
                });
                sentCount += 1;
            } catch (err: any) {
                errors.push({ phone: customer.phoneNumber, error: err.message || 'Unknown error' });
            }
        }

        res.json({
            success: true,
            sentCount,
            skippedOutsideWindow,
            attempted: accounts.length,
            errors
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/orders', auth, async (req, res) => {
    try {
        const shopkeeperId = await resolveShopkeeperId((req as any).auth?.userId);
        console.log(`[WhatsApp] GET /orders: auth.userId=${req.auth?.userId}, resolved shopkeeperId=${shopkeeperId}`);

        if (!shopkeeperId) {
            res.status(404).json({ message: 'No shopkeeper found for WhatsApp orders' });
            return;
        }

        const orders = await WhatsAppOrder.find({ shopkeeperId })
            .populate('customerId', 'name phoneNumber')
            .sort({ createdAt: -1 })
            .limit(100);

        console.log(`[WhatsApp] GET /orders: found ${orders.length} orders for shopkeeper ${shopkeeperId}`);
        res.json(orders);
    } catch (error: any) {
        console.error('[WhatsApp] GET /orders error:', error);
        res.status(500).json({ message: error.message });
    }
});

router.patch('/orders/:id/status', auth, async (req, res) => {
    try {
        const shopkeeperId = await resolveShopkeeperId((req as any).auth?.userId);
        if (!shopkeeperId) {
            res.status(404).json({ message: 'No shopkeeper found for WhatsApp orders' });
            return;
        }

        const { status } = req.body;
        const allowed = ['received', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
        if (!allowed.includes(status)) {
            res.status(400).json({ message: 'Invalid status' });
            return;
        }

        const order = await WhatsAppOrder.findOne({ _id: req.params.id, shopkeeperId });

        if (!order) {
            res.status(404).json({ message: 'Order not found' });
            return;
        }

        if (order.reviewState !== 'none' && ['ready', 'delivered'].includes(status)) {
            res.status(400).json({ message: 'Resolve order items first, then mark ready/delivered.' });
            return;
        }

        const previousStatus = order.status;
        order.status = status;
        await order.save();

        let notification: any = { attempted: false, reason: 'no_status_change' };
        if (previousStatus !== status) {
            try {
                notification = await sendStatusUpdateOnWhatsApp(order, status);
            } catch (notifyError: any) {
                notification = { attempted: true, sent: false, reason: notifyError?.message || 'send_failed' };
            }
        }

        res.json({
            ...order.toObject(),
            customerNotification: notification,
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

router.patch('/orders/:id/items', auth, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const resolvedShopkeeperId = await resolveShopkeeperId((req as any).auth?.userId);

        const payloadItems = Array.isArray(req.body?.items) ? req.body.items : [];
        if (!payloadItems.length) {
            await session.abortTransaction();
            res.status(400).json({ message: 'At least one item is required' });
            return;
        }

        const normalizedIncoming = new Map<string, number>();
        for (const rawItem of payloadItems) {
            const productId = String(rawItem?.productId || '');
            const quantity = Number(rawItem?.quantity || 0);
            if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
                await session.abortTransaction();
                res.status(400).json({ message: 'Each item must have productId and quantity > 0' });
                return;
            }
            normalizedIncoming.set(productId, (normalizedIncoming.get(productId) || 0) + quantity);
        }

        const order = await WhatsAppOrder.findById(req.params.id).session(session);
        if (!order) {
            await session.abortTransaction();
            res.status(404).json({ message: 'Order not found' });
            return;
        }

        const effectiveShopkeeperId = String(order.shopkeeperId);
        if ((req as any).auth?.userId && resolvedShopkeeperId && resolvedShopkeeperId !== effectiveShopkeeperId) {
            await session.abortTransaction();
            res.status(403).json({ message: 'You are not allowed to edit this order' });
            return;
        }

        const existing = new Map<string, number>();
        for (const item of order.items || []) {
            const productId = String(item.productId);
            existing.set(productId, (existing.get(productId) || 0) + Number(item.quantity || 0));
        }

        const productIds = Array.from(new Set([...existing.keys(), ...normalizedIncoming.keys()]));
        const products = await Product.find({
            _id: { $in: productIds },
            shopkeeperId: effectiveShopkeeperId,
        }).session(session);

        const productMap = new Map(products.map((product) => [String(product._id), product]));
        for (const productId of normalizedIncoming.keys()) {
            if (!productMap.has(productId)) {
                await session.abortTransaction();
                res.status(400).json({ message: `Product not found in your current catalog. Please remove it or add a replacement.` });
                return;
            }
        }

        for (const productId of productIds) {
            const previousQty = existing.get(productId) || 0;
            const nextQty = normalizedIncoming.get(productId) || 0;
            const delta = nextQty - previousQty;
            if (delta === 0) continue;

            const product = productMap.get(productId);
            if (!product) continue;

            if (delta > 0) {
                if (product.stock < delta) {
                    await session.abortTransaction();
                    res.status(400).json({ message: `Insufficient stock for ${product.name}. Available: ${product.stock}` });
                    return;
                }
                await consumeProductStockFEFO(effectiveShopkeeperId, productId, delta, { session });
            } else {
                await releaseStockBackToBatch(effectiveShopkeeperId, productId, Math.abs(delta), { session });
            }
        }

        const nextItems = Array.from(normalizedIncoming.entries()).map(([productId, quantity]) => {
            const product = productMap.get(productId)!;
            const unitPrice = Number(product.price || 0);
            return {
                productId,
                name: product.name,
                quantity,
                unitPrice,
                lineTotal: Number((unitPrice * quantity).toFixed(2)),
            };
        });

        const nextTotal = nextItems.reduce((sum, item) => sum + item.lineTotal, 0);

        order.items = nextItems as any;
        order.totalAmount = nextTotal;
        if (order.status === 'received' && nextItems.length > 0) {
            order.status = 'confirmed';
        }
        if (!order.referenceCode) {
            order.referenceCode = generateReferenceCode();
        }
        order.reviewState = 'none';
        order.reviewReason = undefined;
        order.resolutionSource = 'shopkeeper_edit';
        await order.save({ session });

        await Customer.updateOne(
            {
                _id: order.customerId,
                'whatsappPendingSelection.orderId': order._id,
            },
            { $unset: { whatsappPendingSelection: 1 } },
            { session }
        );

        await session.commitTransaction();
        res.json(order);
    } catch (error: any) {
        await session.abortTransaction();
        res.status(500).json({ message: error.message || 'Failed to update order items' });
    } finally {
        session.endSession();
    }
});

router.get('/orders/:id/media', auth, async (req, res) => {
    try {
        const shopkeeperId = await resolveShopkeeperId((req as any).auth?.userId);
        if (!shopkeeperId) {
            res.status(404).json({ message: 'No shopkeeper found for WhatsApp orders' });
            return;
        }

        const order = await WhatsAppOrder.findOne({ _id: req.params.id, shopkeeperId }).select('mediaUrl');
        if (!order) {
            res.status(404).json({ message: 'Order not found' });
            return;
        }

        if (!order.mediaUrl) {
            res.status(404).json({ message: 'No media available for this order' });
            return;
        }

        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
            res.status(500).json({ message: 'Twilio credentials are missing for media retrieval' });
            return;
        }

        const authHeader = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
        const mediaResponse = await fetch(order.mediaUrl, {
            headers: { Authorization: `Basic ${authHeader}` }
        });

        if (!mediaResponse.ok) {
            res.status(502).json({ message: 'Unable to fetch media from Twilio' });
            return;
        }

        const contentType = mediaResponse.headers.get('content-type') || 'audio/ogg';
        const mediaArrayBuffer = await mediaResponse.arrayBuffer();
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'private, max-age=300');
        res.send(Buffer.from(mediaArrayBuffer));
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to fetch order media' });
    }
});

router.post('/orders/:id/convert-to-bill', auth, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const resolvedShopkeeperId = await resolveShopkeeperId((req as any).auth?.userId);

        const paymentType = req.body?.paymentType || 'cash';
        if (!['cash', 'online', 'ledger'].includes(paymentType)) {
            await session.abortTransaction();
            res.status(400).json({ message: 'Invalid paymentType. Use cash, online, or ledger.' });
            return;
        }

        const order = await WhatsAppOrder.findById(req.params.id).session(session);
        if (!order) {
            await session.abortTransaction();
            res.status(404).json({ message: 'Order not found' });
            return;
        }

        const effectiveShopkeeperId = String(order.shopkeeperId);
        if ((req as any).auth?.userId && resolvedShopkeeperId && resolvedShopkeeperId !== effectiveShopkeeperId) {
            await session.abortTransaction();
            res.status(403).json({ message: 'You are not allowed to convert this order' });
            return;
        }

        if (!order.items?.length || order.totalAmount <= 0) {
            await session.abortTransaction();
            res.status(400).json({ message: 'Order has no billable items. Edit items first.' });
            return;
        }

        if (order.reviewState !== 'none') {
            await session.abortTransaction();
            res.status(400).json({ message: 'Resolve order review first before bill conversion.' });
            return;
        }

        if (order.convertedBillId) {
            const existingBill = await Bill.findById(order.convertedBillId).session(session);
            await session.commitTransaction();
            res.json({
                success: true,
                alreadyConverted: true,
                bill: existingBill,
                order,
            });
            return;
        }

        const billItems = order.items.map((item: any) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            price: item.unitPrice,
        }));

        const bill = new Bill({
            shopkeeperId: effectiveShopkeeperId,
            customerId: order.customerId,
            items: billItems,
            totalAmount: order.totalAmount,
            paymentType,
        });
        await bill.save({ session });

        if (paymentType === 'ledger') {
            const ledgerEntry = new LedgerEntry({
                shopkeeperId: effectiveShopkeeperId,
                customerId: order.customerId,
                billId: bill._id,
                amount: order.totalAmount,
                type: 'debit',
                status: 'pending',
            });
            await ledgerEntry.save({ session });

            let account = await CustomerAccount.findOne({ customerId: order.customerId, shopkeeperId: effectiveShopkeeperId }).session(session);
            if (!account) {
                account = new CustomerAccount({
                    customerId: order.customerId,
                    shopkeeperId: effectiveShopkeeperId,
                    balance: order.totalAmount,
                });
            } else {
                account.balance += order.totalAmount;
            }
            await account.save({ session });
        }

        order.convertedBillId = bill._id;
        order.convertedAt = new Date();
        await order.save({ session });

        await session.commitTransaction();
        res.status(201).json({ success: true, bill, order });
    } catch (error: any) {
        await session.abortTransaction();
        res.status(500).json({ message: error.message || 'Failed to convert order to bill' });
    } finally {
        session.endSession();
    }
});

export { router as whatsappRouter };
