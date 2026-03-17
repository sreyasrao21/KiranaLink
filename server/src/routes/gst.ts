import express, { Request, Response } from 'express';
import { auth } from '../middleware/auth.js';
import { Product } from '../models/Product.js';
import { GSTInvoice } from '../models/GSTInvoice.js';
import { GSTLedger } from '../models/GSTLedger.js';
import { SupplierBill } from '../models/SupplierBill.js';
import { classifyProduct } from '../services/gstClassification.js';
import { calculateInvoice, RawItem } from '../services/gstCalculator.js';
import { getGSTSummary, getITRSummary } from '../services/gstReports.js';
import mongoose from 'mongoose';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 1 — Classify a product and enrich it with GST data
// POST /api/gst/classify
// Body: { productId?, name }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/classify', auth, async (req: Request, res: Response) => {
    try {
        const { productId, name } = req.body;
        if (!name) return res.status(400).json({ message: 'name is required' });

        const classification = await classifyProduct(name);

        // If productId provided, update the product document in-place
        if (productId) {
            await Product.findOneAndUpdate(
                { _id: productId, shopkeeperId: req.auth?.userId },
                {
                    $set: {
                        hsnCode: classification.hsnCode,
                        gstRate: classification.gstRate,
                        normalizedName: classification.normalizedName,
                        category: classification.category,
                    },
                }
            );
        }

        return res.json(classification);
    } catch (err: any) {
        console.error('[GST classify]', err);
        return res.status(500).json({ message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 1 — Bulk-classify all products that don't have gstRate yet
// POST /api/gst/classify-all
// ─────────────────────────────────────────────────────────────────────────────
router.post('/classify-all', auth, async (req: Request, res: Response) => {
    try {
        const products = await Product.find({
            shopkeeperId: req.auth?.userId,
            $or: [{ hsnCode: { $exists: false } }, { gstRate: { $exists: false } }],
        });

        const results: any[] = [];
        for (const p of products) {
            const c = await classifyProduct(p.name);
            await Product.updateOne(
                { _id: p._id },
                {
                    $set: {
                        hsnCode: c.hsnCode,
                        gstRate: c.gstRate,
                        normalizedName: c.normalizedName,
                        category: c.category,
                    },
                }
            );
            results.push({ productId: p._id, name: p.name, hsnCode: c.hsnCode, gstRate: c.gstRate, normalizedName: c.normalizedName, category: c.category });
        }

        return res.json({ classified: results.length, results });
    } catch (err: any) {
        console.error('[GST classify-all]', err);
        return res.status(500).json({ message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 2 + 3 — Create a GST Invoice (sale)
// POST /api/gst/invoices
// Body: { customerId?, billId?, items: RawItem[], priceIncludesGST? }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/invoices', auth, async (req: Request, res: Response) => {
    try {
        const { customerId, billId, items } = req.body as {
            customerId?: string;
            billId?: string;
            items: RawItem[];
        };

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'items array is required' });
        }

        // Auto-enrich items with GST data from DB / OpenAI if gstRate missing
        const enrichedItems: RawItem[] = await Promise.all(
            items.map(async (item) => {
                if (item.gstRate == null) {
                    const c = await classifyProduct(item.name);
                    return { ...item, hsnCode: c.hsnCode, gstRate: c.gstRate };
                }
                return item;
            })
        );

        const totals = calculateInvoice(enrichedItems);
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        // Persist GSTInvoice
        const invoice = await GSTInvoice.create({
            shopkeeperId: req.auth?.userId,
            customerId: customerId || undefined,
            billId: billId || undefined,
            ...totals,
            invoiceType: 'sale',
            month,
            year,
        });

        // Persist GSTLedger entry (output = sale)
        await GSTLedger.create({
            shopkeeperId: req.auth?.userId,
            type: 'output',
            gstInvoiceId: invoice._id,
            referenceId: billId ? new mongoose.Types.ObjectId(billId) : undefined,
            referenceType: billId ? 'Bill' : undefined,
            totalBaseAmount: totals.totalBaseAmount,
            totalCGST: totals.totalCGST,
            totalSGST: totals.totalSGST,
            totalGST: totals.totalGST,
            grandTotal: totals.grandTotal,
            month,
            year,
        });

        return res.status(201).json({ invoice });
    } catch (err: any) {
        console.error('[GST invoice]', err);
        return res.status(500).json({ message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 3 — Create a GST entry for a supplier purchase
// POST /api/gst/purchases
// Body: { supplierBillId?, items: RawItem[] }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/purchases', auth, async (req: Request, res: Response) => {
    try {
        const { supplierBillId, items } = req.body as {
            supplierBillId?: string;
            items: RawItem[];
        };

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'items array is required' });
        }

        const enrichedItems: RawItem[] = await Promise.all(
            items.map(async (item) => {
                if (item.gstRate == null) {
                    const c = await classifyProduct(item.name);
                    return { ...item, hsnCode: c.hsnCode, gstRate: c.gstRate };
                }
                return item;
            })
        );

        const totals = calculateInvoice(enrichedItems);
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const invoice = await GSTInvoice.create({
            shopkeeperId: req.auth?.userId,
            ...totals,
            invoiceType: 'purchase',
            month,
            year,
        });

        await GSTLedger.create({
            shopkeeperId: req.auth?.userId,
            type: 'input',
            gstInvoiceId: invoice._id,
            referenceId: supplierBillId ? new mongoose.Types.ObjectId(supplierBillId) : undefined,
            referenceType: supplierBillId ? 'SupplierBill' : undefined,
            totalBaseAmount: totals.totalBaseAmount,
            totalCGST: totals.totalCGST,
            totalSGST: totals.totalSGST,
            totalGST: totals.totalGST,
            grandTotal: totals.grandTotal,
            month,
            year,
        });

        return res.status(201).json({ invoice });
    } catch (err: any) {
        console.error('[GST purchase]', err);
        return res.status(500).json({ message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Get all GST invoices for the shop
// GET /api/gst/invoices?type=sale|purchase&month=&year=
// ─────────────────────────────────────────────────────────────────────────────
router.get('/invoices', auth, async (req: Request, res: Response) => {
    try {
        const { type, month, year } = req.query;
        const filter: any = { shopkeeperId: req.auth?.userId };
        if (type) filter.invoiceType = type;
        if (month) filter.month = Number(month);
        if (year) filter.year = Number(year);

        const invoices = await GSTInvoice.find(filter)
            .sort({ createdAt: -1 })
            .limit(200);

        return res.json(invoices);
    } catch (err: any) {
        return res.status(500).json({ message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GST Ledger entries
// GET /api/gst/ledger?type=input|output&month=&year=
// ─────────────────────────────────────────────────────────────────────────────
router.get('/ledger', auth, async (req: Request, res: Response) => {
    try {
        const { type, month, year } = req.query;
        const filter: any = { shopkeeperId: req.auth?.userId };
        if (type) filter.type = type;
        if (month) filter.month = Number(month);
        if (year) filter.year = Number(year);

        const entries = await GSTLedger.find(filter)
            .sort({ createdAt: -1 })
            .limit(200);

        return res.json(entries);
    } catch (err: any) {
        return res.status(500).json({ message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 4 — Monthly GST Summary
// GET /api/gst/reports/gst-summary?month=3&year=2026
// ─────────────────────────────────────────────────────────────────────────────
router.get('/reports/gst-summary', auth, async (req: Request, res: Response) => {
    try {
        const month = Number(req.query.month) || new Date().getMonth() + 1;
        const year = Number(req.query.year) || new Date().getFullYear();

        if (month < 1 || month > 12) {
            return res.status(400).json({ message: 'month must be 1-12' });
        }

        const summary = await getGSTSummary(req.auth!.userId, month, year);
        return res.json(summary);
    } catch (err: any) {
        console.error('[GST summary]', err);
        return res.status(500).json({ message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 5 — Monthly ITR Assistance Summary
// GET /api/gst/reports/itr-summary?month=3&year=2026
// ─────────────────────────────────────────────────────────────────────────────
router.get('/reports/itr-summary', auth, async (req: Request, res: Response) => {
    try {
        const month = Number(req.query.month) || new Date().getMonth() + 1;
        const year = Number(req.query.year) || new Date().getFullYear();

        if (month < 1 || month > 12) {
            return res.status(400).json({ message: 'month must be 1-12' });
        }

        const summary = await getITRSummary(req.auth!.userId, month, year);
        return res.json(summary);
    } catch (err: any) {
        console.error('[ITR summary]', err);
        return res.status(500).json({ message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper — Preview GST calculation without saving
// POST /api/gst/calculate
// Body: { items: RawItem[] }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/calculate', auth, async (req: Request, res: Response) => {
    try {
        const { items } = req.body as { items: RawItem[] };
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ message: 'items array is required' });
        }
        const totals = calculateInvoice(items);
        return res.json(totals);
    } catch (err: any) {
        return res.status(500).json({ message: err.message });
    }
});

export { router as gstRouter };
