import mongoose from 'mongoose';

const inventoryBatchSchema = new mongoose.Schema({
    shopkeeperId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    batchCode: { type: String },
    mfgDate: { type: Date },
    expiryDate: { type: Date },
    quantityReceived: { type: Number, required: true, min: 0 },
    quantityAvailable: { type: Number, required: true, min: 0 },
    costPricePerUnit: { type: Number, min: 0 },
    sellingPriceSnapshot: { type: Number, min: 0 },
    supplierBillId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupplierBill' },
    source: {
        type: String,
        enum: ['supplier_bill', 'manual', 'adjustment_return', 'system_reconciliation'],
        default: 'manual',
    },
    status: {
        type: String,
        enum: ['active', 'depleted', 'expired', 'returned'],
        default: 'active',
        index: true,
    },
}, { timestamps: true });

inventoryBatchSchema.index({ shopkeeperId: 1, expiryDate: 1, status: 1 });
inventoryBatchSchema.index({ productId: 1, expiryDate: 1 });

export const InventoryBatch = mongoose.model('InventoryBatch', inventoryBatchSchema);
