import mongoose from 'mongoose';

const discountCodeSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true },
    shopkeeperId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    description: { type: String, default: '' },
    discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
    discountValue: { type: Number, required: true },
    minPurchase: { type: Number, default: 0 },
    maxUses: { type: Number, default: 100 },
    usedCount: { type: Number, default: 0 },
    validFrom: { type: Date, default: Date.now },
    validUntil: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    createdFor: { type: String, enum: ['expiry', 'manual', 'promotional'], default: 'manual' },
    linkedBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryBatch' },
    usageHistory: [{
        usedAt: { type: Date, default: Date.now },
        billId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' },
        customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
        discountAmount: Number
    }]
}, { timestamps: true });

discountCodeSchema.index({ shopkeeperId: 1, isActive: 1 });
discountCodeSchema.index({ code: 1, shopkeeperId: 1 });

export const DiscountCode = mongoose.model('DiscountCode', discountCodeSchema);
