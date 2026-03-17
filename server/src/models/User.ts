import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, unique: true, sparse: true },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Hashed
    phoneNumber: { type: String },
    googleId: { type: String, unique: true, sparse: true },
    shopName: { type: String },
    avatar: { type: String },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            default: undefined
        }
    },
    address: { type: String }, // Optional: store formatted address
    defaultVoiceLanguage: { type: String, default: 'en' },
    fallbackVoiceLanguage: { type: String, default: 'en' },
    voiceLanguagePolicy: {
        type: String,
        enum: ['manual', 'hybrid', 'auto'],
        default: 'hybrid'
    },
    enableVoiceLanguageMenu: { type: Boolean, default: true },
    supportedVoiceLanguages: { type: [String], default: ['en', 'hi', 'te'] }
}, { timestamps: true });

// Add geospatial index for efficient location queries
userSchema.index({ location: '2dsphere' });

export const User = mongoose.model('User', userSchema);
