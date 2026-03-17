import express from 'express';
import { auth } from '../middleware/auth.js';
import { Product } from '../models/Product.js';
import { InventoryBatch } from '../models/InventoryBatch.js';
import { ExpiryAction } from '../models/ExpiryAction.js';
import {
    addStockBatch,
    getDaysToExpiry,
    getRiskBucket,
    getSuggestedAction,
    recalculateProductStockFromBatches,
} from '../services/inventoryBatches.js';

const router = express.Router();

router.post('/batches', auth, async (req, res) => {
    try {
        const shopkeeperId = req.auth?.userId;
        if (!shopkeeperId) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        const {
            productId,
            quantity,
            costPricePerUnit,
            sellingPriceSnapshot,
            batchCode,
            mfgDate,
            expiryDate,
        } = req.body || {};

        if (!productId || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
            res.status(400).json({ message: 'productId and quantity > 0 are required' });
            return;
        }

        const batch = await addStockBatch(shopkeeperId, {
            productId: String(productId),
            quantity: Number(quantity),
            costPricePerUnit: Number.isFinite(Number(costPricePerUnit)) ? Number(costPricePerUnit) : undefined,
            sellingPriceSnapshot: Number.isFinite(Number(sellingPriceSnapshot)) ? Number(sellingPriceSnapshot) : undefined,
            batchCode: batchCode ? String(batchCode) : undefined,
            mfgDate: mfgDate ? new Date(mfgDate) : undefined,
            expiryDate: expiryDate ? new Date(expiryDate) : undefined,
            source: 'manual',
        });

        res.status(201).json(batch);
    } catch (error: any) {
        res.status(400).json({ message: error.message || 'Failed to create batch' });
    }
});

router.get('/batches', auth, async (req, res) => {
    try {
        const shopkeeperId = req.auth?.userId;
        if (!shopkeeperId) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        const { status, productId } = req.query;
        const query: Record<string, unknown> = { shopkeeperId };
        if (status) query.status = status;
        if (productId) query.productId = String(productId);

        const batches = await InventoryBatch.find(query)
            .populate('productId', 'name category unit icon price')
            .sort({ expiryDate: 1, createdAt: -1 });
        res.json(batches);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to fetch batches' });
    }
});

router.patch('/batches/:id', auth, async (req, res) => {
    try {
        const shopkeeperId = req.auth?.userId;
        if (!shopkeeperId) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        const { status, batchCode, mfgDate, expiryDate } = req.body || {};
        const batch = await InventoryBatch.findOne({ _id: req.params.id, shopkeeperId });
        if (!batch) {
            res.status(404).json({ message: 'Batch not found' });
            return;
        }

        if (status && ['active', 'depleted', 'expired', 'returned'].includes(status)) {
            batch.status = status;
        }
        if (batchCode !== undefined) batch.batchCode = batchCode || undefined;
        if (mfgDate !== undefined) batch.mfgDate = mfgDate ? new Date(mfgDate) : undefined;
        if (expiryDate !== undefined) batch.expiryDate = expiryDate ? new Date(expiryDate) : undefined;
        await batch.save();

        await recalculateProductStockFromBatches(shopkeeperId, String(batch.productId));
        res.json(batch);
    } catch (error: any) {
        res.status(400).json({ message: error.message || 'Failed to update batch' });
    }
});

