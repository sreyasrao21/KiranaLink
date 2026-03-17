import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    shopkeeperId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    costPrice: { type: Number },
    stock: { type: Number, required: true },
    category: { type: String },
    unit: { type: String },
    icon: { type: String },
    // GST Classification (populated lazily on first sale / via /api/gst/classify)
    normalizedName: { type: String },
    hsnCode: { type: String },
    gstRate: { type: Number },            // e.g. 0, 5, 12, 18, 28
}, { timestamps: true });

export const Product = mongoose.model('Product', productSchema);

