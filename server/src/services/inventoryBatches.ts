import mongoose from 'mongoose';
import { InventoryBatch } from '../models/InventoryBatch.js';
import { Product } from '../models/Product.js';

type SessionArg = { session?: mongoose.ClientSession };

function withSession<T extends { session: (session: mongoose.ClientSession) => T }>(query: T, session?: mongoose.ClientSession): T {
    return session ? query.session(session) : query;
}

function normalizeDay(date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function getDaysToExpiry(expiryDate?: Date | null): number | null {
    if (!expiryDate) return null;
    const today = normalizeDay(new Date());
    const expiry = normalizeDay(expiryDate);
    const diffMs = expiry.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function getRiskBucket(daysToExpiry: number): 'urgent_3d' | 'week_7d' | 'month_30d' | 'expired' | null {
    if (daysToExpiry < 0) return 'expired';
    if (daysToExpiry <= 3) return 'urgent_3d';
    if (daysToExpiry <= 7) return 'week_7d';
    if (daysToExpiry <= 30) return 'month_30d';
    return null;
}

export function getSuggestedAction(daysToExpiry: number, quantityAvailable: number): 'discount' | 'bundle' | 'return' | 'waste' | 'none' {
    if (daysToExpiry < 0) return 'waste';
    if (daysToExpiry <= 2 && quantityAvailable >= 15) return 'discount';
    if (daysToExpiry <= 2) return 'bundle';
    if (daysToExpiry <= 7 && quantityAvailable >= 25) return 'discount';
    if (daysToExpiry <= 7) return 'bundle';
    if (daysToExpiry <= 30) return 'return';
    return 'none';
}

function fefoSort(a: { expiryDate?: Date | null; createdAt?: Date }, b: { expiryDate?: Date | null; createdAt?: Date }) {
    if (a.expiryDate && b.expiryDate) {
        const diff = a.expiryDate.getTime() - b.expiryDate.getTime();
        if (diff !== 0) return diff;
    } else if (a.expiryDate && !b.expiryDate) {
        return -1;
    } else if (!a.expiryDate && b.expiryDate) {
        return 1;
    }
    return (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
}

export async function consumeProductStockFEFO(
    shopkeeperId: string,
    productId: string,
    quantity: number,
    args: SessionArg = {},
) {
    const { session } = args;
    if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
    }

    const product = await withSession(Product.findOne({ _id: productId, shopkeeperId }), session);
    if (!product) throw new Error('Product not found');
    if ((product.stock || 0) < quantity) throw new Error(`Insufficient stock for ${product.name}`);

    const batches = await withSession(InventoryBatch.find({
        shopkeeperId,
        productId,
        status: { $in: ['active', 'expired'] },
        quantityAvailable: { $gt: 0 },
    }), session);

    if (!batches.length) {
        product.stock -= quantity;
        await product.save({ session });
        return { usedBatches: [], product };
    }

    const trackedQty = batches.reduce((sum, batch) => sum + Number(batch.quantityAvailable || 0), 0);
    const untrackedQty = Math.max(0, Number(product.stock || 0) - trackedQty);
    if (untrackedQty > 0) {
        const shadowBatch = await InventoryBatch.create([{
            shopkeeperId,
            productId,
            quantityReceived: untrackedQty,
            quantityAvailable: untrackedQty,
            costPricePerUnit: product.costPrice || 0,
            sellingPriceSnapshot: product.price,
            source: 'system_reconciliation',
            status: 'active',
        }], { session });
        batches.push(shadowBatch[0]);
    }

    const sorted = [...batches].sort(fefoSort);
    let remaining = quantity;
    const usedBatches: Array<{ batchId: string; quantity: number }> = [];

    for (const batch of sorted) {
        if (remaining <= 0) break;
        const useQty = Math.min(batch.quantityAvailable, remaining);
        if (useQty <= 0) continue;

        batch.quantityAvailable -= useQty;
        if (batch.quantityAvailable <= 0) {
            batch.quantityAvailable = 0;
            batch.status = 'depleted';
        } else if (batch.status !== 'expired') {
            batch.status = 'active';
        }
        await batch.save({ session });
        usedBatches.push({ batchId: String(batch._id), quantity: useQty });
        remaining -= useQty;
    }

    if (remaining > 0) throw new Error(`Insufficient FEFO stock for ${product.name}`);

    product.stock -= quantity;
    await product.save({ session });
    return { usedBatches, product };
}

export async function addStockBatch(
    shopkeeperId: string,
    input: {
        productId: string;
        quantity: number;
        costPricePerUnit?: number;
        sellingPriceSnapshot?: number;
        batchCode?: string;
        mfgDate?: Date;
        expiryDate?: Date;
        supplierBillId?: string;
        source?: 'supplier_bill' | 'manual' | 'adjustment_return' | 'system_reconciliation';
    },
    args: SessionArg = {},
) {
    const { session } = args;
    const product = await withSession(Product.findOne({ _id: input.productId, shopkeeperId }), session);
    if (!product) throw new Error('Product not found');
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error('Quantity must be > 0');

    const batch = new InventoryBatch({
        shopkeeperId,
        productId: input.productId,
        batchCode: input.batchCode,
        mfgDate: input.mfgDate,
        expiryDate: input.expiryDate,
        quantityReceived: input.quantity,
        quantityAvailable: input.quantity,
        costPricePerUnit: input.costPricePerUnit,
        sellingPriceSnapshot: input.sellingPriceSnapshot,
        supplierBillId: input.supplierBillId,
        source: input.source || 'manual',
        status: 'active',
    });
    await batch.save({ session });

    product.stock += input.quantity;
    await product.save({ session });
    return batch;
}

export async function releaseStockBackToBatch(
    shopkeeperId: string,
    productId: string,
    quantity: number,
    args: SessionArg = {},
) {
    const { session } = args;
    const product = await withSession(Product.findOne({ _id: productId, shopkeeperId }), session);
    if (!product) throw new Error('Product not found');
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantity must be > 0');

    const fallbackBatch = await withSession(InventoryBatch.findOne({
        shopkeeperId,
        productId,
        source: 'adjustment_return',
        status: { $in: ['active', 'expired'] },
    }).sort({ updatedAt: -1 }), session);

    if (fallbackBatch) {
        fallbackBatch.quantityAvailable += quantity;
        fallbackBatch.quantityReceived += quantity;
        fallbackBatch.status = 'active';
        await fallbackBatch.save({ session });
    } else {
        const batch = new InventoryBatch({
            shopkeeperId,
            productId,
            quantityReceived: quantity,
            quantityAvailable: quantity,
            costPricePerUnit: product.costPrice || 0,
            sellingPriceSnapshot: product.price,
            source: 'adjustment_return',
            status: 'active',
        });
        await batch.save({ session });
    }

    product.stock += quantity;
    await product.save({ session });
}

export async function recalculateProductStockFromBatches(shopkeeperId: string, productId: string, args: SessionArg = {}) {
    const { session } = args;
    const total = await withSession(InventoryBatch.aggregate([
        {
            $match: {
                shopkeeperId: new mongoose.Types.ObjectId(shopkeeperId),
                productId: new mongoose.Types.ObjectId(productId),
                status: { $in: ['active', 'expired'] },
            },
        },
        { $group: { _id: '$productId', qty: { $sum: '$quantityAvailable' } } },
    ]), session);

    const stock = total[0]?.qty || 0;
    const product = await withSession(Product.findOne({ _id: productId, shopkeeperId }), session);
    if (!product) return null;
    product.stock = stock;
    await product.save({ session });
    return product;
}
