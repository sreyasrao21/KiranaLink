import mongoose from 'mongoose';

const customerAccountSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    shopkeeperId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    balance: { type: Number, default: 0 },
}, { timestamps: true });

// Ensure a customer has only one account per shopkeeper
customerAccountSchema.index({ customerId: 1, shopkeeperId: 1 }, { unique: true });

export const CustomerAccount = mongoose.model('CustomerAccount', customerAccountSchema);
