import mongoose from 'mongoose';

const whatsAppOrderItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
}, { _id: false });

const whatsAppOrderSchema = new mongoose.Schema({
    shopkeeperId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerPhone: { type: String, required: true },
    customerMessage: { type: String, required: true },
    parsedText: { type: String },
    mediaUrl: { type: String },
    channel: { type: String, enum: ['whatsapp_text', 'whatsapp_audio'], required: true },
    status: {
        type: String,
        enum: ['received', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'],
        default: 'confirmed'
    },
    items: { type: [whatsAppOrderItemSchema], required: true },
    totalAmount: { type: Number, required: true },
    paymentMode: { type: String, enum: ['cash_pickup', 'upi_pickup', 'paid_online'], default: 'cash_pickup' },
    sourceWindow24h: { type: Boolean, default: true },
    referenceCode: { type: String, index: true },
    reviewState: {
        type: String,
        enum: ['none', 'needs_manual_review', 'awaiting_customer_choice'],
        default: 'none'
    },
    reviewReason: { type: String },
    autoDecisionReason: { type: String },
    resolutionSource: {
        type: String,
        enum: ['auto', 'customer_choice', 'shopkeeper_edit'],
        default: 'auto'
    },
    convertedBillId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' },
    convertedAt: { type: Date },
}, { timestamps: true });

export const WhatsAppOrder = mongoose.model('WhatsAppOrder', whatsAppOrderSchema);
