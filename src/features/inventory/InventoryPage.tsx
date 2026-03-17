import React, { useState, useEffect } from 'react';
import { productApi } from '../../services/api';
import { Plus, X, Save } from 'lucide-react';
import type { Product } from '../../db/db';
import { useTranslate } from '../../hooks/useTranslate';
import { useLanguage } from '../../contexts/LanguageContext';

const InventoryItemCard = React.memo(({ product, t }: { product: Product, t: any }) => (
    <div key={product._id} className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center border border-gray-100">
        <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">{product.icon || '📦'}</div>
            <div>
                <h4 className="font-bold text-gray-800">{product.name}</h4>
                <p className="text-xs text-gray-500">{t['Available Stock']}: {product.stock}</p>
            </div>
        </div>
        <div className="text-right">
            <span className="block font-bold text-primary-green text-lg">₹{product.price}</span>
        </div>
    </div>
));

export const InventoryPage: React.FC = () => {
    const { t } = useLanguage();
    const [products, setProducts] = useState<Product[]>([]);
    const translatedProducts = useTranslate(products, ['name', 'category']);
    const [isAdding, setIsAdding] = useState(false);
    const [newProduct, setNewProduct] = useState({ name: '', price: '', stock: '', category: 'default', unit: 'piece' });

    const loadProducts = React.useCallback(async () => {
        try {
            const response = await productApi.getAll();
            setProducts(response.data);
        } catch (err) {
            console.error('Failed to load products', err);
        }
    }, []);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    const handleAddProduct = React.useCallback(async () => {
        if (!newProduct.name || !newProduct.price) return;
        try {
            await productApi.create({
                name: newProduct.name,
                price: parseFloat(newProduct.price),
                stock: parseInt(newProduct.stock) || 0,
                category: newProduct.category,
                unit: newProduct.unit,
                icon: '📦'
            });
            setIsAdding(false);
            setNewProduct({ name: '', price: '', stock: '', category: 'default', unit: 'piece' });
            loadProducts();
        } catch (err) {
            console.error('Failed to save product', err);
        }
    }, [newProduct, loadProducts]);

    const handleSeedInventory = React.useCallback(async () => {
        if (confirm(t['Add 20+ starter items to your inventory?'])) {
            try {
                await productApi.seed();
                alert(t['Inventory filled!']);
                loadProducts();
            } catch (e) {
                alert(t['Failed to seed']);
                console.error(e);
            }
        }
    }, [t, loadProducts]);

    return (
        <div className="p-4 safe-area-bottom">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{t['Inventory Status']}</h2>
                <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                    {products.length} {t['Items Listed']}
                </span>
            </div>

            {isAdding ? (
                <div className="bg-white rounded-2xl shadow-lg p-6 animate-slide-up border border-green-100">
                    <div className="flex justify-between mb-4">
                        <h3 className="text-lg font-bold">{t['Add Item']}</h3>
                        <button onClick={() => setIsAdding(false)}><X size={24} className="text-gray-400" /></button>
                    </div>

                    <div className="space-y-4">
                        <input
                            type="text"
                            className="w-full p-3 bg-gray-50 rounded-xl"
                            placeholder={t['Item Name']}
                            value={newProduct.name}
                            onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <input
                                type="number"
                                className="w-full p-3 bg-gray-50 rounded-xl"
                                placeholder={t['Price']}
                                value={newProduct.price}
                                onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}
                            />
                            <input
                                type="number"
                                className="w-full p-3 bg-gray-50 rounded-xl"
                                placeholder={t['Stock']}
                                value={newProduct.stock}
                                onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })}
                            />
                        </div>
                        <button onClick={handleAddProduct} className="w-full bg-primary-green text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg">
                            <Save size={20} /> {t['Save Product']}
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex gap-4 mb-6">
                        <button onClick={() => setIsAdding(true)} className="flex-1 bg-white border-2 border-dashed border-primary-green text-primary-green p-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-colors hover:bg-green-50">
                            <Plus size={24} /> {t['Add New Product']}
                        </button>
                        <button
                            onClick={handleSeedInventory}
                            className="flex-1 bg-primary-green text-white p-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
                        >
                            <Save size={24} /> {t['Fast Fill Inventory']}
                        </button>
                    </div>
                    <div className="space-y-6 pb-48">
                        {translatedProducts.map(product => (
                            <InventoryItemCard key={product._id} product={product} t={t} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
