import mongoose from 'mongoose';

const ledgerEntrySchema = new mongoose.Schema({
    shopkeeperId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    billId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' }, // Optional if it's a direct payment
    amount: { type: Number, required: true },
    type: { type: String, enum: ['debit', 'credit'], required: true }, // debit = increase due, credit = payment received
    paymentMode: { type: String, enum: ['cash', 'online', 'ledger'], default: 'ledger' },
    status: { type: String, enum: ['pending', 'settled'], default: 'pending' },
}, { timestamps: true });

export const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema);
