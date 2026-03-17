import { useState, useEffect } from 'react';
import { X, Package, ArrowRight, Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { productApi } from '../services/api';

const HostDealModal = ({ isOpen, onClose, onHost }: { isOpen: boolean, onClose: () => void, onHost: (deal: any) => void }) => {
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [target, setTarget] = useState(10);
    const [inventory, setInventory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadInventory();
        }
    }, [isOpen]);

    const loadInventory = async () => {
        setIsLoading(true);
        try {
            const res = await productApi.getAll();
            const products = res.data || [];

            // Sort by stock (ascending) and take top 10 lowest stock items
            const lowStockProducts = products
                .sort((a: any, b: any) => a.stock - b.stock)
                .slice(0, 10);

            setInventory(lowStockProducts);
        } catch (e) {
            console.error("Failed to load inventory", e);
        } finally {
            setIsLoading(false);
        }
    };

    const getProductImage = (name: string) => {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('rice')) return "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&q=80";
        if (lowerName.includes('atta') || lowerName.includes('flour') || lowerName.includes('wheat') || lowerName.includes('maida')) return "https://images.unsplash.com/photo-1627485937980-221c88ac04f9?w=500&q=80";
        if (lowerName.includes('oil') || lowerName.includes('ghee')) return "https://images.unsplash.com/photo-1474608799738-ee81720361b7?w=500&q=80";
        if (lowerName.includes('dal') || lowerName.includes('pulse') || lowerName.includes('rajma') || lowerName.includes('chana') || lowerName.includes('besan')) return "https://plus.unsplash.com/premium_photo-1675237626938-ae4125a29774?w=500&q=80";
        if (lowerName.includes('sugar') || lowerName.includes('salt')) return "https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=500&q=80";
        if (lowerName.includes('milk') || lowerName.includes('curd') || lowerName.includes('paneer') || lowerName.includes('dairy')) return "https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=500&q=80";
        if (lowerName.includes('vegetable') || lowerName.includes('onion') || lowerName.includes('potato') || lowerName.includes('tomato')) return "https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=500&q=80";
        if (lowerName.includes('spice') || lowerName.includes('chili') || lowerName.includes('turmeric') || lowerName.includes('pepper')) return "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500&q=80";
        if (lowerName.includes('tea') || lowerName.includes('coffee')) return "https://images.unsplash.com/photo-1571934811356-5cc55449d0f1?w=500&q=80";

        return "https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&q=80";
    };

    const handleSubmit = () => {
        if (!selectedItem) return;

        const marketPrice = Math.round(selectedItem.price * 1.2);
        const dealPrice = selectedItem.price;
        const discountedPrice = Math.round(dealPrice * 0.9);

        const newDeal = {
            id: `deal_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            groupName: `${selectedItem.name} Bulk Deal`,
            product_name: selectedItem.name,
            image_url: selectedItem.image || getProductImage(selectedItem.name),
            category: "MERCHANT_HOSTED",
            marketPrice: marketPrice,
            dealPrice: discountedPrice,
            targetUnits: target,
            currentUnits: 0,
            products: [{ productId: selectedItem._id, quantity: target }],
            totalAmount: discountedPrice * target,
            status: 'active'
        };

        onHost(newDeal);
        onClose();
    };

    const getInsight = (item: any) => {
        if (item.stock < 10) return { text: "Low Stock: Good for Clearance", color: "text-orange-500", icon: <AlertTriangle size={14} /> };
        return { text: "High Demand Potential", color: "text-green-600", icon: <TrendingUp size={14} /> };
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                        className="relative bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        {/* Header */}
                        <div className="bg-black dark:bg-gray-900 text-white p-6 shrink-0">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="bg-white/20 p-2 rounded-lg"><Package size={20} /></div>
                                    <h2 className="text-xl font-bold">Host a Group Buy</h2>
                                </div>
                                <button onClick={onClose} className="bg-white/20 p-1 rounded-full hover:bg-white/30"><X size={18} /></button>
                            </div>
                            <p className="text-gray-400 text-sm mt-2">Select from your lowest stock items to restock.</p>
                        </div>

                        {/* Inventory List (Scrollable) */}
                        <div className="flex-1 p-6 overflow-y-auto min-h-0">
                            <h3 className="font-bold text-gray-800 dark:text-white mb-3">📉 Lowest Stock Items (Top 10)</h3>
                            <div className="grid grid-cols-1 gap-3">
                                {isLoading ? (
                                    <div className="text-center py-8 text-gray-400 font-medium">Loading products...</div>
                                ) : inventory.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 font-medium">No products found in inventory.</div>
                                ) : (
                                    inventory.map((item) => {
                                        const insight = getInsight(item);
                                        return (
                                            <div
                                                key={item._id}
                                                onClick={() => setSelectedItem(item)}
                                                className={`p-3 rounded-xl border-2 cursor-pointer flex justify-between items-center transition-all ${selectedItem?._id === item._id
                                                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                                                    : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="text-2xl">{item.icon || '📦'}</div>
                                                    <div>
                                                        <p className="font-bold text-gray-800 dark:text-white leading-tight">{item.name}</p>
                                                        <div className={`flex items-center gap-1 text-[10px] font-bold mt-1 ${insight.color}`}>
                                                            {insight.icon} {insight.text}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-black text-gray-900 dark:text-white">₹{item.price}</div>
                                                    <div className="text-xs text-gray-400">Stock: {item.stock}</div>
                                                </div>
                                                {selectedItem?._id === item._id && <div className="ml-2 bg-blue-600 text-white rounded-full p-1"><Sparkles size={12} /></div>}
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>

                        {/* Fixed Bottom Action Bar */}
                        <AnimatePresence>
                            {selectedItem && (
                                <motion.div
                                    initial={{ y: 100 }}
                                    animate={{ y: 0 }}
                                    exit={{ y: 100 }}
                                    className="p-6 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-20"
                                >
                                    <div className="mb-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                                        <div className="flex justify-between items-center mb-4">
                                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Target Goal (Units)</label>
                                            <div className="text-xs font-bold text-blue-600">Potential Revenue: ₹{Math.round(selectedItem.price * 0.9 * target)}</div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <button onClick={() => setTarget(Math.max(5, target - 5))} className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-600 font-bold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">-</button>
                                            <span className="font-black text-2xl w-12 text-center text-gray-900 dark:text-white">{target}</span>
                                            <button onClick={() => setTarget(target + 5)} className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-600 font-bold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">+</button>

                                            <div className="flex-1 ml-4 text-right">
                                                <div className="text-xs text-gray-400">Deal Price (10% OFF)</div>
                                                <div className="text-xl font-black text-green-600">₹{Math.round(selectedItem.price * 0.9)}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleSubmit}
                                        className="w-full bg-gradient-to-r from-blue-600 to-violet-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-blue-200/50 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                                    >
                                        Launch Deal <ArrowRight size={20} />
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default HostDealModal;
