import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';
import { GroupBuy } from '../models/GroupBuy.js';
import dotenv from 'dotenv';

dotenv.config();

async function clearDeals() {
    try {
        await mongoose.connect(process.env.MONGODB_URI!, { family: 4 });
        console.log('Connected to MongoDB for clearing deals...');

        await GroupBuy.deleteMany({});

        console.log('✅ Cleared all active Group Buy deals!');
        process.exit(0);
    } catch (err) {
        console.error('Clear failed:', err);
        process.exit(1);
    }
}

clearDeals();
