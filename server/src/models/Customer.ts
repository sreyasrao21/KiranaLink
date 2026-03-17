import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
    name: { type: String },
    phoneNumber: { type: String, required: true, unique: true },
    email: { type: String },
    khataBalance: { type: Number, default: 0 },
    trustScore: { type: Number, default: 600 },
    khataScore: { type: Number, default: 600 },
    khataLimit: { type: Number, default: 3000 },
    lastScoreUpdate: { type: Date, default: Date.now },
    nextCallDate: { type: Number }, // Timestamp
    recoveryStatus: { type: String, enum: ['Promised', 'Call Again', 'Busy', 'Failed', null], default: null },
    recoveryNotes: { type: String },
    visitValidation: { type: Number, default: 0 },
    loyaltyPoints: { type: Number, default: 0 },
    totalPurchases: { type: Number, default: 0 },
    preferredLanguage: { type: String, default: 'en' },
    preferredVoiceLanguage: { type: String, default: 'en' },
    lockVoiceLanguage: { type: Boolean, default: false },
    lastDetectedVoiceLanguage: { type: String },
    lastVoiceLanguageConfidence: { type: Number, default: 0 },
    voiceLanguageSource: {
        type: String,
        enum: ['manual', 'shop_default', 'detected', 'ivr'],
        default: 'shop_default'
    },
    voiceLanguageUpdatedAt: { type: Date },
    whatsappLastInboundAt: { type: Date },
    whatsappPendingSelection: {
        alias: { type: String },
        quantity: { type: Number },
        optionProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppOrder' },
        referenceCode: { type: String },
        requestedAt: { type: Date },
    },
}, { timestamps: true });

export const Customer = mongoose.model('Customer', customerSchema);
