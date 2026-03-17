import mongoose from 'mongoose';

const globalProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    // Stock might typically be infinite or not tracked for global template products, 
    // but assuming we copy it as a starting point.
    stock: { type: Number, required: true, default: 0 },
    category: { type: String },
    unit: { type: String },
    icon: { type: String },
}, { timestamps: true });

export const GlobalProduct = mongoose.model('GlobalProduct', globalProductSchema);
