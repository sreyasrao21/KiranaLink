import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Phone, Loader2, Play, ShieldCheck, AlertTriangle, Zap } from 'lucide-react';
import { db } from '../../db/db';

const BatchCallModal = ({ isOpen, onClose, customers }: { isOpen: boolean, onClose: () => void, customers: any[] }) => {
    const [queue, setQueue] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [stats, setStats] = useState({ recovered: 0, promised: 0, failed: 0 });

    const formatPhone = (phone: string) => {
        let cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) cleaned = '91' + cleaned;
        return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
    };

    const calculatePromiseDate = (dateStr: string) => {
        const now = new Date();
        if (dateStr.toLowerCase().includes('tomorrow')) return now.getTime() + 86400000;
        return now.getTime() + 86400000;
    };

    const updateCustomerPromise = async (customerId: number, dateStr: string) => {
        try {
            const nextDate = calculatePromiseDate(dateStr);
            await db.customers.update(customerId, {
                nextCallDate: nextDate,
                recoveryStatus: 'Promised',
                recoveryNotes: `Batch AI: ${dateStr}`
            });
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        if (isOpen && customers.length > 0) {
            const timer = setTimeout(() => {
                setQueue(customers.map((c, i) => ({ ...c, status: 'pending', isReal: i === 0 })));
                setCurrentIndex(0);
                setIsProcessing(false);
                setCompleted(false);
                setStats({ recovered: 0, promised: 0, failed: 0 });
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [isOpen, customers]);

    const processStep = async (index: number) => {
        if (index >= queue.length) {
            setCompleted(true);
            setIsProcessing(false);
            return;
        }

        setCurrentIndex(index);
        updateStatus(queue[index].id, 'calling');
        const current = queue[index];

        if (current.isReal) {
            try {
                await fetch('https://api.vapi.ai/call/phone', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer 7c654710-662a-4da2-9788-592f15cc2fcc',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        phoneNumberId: "b1e1b956-6134-41a6-b513-75216615cdf7",
                        customer: { number: formatPhone(current.phone), name: current.name },
                        assistant: {
                            model: {
                                provider: "openai", model: "gpt-4o-mini",
                                messages: [{ role: "system", content: "Speak ONLY Telugu. Use tool for dates." }],
                                tools: [{ type: "function", function: { name: "updatePromiseDate", description: "date", parameters: { type: "object", properties: { date: { type: "string" } } } } }]
                            },
                            voice: { provider: "11labs", voiceId: "EXAVITQu4vr4xnSDxMaL", model: "eleven_multilingual_v2" },
                            firstMessage: `Namaskaram ${current.name} andi, nenu Smart Dukaan store nunchi matladutunnanu.`
                        }
                    })
                });
                setTimeout(() => finishStep(current.id, 'promised', 'tomorrow', index), 10000);
            } catch { finishStep(current.id, 'failed', '', index); }
        } else {
            setTimeout(() => finishStep(current.id, 'promised', 'tomorrow', index), 2000);
        }
    };

    const updateStatus = (id: number, status: string) => {
        setQueue(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    };

    const finishStep = async (id: number, result: string, dateStr: string, index: number) => {
        updateStatus(id, result);
        if (result === 'promised') {
            await updateCustomerPromise(id, dateStr);
            setStats(prev => ({ ...prev, promised: prev.promised + (queue[index]?.amount || 0) }));
        } else {
            setStats(prev => ({ ...prev, failed: prev.failed + 1 }));
        }
        processStep(index + 1);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0B0F1A] w-full max-w-2xl rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl">
                    <div className="p-8 border-b border-white/5 flex justify-between items-start relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Zap size={100} className="text-blue-500" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                                <Loader2 size={14} className={`text-blue-500 ${isProcessing ? 'animate-spin' : ''}`} />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500/80">Mission Control</span>
                            </div>
                            <h2 className="text-3xl font-black text-white">Bulk Auto-Recovery</h2>
                            <p className="text-blue-500/60 text-[10px] font-bold mt-1 uppercase tracking-widest flex items-center gap-2">
                                <ShieldCheck size={12} /> Intelligence Loop Active
                            </p>
                        </div>
                        <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-2xl text-right relative z-10">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Promises</span>
                            <p className="text-xl font-black text-green-400">₹{stats.promised.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="p-8 max-h-[400px] overflow-y-auto space-y-3 custom-scrollbar">
                        {queue.map((customer, idx) => (
                            <div key={customer.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${idx === currentIndex && isProcessing ? 'bg-blue-600/10 border-blue-500 scale-[1.02]' : 'bg-white/[0.02] border-white/5'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black transition-colors ${customer.status === 'promised' ? 'bg-green-500/20 text-green-500' :
                                        customer.status === 'calling' ? 'bg-blue-500/20 text-blue-500' : 'bg-white/5 text-gray-400'}`}>
                                        {customer.status === 'promised' ? <CheckCircle size={20} /> :
                                            customer.status === 'calling' ? <Phone size={18} className="animate-pulse" /> :
                                                customer.status === 'failed' ? <AlertTriangle size={18} /> :
                                                    idx + 1}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-sm">{customer.name}</h3>
                                        <p className="text-[10px] text-gray-500">₹{customer.amount.toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className={`text-[9px] font-black uppercase tracking-tighter px-2 py-1 rounded-md border ${customer.status === 'promised' ? 'border-green-500/30 text-green-500 bg-green-500/5' :
                                    customer.status === 'calling' ? 'border-blue-500/30 text-blue-500' :
                                        customer.status === 'failed' ? 'border-red-500/30 text-red-500' : 'border-white/5 text-gray-600'
                                    }`}>
                                    {customer.status}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-8 bg-black/40 border-t border-white/5 flex gap-4">
                        {!isProcessing && !completed ? (
                            <button onClick={() => { setIsProcessing(true); processStep(0); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-[1.5rem] flex items-center justify-center gap-3 transition-all">
                                <Play size={18} fill="white" /> START RECOVERY LOOP
                            </button>
                        ) : (
                            <button onClick={onClose} className="w-full bg-white/5 hover:bg-white/10 text-white py-5 rounded-xl font-bold transition-all">
                                {completed ? "CLOSE MISSION CONTROL" : "SYSTEM PROCESSING..."}
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default BatchCallModal;
