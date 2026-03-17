import mongoose, { Schema, Document } from 'mongoose';

export interface IReminderHistory {
    timestamp: Date;
    channel: string;
    message_content: string;
    delivery_status: string;
}

export interface IInvoice extends Document {
    invoice_id: string;
    client_name: string;
    client_email: string;
    client_phone: string;
    amount: number;
    due_date: Date;
    status: 'paid' | 'unpaid' | 'overdue' | 'disputed' | 'promised';
    reminder_level: number;
    last_contacted_at: Date | null;
    payment_link: string;
    reminder_history: IReminderHistory[];
    promised_date: Date | null;
    next_retry_at: Date | null;
    last_intent: string;
    ai_confidence: number;
    no_speech_count: number;
}

const ReminderHistorySchema = new Schema<IReminderHistory>({
    timestamp: { type: Date, default: Date.now },
    channel: { type: String, required: true },
    message_content: { type: String, required: true },
    delivery_status: { type: String, required: true },
});

const InvoiceSchema = new Schema<IInvoice>({
    invoice_id: { type: String, required: true, unique: true },
    client_name: { type: String, required: true },
    client_email: { type: String, required: true },
    client_phone: { type: String, required: true },
    amount: { type: Number, required: true },
    due_date: { type: Date, required: true },
    status: { type: String, enum: ['paid', 'unpaid', 'overdue', 'disputed', 'promised'], default: 'unpaid' },
    reminder_level: { type: Number, default: 0 },
    last_contacted_at: { type: Date, default: null },
    payment_link: { type: String, default: '' },
    reminder_history: [ReminderHistorySchema],
    promised_date: { type: Date, default: null },
    next_retry_at: { type: Date, default: null },
    last_intent: { type: String, default: 'UNKNOWN' },
    ai_confidence: { type: Number, default: 0 },
    no_speech_count: { type: Number, default: 0 },
}, { timestamps: true });

// Note: last_contacted_at updates should be handled within API controllers where reminder_history is modified to avoid complex Mongoose 9 typings issues.

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema);
