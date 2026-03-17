import React, { useState, useEffect } from 'react';
import { Phone, ShieldCheck, Zap, ArrowRight, Clock3 } from 'lucide-react';
import DefaulterCard from '../../components/recovery/DefaulterCard';
import LiveCallModal, { type RecoveryCustomer } from '../../components/recovery/LiveCallModal';
import RecoveryMissionControl from '../../components/recovery/RecoveryMissionControl';
import { useToast } from '../../contexts/ToastContext';
import { customerApi } from '../../services/api';
import type { Customer } from '../../db/db';
import { useLanguage } from '../../contexts/LanguageContext';

export default function RecoveryPage() {
    const { addToast } = useToast();
    const { t } = useLanguage();

    // Fetch all customers from API
    const [allCustomers, setAllCustomers] = useState<Customer[]>([]);

    const loadCustomers = React.useCallback(async () => {
        try {
            const response = await customerApi.getAll();
            setAllCustomers(response.data);
        } catch (e) {
            console.error("Failed to load customers", e);
            addToast("Failed to sync customers", "error");
        }
    }, [addToast]);

    useEffect(() => {
        loadCustomers();
    }, [loadCustomers]);

    const [activeCall, setActiveCall] = useState<RecoveryCustomer | null>(null);
    const [isMissionControlOpen, setIsMissionControlOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'ACTION' | 'SCHEDULED'>('ACTION');

    const nowTs = React.useMemo(() => Date.now(), []); // Snapshot for consistent queueing in a render

    // Action Queue
    const actionQueue = React.useMemo(() => allCustomers?.filter((customer: Customer) => {
        const hasBalance = customer.khataBalance > 0;
        const isPastPromiseDate = !customer.nextCallDate || (typeof customer.nextCallDate === 'number' && customer.nextCallDate <= nowTs);
        return hasBalance && isPastPromiseDate;
    }) || [], [allCustomers, nowTs]);

    // Scheduled Queue
    const scheduledQueue = React.useMemo(() => allCustomers?.filter((customer: Customer) => {
        const hasBalance = customer.khataBalance > 0;
        const isFuturePromiseDate = customer.nextCallDate && (typeof customer.nextCallDate === 'number' && customer.nextCallDate > nowTs);
        return hasBalance && isFuturePromiseDate;
    }) || [], [allCustomers, nowTs]);

    const displayCustomers = React.useMemo(() => (viewMode === 'ACTION' ? actionQueue : scheduledQueue).map((customer: Customer) => {
        const createdAt = customer.createdAt
            ? (typeof customer.createdAt === 'string' ? new Date(customer.createdAt).getTime() : customer.createdAt)
            : nowTs;
        const daysOverdue = Math.floor((nowTs - createdAt) / (1000 * 60 * 60 * 24));
        let risk: 'LOW' | 'MEDIUM' | 'HIGH';
        const trustScore = customer.trustScore || 0;
        const khataBalance = customer.khataBalance || 0;

        if (trustScore >= 80 && khataBalance < 1000) risk = 'LOW';
        else if (trustScore >= 50 || khataBalance < 2000) risk = 'MEDIUM';
        else risk = 'HIGH';

        return {
            id: customer._id || (customer.id ? customer.id.toString() : 'unknown'),
            name: customer.name || t['Unnamed Customer'],
            amount: khataBalance,
            days: daysOverdue > 0 ? daysOverdue : 1,
            phone: customer.phoneNumber,
            risk: risk,
            nextCallDate: customer.nextCallDate,
            recoveryStatus: customer.recoveryStatus
        };
    }), [viewMode, actionQueue, scheduledQueue, nowTs, t]);

    const handleCallResult = React.useCallback((result: { status: string; promiseDate: string }) => {
        if (result.status === 'success') {
            addToast(`✅ Promise recorded: ${result.promiseDate}`, 'success');
            loadCustomers();
            return;
        }

        if (result.status === 'initiated') {
            addToast('📞 Voice call initiated. Agent will auto-update dues from customer response.', 'success');
            window.setTimeout(() => loadCustomers(), 6000);
            window.setTimeout(() => loadCustomers(), 15000);
            window.setTimeout(() => loadCustomers(), 30000);
        }
    }, [addToast, loadCustomers]);

    const totalPending = React.useMemo(() => (allCustomers?.filter((c: Customer) => c.khataBalance > 0) || []).reduce((sum: number, d: Customer) => sum + d.khataBalance, 0), [allCustomers]);

    return (
        <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] pb-48 font-sans text-gray-900">
            {/* CLEAN HERO SECTION */}
            <div className="bg-white dark:bg-[#111111] pt-8 pb-10 px-6 rounded-b-[2rem] shadow-sm border-b border-gray-100 dark:border-white/5">
                <div className="max-w-5xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-2xl font-black flex items-center gap-3 text-gray-900 dark:text-white tracking-tight">
                                <div className="p-2.5 bg-primary-green rounded-xl text-white">
                                    <ShieldCheck size={24} />
                                </div>
                                {t['Recovery Agent']}
                            </h1>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-primary-green to-emerald-700 rounded-[1.5rem] p-6 text-white shadow-xl shadow-primary-green/20 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all duration-700"></div>
                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <p className="text-green-100 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{t['Total Outstanding']}</p>
                                <h2 className="text-4xl font-black tracking-tighter">₹{totalPending.toLocaleString()}</h2>
                            </div>
                            <div className="flex gap-2">
                                <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 text-center min-w-[100px]">
                                    <p className="text-[8px] uppercase font-black opacity-60">{t['Success']}</p>
                                    <p className="text-lg font-black">94%</p>
                                </div>
                                <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 text-center min-w-[100px]">
                                    <p className="text-[8px] uppercase font-black opacity-60">{t['Avg. Days']}</p>
                                    <p className="text-lg font-black">12d</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 -mt-6 relative z-10">
                {/* Segmented Control */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-1 rounded-[1.2rem] shadow-lg border border-gray-100 dark:border-white/5 flex gap-1 mb-6">
                    <button
                        onClick={() => setViewMode('ACTION')}
                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${viewMode === 'ACTION'
                            ? 'bg-primary-green text-white shadow-md'
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                            }`}
                    >
                        {t['Pending']} ({actionQueue.length})
                    </button>
                    <button
                        onClick={() => setViewMode('SCHEDULED')}
                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${viewMode === 'SCHEDULED'
                            ? 'bg-primary-green text-white shadow-md'
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                            }`}
                    >
                        {t['Follow-ups']} ({scheduledQueue.length})
                    </button>
                </div>

                {/* MISSION CONTROL BUTTON (Refined) */}
                {viewMode === 'ACTION' && actionQueue.length > 0 && (
                    <button
                        onClick={() => setIsMissionControlOpen(true)}
                        className="w-full relative overflow-hidden bg-white dark:bg-[#111111] p-4 rounded-[1.2rem] shadow-sm border border-gray-100 dark:border-white/5 mb-6 flex items-center justify-between group active:scale-[0.98] transition-all"
                    >
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="w-10 h-10 bg-primary-green/10 rounded-lg flex items-center justify-center text-primary-green group-hover:scale-110 transition-transform">
                                <Zap size={20} fill="currentColor" />
                            </div>
                            <div className="text-left">
                                <h4 className="font-black text-sm text-gray-900 dark:text-white">{t['AI Voice Control']}</h4>
                                <p className="text-[10px] text-gray-500 font-bold">{t['Automated recovery for']} {actionQueue.length} {t['Customers']}</p>
                            </div>
                        </div>
                        <ArrowRight size={18} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
                    </button>
                )}

                {/* LIST */}
                <div className="space-y-3">
                    {displayCustomers.length > 0 ? (
                        displayCustomers.map((customer: any) => (
                            viewMode === 'SCHEDULED' ? (
                                // === SCHEDULED CARD ===
                                <div key={customer.id} className="bg-white dark:bg-[#111111] p-4 rounded-[1.2rem] border border-gray-100 dark:border-white/5 flex items-center justify-between gap-4 shadow-sm h-22">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="shrink-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-white/5 w-12 h-12 rounded-xl border border-gray-100 dark:border-white/10 text-primary-green">
                                            <span className="text-[8px] uppercase font-black opacity-60">
                                                {customer.nextCallDate ? new Date(customer.nextCallDate).toLocaleString('en-US', { month: 'short' }) : 'FUT'}
                                            </span>
                                            <span className="text-lg font-black leading-none">
                                                {customer.nextCallDate ? new Date(customer.nextCallDate).getDate() : '?'}
                                            </span>
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-black text-gray-900 dark:text-white text-sm truncate">{customer.name}</h3>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs font-black text-primary-green">₹{customer.amount.toLocaleString()}</span>
                                                <span className="text-[9px] text-gray-400 font-bold uppercase flex items-center gap-1">
                                                    <Clock3 size={10} /> {customer.nextCallDate ? new Date(customer.nextCallDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setActiveCall(customer)}
                                        className="shrink-0 w-10 h-10 bg-primary-green text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary-green/20 active:scale-95 transition-all"
                                    >
                                        <Phone size={18} fill="currentColor" />
                                    </button>
                                </div>
                            ) : (
                                // === ACTION CARD ===
                                <div key={customer.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <DefaulterCard
                                        customer={customer}
                                        onRecover={(c: any) => setActiveCall(c)}
                                    />
                                </div>
                            )
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 opacity-30 text-center">
                            <ShieldCheck className="text-gray-400 mb-4" size={48} />
                            <h3 className="text-lg font-black text-gray-900 dark:text-white">{t['All Clear']}</h3>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">{t['No actions required']}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* LIVE CALL MODAL */}
            <LiveCallModal
                customer={activeCall}
                isOpen={!!activeCall}
                onClose={() => setActiveCall(null)}
                onResult={handleCallResult}
            />

            {/* MISSION CONTROL HUD */}
            <RecoveryMissionControl
                isOpen={isMissionControlOpen}
                onClose={() => setIsMissionControlOpen(false)}
                customers={actionQueue.map(c => ({
                    id: c._id || (c.id ? c.id.toString() : 'unknown'),
                    name: c.name,
                    amount: c.khataBalance,
                    phone: c.phoneNumber
                }))}
            />
        </div>
    );
}
