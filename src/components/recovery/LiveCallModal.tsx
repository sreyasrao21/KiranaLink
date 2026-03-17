import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, CheckCircle, AlertTriangle, AudioLines, PhoneOff, RotateCcw, Clock } from 'lucide-react';
import { customerApi, invoiceApi } from '../../services/api';

export interface RecoveryCustomer {
    id: number | string;
    name: string;
    amount: number;
    days: number;
    phone: string;
    risk?: 'LOW' | 'MEDIUM' | 'HIGH';
    nextCallDate?: number;
    recoveryStatus?: string;
}

const LiveCallModal = ({ customer, isOpen, onClose, onResult }: { customer: RecoveryCustomer | null, isOpen: boolean, onClose: () => void, onResult: (res: any) => void }) => {
    const [status, setStatus] = useState<'connecting' | 'active' | 'completed' | 'failed'>('connecting');
    const [transcript, setTranscript] = useState<Array<{ role: 'assistant' | 'user' | 'system'; text: string }>>([]);
    const [insight, setInsight] = useState('Initializing recovery agent...');
    const [callDuration, setCallDuration] = useState(0);
    const [_lastUpdate, setLastUpdate] = useState<string>('');
    const [activeInvoiceId, setActiveInvoiceId] = useState<string>('');
    const [sessionStartedAtIso, setSessionStartedAtIso] = useState<string>('');
    const timerRef = useRef<number | null>(null);
    const hasTriggeredCallRef = useRef(false);
    const onResultRef = useRef(onResult);

    useEffect(() => {
        onResultRef.current = onResult;
    }, [onResult]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        if (isOpen && customer) {
            // Reset all state when opening for a new call
            setStatus('connecting');
            setTranscript([]);
            setInsight('Initializing recovery agent...');
            setCallDuration(0);
            setActiveInvoiceId('');
            setSessionStartedAtIso('');
            hasTriggeredCallRef.current = false;
            
            timerRef.current = window.setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [isOpen, customer]);

    const handleRetry = async () => {
        if (!customer) return;
        hasTriggeredCallRef.current = true;

        setStatus('connecting');
        setTranscript([
            { role: 'system', text: 'Retrying voice call...' },
            { role: 'assistant', text: `Re-initiating call to ${customer.phone}` }
        ]);
        setInsight('Retrying call connection...');

        try {
            const res = await invoiceApi.recoverNow(customer.id.toString());
            setActiveInvoiceId(String(res.data?.invoiceId || ''));
            setSessionStartedAtIso(new Date().toISOString());
            setStatus('active');
            setTranscript(prev => [
                ...prev,
                { role: 'assistant', text: 'Call re-initiated. Waiting for response...' },
                { role: 'system', text: `Status: ${res.data?.callStatus || 'queued'}` }
            ]);
            setInsight('Call is active. Awaiting customer response...');
            setLastUpdate(new Date().toLocaleTimeString());
        } catch (error: any) {
            setStatus('failed');
            setInsight('Call retry failed. Please check configuration.');
            setTranscript(prev => [
                ...prev,
                { role: 'system', text: `Error: ${error?.response?.data?.message || error.message}` }
            ]);
        }
    };

    useEffect(() => {
        let timer: number | undefined;

        const run = async () => {
            if (!isOpen || !customer) return;
            if (hasTriggeredCallRef.current) return;
            hasTriggeredCallRef.current = true;

            setStatus('connecting');
            setTranscript([
                { role: 'system', text: '🎯 Recovery Agent initializing...' },
                { role: 'assistant', text: `Preparing call to ${customer.phone}` }
            ]);
            setInsight('Connecting to Voice API...');

            timer = window.setTimeout(() => setStatus('active'), 900);

            try {
                const res = await invoiceApi.recoverNow(customer.id.toString());
                setActiveInvoiceId(String(res.data?.invoiceId || ''));
                setSessionStartedAtIso(new Date().toISOString());
                setTranscript((prev) => [
                    ...prev,
                    { role: 'assistant', text: '📞 Call initiated. Waiting for live speech...' },
                    { role: 'system', text: `Delivery status: ${res.data?.callStatus || 'queued'}` }
                ]);
                setInsight('🤖 Recovery Agent is live. Listening for customer response...');
                setLastUpdate(new Date().toLocaleTimeString());

                await customerApi.update(customer.id.toString(), {
                    recoveryStatus: 'Busy',
                    recoveryNotes: 'Live call started from Recovery Agent interface.'
                });

                setTranscript((prev) => [
                    ...prev,
                    { role: 'system', text: '✅ Call connected. Analyzing response...' }
                ]);
                onResultRef.current({ status: 'initiated', promiseDate: '' });
            } catch (error: any) {
                setStatus('failed');
                setInsight('❌ Call failed. Check API configuration.');
                setTranscript((prev) => [
                    ...prev,
                    { role: 'system', text: `Error: ${error?.response?.data?.message || error.message || 'Unknown error'}` }
                ]);
            }
        };

        run();

        return () => {
            if (timer) window.clearTimeout(timer);
        };
    }, [isOpen, customer]);

    useEffect(() => {
        if (!isOpen) {
            hasTriggeredCallRef.current = false;
            setActiveInvoiceId('');
            setSessionStartedAtIso('');
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !activeInvoiceId || status !== 'active') return;

        const interval = window.setInterval(async () => {
            try {
                const response = await invoiceApi.getRecoveryState(activeInvoiceId, sessionStartedAtIso || undefined);
                const state = response.data;

                // Update insight with negotiation details
                if (state.negotiationStage) {
                    const partialText = state.negotiationPartialAmountNow
                        ? ` | Partial now: ₹${state.negotiationPartialAmountNow}`
                        : '';
                    const remainingText = typeof state.negotiationRemainingAmount === 'number'
                        ? ` | Remaining: ₹${state.negotiationRemainingAmount}`
                        : '';
                    const langText = state.negotiationLanguage 
                        ? ` | Lang: ${state.negotiationLanguage.toUpperCase()}`
                        : '';
                    setInsight(`Stage: ${state.negotiationStage} | Turns: ${state.negotiationTurns || 0}${partialText}${remainingText}${langText}`);
                }

                // Add AI prompt (what the system said)
                if (state.latestVoiceLog && !state.latestVoiceLog.includes('We could not hear')) {
                    setTranscript((prev) => {
                        const exists = prev.some((entry) => entry.text === state.latestVoiceLog);
                        if (exists) return prev;
                        return [...prev, { role: 'assistant', text: state.latestVoiceLog || '' }];
                    });
                }

                // Add customer transcript
                if (state.latestTranscriptLog) {
                    setTranscript((prev) => {
                        const exists = prev.some((entry) => entry.text === state.latestTranscriptLog);
                        if (exists) return prev;
                        return [...prev, { role: 'user', text: state.latestTranscriptLog || '' }];
                    });
                }

                // Also add session customer transcript if available
                if (state.latestSessionCustomerTranscript) {
                    setTranscript((prev) => {
                        const exists = prev.some((entry) => entry.text === state.latestSessionCustomerTranscript);
                        if (exists) return prev;
                        return [...prev, { role: 'user', text: state.latestSessionCustomerTranscript || '' }];
                    });
                }

                if (state.negotiationStatus === 'completed') {
                    setStatus('completed');
                    setInsight(state.negotiationSummary || `Call completed. Intent: ${state.lastIntent || 'UNKNOWN'}`);
                    setLastUpdate(new Date().toLocaleTimeString());
                    onResultRef.current({
                        status: 'success',
                        promiseDate: state.promisedDate ? new Date(state.promisedDate).toLocaleDateString('en-IN') : 'Captured',
                    });
                    window.clearInterval(interval);
                }
            } catch {
                // Polling...
            }
        }, 3500);

        return () => window.clearInterval(interval);
    }, [isOpen, activeInvoiceId, sessionStartedAtIso, status]);

    if (!isOpen || !customer) return null;

    const statusColors = {
        connecting: 'from-amber-600 to-orange-700',
        active: 'from-primary-green to-emerald-800',
        completed: 'from-emerald-700 to-teal-900',
        failed: 'from-rose-600 to-red-700'
    };

    const statusIcons = {
        connecting: <Phone className="animate-pulse" size={40} />,
        active: <AudioLines className="animate-pulse" size={40} />,
        completed: <CheckCircle size={40} />,
        failed: <AlertTriangle size={40} />
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.92, opacity: 0 }}
                    className={`bg-gradient-to-br ${statusColors[status]} w-full max-w-lg rounded-3xl overflow-hidden border border-white/10 shadow-2xl mr-20`}
                >
                    <div className="p-6 text-center border-b border-white/10">
                        <div className="relative">
                            <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-4 bg-white/10 border border-white/20">
                                <div className="text-white">
                                    {statusIcons[status]}
                                </div>
                                {status === 'active' && (
                                    <div className="absolute inset-0 border-4 border-white/20 rounded-full animate-ping" />
                                )}
                            </div>
                            {status === 'active' && (
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                    LIVE
                                </div>
                            )}
                        </div>

                        <h2 className="text-xl font-black text-white tracking-tight">{customer.name}</h2>
                        <p className="text-white/70 font-bold text-xs mt-1">Recovery Call · ₹{customer.amount.toLocaleString()}</p>

                        {status === 'active' && (
                            <div className="mt-3 inline-flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full">
                                <Clock size={12} className="text-white/60" />
                                <span className="text-white font-mono text-xs">{formatDuration(callDuration)}</span>
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-b border-white/10 bg-black/10">
                        <p className="text-[10px] uppercase tracking-widest text-white/40 font-black mb-1">Status Report</p>
                        <p className="text-xs text-white/90 leading-relaxed font-bold">{insight}</p>
                    </div>

                    <div className="h-56 bg-black/20 p-4 overflow-y-auto space-y-3 custom-scrollbar">
                        {status === 'active' && (
                            <div className="flex justify-center py-1">
                                <div className="flex gap-1">
                                    {[0, 150, 300].map(delay => (
                                        <span key={delay} className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                                    ))}
                                </div>
                            </div>
                        )}
                        {transcript.map((t, i) => (
                            <div key={i} className="text-xs">
                                <span className={`text-[8px] font-black uppercase tracking-wider ${t.role === 'assistant' ? 'text-emerald-300' : t.role === 'user' ? 'text-white' : 'text-amber-300'}`}>
                                    {t.role === 'system' ? 'AGENT' : t.role === 'assistant' ? 'AI' : 'CUSTOMER'}
                                </span>
                                <p className="text-white/90 mt-0.5 font-medium">{t.text}</p>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 bg-black/10 flex gap-2">
                        {status === 'failed' ? (
                            <>
                                <button
                                    onClick={handleRetry}
                                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all uppercase tracking-widest"
                                >
                                    <RotateCcw size={14} />
                                    Retry
                                </button>
                                <button
                                    onClick={onClose}
                                    className="flex-1 bg-white/10 hover:bg-white/15 text-white py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all uppercase tracking-widest"
                                >
                                    Close
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={onClose}
                                className="flex-1 bg-white/10 hover:bg-white/15 text-white py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all"
                            >
                                {status === 'completed' ? <CheckCircle size={18} /> : <PhoneOff size={18} />}
                                {status === 'completed' ? 'Finish' : 'End Call'}
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default LiveCallModal;
