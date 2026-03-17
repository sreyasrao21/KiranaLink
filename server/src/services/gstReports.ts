import { GSTLedger } from '../models/GSTLedger.js';
import { GSTInvoice } from '../models/GSTInvoice.js';
import { SupplierBill } from '../models/SupplierBill.js';
import { Bill } from '../models/Bill.js';
import mongoose from 'mongoose';

// ── Monthly GST Summary ───────────────────────────────────────────────────────
export interface GSTSummary {
    month: number;
    year: number;
    totalSales: number;   // grand total of all sales (incl. GST)
    totalOutputGST: number;   // GST collected on sales
    totalInputGST: number;   // GST paid on purchases
    netGSTPayable: number;   // outputGST - inputGST
    outputCGST: number;
    outputSGST: number;
    inputCGST: number;
    inputSGST: number;
}

export async function getGSTSummary(
    shopkeeperId: string,
    month: number,
    year: number
): Promise<GSTSummary> {
    const shopId = new mongoose.Types.ObjectId(shopkeeperId);

    const [outputAgg, inputAgg] = await Promise.all([
        GSTLedger.aggregate([
            { $match: { shopkeeperId: shopId, type: 'output', month, year } },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: '$grandTotal' },
                    totalOutputGST: { $sum: '$totalGST' },
                    outputCGST: { $sum: '$totalCGST' },
                    outputSGST: { $sum: '$totalSGST' },
                },
            },
        ]),
        GSTLedger.aggregate([
            { $match: { shopkeeperId: shopId, type: 'input', month, year } },
            {
                $group: {
                    _id: null,
                    totalInputGST: { $sum: '$totalGST' },
                    inputCGST: { $sum: '$totalCGST' },
                    inputSGST: { $sum: '$totalSGST' },
                },
            },
        ]),
    ]);

    const out = outputAgg[0] || { totalSales: 0, totalOutputGST: 0, outputCGST: 0, outputSGST: 0 };
    const inp = inputAgg[0] || { totalInputGST: 0, inputCGST: 0, inputSGST: 0 };

    return {
        month,
        year,
        totalSales: round2(out.totalSales),
        totalOutputGST: round2(out.totalOutputGST),
        totalInputGST: round2(inp.totalInputGST),
        netGSTPayable: round2(out.totalOutputGST - inp.totalInputGST),
        outputCGST: round2(out.outputCGST),
        outputSGST: round2(out.outputSGST),
        inputCGST: round2(inp.inputCGST),
        inputSGST: round2(inp.inputSGST),
    };
}

// ── Monthly ITR Assistance Summary ────────────────────────────────────────────
export interface ITRSummary {
    month: number;
    year: number;
    revenue: number;   // total sales including GST
    revenueExGST: number;   // base sales amount
    purchaseCost: number;   // total supplier purchases
    grossProfit: number;   // revenue (ex-GST) - purchaseCost
    gstCollected: number;   // GST collected on sales
    gstPaid: number;   // GST paid on purchases
    netGSTPayable: number;
    estimatedTaxableIncome: number;   // grossProfit (estimate)
    disclaimer: string;
}

export async function getITRSummary(
    shopkeeperId: string,
    month: number,
    year: number
): Promise<ITRSummary> {
    const shopId = new mongoose.Types.ObjectId(shopkeeperId);
    const gstData = await getGSTSummary(shopkeeperId, month, year);

    // Purchase cost: sum all supplier bills for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const purchaseAgg = await SupplierBill.aggregate([
        {
            $match: {
                shopkeeperId: shopId,
                createdAt: { $gte: startDate, $lt: endDate },
            },
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);

    const purchaseCost = round2(purchaseAgg[0]?.total ?? 0);

    const revenue = gstData.totalSales;
    const revenueExGST = round2(revenue - gstData.totalOutputGST);
    const grossProfit = round2(revenueExGST - purchaseCost);
    const estimatedTaxableIncome = grossProfit > 0 ? grossProfit : 0;

    return {
        month,
        year,
        revenue,
        revenueExGST,
        purchaseCost,
        grossProfit,
        gstCollected: gstData.totalOutputGST,
        gstPaid: gstData.totalInputGST,
        netGSTPayable: gstData.netGSTPayable,
        estimatedTaxableIncome,
        disclaimer:
            'This is an automated estimate only. Consult a Chartered Accountant for official ITR filing.',
    };
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
