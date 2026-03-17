import express from 'express';
import mongoose from 'mongoose';
import { auth } from '../middleware/auth.js';
import { WasteLog } from '../models/WasteLog.js';
import { InventoryBatch } from '../models/InventoryBatch.js';
import { Product } from '../models/Product.js';
import { ExpiryAction } from '../models/ExpiryAction.js';

const router = express.Router();

router.post('/log', auth, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const shopkeeperId = req.auth?.userId;
        if (!shopkeeperId) {
            await session.abortTransaction();
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        const { batchId, quantity, reason, disposalMode, notes } = req.body || {};
        if (!batchId || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0 || !reason) {
            await session.abortTransaction();
            res.status(400).json({ message: 'batchId, quantity > 0 and reason are required' });
            return;
        }

        const batch = await InventoryBatch.findOne({ _id: batchId, shopkeeperId }).session(session);
        if (!batch) {
            await session.abortTransaction();
            res.status(404).json({ message: 'Batch not found' });
            return;
        }
        if (batch.quantityAvailable < Number(quantity)) {
            await session.abortTransaction();
            res.status(400).json({ message: 'Waste quantity exceeds available batch stock' });
            return;
        }

        const product = await Product.findOne({ _id: batch.productId, shopkeeperId }).session(session);
        if (!product) {
            await session.abortTransaction();
            res.status(404).json({ message: 'Linked product not found' });
            return;
        }

        const qty = Number(quantity);
        const unitCost = Number(batch.costPricePerUnit || product.costPrice || 0);
        const estimatedLoss = Number((unitCost * qty).toFixed(2));

        const waste = new WasteLog({
            shopkeeperId,
            productId: product._id,
            batchId: batch._id,
            reason,
            quantity: qty,
            unitCost,
            estimatedLoss,
            disposalMode: disposalMode || 'discarded',
            notes,
            loggedBy: shopkeeperId,
            loggedAt: new Date(),
        });
        await waste.save({ session });

        batch.quantityAvailable -= qty;
        if (batch.quantityAvailable <= 0) {
            batch.quantityAvailable = 0;
            batch.status = 'depleted';
        }
        await batch.save({ session });

        product.stock = Math.max(0, Number(product.stock || 0) - qty);
        await product.save({ session });

        await ExpiryAction.updateMany(
            { shopkeeperId, batchId: batch._id, actionStatus: { $in: ['open', 'in_progress'] } },
            { $set: { actionStatus: 'done', actedAt: new Date() } },
            { session }
        );

        await session.commitTransaction();
        res.status(201).json(waste);
    } catch (error: any) {
        await session.abortTransaction();
        res.status(400).json({ message: error.message || 'Failed to log waste' });
    } finally {
        session.endSession();
    }
});

router.get('/history', auth, async (req, res) => {
    try {
        const shopkeeperId = req.auth?.userId;
        if (!shopkeeperId) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        const { from, to } = req.query;
        const query: Record<string, unknown> = { shopkeeperId };
        if (from || to) {
            const dateQuery: Record<string, Date> = {};
            if (from) dateQuery.$gte = new Date(String(from));
            if (to) dateQuery.$lte = new Date(String(to));
            query.loggedAt = dateQuery;
        }

        const rows = await WasteLog.find(query)
            .populate('productId', 'name category unit icon')
            .populate('batchId', 'expiryDate batchCode')
            .sort({ loggedAt: -1 })
            .limit(300);

        res.json(rows);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to fetch waste history' });
    }
});

router.get('/kpi', auth, async (req, res) => {
    try {
        const shopkeeperId = req.auth?.userId;
        if (!shopkeeperId) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().setDate(new Date().getDate() - 30));
        const to = req.query.to ? new Date(String(req.query.to)) : new Date();

        const [wasteAgg, actionAgg] = await Promise.all([
            WasteLog.aggregate([
                {
                    $match: {
                        shopkeeperId: new mongoose.Types.ObjectId(shopkeeperId),
                        loggedAt: { $gte: from, $lte: to },
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalWasteValue: { $sum: '$estimatedLoss' },
                        totalWasteQty: { $sum: '$quantity' },
                    },
                },
            ]),
            ExpiryAction.aggregate([
                {
                    $match: {
                        shopkeeperId: new mongoose.Types.ObjectId(shopkeeperId),
                        actionStatus: 'done',
                        actedAt: { $gte: from, $lte: to },
                        suggestedAction: { $in: ['discount', 'bundle', 'return'] },
                    },
                },
                { $count: 'doneActions' },
            ]),
        ]);

        res.json({
            from,
            to,
            totalWasteValue: Number((wasteAgg[0]?.totalWasteValue || 0).toFixed(2)),
            totalWasteQty: Number((wasteAgg[0]?.totalWasteQty || 0).toFixed(2)),
            recoveredActions: actionAgg[0]?.doneActions || 0,
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to compute waste KPI' });
    }
});

export { router as wasteRouter };
