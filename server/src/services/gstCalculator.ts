import { IInvoiceItem } from '../models/GSTInvoice.js';
import mongoose from 'mongoose';

// ── Raw item input (before GST calculation) ───────────────────────────────────
export interface RawItem {
    productId: string;
    name: string;
    hsnCode?: string;
    gstRate: number;      // e.g. 5 (= 5%)
    quantity: number;
    unitPrice: number;      // price per single unit
    priceIncludesGST: boolean;
}

// ── Round to 2 decimal places ─────────────────────────────────────────────────
function r2(n: number): number {
    return Math.round(n * 100) / 100;
}

// ── Calculate GST for a single line item ─────────────────────────────────────
export function calculateLineItem(raw: RawItem): IInvoiceItem {
    const { productId, name, hsnCode = '', gstRate, quantity, unitPrice, priceIncludesGST } = raw;

    const lineTotal = r2(unitPrice * quantity); // total as entered

    let baseAmount: number;
    let gstAmount: number;

    if (priceIncludesGST && gstRate > 0) {
        // Reverse-calculate base from GST-inclusive price
        baseAmount = r2(lineTotal / (1 + gstRate / 100));
        gstAmount = r2(lineTotal - baseAmount);
    } else {
        // Tax-exclusive: add GST on top
        baseAmount = lineTotal;
        gstAmount = r2(baseAmount * (gstRate / 100));
    }

    const cgstAmount = r2(gstAmount / 2);
    const sgstAmount = r2(gstAmount / 2);
    const totalAmount = priceIncludesGST ? lineTotal : r2(lineTotal + gstAmount);

    return {
        productId: new mongoose.Types.ObjectId(productId),
        name,
        hsnCode,
        gstRate,
        quantity,
        unitPrice,
        priceIncludesGST,
        baseAmount,
        cgstAmount,
        sgstAmount,
        totalAmount,
    };
}

// ── Calculate GST for an array of items and return invoice-level totals ───────
export interface InvoiceTotals {
    items: IInvoiceItem[];
    totalBaseAmount: number;
    totalCGST: number;
    totalSGST: number;
    totalGST: number;
    grandTotal: number;
}

export function calculateInvoice(rawItems: RawItem[]): InvoiceTotals {
    const items = rawItems.map(calculateLineItem);

    const totalBaseAmount = r2(items.reduce((s, i) => s + i.baseAmount, 0));
    const totalCGST = r2(items.reduce((s, i) => s + i.cgstAmount, 0));
    const totalSGST = r2(items.reduce((s, i) => s + i.sgstAmount, 0));
    const totalGST = r2(totalCGST + totalSGST);
    const grandTotal = r2(items.reduce((s, i) => s + i.totalAmount, 0));

    return { items, totalBaseAmount, totalCGST, totalSGST, totalGST, grandTotal };
}
