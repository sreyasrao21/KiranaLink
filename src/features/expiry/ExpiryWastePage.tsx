import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Recycle, RefreshCw, Trash2, ShoppingBag, DollarSign, X, Send, Users, Copy } from 'lucide-react';
import { expiryApi, wasteApi, discountApi, type ExpiryQueueItem, type ExpiryQueueSummary, type WasteLogItem, type DiscountCode, type DiscountCustomer } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useTranslate } from '../../hooks/useTranslate';
import { useLanguage } from '../../contexts/LanguageContext';


const initialSummary: ExpiryQueueSummary = {
    urgent_3d: 0,
    week_7d: 0,
    month_30d: 0,
    expired: 0,
    totalValueAtRisk: 0,
};

export const ExpiryWastePage: React.FC = () => {
    const { t } = useLanguage();
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [summary, setSummary] = useState<ExpiryQueueSummary>(initialSummary);
    const [queue, setQueue] = useState<ExpiryQueueItem[]>([]);
    const [wasteHistory, setWasteHistory] = useState<WasteLogItem[]>([]);

    // Dynamic Translation Hooks
    const translatedQueue = useTranslate(queue, ['productId.name', 'suggestedAction']);
    const translatedWasteHistory = useTranslate(wasteHistory, ['productId.name', 'reason']);

    const [wasteKPI, setWasteKPI] = useState<{ totalWasteValue: number; totalWasteQty: number; recoveredActions: number }>({
        totalWasteValue: 0,
        totalWasteQty: 0,
        recoveredActions: 0,
    });

    const [wasteForm, setWasteForm] = useState({
        batchId: '',
        quantity: '',
        reason: 'expired' as WasteLogItem['reason'],
        disposalMode: 'discarded' as WasteLogItem['disposalMode'],
        notes: '',
    });

    // Discount Modal State
    const [discountModal, setDiscountModal] = useState<{
        isOpen: boolean;
        item: ExpiryQueueItem | null;
        discountValue: number;
        discountType: 'percentage' | 'fixed';
        validDays: number;
        loading: boolean;
        createdCode: DiscountCode | null;
    }>({
        isOpen: false,
        item: null,
        discountValue: 15,
        discountType: 'percentage',
        validDays: 7,
        loading: false,
        createdCode: null,
    });

    // Customer List Modal State
    const [customerModal, setCustomerModal] = useState<{
        isOpen: boolean;
        productId: string | null;
        productName: string;
        discountCode: string;
        customers: DiscountCustomer[];
        loading: boolean;
        notifying: boolean;
        notifyResult: { sent: number; failed: number } | null;
    }>({
        isOpen: false,
        productId: null,
        productName: '',
        discountCode: '',
        customers: [],
        loading: false,
        notifying: false,
        notifyResult: null,
    });

    const topRiskItems = useMemo(() => translatedQueue.slice(0, 6), [translatedQueue]);

    const loadAll = async () => {
        const [queueRes, kpiRes, wasteHistoryRes, wasteKPIRes] = await Promise.all([
            expiryApi.getQueue({ status: 'open' }),
            expiryApi.getKPI(),
            wasteApi.getHistory(),
            wasteApi.getKPI(),
        ]);
        setSummary(queueRes.data.summary || initialSummary);
        setQueue(queueRes.data.items || []);
        setWasteHistory((wasteHistoryRes.data || []).slice(0, 8));
        setWasteKPI({
            totalWasteValue: wasteKPIRes.data.totalWasteValue || 0,
            totalWasteQty: wasteKPIRes.data.totalWasteQty || 0,
            recoveredActions: wasteKPIRes.data.recoveredActions || 0,
        });

        if (!wasteForm.batchId && queueRes.data.items?.length) {
            const firstBatchId = queueRes.data.items[0]?.batchId?._id;
            if (firstBatchId) {
                setWasteForm((prev) => ({ ...prev, batchId: firstBatchId }));
            }
        }

        const openRisks = Number(kpiRes.data.openRisks || 0);
        if (openRisks === 0) {
            await expiryApi.recompute();
            const recomputed = await expiryApi.getQueue({ status: 'open' });
            setSummary(recomputed.data.summary || initialSummary);
            setQueue(recomputed.data.items || []);
        }
    };

    useEffect(() => {
        async function boot() {
            setLoading(true);
            try {
                await loadAll();
            } catch (error) {
                console.error('Failed to load expiry dashboard', error);
            } finally {
                setLoading(false);
            }
        }
        boot();
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await expiryApi.recompute();
            await loadAll();
        } catch (error) {
            console.error('Failed to refresh expiry queue', error);
        } finally {
            setRefreshing(false);
        }
    };

    const handleLogWaste = async () => {
        if (!wasteForm.batchId || Number(wasteForm.quantity) <= 0) return;
        try {
            await wasteApi.log({
                batchId: wasteForm.batchId,
                quantity: Number(wasteForm.quantity),
                reason: wasteForm.reason,
                disposalMode: wasteForm.disposalMode,
                notes: wasteForm.notes || undefined,
            });
            setWasteForm({ batchId: '', quantity: '', reason: 'expired', disposalMode: 'discarded', notes: '' });
            await handleRefresh();
        } catch (error) {
            console.error('Failed to log waste', error);
        }
    };

    const markAction = async (id: string, status: 'in_progress' | 'done' | 'ignored', actionMeta?: Record<string, unknown>) => {
        try {
            await expiryApi.updateAction(id, { actionStatus: status, actionMeta });
            await loadAll();
        } catch (error) {
            console.error('Failed to update action', error);
        }
    };

    const openDiscountModal = (item: ExpiryQueueItem) => {
        setDiscountModal({
            isOpen: true,
            item,
            discountValue: item.daysToExpiry <= 3 ? 20 : 15,
            discountType: 'percentage',
            validDays: item.daysToExpiry <= 3 ? 3 : 7,
            loading: false,
            createdCode: null,
        });
    };

    const handleCreateDiscount = async () => {
        if (!discountModal.item || !discountModal.item.productId?._id) return;
        
        setDiscountModal(prev => ({ ...prev, loading: true }));
        
        try {
            const validUntil = new Date();
            validUntil.setDate(validUntil.getDate() + discountModal.validDays);
            
            const response = await discountApi.create({
                productId: discountModal.item.productId._id,
                description: `Expiry discount for ${discountModal.item.productId.name}`,
                discountType: discountModal.discountType,
                discountValue: discountModal.discountValue,
                minPurchase: 0,
                maxUses: 50,
                validUntil: validUntil.toISOString(),
                createdFor: 'expiry',
                linkedBatchId: discountModal.item.batchId?._id,
            });
            
            setDiscountModal(prev => ({ ...prev, loading: false, createdCode: response.data }));
            addToast(`Discount code ${response.data.code} created!`, 'success');
            
            await markAction(discountModal.item._id, 'in_progress', { mode: 'discount', discountCode: response.data.code });
        } catch (error: any) {
            addToast(error.response?.data?.message || 'Failed to create discount', 'error');
            setDiscountModal(prev => ({ ...prev, loading: false }));
        }
    };

    const openCustomerModal = async (productId: string, productName: string, discountCode: string) => {
        setCustomerModal({
            isOpen: true,
            productId,
            productName,
            discountCode,
            customers: [],
            loading: true,
            notifying: false,
            notifyResult: null,
        });
        
        try {
            const response = await discountApi.getCustomers(productId, 30);
            setCustomerModal(prev => ({ ...prev, customers: response.data, loading: false }));
        } catch (error) {
            addToast('Failed to load customers', 'error');
            setCustomerModal(prev => ({ ...prev, loading: false }));
        }
    };

    const handleNotifyCustomers = async () => {
        if (!customerModal.productId || !customerModal.discountCode) return;
        
        setCustomerModal(prev => ({ ...prev, notifying: true }));
        
        try {
            const response = await discountApi.notifyCustomers({
                productId: customerModal.productId,
                discountCode: customerModal.discountCode,
                expiryDays: 3,
            });
            
            setCustomerModal(prev => ({ 
                ...prev, 
                notifying: false, 
                notifyResult: { sent: response.data.sent, failed: response.data.failed } 
            }));
            
            addToast(`Notified ${response.data.sent} customers!`, 'success');
        } catch (error: any) {
            addToast(error.response?.data?.message || 'Failed to notify customers', 'error');
            setCustomerModal(prev => ({ ...prev, notifying: false }));
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        addToast('Copied to clipboard!', 'success');
    };

    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-pulse space-y-4">
                    <div className="h-20 bg-gray-200 rounded-2xl" />
                    <div className="h-44 bg-gray-200 rounded-2xl" />
                    <div className="h-44 bg-gray-200 rounded-2xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-48">
            {/* Header Block: Title */}
            <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
                <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                    {t['Expiry & Waste Command Center']}
                </h2>
            </div>

            {/* Stats Block: At Risk Value */}
            <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-red-500/5 flex items-center justify-between group overflow-hidden relative">
                <div className="absolute right-0 top-0 -mr-8 -mt-8 opacity-5 group-hover:rotate-12 transition-transform duration-700 pointer-events-none">
                    <Recycle size={180} className="text-red-500" />
                </div>
                <div className="flex items-center gap-5 relative z-10">
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl text-red-500 transition-transform group-hover:scale-110">
                        <AlertTriangle size={32} />
                    </div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1 leading-none">{t['At Risk Value']}</p>
                        <p className="text-3xl md:text-4xl font-black text-red-600 leading-none">₹{summary.totalValueAtRisk.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* Action Block: Refresh */}
            <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-5 rounded-[2rem] font-black text-xl shadow-2xl hover:scale-[1.01] transition-transform active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
            >
                <RefreshCw size={24} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? t['Refreshing...'] : t['Refresh System']}
            </button>


            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-4">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                <AlertTriangle className="text-amber-500" size={18} />
                                {t['Priority Risk Queue']}
                            </h3>
                            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold uppercase tracking-wider">
                                {topRiskItems.length} {t['High Risk Items']}
                            </span>
                        </div>
                        <div className="p-4 space-y-3">
                            {topRiskItems.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                                        <CheckCircle2 size={32} />
                                    </div>
                                    <p className="text-gray-500 font-medium">{t['No inventory items currently at risk']}</p>
                                </div>
                            ) : (
                                topRiskItems.map((item) => (
                                    <div key={item._id} className="p-4 rounded-xl border border-gray-100 bg-white hover:border-green-200 hover:shadow-md transition-all group">
                                        {/* Product info row */}
                                        <div className="mb-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-bold text-gray-900 group-hover:text-primary-green transition-colors">{item.productId?.name}</h4>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${item.daysToExpiry <= 3 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {item.daysToExpiry < 0 ? t['Expired'] : `${item.daysToExpiry} ${t['days left']}`}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                                                <span className="flex items-center gap-1.5"><ShoppingBag size={14} /> {t['Qty:']} <strong>{item.batchId?.quantityAvailable}</strong></span>
                                                <span className="flex items-center gap-1.5"><DollarSign size={14} /> {t['Value at Risk:']} <strong>₹{item.valueAtRisk.toLocaleString()}</strong></span>
                                                <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-medium">{t['Suggest:']} {item.suggestedAction}</span>
                                            </div>
                                        </div>
                                        {/* Horizontal action bar */}
                                        <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between gap-2 overflow-hidden">
                                            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                                                <button
                                                    onClick={() => markAction(item._id, 'in_progress')}
                                                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-[10px] font-bold hover:bg-gray-50 transition-colors whitespace-nowrap flex-shrink"
                                                >
                                                    {t['Mark In Progress']}
                                                </button>
                                                <button
                                                    onClick={() => openDiscountModal(item)}
                                                    className="px-2.5 py-1.5 rounded-lg bg-green-50 text-primary-green text-[10px] font-bold hover:bg-green-100 transition-colors whitespace-nowrap flex-shrink"
                                                >
                                                    {t['Apply Discount']}
                                                </button>
                                                <button
                                                    onClick={() => markAction(item._id, 'done', { mode: 'bundle' })}
                                                    className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-bold hover:bg-blue-100 transition-colors whitespace-nowrap flex-shrink"
                                                >
                                                    {t['Start Bundle']}
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => markAction(item._id, 'ignored')}
                                                className="p-1.5 rounded-lg border border-red-100 text-red-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                                                title={t['Ignore']}
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                <Recycle className="text-primary-green" size={18} />
                                {t['Waste & Recovery Snapshot']}
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div className="p-4 rounded-xl bg-red-50 border border-red-100">
                                    <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-1">{t['Waste Value (30d)']}</p>
                                    <p className="text-2xl font-black text-red-700">₹{wasteKPI.totalWasteValue.toLocaleString()}</p>
                                </div>
                                <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                                    <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">{t['Waste Qty (30d)']}</p>
                                    <p className="text-2xl font-black text-amber-700">{wasteKPI.totalWasteQty.toFixed(1)}</p>
                                </div>
                                <div className="p-4 rounded-xl bg-green-50 border border-green-100">
                                    <p className="text-xs font-bold text-green-600 uppercase tracking-widest mb-1">{t['Recovered Actions']}</p>
                                    <p className="text-2xl font-black text-green-700">{wasteKPI.recoveredActions}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">{t['Recent Waste Logs']}</h4>
                                {translatedWasteHistory.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic py-4">{t['No recent waste logs found']}</p>
                                ) : (
                                    <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                                        {translatedWasteHistory.map((entry) => (
                                            <div key={entry._id} className="p-3 bg-white flex justify-between items-center hover:bg-gray-50 transition-colors">
                                                <div>
                                                    <p className="font-bold text-gray-900 text-sm">{entry.productId?.name}</p>
                                                    <p className="text-xs text-gray-500">{entry.reason} • {new Date(entry.loggedAt).toLocaleDateString()}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-red-600">₹{entry.estimatedLoss.toLocaleString()}</p>
                                                    <p className="text-xs text-gray-400">{t['Qty:']} {entry.quantity}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 ring-1 ring-red-100">
                    <h3 className="font-bold text-lg text-gray-900 mb-6 flex items-center gap-2">
                        <Trash2 className="text-red-500" size={20} />
                        {t['Log Inventory Loss']}
                    </h3>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">{t['Select Batch']}</label>
                            <select
                                value={wasteForm.batchId}
                                onChange={(e) => setWasteForm((prev) => ({ ...prev, batchId: e.target.value }))}
                                className="w-full px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 outline-none text-sm font-bold focus:ring-2 focus:ring-red-100 transition-all"
                            >
                                <option value="">{t['Choose a risky batch...']}</option>
                                {translatedQueue.map((item) => (
                                    <option key={item._id} value={item.batchId?._id}>{item.productId?.name} ({item.batchId?.quantityAvailable})</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">{t['Quantity']}</label>
                                <input value={wasteForm.quantity} onChange={(e) => setWasteForm((prev) => ({ ...prev, quantity: e.target.value }))} className="w-full px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 outline-none text-sm font-bold focus:ring-2 focus:ring-red-100 transition-all" type="number" min="0" placeholder="0" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">{t['Loss Reason']}</label>
                                <select value={wasteForm.reason} onChange={(e) => setWasteForm((prev) => ({ ...prev, reason: e.target.value as WasteLogItem['reason'] }))} className="w-full px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 outline-none text-sm font-bold focus:ring-2 focus:ring-red-100 transition-all">
                                    <option value="expired">{t['Expired']}</option>
                                    <option value="damaged">{t['Damaged']}</option>
                                    <option value="spoilage">{t['Spoilage']}</option>
                                    <option value="leakage">{t['Leakage']}</option>
                                    <option value="return_rejected">{t['Return Rejected']}</option>
                                    <option value="other">{t['Other']}</option>
                                </select>
                            </div>
                        </div>

                        <button onClick={handleLogWaste} className="w-full rounded-2xl border-2 border-red-500 text-red-500 bg-white py-4 text-sm font-black transition-all hover:bg-red-500 hover:text-white flex items-center justify-center gap-2 mt-2">
                            <Trash2 size={18} />
                            {t['Confirm Waste Log']}
                        </button>
                    </div>
                </div>
            </div>

            {/* Discount Modal */}
            {discountModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-gray-900">Create Discount Code</h3>
                            <button onClick={() => setDiscountModal(prev => ({ ...prev, isOpen: false }))} className="p-2 hover:bg-gray-100 rounded-xl">
                                <X size={20} />
                            </button>
                        </div>

                        {discountModal.item && (
                            <div className="space-y-4">
                                <div className="bg-green-50 p-4 rounded-2xl">
                                    <p className="font-bold text-gray-900">{discountModal.item.productId?.name}</p>
                                    <p className="text-sm text-gray-500">
                                        {discountModal.item.daysToExpiry <= 3 ? '⚠️ Expiring soon!' : `${discountModal.item.daysToExpiry} days left`}
                                        • ₹{discountModal.item.valueAtRisk?.toLocaleString()} at risk
                                    </p>
                                </div>

                                {!discountModal.createdCode ? (
                                    <>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500">Discount %</label>
                                                <input
                                                    type="number"
                                                    value={discountModal.discountValue}
                                                    onChange={(e) => setDiscountModal(prev => ({ ...prev, discountValue: Number(e.target.value) }))}
                                                    className="w-full px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 font-bold"
                                                    min={5}
                                                    max={50}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500">Valid Days</label>
                                                <select
                                                    value={discountModal.validDays}
                                                    onChange={(e) => setDiscountModal(prev => ({ ...prev, validDays: Number(e.target.value) }))}
                                                    className="w-full px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 font-bold"
                                                >
                                                    <option value={3}>3 Days</option>
                                                    <option value={5}>5 Days</option>
                                                    <option value={7}>7 Days</option>
                                                    <option value={14}>14 Days</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setDiscountModal(prev => ({ ...prev, discountType: 'percentage' }))}
                                                className={`flex-1 py-3 rounded-2xl font-bold text-sm ${discountModal.discountType === 'percentage' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                                            >
                                                Percentage %
                                            </button>
                                            <button
                                                onClick={() => setDiscountModal(prev => ({ ...prev, discountType: 'fixed' }))}
                                                className={`flex-1 py-3 rounded-2xl font-bold text-sm ${discountModal.discountType === 'fixed' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                                            >
                                                Fixed ₹
                                            </button>
                                        </div>

                                        <button
                                            onClick={handleCreateDiscount}
                                            disabled={discountModal.loading}
                                            className="w-full bg-primary-green text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-green-100 hover:scale-[1.02] transition-transform disabled:opacity-50"
                                        >
                                            {discountModal.loading ? 'Creating...' : `Create ${discountModal.discountType === 'percentage' ? `${discountModal.discountValue}%` : `₹${discountModal.discountValue}`} Discount`}
                                        </button>
                                    </>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="bg-green-50 border-2 border-green-200 p-4 rounded-2xl text-center">
                                            <p className="text-sm text-gray-600 mb-2">Discount Code Created!</p>
                                            <div className="flex items-center justify-center gap-2">
                                                <span className="text-3xl font-black text-primary-green">{discountModal.createdCode.code}</span>
                                                <button onClick={() => copyToClipboard(discountModal.createdCode!.code)} className="p-2 hover:bg-green-100 rounded-xl">
                                                    <Copy size={18} />
                                                </button>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2">
                                                Valid until {new Date(discountModal.createdCode.validUntil).toLocaleDateString()}
                                            </p>
                                        </div>

                                        <button
                                            onClick={() => discountModal.item && discountModal.createdCode && openCustomerModal(
                                                discountModal.item.productId?._id || '',
                                                discountModal.item.productId?.name || '',
                                                discountModal.createdCode.code
                                            )}
                                            disabled={!discountModal.item || !discountModal.createdCode}
                                            className="w-full bg-blue-500 text-white py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <Send size={16} />
                                            Notify Previous Customers
                                        </button>

                                        <button
                                            onClick={() => setDiscountModal(prev => ({ ...prev, isOpen: false }))}
                                            className="w-full bg-gray-100 text-gray-700 py-3 rounded-2xl font-bold text-sm"
                                        >
                                            Done
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Customer Notification Modal */}
            {customerModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-gray-900">Notify Customers</h3>
                            <button onClick={() => setCustomerModal(prev => ({ ...prev, isOpen: false }))} className="p-2 hover:bg-gray-100 rounded-xl">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="bg-blue-50 p-3 rounded-2xl mb-4">
                            <p className="font-bold text-sm">{customerModal.productName}</p>
                            <p className="text-xs text-gray-600">Code: <span className="font-black text-primary-green">{customerModal.discountCode}</span></p>
                        </div>

                        {customerModal.notifyResult ? (
                            <div className="bg-green-50 p-4 rounded-2xl text-center">
                                <CheckCircle2 size={48} className="mx-auto text-green-500 mb-2" />
                                <p className="font-bold text-gray-900">Sent to {customerModal.notifyResult.sent} customers!</p>
                                {customerModal.notifyResult.failed > 0 && (
                                    <p className="text-sm text-gray-500">{customerModal.notifyResult.failed} failed</p>
                                )}
                            </div>
                        ) : customerModal.loading ? (
                            <div className="py-8 text-center">
                                <div className="animate-spin w-8 h-8 border-4 border-primary-green border-t-transparent rounded-full mx-auto" />
                                <p className="text-sm text-gray-500 mt-2">Loading customers...</p>
                            </div>
                        ) : customerModal.customers.length === 0 ? (
                            <div className="py-8 text-center opacity-50">
                                <Users size={48} className="mx-auto text-gray-300 mb-2" />
                                <p className="text-sm">No previous customers found</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex-1 overflow-y-auto mb-4">
                                    <p className="text-xs text-gray-500 mb-2">{customerModal.customers.length} customers who bought this product</p>
                                    <div className="space-y-2">
                                        {customerModal.customers.slice(0, 10).map((customer) => (
                                            <div key={customer._id} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl">
                                                <div>
                                                    <p className="font-bold text-sm">{customer.name}</p>
                                                    <p className="text-xs text-gray-500">{customer.phoneNumber}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-500">{customer.purchaseCount} orders</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleNotifyCustomers}
                                    disabled={customerModal.notifying}
                                    className="w-full bg-primary-green text-white py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {customerModal.notifying ? 'Sending...' : `Send to ${customerModal.customers.length} Customers`}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpiryWastePage;
