import mongoose from 'mongoose';

const lineItemSchema = new mongoose.Schema({
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String },
    totalAmount: { type: Number, required: true },
    costPrice: { type: Number },
    sellingPrice: { type: Number }
});

const supplierBillSchema = new mongoose.Schema({
    shopkeeperId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [lineItemSchema],
    totalAmount: { type: Number, default: 0 },
    itemCount: { type: Number, default: 0 },
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ['processed'], default: 'processed' } // Future proofing
}, { timestamps: true });

export const SupplierBill = mongoose.model('SupplierBill', supplierBillSchema);
