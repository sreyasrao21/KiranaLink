import cron from 'node-cron';
import { InventoryBatch } from '../models/InventoryBatch.js';
import { ExpiryAction } from '../models/ExpiryAction.js';
import { Product } from '../models/Product.js';
import { User } from '../models/User.js';
import { getDaysToExpiry, getRiskBucket, getSuggestedAction } from '../services/inventoryBatches.js';
import { sendGenericMessage } from '../services/communicationService.js';

const BUCKET_MESSAGES: Record<string, { title: string; emoji: string }> = {
    urgent_3d: { title: 'URGENT - Expires in 3 days!', emoji: '🚨' },
    week_7d: { title: 'Expires in 7 days', emoji: '⚠️' },
    month_30d: { title: 'Expires in 30 days', emoji: '📅' },
    expired: { title: 'ALREADY EXPIRED!', emoji: '❌' }
};

async function sendExpiryNotification(
    shopkeeperId: string,
    productName: string,
    daysToExpiry: number,
    riskBucket: string,
    valueAtRisk: number,
    phoneNumber?: string
): Promise<boolean> {
    try {
        const bucketInfo = BUCKET_MESSAGES[riskBucket] || BUCKET_MESSAGES.month_30d;
        
        const message = `${bucketInfo.emoji} EXPIRY ALERT ${bucketInfo.emoji}

${bucketInfo.title}
Product: ${productName}
Days left: ${daysToExpiry < 0 ? 'EXPIRED!' : daysToExpiry}
Value at risk: ₹${valueAtRisk.toLocaleString()}

Please take action: Apply discount, create bundle, or log as waste.

- Smart Dukaan`;

        const phone = phoneNumber || process.env.SHOPKEEPER_NOTIFICATION_PHONE;
        if (!phone) {
            console.log(`[ExpiryNotification] No phone number for shopkeeper ${shopkeeperId}`);
            return false;
        }

        const result = await sendGenericMessage(phone, message, 'whatsapp');
        console.log(`[ExpiryNotification] Sent to ${phone}: ${result}`);
        return result === 'delivered';
    } catch (error) {
        console.error('[ExpiryNotification] Failed to send:', error);
        return false;
    }
}

async function runExpiryRecomputeJob() {
    const batches = await InventoryBatch.find({
        status: { $in: ['active', 'expired'] },
        quantityAvailable: { $gt: 0 },
    }).select('_id shopkeeperId productId expiryDate quantityAvailable costPricePerUnit status');

    const productCache = new Map<string, { name: string; costPrice?: number }>();
    
    let upserts = 0;
    let notifications = 0;

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

        const result = await ExpiryAction.findOneAndUpdate(
            {
                shopkeeperId: batch.shopkeeperId,
                batchId: batch._id,
                actionStatus: { $in: ['open', 'in_progress'] },
            },
            {
                shopkeeperId: batch.shopkeeperId,
                productId: batch.productId,
                batchId: batch._id,
                daysToExpiry,
                riskBucket,
                suggestedAction,
                lastEvaluatedAt: new Date(),
            },
            {
                upsert: true,
                setDefaultsOnInsert: true,
                new: true,
            }
        );

        upserts += 1;

        const shouldNotify = (riskBucket === 'urgent_3d' || riskBucket === 'expired') && 
                            (!result.notificationSent || result.lastNotifiedBucket !== riskBucket);

        if (shouldNotify) {
            let productName = 'Unknown Product';
            let costPrice = 0;
            
            if (productCache.has(batch.productId.toString())) {
                const cached = productCache.get(batch.productId.toString())!;
                productName = cached.name;
                costPrice = cached.costPrice || 0;
            } else {
                const product = await Product.findById(batch.productId).select('name costPrice').lean();
                if (product) {
                    productName = product.name;
                    costPrice = product.costPrice || 0;
                    productCache.set(batch.productId.toString(), { name: productName, costPrice });
                }
            }

            const valueAtRisk = (batch.costPricePerUnit || costPrice || 0) * batch.quantityAvailable;

            const shopkeeper = await User.findById(batch.shopkeeperId).select('phoneNumber').lean();
            const shopkeeperPhone = shopkeeper?.phoneNumber || undefined;

            const sent = await sendExpiryNotification(
                batch.shopkeeperId.toString(),
                productName,
                daysToExpiry,
                riskBucket,
                valueAtRisk,
                shopkeeperPhone
            );

            if (sent) {
                await ExpiryAction.updateOne(
                    { _id: result._id },
                    { 
                        notificationSent: true, 
                        notificationSentAt: new Date(),
                        lastNotifiedBucket: riskBucket 
                    }
                );
                notifications += 1;
            }
        }
    }

    console.log(`[ExpiryScheduler] scanned=${batches.length}, upserts=${upserts}, notifications=${notifications}`);
    return { scanned: batches.length, upserts, notifications };
}

export function startExpiryScheduler() {
    cron.schedule('15 8 * * *', async () => {
        try {
            const result = await runExpiryRecomputeJob();
            console.log(`[ExpiryScheduler] Daily run completed:`, result);
        } catch (error) {
            console.error('[ExpiryScheduler] failed', error);
        }
    });

    runExpiryRecomputeJob()
        .then((result) => console.log(`[ExpiryScheduler] initial run:`, result))
        .catch((error) => console.error('[ExpiryScheduler] initial run failed:', error));
}
