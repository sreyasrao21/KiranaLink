import mongoose from 'mongoose';

const wasteLogSchema = new mongoose.Schema({
    shopkeeperId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryBatch', required: true, index: true },
    reason: {
        type: String,
        enum: ['expired', 'damaged', 'spoilage', 'leakage', 'return_rejected', 'other'],
        required: true,
    },
    quantity: { type: Number, required: true, min: 0.0001 },
    unitCost: { type: Number, required: true, min: 0 },
    estimatedLoss: { type: Number, required: true, min: 0 },
    disposalMode: {
        type: String,
        enum: ['discarded', 'donated', 'supplier_returned'],
        default: 'discarded',
    },
    notes: { type: String },
    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    loggedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

wasteLogSchema.index({ shopkeeperId: 1, loggedAt: -1 });

export const WasteLog = mongoose.model('WasteLog', wasteLogSchema);
