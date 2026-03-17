import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, CheckCircle, Truck, MapPin } from 'lucide-react';

interface Order {
    id: string;
    dealName: string;
    date: string;
    quantity: number;
    totalWeight: string;
    amount: number;
    savings: number;
    status: string;
    qrCode: string;
}

const DigitalPassModal = ({ order, isOpen, onClose }: { order: Order | null, isOpen: boolean, onClose: () => void }) => {
    if (!order) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 50 }}
                        className="relative bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
                    >
                        {/* TICKET HEADER */}
                        <div className="bg-gradient-to-r from-gray-900 to-black p-6 text-center text-white relative">
                            <button onClick={onClose} className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 p-1 rounded-full transition-colors"><X size={16} /></button>
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <Truck size={20} />
                                <h3 className="text-lg font-bold tracking-widest uppercase">Digital Gate Pass</h3>
                            </div>
                            <p className="text-xs text-gray-400">Show this to delivery partner</p>
                        </div>

                        {/* TICKET BODY */}
                        <div className="p-6 flex flex-col items-center border-b-2 border-dashed border-gray-200 dark:border-gray-700 relative">
                            {/* Notches for ticket look */}
                            <div className="absolute -left-3 bottom-[-12px] w-6 h-6 bg-gray-900 rounded-full"></div>
                            <div className="absolute -right-3 bottom-[-12px] w-6 h-6 bg-gray-900 rounded-full"></div>

                            <div className="bg-white p-4 rounded-2xl shadow-inner mb-4">
                                <img src={order.qrCode} alt="QR" className="w-40 h-40" />
                            </div>

                            <h2 className="text-2xl font-black text-gray-900 dark:text-white">#{order.id.toUpperCase()}</h2>
                            <div className={`${order.status === 'Delivered' ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-700'} px-3 py-1 rounded-full text-xs font-bold mt-2 flex items-center gap-1`}>
                                <CheckCircle size={12} /> {order.status === 'Delivered' ? 'Completed' : 'Payment Verified'}
                            </div>
                        </div>

                        {/* TICKET DETAILS */}
                        <div className="p-6 bg-gray-50 dark:bg-gray-900">
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500 dark:text-gray-400">Shop Name</span>
                                    <span className="font-bold text-gray-900 dark:text-white">My Smart Dukaan</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 dark:text-gray-400">Item</span>
                                    <span className="font-bold text-right text-gray-900 dark:text-white">{order.dealName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 dark:text-gray-400">Quantity</span>
                                    <span className="font-bold text-gray-900 dark:text-white">{order.quantity} Units ({order.totalWeight})</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 dark:text-gray-400">Date</span>
                                    <span className="font-bold text-gray-900 dark:text-white">{order.date}</span>
                                </div>
                                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between text-lg">
                                    <span className="font-bold text-gray-500 dark:text-gray-400">Total Paid</span>
                                    <span className="font-black text-gray-900 dark:text-white">₹{order.amount.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-center gap-1 text-xs text-green-600 dark:text-green-400 font-bold">
                                    <span>You saved ₹{order.savings}</span>
                                </div>
                            </div>

                            <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-3 flex items-start gap-2">
                                <MapPin size={16} className="text-blue-600 dark:text-blue-400 mt-0.5" />
                                <div className="text-xs">
                                    <p className="font-bold text-blue-900 dark:text-blue-300">Drop Point</p>
                                    <p className="text-blue-700 dark:text-blue-400">Raju Smart Dukaan (200m away)</p>
                                </div>
                            </div>

                            <button
                                onClick={() => window.print()}
                                className="w-full mt-6 bg-gradient-to-r from-blue-600 to-violet-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg hover:scale-[1.02] transition-all active:scale-95"
                            >
                                <Download size={18} /> Download PDF Receipt
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default DigitalPassModal;
