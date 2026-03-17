import mongoose, { Document, Schema } from 'mongoose';

export interface IGSTLedger extends Document {
    shopkeeperId: mongoose.Types.ObjectId;
    type: 'input' | 'output';     // input = purchase, output = sale
    gstInvoiceId: mongoose.Types.ObjectId;
    referenceId?: mongoose.Types.ObjectId; // Bill._id or SupplierBill._id
    referenceType?: 'Bill' | 'SupplierBill';
    totalBaseAmount: number;
    totalCGST: number;
    totalSGST: number;
    totalGST: number;
    grandTotal: number;
    month: number;
    year: number;
    createdAt: Date;
    updatedAt: Date;
}

const gstLedgerSchema = new Schema<IGSTLedger>(
    {
        shopkeeperId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        type: { type: String, enum: ['input', 'output'], required: true },
        gstInvoiceId: { type: Schema.Types.ObjectId, ref: 'GSTInvoice', required: true },
        referenceId: { type: Schema.Types.ObjectId },
        referenceType: { type: String, enum: ['Bill', 'SupplierBill'] },
        totalBaseAmount: { type: Number, required: true },
        totalCGST: { type: Number, required: true },
        totalSGST: { type: Number, required: true },
        totalGST: { type: Number, required: true },
        grandTotal: { type: Number, required: true },
        month: { type: Number, required: true },
        year: { type: Number, required: true },
    },
    { timestamps: true }
);

gstLedgerSchema.index({ shopkeeperId: 1, year: 1, month: 1, type: 1 });

export const GSTLedger = mongoose.model<IGSTLedger>('GSTLedger', gstLedgerSchema);