router.post('/recompute', auth, async (req, res) => {
    try {
        const shopkeeperId = req.auth?.userId;
        if (!shopkeeperId) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        const batches = await InventoryBatch.find({
            shopkeeperId,
            status: { $in: ['active', 'expired'] },
            quantityAvailable: { $gt: 0 },
        });

        let touched = 0;
        for (const batch of batches) {
            const daysToExpiry = getDaysToExpiry(batch.expiryDate);
            if (daysToExpiry === null) continue;

            if (daysToExpiry < 0 && batch.status !== 'expired') {
                batch.status = 'expired';
                await batch.save();
            }

            const riskBucket = getRiskBucket(daysToExpiry);
            if (!riskBucket) continue;
            const suggestedAction = getSuggestedAction(daysToExpiry, batch.quantityAvailable);

            await ExpiryAction.findOneAndUpdate(
                { shopkeeperId, batchId: batch._id, actionStatus: { $in: ['open', 'in_progress'] } },
                {
                    shopkeeperId,
                    productId: batch.productId,
                    batchId: batch._id,
                    daysToExpiry,
                    riskBucket,
                    suggestedAction,
                    lastEvaluatedAt: new Date(),
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            touched += 1;
        }

        res.json({ success: true, touched, scanned: batches.length });
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to recompute expiry queue' });
    }
});

router.get('/queue', auth, async (req, res) => {
    try {
        const shopkeeperId = req.auth?.userId;
        if (!shopkeeperId) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        const bucket = typeof req.query.bucket === 'string' ? req.query.bucket : undefined;
        const status = typeof req.query.status === 'string' ? req.query.status : 'open';

        const query: Record<string, unknown> = { shopkeeperId };
        if (bucket) query.riskBucket = bucket;
        if (status !== 'all') query.actionStatus = status;

        const actions = await ExpiryAction.find(query)
            .populate('productId', 'name category unit icon price costPrice')
            .populate('batchId', 'expiryDate quantityAvailable costPricePerUnit')
            .sort({ daysToExpiry: 1, updatedAt: -1 })
            .lean();

        const normalized = actions.map((entry: any) => {
            const cost = Number(entry?.batchId?.costPricePerUnit || entry?.productId?.costPrice || 0);
            const qty = Number(entry?.batchId?.quantityAvailable || 0);
            return {
                ...entry,
                valueAtRisk: Number((cost * qty).toFixed(2)),
            };
        });

        const summary = {
            urgent_3d: normalized.filter((a: any) => a.riskBucket === 'urgent_3d').length,
            week_7d: normalized.filter((a: any) => a.riskBucket === 'week_7d').length,
            month_30d: normalized.filter((a: any) => a.riskBucket === 'month_30d').length,
            expired: normalized.filter((a: any) => a.riskBucket === 'expired').length,
            totalValueAtRisk: Number(normalized.reduce((sum: number, a: any) => sum + (a.valueAtRisk || 0), 0).toFixed(2)),
        };

        res.json({ summary, items: normalized });
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to load expiry queue' });
    }
});

router.patch('/actions/:id', auth, async (req, res) => {
    try {
        const shopkeeperId = req.auth?.userId;
        if (!shopkeeperId) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        const { actionStatus, actionMeta } = req.body || {};
        if (!actionStatus || !['open', 'in_progress', 'done', 'ignored'].includes(actionStatus)) {
            res.status(400).json({ message: 'Valid actionStatus is required' });
            return;
        }

        const update: Record<string, unknown> = { actionStatus };
        if (actionMeta !== undefined) update.actionMeta = actionMeta;
        if (actionStatus === 'done' || actionStatus === 'ignored') {
            update.actedAt = new Date();
        }

        const action = await ExpiryAction.findOneAndUpdate(
            { _id: req.params.id, shopkeeperId },
            update,
            { new: true }
        );
        if (!action) {
            res.status(404).json({ message: 'Action not found' });
            return;
        }
        res.json(action);
    } catch (error: any) {
        res.status(400).json({ message: error.message || 'Failed to update action' });
    }
});

router.get('/kpi', auth, async (req, res) => {
    try {
        const shopkeeperId = req.auth?.userId;
        if (!shopkeeperId) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        const [riskItems, products] = await Promise.all([
            ExpiryAction.find({ shopkeeperId, actionStatus: { $in: ['open', 'in_progress'] } })
                .populate('batchId', 'quantityAvailable costPricePerUnit')
                .lean(),
            Product.countDocuments({ shopkeeperId }),
        ]);

        const atRiskValue = riskItems.reduce((sum: number, entry: any) => {
            const qty = Number(entry?.batchId?.quantityAvailable || 0);
            const cost = Number(entry?.batchId?.costPricePerUnit || 0);
            return sum + (qty * cost);
        }, 0);

        res.json({
            products,
            openRisks: riskItems.length,
            atRiskValue: Number(atRiskValue.toFixed(2)),
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to fetch KPI' });
    }
});

export { router as expiryRouter };
