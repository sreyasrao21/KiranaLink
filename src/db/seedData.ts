import { db, type Product } from './db';

export const smartDukaanProducts: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[] = [
    // Rice & Grains
    { name: 'Basmati Rice', price: 180, stock: 50, minStock: 10, icon: '🍚', category: 'Rice & Grains', unit: 'kg' },
    { name: 'Sona Masoori Rice', price: 65, stock: 40, minStock: 10, icon: '🍚', category: 'Rice & Grains', unit: 'kg' },
    { name: 'Wheat Flour (Atta)', price: 45, stock: 60, minStock: 15, icon: '🌾', category: 'Rice & Grains', unit: 'kg' },
    { name: 'Maida (All Purpose)', price: 40, stock: 30, minStock: 10, icon: '🌾', category: 'Rice & Grains', unit: 'kg' },
    { name: 'Sooji (Rava)', price: 50, stock: 25, minStock: 8, icon: '🌾', category: 'Rice & Grains', unit: 'kg' },

    // Dal & Pulses
    { name: 'Toor Dal', price: 140, stock: 35, minStock: 10, icon: '🫘', category: 'Dal & Pulses', unit: 'kg' },
    { name: 'Moong Dal', price: 130, stock: 30, minStock: 10, icon: '🫘', category: 'Dal & Pulses', unit: 'kg' },
    { name: 'Chana Dal', price: 110, stock: 28, minStock: 8, icon: '🫘', category: 'Dal & Pulses', unit: 'kg' },
    { name: 'Masoor Dal', price: 120, stock: 25, minStock: 8, icon: '🫘', category: 'Dal & Pulses', unit: 'kg' },
    { name: 'Urad Dal', price: 135, stock: 22, minStock: 8, icon: '🫘', category: 'Dal & Pulses', unit: 'kg' },
    { name: 'Rajma (Kidney Beans)', price: 160, stock: 20, minStock: 5, icon: '🫘', category: 'Dal & Pulses', unit: 'kg' },

    // Cooking Oil
    { name: 'Sunflower Oil', price: 180, stock: 40, minStock: 10, icon: '🛢️', category: 'Cooking Oil', unit: 'litre' },
    { name: 'Mustard Oil', price: 200, stock: 35, minStock: 10, icon: '🛢️', category: 'Cooking Oil', unit: 'litre' },
    { name: 'Groundnut Oil', price: 220, stock: 30, minStock: 8, icon: '🛢️', category: 'Cooking Oil', unit: 'litre' },
    { name: 'Refined Oil', price: 150, stock: 45, minStock: 12, icon: '🛢️', category: 'Cooking Oil', unit: 'litre' },

    // Dairy
    { name: 'Amul Milk (500ml)', price: 28, stock: 80, minStock: 20, icon: '🥛', category: 'Dairy', unit: 'packet' },
    { name: 'Amul Milk (1L)', price: 56, stock: 60, minStock: 15, icon: '🥛', category: 'Dairy', unit: 'packet' },
    { name: 'Amul Butter (100g)', price: 60, stock: 40, minStock: 10, icon: '🧈', category: 'Dairy', unit: 'packet' },
    { name: 'Amul Cheese (200g)', price: 120, stock: 30, minStock: 8, icon: '🧀', category: 'Dairy', unit: 'packet' },
    { name: 'Curd (Dahi) 400g', price: 35, stock: 50, minStock: 15, icon: '🥛', category: 'Dairy', unit: 'packet' },
    { name: 'Paneer (200g)', price: 80, stock: 25, minStock: 8, icon: '🧀', category: 'Dairy', unit: 'packet' },

    // Biscuits & Snacks
    { name: 'Parle-G Biscuits', price: 10, stock: 100, minStock: 30, icon: '🍪', category: 'Biscuits', unit: 'packet' },
    { name: 'Good Day Biscuits', price: 20, stock: 80, minStock: 25, icon: '🍪', category: 'Biscuits', unit: 'packet' },
    { name: 'Marie Gold', price: 25, stock: 70, minStock: 20, icon: '🍪', category: 'Biscuits', unit: 'packet' },
    { name: 'Hide & Seek', price: 30, stock: 60, minStock: 20, icon: '🍪', category: 'Biscuits', unit: 'packet' },
    { name: 'Bourbon Biscuits', price: 20, stock: 75, minStock: 25, icon: '🍪', category: 'Biscuits', unit: 'packet' },
    { name: 'Kurkure (90g)', price: 20, stock: 90, minStock: 30, icon: '🌽', category: 'Snacks', unit: 'packet' },
    { name: 'Lays Chips (52g)', price: 20, stock: 85, minStock: 30, icon: '🥔', category: 'Snacks', unit: 'packet' },
    { name: 'Haldiram Bhujia (200g)', price: 50, stock: 40, minStock: 15, icon: '🥜', category: 'Snacks', unit: 'packet' },
    { name: 'Maggi Noodles', price: 14, stock: 120, minStock: 40, icon: '🍜', category: 'Snacks', unit: 'packet' },

    // Spices & Masala
    { name: 'Red Chilli Powder', price: 80, stock: 35, minStock: 10, icon: '🌶️', category: 'Spices', unit: '100g' },
    { name: 'Turmeric Powder', price: 60, stock: 40, minStock: 10, icon: '🌶️', category: 'Spices', unit: '100g' },
    { name: 'Coriander Powder', price: 50, stock: 38, minStock: 10, icon: '🌿', category: 'Spices', unit: '100g' },
    { name: 'Garam Masala', price: 90, stock: 30, minStock: 8, icon: '🌶️', category: 'Spices', unit: '100g' },
    { name: 'Cumin Seeds (Jeera)', price: 120, stock: 25, minStock: 8, icon: '🌿', category: 'Spices', unit: '100g' },
    { name: 'Mustard Seeds', price: 70, stock: 28, minStock: 8, icon: '🌿', category: 'Spices', unit: '100g' },
    { name: 'MDH Chana Masala', price: 45, stock: 35, minStock: 10, icon: '📦', category: 'Spices', unit: 'packet' },
    { name: 'Everest Kitchen King', price: 50, stock: 32, minStock: 10, icon: '📦', category: 'Spices', unit: 'packet' },

    // Sugar & Salt
    { name: 'Sugar', price: 45, stock: 50, minStock: 15, icon: '🧂', category: 'Sugar & Salt', unit: 'kg' },
    { name: 'Tata Salt', price: 22, stock: 60, minStock: 20, icon: '🧂', category: 'Sugar & Salt', unit: 'kg' },
    { name: 'Jaggery (Gur)', price: 60, stock: 30, minStock: 10, icon: '🍯', category: 'Sugar & Salt', unit: 'kg' },

    // Tea & Coffee
    { name: 'Tata Tea Gold (250g)', price: 140, stock: 40, minStock: 12, icon: '☕', category: 'Tea & Coffee', unit: 'packet' },
    { name: 'Red Label Tea (250g)', price: 120, stock: 45, minStock: 12, icon: '☕', category: 'Tea & Coffee', unit: 'packet' },
    { name: 'Nescafe Coffee (50g)', price: 180, stock: 30, minStock: 10, icon: '☕', category: 'Tea & Coffee', unit: 'packet' },
    { name: 'Bru Coffee (50g)', price: 160, stock: 28, minStock: 10, icon: '☕', category: 'Tea & Coffee', unit: 'packet' },

    // Personal Care
    { name: 'Lux Soap', price: 35, stock: 60, minStock: 20, icon: '🧼', category: 'Personal Care', unit: 'piece' },
    { name: 'Lifebuoy Soap', price: 30, stock: 65, minStock: 20, icon: '🧼', category: 'Personal Care', unit: 'piece' },
    { name: 'Dove Soap', price: 55, stock: 40, minStock: 15, icon: '🧼', category: 'Personal Care', unit: 'piece' },
    { name: 'Colgate (200g)', price: 85, stock: 50, minStock: 15, icon: '🪥', category: 'Personal Care', unit: 'piece' },
    { name: 'Clinic Plus Shampoo', price: 120, stock: 35, minStock: 12, icon: '🧴', category: 'Personal Care', unit: 'piece' },
    { name: 'Pantene Shampoo', price: 180, stock: 28, minStock: 10, icon: '🧴', category: 'Personal Care', unit: 'piece' },
    { name: 'Dettol Handwash', price: 75, stock: 40, minStock: 12, icon: '🧴', category: 'Personal Care', unit: 'piece' },

    // Household
    { name: 'Vim Bar', price: 10, stock: 80, minStock: 25, icon: '🧽', category: 'Household', unit: 'piece' },
    { name: 'Surf Excel (1kg)', price: 180, stock: 35, minStock: 10, icon: '🧺', category: 'Household', unit: 'packet' },
    { name: 'Ariel Detergent (1kg)', price: 220, stock: 30, minStock: 10, icon: '🧺', category: 'Household', unit: 'packet' },
    { name: 'Harpic Toilet Cleaner', price: 95, stock: 40, minStock: 12, icon: '🧴', category: 'Household', unit: 'piece' },
    { name: 'Colin Glass Cleaner', price: 85, stock: 30, minStock: 10, icon: '🧴', category: 'Household', unit: 'piece' },

    // Beverages
    { name: 'Coca Cola (750ml)', price: 40, stock: 50, minStock: 20, icon: '🥤', category: 'Beverages', unit: 'piece' },
    { name: 'Pepsi (750ml)', price: 40, stock: 48, minStock: 20, icon: '🥤', category: 'Beverages', unit: 'piece' },
    { name: 'Sprite (750ml)', price: 40, stock: 45, minStock: 20, icon: '🥤', category: 'Beverages', unit: 'piece' },
    { name: 'Frooti (200ml)', price: 10, stock: 100, minStock: 30, icon: '🧃', category: 'Beverages', unit: 'piece' },
    { name: 'Maaza (200ml)', price: 10, stock: 95, minStock: 30, icon: '🧃', category: 'Beverages', unit: 'piece' },
    { name: 'Bisleri Water (1L)', price: 20, stock: 80, minStock: 30, icon: '💧', category: 'Beverages', unit: 'piece' },
];

export const seedProducts = async () => {
    const existingProducts = await db.products.count();

    if (existingProducts === 0) {
        const timestamp = Date.now();
        const productsWithTimestamps = smartDukaanProducts.map(p => ({
            ...p,
            createdAt: timestamp,
            updatedAt: timestamp,
        }));

        await db.products.bulkAdd(productsWithTimestamps);
        console.log('✅ Seeded', smartDukaanProducts.length, 'Smart Dukaan products');
    } else {
        console.log('ℹ️ Products already exist, skipping seed');
    }
};
