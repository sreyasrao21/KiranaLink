import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { User } from '../models/User.js';
import { starterProducts } from '../utils/starterProducts.js';
import dotenv from 'dotenv';

dotenv.config();


async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI!, { family: 4 });
        console.log('Connected to MongoDB for seeding...');

        const firstUser = await User.findOne();
        if (!firstUser) {
            console.log('❌ No user found. Please register a shopkeeper account first.');
            process.exit(1);
        }

        console.log(`📡 Seeding products for shopkeeper: ${firstUser.email}`);

        const productsWithOwner = starterProducts.map(p => ({
            ...p,
            shopkeeperId: firstUser._id
        }));

        await Product.deleteMany({ shopkeeperId: firstUser._id });
        await Product.insertMany(productsWithOwner);

        console.log('✅ MongoDB Seeded successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Seed failed:', err);
        process.exit(1);
    }
}

seed();
