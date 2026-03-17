import express from 'express';
import mongoose from 'mongoose';
import { auth } from '../middleware/auth.js';
import { DiscountCode } from '../models/DiscountCode.js';
import { Product } from '../models/Product.js';
import { Bill } from '../models/Bill.js';
import { Customer } from '../models/Customer.js';
import { sendGenericMessage } from '../services/communicationService.js';

const router = express.Router();

function generateDiscountCode(productName: string, discountValue: number): string {
    const sanitized = productName
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 4)
        .toUpperCase();
    const dateStr = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short'
    }).replace(' ', '').toUpperCase();
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return `EXP${discountValue}${sanitized}${dateStr}${random}`;
}

router.post('/', auth, async (req, res) => {
    try {
        const shopkeeperId = req.auth?.userId;
        if (!shopkeeperId) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        const {
            productId,
            description,
            discountType,
            discountValue,
            minPurchase,
            maxUses,
            validUntil,
            createdFor,
            linkedBatchId,
        } = req.body || {};

        if (!discountType || !discountValue || !validUntil) {
            res.status(400).json({ message: 'discountType, discountValue, and validUntil are required' });
            return;
        }

        let productName = 'DISCOUNT';
        if (productId) {
            const product = await Product.findOne({ _id: productId, shopkeeperId });
            if (!product) {
                res.status(404).json({ message: 'Product not found' });
                return;
            }
            productName = product.name;
        }

        const code = generateDiscountCode(productName, discountValue);

        const discount = new DiscountCode({
            code,
            shopkeeperId,
            productId: productId || undefined,
            description: description || '',
            discountType,
            discountValue,
            minPurchase: minPurchase || 0,
            maxUses: maxUses || 100,
            validUntil: new Date(validUntil),
            createdFor: createdFor || 'manual',
            linkedBatchId: linkedBatchId || undefined,
        });

        await discount.save();
        res.status(201).json(discount);
    } catch (error: any) {
        if (error.code === 11000) {
            res.status(400).json({ message: 'Discount code already exists, please try again' });
            return;
        }
        res.status(400).json({ message: error.message || 'Failed to create discount code' });
    }
});

router.get('/', auth, async (req, res) => {
    try {
        const shopkeeperId = req.auth?.userId;
        if (!shopkeeperId) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        const { isActive, createdFor } = req.query;
        const query: Record<string, unknown> = { shopkeeperId };
        if (isActive !== undefined) query.isActive = isActive === 'true';
        if (createdFor) query.createdFor = createdFor;

        const discounts = await DiscountCode.find(query)
            .populate('productId', 'name icon')
            .sort({ createdAt: -1 })
            .limit(50);

        res.json(discounts);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to fetch discounts' });
    }
});

router.patch('/:id', auth, async (req, res) => {
    try {
        const shopkeeperId = req.auth?.userId;
        if (!shopkeeperId) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        const { isActive, discountValue, maxUses, validUntil } = req.body || {};

        const discount = await DiscountCode.findOne({ _id: req.params.id, shopkeeperId });
        if (!discount) {
            res.status(404).json({ message: 'Discount not found' });
            return;
        }

        if (isActive !== undefined) discount.isActive = isActive;
        if (discountValue !== undefined) discount.discountValue = discountValue;
        if (maxUses !== undefined) discount.maxUses = maxUses;
        if (validUntil) discount.validUntil = new Date(validUntil);

        await discount.save();
        res.json(discount);
    } catch (error: any) {
        res.status(400).json({ message: error.message || 'Failed to update discount' });
    }
});

