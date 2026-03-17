import mongoose from 'mongoose';

const transcriptTurnSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    speaker: { type: String, enum: ['agent', 'customer', 'system'], required: true },
    text: { type: String, required: true },
}, { _id: false });

const voiceCallSessionSchema = new mongoose.Schema({
    callSid: { type: String, required: true, unique: true, index: true },
    invoiceId: { type: String, required: true, index: true },
    customerPhone: { type: String, required: true },
    stage: {
        type: String,
        enum: ['OPENING', 'ASK_PARTIAL_NOW', 'ASK_PARTIAL_AMOUNT', 'ASK_REMAINING_DATE', 'CONFIRM_PLAN', 'CLOSED'],
        default: 'OPENING',
    },
    status: {
        type: String,
        enum: ['active', 'completed', 'failed'],
        default: 'active',
    },
    turnCount: { type: Number, default: 0 },
    maxTurns: { type: Number, default: 6 },
    partialAmountNow: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
    promisedDate: { type: Date, default: null },
    outcomeIntent: { type: String, default: 'UNKNOWN' },
    confidence: { type: Number, default: 0 },
    confirmationPending: { type: Boolean, default: false },
    lastPrompt: { type: String, default: '' },
    lastRecordingSid: { type: String, default: '' },
    transcriptTurns: { type: [transcriptTurnSchema], default: [] },
    finalSummary: { type: String, default: '' },
    detectedLanguage: { type: String, default: 'en' },
    languageConfidence: { type: Number, default: 0 },
    isCodeMixed: { type: Boolean, default: false },
    fallbackMode: {
        type: String,
        enum: ['none', 'simple_prompt', 'dtmf', 'manual_callback'],
        default: 'none'
    },
    languageSwitchCount: { type: Number, default: 0 },
    selectedLanguageSource: {
        type: String,
        enum: ['customer', 'shop_default', 'location', 'ivr', 'detected', 'fallback'],
        default: 'fallback'
    },
}, { timestamps: true });

export const VoiceCallSession = mongoose.model('VoiceCallSession', voiceCallSessionSchema);
