import mongoose from 'mongoose';

const groupBuySchema = new mongoose.Schema({
    shopkeeperId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    groupName: { type: String, required: true },
    members: [{ type: String }],
    products: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        quantity: { type: Number, required: true }
    }],
    totalAmount: { type: Number, required: true },

    // Detailed Pricing & Tiers
    marketPrice: { type: Number, required: true },
    dealPrice: { type: Number }, // Current active price
    tiers: [{
        goal: { type: Number, required: true },
        price: { type: Number, required: true },
        label: { type: String } // e.g., 'Gold', 'Silver'
    }],

    // Progress
    targetUnits: { type: Number, default: 10 },
    currentUnits: { type: Number, default: 0 },

    // Metadata
    image_url: { type: String },
    category: { type: String, default: 'General' },
    anchorShop: { type: String, default: 'Local Hub' },
    expiresAt: { type: Date },

    // AI & Status
    aiInsight: { type: String },
    status: { type: String, enum: ['active', 'completed', 'expired'], default: 'active' },

    // Location for proximity filtering (GeoJSON)
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: false // Optional, as some legacy deals might not have it
        }
    }
}, { timestamps: true });

// Add geospatial index for efficient proximity queries
groupBuySchema.index({ location: '2dsphere' });

export const GroupBuy = mongoose.model('GroupBuy', groupBuySchema);
