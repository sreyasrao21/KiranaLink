import mongoose from 'mongoose';

const expiryActionSchema = new mongoose.Schema({
    shopkeeperId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryBatch', required: true, index: true },
    daysToExpiry: { type: Number, required: true },
    riskBucket: {
        type: String,
        enum: ['urgent_3d', 'week_7d', 'month_30d', 'expired'],
        required: true,
        index: true,
    },
    suggestedAction: {
        type: String,
        enum: ['discount', 'bundle', 'return', 'waste', 'none'],
        required: true,
    },
    actionStatus: {
        type: String,
        enum: ['open', 'in_progress', 'done', 'ignored'],
        default: 'open',
        index: true,
    },
    actionMeta: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actedAt: { type: Date },
    lastEvaluatedAt: { type: Date, default: Date.now },
    notificationSent: { type: Boolean, default: false },
    notificationSentAt: { type: Date },
    lastNotifiedBucket: { type: String },
}, { timestamps: true });

expiryActionSchema.index({ shopkeeperId: 1, riskBucket: 1, actionStatus: 1 });
expiryActionSchema.index({ batchId: 1, actionStatus: 1 });

export const ExpiryAction = mongoose.model('ExpiryAction', expiryActionSchema);
