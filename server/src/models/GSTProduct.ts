import mongoose, { Document, Schema } from 'mongoose';

export interface IGSTProduct extends Document {
    normalizedName: string;
    hsnCode: string;
    gstRate: number;       // e.g. 0, 5, 12, 18, 28
    category: string;
    createdAt: Date;
    updatedAt: Date;
}

const gstProductSchema = new Schema<IGSTProduct>(
    {
        normalizedName: { type: String, required: true, unique: true, lowercase: true, trim: true },
        hsnCode: { type: String, required: true },
        gstRate: { type: Number, required: true, default: 5 },
        category: { type: String, required: true },
    },
    { timestamps: true }
);

gstProductSchema.index({ normalizedName: 1 });

export const GSTProduct = mongoose.model<IGSTProduct>('GSTProduct', gstProductSchema);