router.post('/validate', auth, async (req, res) => {
    try {
        const shopkeeperId = req.auth?.userId;
        if (!shopkeeperId) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        const { code, customerId, billAmount } = req.body || {};
        if (!code) {
            res.status(400).json({ message: 'Code is required' });
            return;
        }

        const discount = await DiscountCode.findOne({
            code: code.toUpperCase(),
            shopkeeperId,
            isActive: true
        }).populate('productId', 'name');

        if (!discount) {
            res.status(404).json({ valid: false, message: 'Invalid discount code' });
            return;
        }

        const now = new Date();
        if (now < discount.validFrom || now > discount.validUntil) {
            res.status(400).json({ valid: false, message: 'Discount code has expired' });
            return;
        }

        if (discount.usedCount >= discount.maxUses) {
            res.status(400).json({ valid: false, message: 'Discount code usage limit reached' });
            return;
        }

        if (billAmount && billAmount < discount.minPurchase) {
            res.status(400).json({
                valid: false,
                message: `Minimum purchase of ₹${discount.minPurchase} required`
            });
            return;
        }

        let discountAmount = 0;
        if (discount.discountType === 'percentage') {
            discountAmount = (billAmount || 0) * (discount.discountValue / 100);
        } else {
            discountAmount = Math.min(discount.discountValue, billAmount || 0);
        }

        res.json({
            valid: true,
            discount: {
                code: discount.code,
                description: discount.description,
                discountType: discount.discountType,
                discountValue: discount.discountValue,
                discountAmount: Math.round(discountAmount * 100) / 100,
            }
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to validate discount' });
    }
});

router.post('/:id/apply', auth, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const shopkeeperId = req.auth?.userId;
        if (!shopkeeperId) {
            await session.abortTransaction();
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        const { billId, customerId, billAmount } = req.body || {};

        const discount = await DiscountCode.findOne({ _id: req.params.id, shopkeeperId }).session(session);
        if (!discount) {
            await session.abortTransaction();
            res.status(404).json({ message: 'Discount not found' });
            return;
        }

        if (!discount.isActive) {
            await session.abortTransaction();
            res.status(400).json({ message: 'Discount is not active' });
            return;
        }

        const now = new Date();
        if (now < discount.validFrom || now > discount.validUntil) {
            await session.abortTransaction();
            res.status(400).json({ message: 'Discount has expired' });
            return;
        }

        if (discount.usedCount >= discount.maxUses) {
            await session.abortTransaction();
            res.status(400).json({ message: 'Usage limit reached' });
            return;
        }

        let discountAmount = 0;
        if (discount.discountType === 'percentage') {
            discountAmount = (billAmount || 0) * (discount.discountValue / 100);
        } else {
            discountAmount = Math.min(discount.discountValue, billAmount || 0);
        }

        discount.usedCount += 1;
        discount.usageHistory.push({
            usedAt: new Date(),
            billId: billId ? new mongoose.Types.ObjectId(billId) : undefined,
            customerId: customerId ? new mongoose.Types.ObjectId(customerId) : undefined,
            discountAmount
        });
        await discount.save({ session });

        await session.commitTransaction();
        res.json({
            success: true,
            discountAmount: Math.round(discountAmount * 100) / 100,
            remainingUses: discount.maxUses - discount.usedCount
        });
    } catch (error: any) {
        await session.abortTransaction();
        res.status(400).json({ message: error.message || 'Failed to apply discount' });
    } finally {
        session.endSession();
    }
});

router.get('/customers/:productId', auth, async (req, res) => {
    try {
        const shopkeeperId = req.auth?.userId;
        if (!shopkeeperId) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        const { productId } = req.params;
        const { limit = 20 } = req.query;

        const productIdObj = Array.isArray(productId) ? productId[0] : productId;
        
        const recentBuyers = await Bill.aggregate([
            {
                $match: {
                    shopkeeperId: new mongoose.Types.ObjectId(shopkeeperId),
                    'items.productId': new mongoose.Types.ObjectId(productIdObj)
                }
            },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$customerId',
                    lastPurchased: { $first: '$createdAt' },
                    purchaseCount: { $sum: 1 },
                    totalSpent: { $sum: '$totalAmount' }
                }
            },
            { $sort: { lastPurchased: -1 } },
            { $limit: Number(limit) },
            {
                $lookup: {
                    from: 'customers',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'customer'
                }
            },
            { $unwind: '$customer' },
            {
                $project: {
                    _id: '$customer._id',
                    name: '$customer.name',
                    phoneNumber: '$customer.phoneNumber',
                    lastPurchased: 1,
                    purchaseCount: 1,
                    totalSpent: 1
                }
            }
        ]);

        res.json(recentBuyers);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to fetch customers' });
    }
});

router.post('/notify-customers', auth, async (req, res) => {
    try {
        const shopkeeperId = req.auth?.userId;
        if (!shopkeeperId) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        const { productId, discountCode, message, expiryDays } = req.body || {};
        if (!productId || !discountCode) {
            res.status(400).json({ message: 'productId and discountCode are required' });
            return;
        }

        const product = await Product.findOne({ _id: productId, shopkeeperId });
        if (!product) {
            res.status(404).json({ message: 'Product not found' });
            return;
        }

        const recentBuyers = await Bill.aggregate([
            {
                $match: {
                    shopkeeperId: new mongoose.Types.ObjectId(shopkeeperId),
                    'items.productId': new mongoose.Types.ObjectId(productId)
                }
            },
            { $sort: { createdAt: -1 } },
            { $group: { _id: '$customerId' } },
            { $limit: 50 },
            {
                $lookup: {
                    from: 'customers',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'customer'
                }
            },
            { $unwind: '$customer' },
            { $match: { 'customer.phoneNumber': { $exists: true, $ne: '' } } }
        ]);

        const defaultMessage = `🔥 Special Offer on ${product.name}! 
🔥 ${expiryDays || 3} days left before expiry!

Use code: ${discountCode}
Get ${discountCode.includes('15') ? '15%' : '10%'} OFF on your next purchase!

Valid for limited time only. Hurry!`;

        let sent = 0;
        let failed = 0;

        for (const buyer of recentBuyers) {
            const phone = buyer.customer.phoneNumber;
            if (phone && typeof phone === 'string') {
                const result = await sendGenericMessage(phone, message || defaultMessage, 'whatsapp');
                if (result === 'delivered') sent++;
                else failed++;
            }
        }

        res.json({
            success: true,
            sent,
            failed,
            total: recentBuyers.length
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to notify customers' });
    }
});

export { router as discountRouter };
