import mongoose, { Document, Schema } from 'mongoose';

// ── Invoice Item ─────────────────────────────────────────────────────────────
export interface IInvoiceItem {
    productId: mongoose.Types.ObjectId;
    name: string;
    hsnCode: string;
    gstRate: number;
    quantity: number;
    unitPrice: number;            // price per unit as entered
    priceIncludesGST: boolean;
    baseAmount: number;            // price ex-GST × qty
    cgstAmount: number;
    sgstAmount: number;
    totalAmount: number;            // final amount incl. GST × qty
}

const invoiceItemSchema = new Schema<IInvoiceItem>(
    {
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        hsnCode: { type: String, default: '' },
        gstRate: { type: Number, required: true, default: 0 },
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true },
        priceIncludesGST: { type: Boolean, default: true },
        baseAmount: { type: Number, required: true },
        cgstAmount: { type: Number, required: true },
        sgstAmount: { type: Number, required: true },
        totalAmount: { type: Number, required: true },
    },
    { _id: false }
);

// ── GST Invoice ───────────────────────────────────────────────────────────────
export interface IGSTInvoice extends Document {
    shopkeeperId: mongoose.Types.ObjectId;
    customerId?: mongoose.Types.ObjectId;
    billId?: mongoose.Types.ObjectId;   // reference to existing Bill if any
    items: IInvoiceItem[];
    totalBaseAmount: number;
    totalCGST: number;
    totalSGST: number;
    totalGST: number;
    grandTotal: number;
    invoiceType: 'sale' | 'purchase';
    month: number;
    year: number;
    createdAt: Date;
    updatedAt: Date;
}

const gstInvoiceSchema = new Schema<IGSTInvoice>(
    {
        shopkeeperId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
        billId: { type: Schema.Types.ObjectId, ref: 'Bill' },
        items: [invoiceItemSchema],
        totalBaseAmount: { type: Number, required: true },
        totalCGST: { type: Number, required: true },
        totalSGST: { type: Number, required: true },
        totalGST: { type: Number, required: true },
        grandTotal: { type: Number, required: true },
        invoiceType: { type: String, enum: ['sale', 'purchase'], required: true },
        month: { type: Number, required: true },
        year: { type: Number, required: true },
    },
    { timestamps: true }
);

gstInvoiceSchema.index({ shopkeeperId: 1, year: 1, month: 1 });
gstInvoiceSchema.index({ shopkeeperId: 1, invoiceType: 1 });

export const GSTInvoice = mongoose.model<IGSTInvoice>('GSTInvoice', gstInvoiceSchema);
