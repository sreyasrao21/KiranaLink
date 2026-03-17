import express from 'express';
import { Product } from '../models/Product.js';
import { auth } from '../middleware/auth.js';
import { classifyProduct } from '../services/gstClassification.js';

const router = express.Router();

// Get all products
router.get('/', auth, async (req, res) => {
    try {
        const products = await Product.find({ shopkeeperId: req.auth?.userId });
        res.json(products);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

// Create product
router.post('/', auth, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: 'Product name is required' });

        // Auto-classify using AI/Cache
        const classification = await classifyProduct(name);

        const product = new Product({
            ...req.body,
            ...classification, // Enrich with hsnCode, gstRate, category, normalizedName
            shopkeeperId: req.auth?.userId
        });

        const newProduct = await product.save();
        res.status(201).json(newProduct);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});


// Update product (e.g., manual stock adjustment)
router.patch('/:id', auth, async (req, res) => {
    try {
        const updatedProduct = await Product.findOneAndUpdate(
            { _id: req.params.id, shopkeeperId: req.auth?.userId },
            req.body,
            { new: true }
        );
        res.json(updatedProduct);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

// Seed products
router.post('/seed', auth, async (req, res) => {
    const products = [
        // Grains & Flours
        { name: 'Basmati Rice', price: 90, stock: 100, category: 'Grain', unit: 'kg', icon: '🌾' },
        { name: 'Atta (Wheat Flour)', price: 45, stock: 500, category: 'Flour', unit: 'kg', icon: '🌾' },
        { name: 'Sona Masuri Rice', price: 60, stock: 200, category: 'Grain', unit: 'kg', icon: '🍚' },
        { name: 'Maida', price: 40, stock: 150, category: 'Flour', unit: 'kg', icon: '⚪' },
        { name: 'Besan', price: 80, stock: 120, category: 'Flour', unit: 'kg', icon: '🟡' },
        { name: 'Poha', price: 55, stock: 100, category: 'Grain', unit: 'kg', icon: '🥣' },
        { name: 'Dalia', price: 65, stock: 80, category: 'Grain', unit: 'kg', icon: '🌾' },
        { name: 'Sooji (Rava)', price: 50, stock: 150, category: 'Grain', unit: 'kg', icon: '⚪' },

        // Pulses & Dals
        { name: 'Toor Dal', price: 165, stock: 80, category: 'Pulses', unit: 'kg', icon: '🍲' },
        { name: 'Moong Dal', price: 110, stock: 100, category: 'Pulses', unit: 'kg', icon: '🍲' },
        { name: 'Chana Dal', price: 95, stock: 120, category: 'Pulses', unit: 'kg', icon: '🍲' },
        { name: 'Urad Dal', price: 140, stock: 70, category: 'Pulses', unit: 'kg', icon: '🍲' },
        { name: 'Masoor Dal', price: 105, stock: 90, category: 'Pulses', unit: 'kg', icon: '🍲' },
        { name: 'Kabuli Chana', price: 130, stock: 60, category: 'Pulses', unit: 'kg', icon: '⚪' },
        { name: 'Kala Chana', price: 90, stock: 100, category: 'Pulses', unit: 'kg', icon: '🟤' },
        { name: 'Rajma', price: 150, stock: 50, category: 'Pulses', unit: 'kg', icon: '🟤' },

        // Oils & Ghee
        { name: 'Sunflower Oil', price: 135, stock: 100, category: 'Oil', unit: 'litre', icon: '🌻' },
        { name: 'Mustard Oil', price: 160, stock: 80, category: 'Oil', unit: 'litre', icon: '🛢️' },
        { name: 'Groundnut Oil', price: 180, stock: 60, category: 'Oil', unit: 'litre', icon: '🥜' },
        { name: 'Coconut Oil', price: 240, stock: 40, category: 'Oil', unit: 'litre', icon: '🥥' },
        { name: 'Desi Ghee', price: 650, stock: 30, category: 'Dairy', unit: 'kg', icon: '🧈' },

        // Dairy
        { name: 'Fresh Milk', price: 62, stock: 200, category: 'Dairy', unit: 'litre', icon: '🥛' },
        { name: 'Curd (Loose)', price: 80, stock: 50, category: 'Dairy', unit: 'kg', icon: '🥣' },
        { name: 'Paneer', price: 450, stock: 20, category: 'Dairy', unit: 'kg', icon: '🧀' },

        // Spices & Condiments
        { name: 'Sugar', price: 44, stock: 500, category: 'Grocery', unit: 'kg', icon: '🍬' },
        { name: 'Salt', price: 22, stock: 300, category: 'Grocery', unit: 'kg', icon: '🧂' },
        { name: 'Turmeric Powder', price: 280, stock: 40, category: 'Spices', unit: 'kg', icon: '🟡' },
        { name: 'Red Chili Powder', price: 350, stock: 40, category: 'Spices', unit: 'kg', icon: '🌶️' },
        { name: 'Coriander Powder', price: 240, stock: 50, category: 'Spices', unit: 'kg', icon: '🌿' },
        { name: 'Cumin (Jeera)', price: 600, stock: 30, category: 'Spices', unit: 'kg', icon: '🌿' },
        { name: 'Black Pepper', price: 850, stock: 15, category: 'Spices', unit: 'kg', icon: '⚫' },
        { name: 'Cardamom (Elaichi)', price: 3200, stock: 5, category: 'Spices', unit: 'kg', icon: '🟢' },
        { name: 'Cloves', price: 1200, stock: 10, category: 'Spices', unit: 'kg', icon: '🟤' },
        { name: 'Jaggery (Gur)', price: 70, stock: 100, category: 'Grocery', unit: 'kg', icon: '🟤' },

        // Vegetables (Bulk Items)
        { name: 'Potatoes', price: 30, stock: 200, category: 'Vegetables', unit: 'kg', icon: '🥔' },
        { name: 'Onions', price: 45, stock: 200, category: 'Vegetables', unit: 'kg', icon: '🧅' },
        { name: 'Tomatoes', price: 40, stock: 100, category: 'Vegetables', unit: 'kg', icon: '🍅' },
        { name: 'Garlic', price: 200, stock: 40, category: 'Vegetables', unit: 'kg', icon: '🧄' },
        { name: 'Ginger', price: 180, stock: 30, category: 'Vegetables', unit: 'kg', icon: '🫚' },

        // Cleaning & Others (Weighed/Bulk)
        { name: 'Detergent Powder', price: 110, stock: 150, category: 'Cleaning', unit: 'kg', icon: '🧺' },
        { name: 'Dishwash Bar/Powder', price: 90, stock: 100, category: 'Cleaning', unit: 'kg', icon: '🧼' },
        { name: 'Loose Tea', price: 350, stock: 60, category: 'Beverage', unit: 'kg', icon: '☕' },
        { name: 'Coffee Beans', price: 800, stock: 20, category: 'Beverage', unit: 'kg', icon: '🫘' },
        { name: 'Peanuts', price: 140, stock: 80, category: 'Dry Fruits', unit: 'kg', icon: '🥜' },
        { name: 'Cashews', price: 900, stock: 25, category: 'Dry Fruits', unit: 'kg', icon: '🥜' },
        { name: 'Almonds', price: 850, stock: 30, category: 'Dry Fruits', unit: 'kg', icon: '🥜' },
        { name: 'Raisins', price: 400, stock: 40, category: 'Dry Fruits', unit: 'kg', icon: '🍇' },
        { name: 'Dates', price: 350, stock: 50, category: 'Dry Fruits', unit: 'kg', icon: '🌴' },
        { name: 'Honey', price: 450, stock: 30, category: 'Grocery', unit: 'kg', icon: '🍯' },
    ].map(p => ({ ...p, shopkeeperId: req.auth?.userId }));

    try {
        await Product.deleteMany({ shopkeeperId: req.auth?.userId });
        const seededProducts = await Product.insertMany(products);
        res.status(201).json(seededProducts);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

export { router as productRouter };
