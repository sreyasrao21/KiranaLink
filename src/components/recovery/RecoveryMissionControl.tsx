import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Phone, CheckCircle, X, Calendar,
    Mic, ShieldCheck, TrendingUp, Loader2, Zap
} from 'lucide-react';
import { customerApi } from '../../services/api';

const RecoveryMissionControl = ({ isOpen, onClose, customers }: { isOpen: boolean, onClose: () => void, customers: any[] }) => {
    const [queue, setQueue] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [stats, setStats] = useState({ promised: 0, failed: 0 });

    // HUD STATES
    const [aiState, setAiState] = useState<'idle' | 'dialing' | 'speaking' | 'listening' | 'processing' | 'completed'>('idle');
    const [transcript, setTranscript] = useState<any[]>([]);
    const [extractedData, setExtractedData] = useState<any>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const [isOpenPrev, setIsOpenPrev] = useState(false);

    // HELPER: Convert natural language date to timestamp
    const calculatePromiseDate = (dateStr: string) => {
        const now = new Date();
        const str = dateStr.toLowerCase();

        // Handle numeric days (e.g., "2 days", "after 3 days")
        const dayMatch = str.match(/(\d+)\s*day/);
        if (dayMatch) {
            const days = parseInt(dayMatch[1]);
            return now.getTime() + (days * 24 * 60 * 60 * 1000);
        }

        // Handle variations
        if (str.includes('repu') || str.includes('repo') || str.includes('tomorrow') || str.includes('rep'))
            return now.getTime() + (1 * 24 * 60 * 60 * 1000);

        if (str.includes('next week') || str.includes('week'))
            return now.getTime() + (7 * 24 * 60 * 60 * 1000);

        if (str.includes('2 day') || str.includes('two day'))
            return now.getTime() + (2 * 24 * 60 * 60 * 1000);

        if (str.includes('3 day') || str.includes('three day'))
            return now.getTime() + (3 * 24 * 60 * 60 * 1000);

        return now.getTime() + (1 * 24 * 60 * 60 * 1000); // Default to tomorrow
    };

    const updateCustomerPromise = async (customerId: string, dateStr: string) => {
        try {
            const nextDate = calculatePromiseDate(dateStr);
            await customerApi.update(customerId.toString(), {
                nextCallDate: nextDate,
                recoveryStatus: 'Promised',
                recoveryNotes: `Mission Control: ${dateStr}`
            });
        } catch (err) { console.error(err); }
    };

    // Effect to handle opening the modal
    useEffect(() => {
        if (isOpen && !isOpenPrev && customers.length > 0) {
            const timer = setTimeout(() => {
                setQueue(customers.map((c, i) => ({ ...c, status: 'pending', isReal: i === 0 })));
                setCurrentIndex(0);
                setIsProcessing(false);
                setCompleted(false);
                setStats({ promised: 0, failed: 0 });
                setAiState('idle');
                setTranscript([]);
                setExtractedData(null);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [isOpen, customers, isOpenPrev]);

    // Effect to track previous isOpen value
    useEffect(() => {
        setIsOpenPrev(isOpen);
    }, [isOpen]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [transcript]);

    const startBatch = () => {
        setIsProcessing(true);
        processStep(0);
    };

    const processStep = async (index: number) => {
        if (index >= queue.length) {
            setCompleted(true);
            setIsProcessing(false);
            setAiState('completed');
            return;
        }

        setCurrentIndex(index);
        updateStatus(queue[index].id, 'calling');
        const current = queue[index];

        if (current.isReal) {
            setAiState('dialing');
            setTranscript(prev => [...prev, { role: 'system', text: `Initiating secure link to ${current.phone}...` }]);

            try {
                // REAL SIMULATION based on user request
                setTimeout(() => {
                    setAiState('speaking');
                    setTranscript(prev => [...prev, { role: 'ai', text: `Namaskaram ${current.name} garu, mee ₹${current.amount} pending undi, eppudu pay chestaru?` }]);

                    setTimeout(() => {
                        setAiState('listening');
                        // Simulation of "after 2 days"
                        setTranscript(prev => [...prev, { role: 'user', text: "Namaste andi, currently funds levu, 2 days tharvatha pay chesthanu." }]);

                        setTimeout(() => {
                            setAiState('processing');
                            setExtractedData({ type: 'promise', date: '2 Days', confidence: 99 });
                            setTranscript(prev => [...prev, { role: 'system', text: "INTENT: [PROMISE_FUTURE] | TARGET: [2_DAYS]" }]);

                            setTimeout(() => {
                                setAiState('speaking');
                                setTranscript(prev => [...prev, { role: 'ai', text: "Sare andi, Note cheskunnanu. Dhanyavadhalu." }]);

                                setTimeout(() => {
                                    finishStep(current.id, 'promised', '2 days', index);
                                }, 1500);
                            }, 2000);
                        }, 2000);
                    }, 3000);
                }, 2000);

            } catch {
                setAiState('idle');
                finishStep(current.id, 'failed', '', index);
            }
        } else {
            // FAST SIMULATION FOR OTHERS
            setAiState('processing');
            setTimeout(() => {
                let isSuccess = false;
                const idStr = current.id.toString();
                const lastChar = idStr.slice(-1);
                if (!isNaN(parseInt(lastChar))) {
                    isSuccess = parseInt(lastChar) % 2 === 0;
                } else {
                    isSuccess = idStr.charCodeAt(idStr.length - 1) % 2 === 0;
                }

                const result = isSuccess ? 'promised' : 'failed';
                finishStep(current.id, result, isSuccess ? 'next week' : '', index);
            }, 1500);
        }
    };

    const updateStatus = (id: string, status: string) => {
        setQueue(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    };

    const finishStep = async (id: string, result: string, dateStr: string, index: number) => {
        updateStatus(id, result);

        if (result === 'promised' && dateStr) {
            await updateCustomerPromise(id, dateStr);
            setStats(prev => ({ ...prev, promised: prev.promised + (queue[index]?.amount || 0) }));
        } else {
            setStats(prev => ({ ...prev, failed: prev.failed + 1 }));
            await customerApi.update(id.toString(), { recoveryStatus: 'Call Again' });
        }

        if (index + 1 < queue.length) {
            processStep(index + 1);
        } else {
            setCompleted(true);
            setIsProcessing(false);
            setAiState('completed');
        }
    };

    if (!isOpen) return null;

    const currentCall = queue[currentIndex] || customers[0];
    if (!currentCall) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-6xl h-[90vh] bg-[#050505] rounded-[2.5rem] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col md:flex-row relative"
            >
                {/* Background Grid */}
                <div className="absolute inset-0 bg-grid-dark opacity-10 pointer-events-none"></div>

                {/* --- LEFT PANEL --- */}
                <div className="w-full md:w-1/3 border-r border-white/5 flex flex-col bg-white/[0.02] backdrop-blur-md relative z-10">
                    <div className="p-8 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary-green/20 rounded-lg">
                                <ShieldCheck className="text-primary-green" size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-white tracking-tight">Recovery HUD</h2>
                                <div className="flex items-center gap-2 mt-1 text-[10px] font-black text-primary-green/60 uppercase tracking-widest">
                                    <span className="w-1.5 h-1.5 bg-primary-green rounded-full animate-pulse"></span>
                                    Agent Engaged
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                        <AnimatePresence mode="popLayout">
                            {queue.map((customer, idx) => (
                                <motion.div
                                    key={customer.id}
                                    layout
                                    className={`p-4 rounded-2xl border transition-all relative overflow-hidden ${idx === currentIndex && isProcessing
                                        ? 'bg-primary-green/10 border-primary-green/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                                        : customer.status === 'promised'
                                            ? 'bg-green-500/5 border-green-500/20 opacity-80'
                                            : 'bg-white/[0.03] border-white/5 opacity-40'
                                        }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-bold text-white text-sm truncate">{customer.name}</h3>
                                            <p className="text-[9px] font-mono text-gray-500 mt-0.5 truncate uppercase">
                                                ID: {customer.id.slice(-6).toUpperCase()}
                                            </p>
                                        </div>
                                        <div className="text-right ml-3">
                                            <span className="text-xs font-black text-white">₹{(customer.amount || 0).toLocaleString()}</span>
                                            {customer.status === 'promised' && <CheckCircle size={12} className="text-green-500 ml-auto mt-1" />}
                                        </div>
                                    </div>

                                    {idx === currentIndex && isProcessing && (
                                        <div className="mt-3 h-0.5 bg-white/5 rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full bg-primary-green"
                                                animate={{ width: ['0%', '100%'] }}
                                                transition={{ duration: 10, repeat: Infinity }}
                                            />
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>

                    <div className="p-8 border-t border-white/5 bg-black/20">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Recovered Assets</p>
                                <p className="text-2xl font-black text-primary-green">₹{stats.promised.toLocaleString()}</p>
                            </div>
                            <TrendingUp className="text-primary-green/30" size={32} />
                        </div>
                        {!isProcessing && !completed ? (
                            <button onClick={startBatch} className="w-full bg-primary-green hover:bg-green-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all">
                                <Zap size={18} fill="white" /> INITIALIZE AGENT
                            </button>
                        ) : (
                            <button onClick={onClose} className="w-full bg-white/5 hover:bg-white/10 text-white py-4 rounded-2xl font-black transition-all">
                                {completed ? "TERMINATE LINK" : "AGENT IN TRANSIT"}
                            </button>
                        )}
                    </div>
                </div>

                {/* --- RIGHT PANEL --- */}
                <div className="flex-1 flex flex-col relative z-20 overflow-hidden">
                    <div className="p-8 flex justify-between items-end border-b border-white/5 bg-white/[0.01]">
                        <div>
                            <p className="text-[10px] font-black text-primary-green uppercase tracking-[0.3em] mb-2">Live Target</p>
                            <h1 className="text-3xl font-black text-white tracking-tight">{currentCall.name}</h1>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Risk Profile</p>
                            <div className="flex items-center gap-2">
                                <div className="h-1 w-20 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500 w-[75%]" />
                                </div>
                                <span className="text-[10px] font-black text-white">HIGH</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center relative">
                        <div className={`relative w-56 h-56 flex items-center justify-center transition-all duration-700 ${aiState === 'speaking' || aiState === 'listening' ? 'scale-110' : 'scale-100'}`}>
                            <div className={`absolute inset-0 rounded-full blur-[60px] transition-colors duration-1000 ${aiState === 'speaking' ? 'bg-primary-green/30' :
                                    aiState === 'listening' ? 'bg-primary-green/40' :
                                        aiState === 'processing' ? 'bg-yellow-500/20' : 'bg-primary-green/5'
                                }`} />

                            <div className="z-10 bg-black w-48 h-48 rounded-full flex items-center justify-center border border-white/10 shadow-[inset_0_0_40px_rgba(16,185,129,0.05)] overflow-hidden">
                                {(aiState === 'speaking' || aiState === 'listening') && (
                                    <div className="flex gap-1.5 items-center h-12 relative z-20">
                                        {[...Array(6)].map((_, i) => (
                                            <motion.div
                                                key={i}
                                                className="w-1.5 bg-primary-green rounded-full"
                                                animate={{ height: [10, 40, 15, 45, 10], opacity: [0.6, 1, 0.6] }}
                                                transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                                            />
                                        ))}
                                    </div>
                                )}
                                {aiState === 'dialing' && <Phone size={32} className="text-primary-green animate-pulse" />}
                                {aiState === 'processing' && <Loader2 size={32} className="text-yellow-500 animate-spin" />}
                                {aiState === 'completed' && <CheckCircle size={48} className="text-primary-green" />}
                                {aiState === 'idle' && <Mic size={32} className="text-white/20" />}
                            </div>
                        </div>

                        <div className="mt-8 text-center pointer-events-none">
                            <p className="text-white font-black text-lg tracking-[0.2em] uppercase">
                                {aiState === 'dialing' ? 'Dialing Target...' :
                                    aiState === 'speaking' ? 'Agent Speaking' :
                                        aiState === 'listening' ? 'Listening' :
                                            aiState === 'processing' ? 'Processing Intent' :
                                                aiState === 'completed' ? 'Success' : 'Ready'}
                            </p>
                        </div>
                    </div>

                    {extractedData && (
                        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="absolute bottom-40 left-1/2 -translate-x-1/2 w-full max-w-md px-8">
                            <div className="bg-primary-green shadow-[0_0_30px_rgba(16,185,129,0.3)] p-4 rounded-2xl flex items-center gap-4 border border-white/20">
                                <div className="bg-white/20 p-3 rounded-xl text-white">
                                    <Calendar size={20} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[9px] font-black text-white/60 uppercase tracking-widest">Extracted Promise</p>
                                    <p className="text-lg font-black text-white">{extractedData.date} Promise</p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    <div className="h-40 bg-black/40 border-t border-white/5 p-6 overflow-hidden">
                        <div ref={scrollRef} className="h-full overflow-y-auto space-y-2 font-mono text-[10px] custom-scrollbar">
                            {transcript.map((line, i) => (
                                <div key={i} className="flex gap-3">
                                    <span className="text-gray-700">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                                    <span className={`${line.role === 'ai' ? 'text-primary-green' : line.role === 'user' ? 'text-white' : 'text-gray-500'}`}>
                                        {line.role?.toUpperCase() || 'SYS'}: {line.text}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button onClick={onClose} className="absolute top-8 right-8 text-white/30 hover:text-white transition-all">
                        <X size={20} />
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default RecoveryMissionControl;
