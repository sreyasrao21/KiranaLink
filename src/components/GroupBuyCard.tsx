import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Zap, CheckCircle, ChevronRight, Sparkles, MapPin } from 'lucide-react';
import confetti from 'canvas-confetti';
import { groupBuyApi } from '../services/api';
import { useToast } from '../contexts/ToastContext';

const GroupBuyCard = ({ deal, customerId = 'shop_me', onShowPass, onJoinSuccess }: { deal: any, customerId?: string, onShowPass?: (order: any) => void, onJoinSuccess?: () => void }) => {
    const { addToast } = useToast();
    const [pledge, setPledge] = useState(1);
    const [currentTotal, setCurrentTotal] = useState(deal.currentUnits || 0);
    const [isJoined, setIsJoined] = useState(deal.members?.includes(customerId) || false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Timer State
    const [timeLeft, setTimeLeft] = useState("");

    // Fallback Data for UI richness
    const productname = deal.groupName || deal.product_name || "Bulk Deal";
    // STRICTLY use the image from the deal object (which comes from the product DB)
    const imageUrl = deal.image_url || "https://cdn-icons-png.flaticon.com/512/2921/2921822.png";

    // Force the correct anchor shop for the story
    const anchorShop = (deal.anchorShop && deal.anchorShop !== 'Local Hub') ? deal.anchorShop : "Raju Smart Dukaan (200m away)";
    const marketPrice = deal.marketPrice || 2200;

    // Tier Logic
    const defaultTiers = [
        { goal: 10, price: Math.round(marketPrice * 0.9), label: "Silver" },
        { goal: 50, price: Math.round(marketPrice * 0.85), label: "Gold" },
        { goal: 100, price: Math.round(marketPrice * 0.8), label: "Platinum" }
    ];
    const tiers = (deal.tiers && deal.tiers.length > 0) ? deal.tiers : defaultTiers;

    // Logic to determine current Price Tier
    const getCurrentTier = (units: number) => {
        let activeTier = tiers[0];
        for (let tier of tiers) {
            if (units >= tier.goal) activeTier = tier;
        }
        return activeTier;
    };

    const currentTier = getCurrentTier(currentTotal);

    // Actually, traditionally "unlocked" means the DEAL is valid. Let's use targetUnits from deal object if available.
    const targetGoal = deal.targetUnits || 10;
    const isDealValid = currentTotal >= targetGoal;

    const progressPercent = Math.min((currentTotal / targetGoal) * 100, 100);

    // LIVE TIMER EFFECT
    useEffect(() => {
        const calculateTimeLeft = () => {

            const target = deal.expiresAt ? new Date(deal.expiresAt).getTime() : new Date().setHours(23, 59, 59); // End of day default

            const now = new Date().getTime();
            const difference = target - now;

            if (difference > 0) {
                const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
                const minutes = Math.floor((difference / 1000 / 60) % 60);
                const seconds = Math.floor((difference / 1000) % 60);

                setTimeLeft(`${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`);
            } else {
                setTimeLeft("Expired");
            }
        };

        const timer = setInterval(calculateTimeLeft, 1000);
        calculateTimeLeft(); // Initial call

        return () => clearInterval(timer);
    }, [deal.expiresAt]);

    const [savedOrder, setSavedOrder] = useState<any>(null);

    const generateOrderData = () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return {
            id: Math.random().toString(36).substr(2, 9).toUpperCase(),
            dealName: productname,
            date: new Date().toLocaleDateString(),
            quantity: pledge,
            totalWeight: `${pledge * 10}kg`,
            amount: pledge * currentTier.price,
            savings: (marketPrice - currentTier.price) * pledge,
            status: 'Verified',
            pickupTime: `Truck Arriving: ${tomorrow.toLocaleDateString()} @ 10:00 AM`,
            location: anchorShop,
            qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=ORDER_${deal._id}_user_${customerId}_valid`
        };
    };
    const handleJoin = async () => {
        setIsProcessing(true);
        try {
            await groupBuyApi.join(deal._id, customerId, pledge);

            setCurrentTotal((prev: number) => prev + pledge);
            setIsJoined(true);

            addToast("Successfully joined the deal!", "success");

            if (onJoinSuccess) {
                onJoinSuccess();
            }

            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.7 },
                colors: ['#10B981', '#F59E0B']
            });

            const newOrder = generateOrderData();
            setSavedOrder(newOrder);

            if (onShowPass) {
                setTimeout(() => onShowPass(newOrder), 1500);
            }

        } catch (e: any) {
            console.error("Join failed", e);
            const errorMessage = e.response?.data?.message || e.message || "Unknown error";
            addToast(`Failed to join: ${errorMessage}`, "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleViewPass = () => {
        if (onShowPass) {
            // Use saved order or generate a temporary one for display if data lost on reload
            const orderToShow = savedOrder || generateOrderData();
            onShowPass(orderToShow);
        }
    };

    return (
        <motion.div
            layout
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`rounded-3xl shadow-xl overflow-hidden border mb-8 relative group transition-all duration-500
                ${isDealValid ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'}
            `}
        >
            {/* AI Badge */}
            <div className="absolute top-0 right-0 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-bl-2xl z-10 flex items-center gap-1 shadow-md">
                <Zap size={12} /> {deal.aiInsight || "AI RECOMMENDED"}
            </div>

            <div className="flex flex-col md:flex-row p-6 gap-6">
                {/* Left: Image */}
                <div className="md:w-1/3 relative">
                    <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-700 relative">
                        <img src={imageUrl} alt={productname} className="w-full h-full object-cover" />

                        {/* UNLOCKED OVERLAY */}
                        <AnimatePresence>
                            {isDealValid && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                                    className="absolute inset-0 bg-green-900/40 backdrop-blur-[2px] flex items-center justify-center"
                                >
                                    <div className="bg-white text-green-700 font-black text-xl px-4 py-2 rotate-[-12deg] shadow-2xl border-4 border-green-500 rounded-lg">
                                        UNLOCKED!
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Right: Details */}
                <div className="md:w-2/3 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start">
                            <h2 className="text-2xl font-black text-gray-800 dark:text-white leading-tight mb-1">{productname}</h2>
                            {isDealValid && <Sparkles className="text-yellow-500 animate-bounce" />}
                        </div>

                        {/* Drop Point / Supplier Info */}
                        <div className="flex flex-col gap-2 mb-4">
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Clock size={16} className="text-red-500 animate-pulse" />
                                <span className="font-bold text-red-500 tabular-nums">Expires in {timeLeft}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs bg-gray-100 dark:bg-gray-700/50 px-3 py-1.5 rounded-lg w-fit border border-gray-200 dark:border-gray-600">
                                <MapPin size={14} className="text-gray-500 dark:text-gray-400" />
                                <span className="text-gray-500 dark:text-gray-400">Drop Point:</span>
                                <span className="font-bold text-gray-700 dark:text-gray-200">{anchorShop}</span>
                            </div>
                        </div>

                        {/* Tier Visualization */}
                        <div className="flex flex-wrap items-center gap-4 mt-4 mb-6 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                            <div className="text-center opacity-50">
                                <p className="text-[10px] uppercase font-bold">Retail</p>
                                <p className="text-lg font-bold line-through decoration-red-500">₹{marketPrice}</p>
                            </div>
                            <ChevronRight className="text-gray-300" />
                            <div className="text-center relative">
                                <p className="text-[10px] text-green-600 uppercase font-bold">Group Price</p>
                                <motion.p
                                    key={currentTier.price} // Animate on change
                                    initial={{ scale: 1.2, color: '#16a34a' }} animate={{ scale: 1 }}
                                    className="text-4xl font-black text-green-600"
                                >
                                    ₹{currentTier.price}
                                </motion.p>
                                <span className="absolute -top-3 -right-6 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-200">
                                    {currentTier.label}
                                </span>
                            </div>
                        </div>

                        {/* Dynamic Progress Bar */}
                        <div className="mb-2 flex justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
                            <span>{currentTotal} items pledged</span>
                            <span>Goal: {targetGoal} items</span>
                        </div>
                        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative shadow-inner">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 1, ease: "circOut" }}
                                className={`h-full relative ${isDealValid ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}
                            >
                                <div className="absolute inset-0 bg-white/30 w-full animate-[shimmer_2s_infinite]"></div>
                            </motion.div>
                        </div>
                        <p className="text-right text-xs text-blue-600 dark:text-blue-400 font-bold mt-2">
                            {isDealValid ? "Deal is LIVE! Truck scheduled." : `${targetGoal - currentTotal} more needed to confirm truck.`}
                        </p>
                    </div>

                    {/* Action Area */}
                    <div className="space-y-3">
                        {!isJoined ? (
                            <div className="mt-6 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl flex flex-col sm:flex-row items-center gap-4">
                                <div className="flex-1 w-full">
                                    <div className="flex justify-between mb-1">
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Quantity (Packs)</label>
                                        <span className="text-xs font-bold text-gray-900 dark:text-white">{pledge} Units</span>
                                    </div>
                                    <input
                                        type="range" min="1" max="20"
                                        value={pledge} onChange={(e) => setPledge(parseInt(e.target.value))}
                                        className="w-full accent-black dark:accent-white h-2 bg-gray-200 dark:bg-gray-700 rounded-lg cursor-pointer"
                                    />
                                </div>
                                <button
                                    onClick={handleJoin}
                                    disabled={isProcessing}
                                    className="w-full sm:w-auto bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-xl font-bold hover:bg-gray-800 dark:hover:bg-gray-200 transition-transform active:scale-95 shadow-lg disabled:opacity-70 whitespace-nowrap"
                                >
                                    {isProcessing ? "Joining..." : `Join Deal`}
                                </button>
                            </div>
                        ) : (
                            <div className="mt-6 flex gap-3 animate-slide-up">
                                <div className="flex-1 bg-green-100 dark:bg-green-900/30 p-4 rounded-xl flex items-center justify-between border border-green-200 dark:border-green-800">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="text-green-600" size={20} />
                                        <div>
                                            <p className="font-bold text-green-900 dark:text-green-300 text-sm">Order Confirmed</p>
                                            <p className="text-xs text-green-700 dark:text-green-400">{pledge} units reserved</p>
                                        </div>
                                    </div>
                                    {onShowPass && (
                                        isDealValid ? (
                                            <button
                                                onClick={handleViewPass}
                                                className="bg-white text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:scale-105 transition-transform"
                                            >
                                                View Pass
                                            </button>
                                        ) : (
                                            <span className="text-[10px] bg-white/50 px-2 py-1 rounded-md text-green-800 font-bold opacity-70">
                                                Locked
                                            </span>
                                        )
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Viral Loop: WhatsApp Share */}
                        <button
                            onClick={() => window.open(`https://wa.me/?text=Hey! Join this ${productname} deal on SDukaan. We need ${Math.max(0, targetGoal - currentTotal)} more units to unlock the price!`, '_blank')}
                            className="w-full bg-[#25D366]/10 text-[#25D366] py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#25D366]/20 transition-colors"
                        >
                            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" className="w-5 h-5" alt="WA" />
                            Invite Neighbors
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default GroupBuyCard;
