import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import {
    Activity,
    AlertTriangle,
    Bell,
    MessageCircle,
    Mic,
    Plus,
    RefreshCcw,
    Save,
    ShoppingBag,
    X,
} from 'lucide-react';

import { productApi, whatsappApi, type WhatsAppOrder } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useTranslate } from '../../hooks/useTranslate';
import { useLanguage } from '../../contexts/LanguageContext';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://127.0.0.1:5001';

type LiveEvent = {
    type: string;
    data: Record<string, unknown>;
    timestamp: string;
};

type DashboardDiagnostic = {
    source: string;
    message: string;
    statusCode?: number;
    at: string;
};

type ItemEditorRow = {
    productId: string;
    name: string;
    quantity: number;
};

type ProductOption = {
    _id: string;
    name: string;
    stock: number;
};

type OrderFilter = 'all' | 'needs_review' | 'awaiting_choice' | 'ready_to_bill';

type DashboardAnalytics = {
    pendingTotal: number;
    activeDebtors: number;
    ordersToday: number;
    needsReviewCount: number;
    awaitingChoiceCount: number;
    readyToBillCount: number;
};

const statusOptions: Array<WhatsAppOrder['status']> = ['confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];

const statusClasses: Record<WhatsAppOrder['status'], string> = {
    received: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
    preparing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
    ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
    delivered: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200',
    cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200',
};

const initialAnalytics: DashboardAnalytics = {
    pendingTotal: 0,
    activeDebtors: 0,
    ordersToday: 0,
    needsReviewCount: 0,
    awaitingChoiceCount: 0,
    readyToBillCount: 0,
};

function isOrderNeedsReview(order: WhatsAppOrder): boolean {
    return (order.reviewState ?? 'none') === 'needs_manual_review';
}

function isOrderAwaitingChoice(order: WhatsAppOrder): boolean {
    return (order.reviewState ?? 'none') === 'awaiting_customer_choice';
}

function isOrderReadyToBill(order: WhatsAppOrder): boolean {
    return !order.convertedBillId && (order.reviewState ?? 'none') === 'none' && order.status !== 'cancelled' && order.items.length > 0 && order.totalAmount > 0;
}

function getSimpleStatusColor(status: string, reviewState: string): string {
    if (reviewState === 'needs_manual_review') return 'bg-red-100 text-red-700';
    if (reviewState === 'awaiting_customer_choice') return 'bg-orange-100 text-orange-700';
    switch (status) {
        case 'confirmed': return 'bg-blue-100 text-blue-700';
        case 'preparing': return 'bg-amber-100 text-amber-700';
        case 'ready': return 'bg-green-100 text-green-700';
        case 'delivered': return 'bg-purple-100 text-purple-700';
        case 'cancelled': return 'bg-gray-100 text-gray-500';
        default: return 'bg-gray-100 text-gray-700';
    }
}

function getSimpleStatusLabel(status: string, reviewState: string, lang: string = 'en'): string {
    if (reviewState === 'needs_manual_review') {
        return lang === 'hi' ? '⚠️ ज़रा देखें' : lang === 'te' ? '⚠️ చూద్దా' : '⚠️ Needs Review';
    }
    if (reviewState === 'awaiting_customer_choice') {
        return lang === 'hi' ? '⏳ ग्राहक से बात' : lang === 'te' ? '⏳ వాటి చెప్పు' : '⏳ Awaiting Choice';
    }
    switch (status) {
        case 'received': 
            return lang === 'hi' ? '📩 नया ऑर्डर' : lang === 'te' ? '📩 కొత్త ఆర్డర్' : '📩 New Order';
        case 'confirmed': 
            return lang === 'hi' ? '✅ तय है' : lang === 'te' ? '✅ నిర్ధారణ' : '✅ Confirmed';
        case 'preparing': 
            return lang === 'hi' ? '👨‍🍳 बन रहा है' : lang === 'te' ? '👨‍🍳 తయారు' : '👨‍🍳 Preparing';
        case 'ready': 
            return lang === 'hi' ? '📦 तैयार' : lang === 'te' ? '📦 సిద్ధం' : '📦 Ready';
        case 'delivered': 
            return lang === 'hi' ? '🚚 दे दिया' : lang === 'te' ? '🚚 డెలివర్' : '🚚 Delivered';
        case 'cancelled': 
            return lang === 'hi' ? '❌ रद्द' : lang === 'te' ? '❌రద్దు' : '❌ Cancelled';
        default: return status;
    }
}

export default function WhatsAppPage() {
    const { t, language } = useLanguage();
    const { addToast } = useToast();
    const [orders, setOrders] = useState<WhatsAppOrder[]>([]);
    const [events, setEvents] = useState<LiveEvent[]>([]);

    const [analytics, setAnalytics] = useState<DashboardAnalytics>(initialAnalytics);
    const [loading, setLoading] = useState(true);
    const [sendingReminder, setSendingReminder] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [convertingId, setConvertingId] = useState<string | null>(null);
    const [diagnostics, setDiagnostics] = useState<DashboardDiagnostic[]>([]);
    const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
    const [savingItemsId, setSavingItemsId] = useState<string | null>(null);
    const [draftItemsByOrder, setDraftItemsByOrder] = useState<Record<string, ItemEditorRow[]>>({});
    const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
    const [newProductByOrder, setNewProductByOrder] = useState<Record<string, string>>({});
    const [activeFilter, setActiveFilter] = useState<OrderFilter>('all');
    const [orderMediaUrls, setOrderMediaUrls] = useState<Record<string, string>>({});

    const translatedOrders = useTranslate(orders, ['customerMessage', 'parsedText', 'items.name']);
    const translatedProducts = useTranslate(productOptions, ['name']);

    const [loadingMediaId, setLoadingMediaId] = useState<string | null>(null);

    const addDiagnostic = (source: string, error: any) => {
        const entry: DashboardDiagnostic = {
            source,
            message: error?.response?.data?.message || error?.message || 'Unknown error',
            statusCode: error?.response?.status,
            at: new Date().toISOString(),
        };
        setDiagnostics((prev) => [entry, ...prev].slice(0, 12));
    };

    const loadDashboard = async () => {
        try {
            setLoading(true);
            const [ordersRes, analyticsRes] = await Promise.all([
                whatsappApi.getOrders(),
                whatsappApi.getAnalytics(),
            ]);
            setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
            setAnalytics({ ...initialAnalytics, ...analyticsRes.data });
        } catch (error: any) {
            addToast(error.response?.data?.message || 'Failed to load WhatsApp dashboard', 'error');
            addDiagnostic('loadDashboard', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDashboard();
    }, []);

    useEffect(() => {
        const loadProducts = async () => {
            try {
                const response = await productApi.getAll();
                const normalized = Array.isArray(response.data)
                    ? response.data.map((product: any) => ({
                        _id: String(product._id),
                        name: String(product.name),
                        stock: Number(product.stock || 0),
                    }))
                    : [];
                setProductOptions(normalized);
            } catch (error: any) {
                addDiagnostic('loadProducts', error);
            }
        };

        loadProducts();
    }, []);

    useEffect(() => {
        const socket = io(SOCKET_URL);
        socket.on('connect', () => {
            setEvents([{ type: 'SYSTEM', data: { message: 'WhatsApp live relay connected' }, timestamp: new Date().toISOString() }]);
        });
        socket.on('whatsapp-event', (event: LiveEvent) => {
            setEvents((prev) => [event, ...prev].slice(0, 20));
            if (event.type === 'NEW_ORDER' || event.type === 'ORDER_UPDATED') {
                loadDashboard();
            }
        });
        socket.on('connect_error', (error) => {
            addDiagnostic('socket', error);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const handleSendReminders = async () => {
        try {
            setSendingReminder(true);
            const res = await whatsappApi.broadcastReminders();
            addToast(`Sent ${res.data.sentCount} reminders. Skipped ${res.data.skippedOutsideWindow}.`, 'success');
            await loadDashboard();
        } catch (error: any) {
            addToast(error.response?.data?.message || 'Failed to send reminders', 'error');
            addDiagnostic('broadcastReminders', error);
        } finally {
            setSendingReminder(false);
        }
    };

    const handleStatusUpdate = async (orderId: string, status: WhatsAppOrder['status']) => {
        try {
            setUpdatingId(orderId);
            await whatsappApi.updateOrderStatus(orderId, status);
            setOrders((prev) => prev.map((order) => order._id === orderId ? { ...order, status } : order));
            addToast(status === 'ready' ? '✅ Order Ready!' : status === 'delivered' ? '✅ Delivered!' : 'Updated!', 'success');
        } catch (error: any) {
            addToast('Failed to update', 'error');
            addDiagnostic('updateOrderStatus', error);
        } finally {
            setUpdatingId(null);
        }
    };

    const handleConvertToBill = async (orderId: string) => {
        try {
            setConvertingId(orderId);
            const res = await whatsappApi.convertOrderToBill(orderId);
            const updatedOrder = res.data?.order;
            if (updatedOrder?._id) {
                setOrders((prev) => prev.map((order) => order._id === orderId ? updatedOrder : order));
            } else {
                await loadDashboard();
            }
            addToast(
                res.data?.alreadyConverted
                    ? 'Order already linked to bill'
                    : 'Order converted to bill',
                'success'
            );
        } catch (error: any) {
            addToast(error.response?.data?.message || 'Failed to convert order to bill', 'error');
            addDiagnostic('convertToBill', error);
        } finally {
            setConvertingId(null);
        }
    };

    const handleLoadVoiceNote = async (order: WhatsAppOrder) => {
        try {
            if (orderMediaUrls[order._id]) return;
            setLoadingMediaId(order._id);
            const res = await whatsappApi.fetchOrderMedia(order._id);
            const mediaObjectUrl = URL.createObjectURL(res.data);
            setOrderMediaUrls((prev) => ({ ...prev, [order._id]: mediaObjectUrl }));
        } catch (error: any) {
            addToast(error.response?.data?.message || 'Failed to load voice note', 'error');
            addDiagnostic('loadVoiceNote', error);
        } finally {
            setLoadingMediaId(null);
        }
    };

    const startEditingItems = (order: WhatsAppOrder) => {
        setEditingOrderId(order._id);
        setDraftItemsByOrder((prev) => ({
            ...prev,
            [order._id]: order.items.map((item) => ({
                productId: item.productId,
                name: item.name,
                quantity: item.quantity,
            })),
        }));
    };

    const cancelEditingItems = (orderId: string) => {
        setEditingOrderId((current) => current === orderId ? null : current);
        setDraftItemsByOrder((prev) => {
            const next = { ...prev };
            delete next[orderId];
            return next;
        });
        setNewProductByOrder((prev) => {
            const next = { ...prev };
            delete next[orderId];
            return next;
        });
    };

    const updateDraftItemQuantity = (orderId: string, productId: string, quantity: number) => {
        const safeQty = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
        setDraftItemsByOrder((prev) => ({
            ...prev,
            [orderId]: (prev[orderId] || []).map((item) =>
                item.productId === productId ? { ...item, quantity: safeQty } : item
            ),
        }));
    };

    const removeDraftItem = (orderId: string, productId: string) => {
        setDraftItemsByOrder((prev) => ({
            ...prev,
            [orderId]: (prev[orderId] || []).filter((item) => item.productId !== productId),
        }));
    };

    const addDraftItem = (orderId: string) => {
        const selectedProductId = newProductByOrder[orderId];
        if (!selectedProductId) return;

        const selectedProduct = productOptions.find((product) => product._id === selectedProductId);
        if (!selectedProduct) return;

        setDraftItemsByOrder((prev) => {
            const current = prev[orderId] || [];
            const existing = current.find((item) => item.productId === selectedProduct._id);
            if (existing) {
                return {
                    ...prev,
                    [orderId]: current.map((item) =>
                        item.productId === selectedProduct._id
                            ? { ...item, quantity: item.quantity + 1 }
                            : item
                    ),
                };
            }

            return {
                ...prev,
                [orderId]: [...current, {
                    productId: selectedProduct._id,
                    name: selectedProduct.name,
                    quantity: 1,
                }],
            };
        });
    };

    const saveEditedItems = async (orderId: string) => {
        try {
            const draftItems = draftItemsByOrder[orderId] || [];
            if (!draftItems.length) {
                addToast('Keep at least one item in order', 'error');
                return;
            }

            setSavingItemsId(orderId);
            const payload = draftItems.map((item) => ({ productId: item.productId, quantity: item.quantity }));
            const response = await whatsappApi.updateOrderItems(orderId, payload);
            const updatedOrder = response.data as WhatsAppOrder;

            setOrders((prev) => prev.map((order) => order._id === orderId ? updatedOrder : order));
            addToast('Order items updated', 'success');
            cancelEditingItems(orderId);
        } catch (error: any) {
            addToast(error.response?.data?.message || 'Failed to update items', 'error');
            addDiagnostic('updateOrderItems', error);
        } finally {
            setSavingItemsId(null);
        }
    };

    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

    const activeOrder = useMemo(() => translatedOrders.find(o => o._id === selectedOrderId) || null, [translatedOrders, selectedOrderId]);

    const filteredOrders = useMemo(() => {
        let result = translatedOrders;
        if (activeFilter === 'needs_review') result = translatedOrders.filter((order) => isOrderNeedsReview(order));
        else if (activeFilter === 'awaiting_choice') result = translatedOrders.filter((order) => isOrderAwaitingChoice(order));
        else if (activeFilter === 'ready_to_bill') result = translatedOrders.filter((order) => isOrderReadyToBill(order));
        return result;
    }, [translatedOrders, activeFilter]);

    useEffect(() => {
        if (!selectedOrderId && filteredOrders.length > 0) {
            setSelectedOrderId(filteredOrders[0]._id);
        }
    }, [filteredOrders, selectedOrderId]);

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] -mt-2 space-y-3 px-2 sm:px-0">
            {/* Minimal Header Stats */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="bg-primary-green p-2 sm:p-2.5 rounded-xl sm:rounded-2xl text-white shadow-lg shadow-green-100">
                        <MessageCircle size={20} className="sm:w-6 sm:h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight">{t['WhatsApp Desk'] || 'WhatsApp Desk'}</h2>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{analytics.ordersToday} {t['Orders Today'] || 'Orders Today'}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSendReminders}
                        disabled={sendingReminder}
                        className="bg-white border border-gray-100 text-gray-700 font-bold px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl shadow-sm hover:bg-gray-50 flex items-center gap-2 text-xs sm:text-sm transition-all"
                    >
                        {sendingReminder ? <Activity size={14} className="sm:w-4 sm:h-4 animate-spin" /> : <Bell size={14} className="sm:w-4 sm:h-4 text-primary-green" />}
                        <span className="hidden sm:inline">{sendingReminder ? 'Sending...' : 'Broadcast'}</span>
                    </button>
                    <button
                        onClick={loadDashboard}
                        className="bg-primary-green text-white font-bold px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl shadow-lg shadow-green-100 hover:scale-105 transition-all flex items-center gap-2 text-xs sm:text-sm"
                    >
                        <RefreshCcw size={14} className="sm:w-4 sm:h-4" />
                    </button>
                </div>
            </div>

            {/* Main Messaging Desk */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-3 lg:gap-6 overflow-hidden min-h-0">

                {/* Left: Conversation List */}
                <div className="bg-white rounded-2xl lg:rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col min-h-0 overflow-hidden">
                    <div className="p-3 sm:p-6 border-b border-gray-50 bg-gray-50/30">
                        <div className="flex items-center justify-between mb-3 sm:mb-4">
                            <h3 className="font-black text-gray-900 uppercase tracking-tight text-sm sm:text-base">{t['Conversations'] || 'Conversations'}</h3>
                            <span className="bg-primary-green/10 text-primary-green text-[10px] font-black px-2 py-0.5 rounded-full">
                                {filteredOrders.length} ACTIVE
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <FilterChip label="All" active={activeFilter === 'all'} onClick={() => setActiveFilter('all')} />
                            <FilterChip label="Review" active={activeFilter === 'needs_review'} onClick={() => setActiveFilter('needs_review')} />
                            <FilterChip label="Choice" active={activeFilter === 'awaiting_choice'} onClick={() => setActiveFilter('awaiting_choice')} />
                            <FilterChip label="Ready" active={activeFilter === 'ready_to_bill'} onClick={() => setActiveFilter('ready_to_bill')} />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-2 scrollbar-hide">
                        {loading && orders.length === 0 ? (
                            <div className="py-12 sm:py-20 text-center space-y-4">
                                <div className="animate-spin w-8 h-8 sm:w-10 sm:h-10 border-4 border-primary-green border-t-transparent rounded-full mx-auto" />
                                <p className="text-sm sm:text-base font-bold text-gray-400">{t['Loading...'] || 'Loading...'}</p>
                            </div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="py-12 sm:py-20 text-center opacity-50">
                                <ShoppingBag size={40} className="mx-auto mb-3 sm:mb-4 text-gray-300" />
                                <p className="text-sm sm:text-base font-bold">{t['No orders yet'] || 'No orders yet'}</p>
                            </div>
                        ) : (
                            filteredOrders.map((order) => (
                                <button
                                    key={order._id}
                                    onClick={() => setSelectedOrderId(order._id)}
                                    className={`w-full text-left p-3 sm:p-5 rounded-xl sm:rounded-2xl border-2 transition-all flex items-center gap-3 sm:gap-4 ${selectedOrderId === order._id
                                        ? 'bg-green-50 border-green-400 shadow-lg'
                                        : 'bg-white border-gray-100 hover:border-green-200 hover:bg-green-25'
                                        }`}
                                >
                                    {/* Large avatar */}
                                    <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center text-lg sm:text-2xl font-black ${selectedOrderId === order._id ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
                                        }`}>
                                        {(order.customerId?.name || order.customerPhone || 'C')[0].toUpperCase()}
                                    </div>
                                    
                                    {/* Order Info - BIG and CLEAR */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center">
                                            <p className="font-bold text-gray-900 truncate text-sm sm:text-lg">{order.customerId?.name || order.customerPhone}</p>
                                            <span className="text-sm sm:text-lg font-black text-green-600">₹{order.totalAmount.toFixed(0)}</span>
                                        </div>
                                        
                                        {/* Status badge - LARGE and COLORFUL */}
                                        <div className={`inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-bold mt-1 sm:mt-2 ${getSimpleStatusColor(order.status || 'confirmed', order.reviewState || 'none')}`}>
                                            {order.channel === 'whatsapp_audio' && '🎤 '}
                                            {getSimpleStatusLabel(order.status || 'confirmed', order.reviewState || 'none', language)}
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Right: Active Detail Panel */}
                <div className="bg-white rounded-2xl lg:rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col overflow-hidden min-h-0">
                    {activeOrder ? (
                        <>
                            {/* Detail Panel Header */}
                            <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-50 bg-gray-50/20 flex items-center justify-between flex-wrap gap-3">
                                <div className="flex items-center gap-3 sm:gap-4">
                                    <div className="w-10 sm:w-14 h-10 sm:h-14 rounded-xl sm:rounded-2xl bg-primary-green text-white flex items-center justify-center text-lg sm:text-2xl font-black shadow-lg shadow-green-100">
                                        {(activeOrder.customerId?.name || 'C')[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-base sm:text-xl font-black text-gray-900">{activeOrder.customerId?.name || activeOrder.customerPhone}</h3>
                                        <p className="text-xs font-bold text-gray-400 flex items-center gap-2">
                                            <span className="text-primary-green uppercase tracking-widest">{activeOrder.referenceCode || activeOrder._id.slice(-6).toUpperCase()}</span>
                                            {activeOrder.customerPhone}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 sm:gap-3">
                                    <div className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest ${statusClasses[activeOrder.status]}`}>
                                        {activeOrder.status}
                                    </div>
                                    <button
                                        onClick={() => handleConvertToBill(activeOrder._id)}
                                        disabled={convertingId === activeOrder._id || Boolean(activeOrder.convertedBillId) || editingOrderId === activeOrder._id || !isOrderReadyToBill(activeOrder)}
                                        className="bg-primary-green text-white px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-green-100 transition-all hover:scale-105 disabled:opacity-50 disabled:scale-100"
                                    >
                                        {activeOrder.convertedBillId ? 'BILL' : convertingId === activeOrder._id ? '...' : 'CREATE BILL'}
                                    </button>
                                </div>
                            </div>

                            {/* Detail Panel Body */}
                            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-8 scrollbar-hide">

                                {/* Raw Message Context */}
                                <div className="space-y-3">
                                    <h4 className="text-[10px] sm:text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">{t['Customer Request'] || 'Customer Request'}</h4>
                                    <div className="max-w-[85%] bg-gray-50 rounded-2xl sm:rounded-[2rem] rounded-tl-none p-4 sm:p-5 border border-gray-100 relative">
                                        <div className="absolute top-0 left-[-8px] border-[8px] border-transparent border-t-gray-50 border-r-gray-50" />
                                        <p className="text-gray-800 font-medium leading-relaxed text-sm sm:text-base">{activeOrder.customerMessage}</p>
                                        {activeOrder.channel === 'whatsapp_audio' && activeOrder.mediaUrl && (
                                            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200/60">
                                                {orderMediaUrls[activeOrder._id] ? (
                                                    <audio controls src={orderMediaUrls[activeOrder._id]} className="w-full h-10" />
                                                ) : (
                                                    <button
                                                        onClick={() => handleLoadVoiceNote(activeOrder)}
                                                        disabled={loadingMediaId === activeOrder._id}
                                                        className="flex items-center gap-3 bg-white border border-gray-200 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-gray-700 hover:bg-gray-50"
                                                    >
                                                        <Mic size={14} className="text-primary-green" />
                                                        {loadingMediaId === activeOrder._id ? '...' : 'PLAY VOICE'}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {activeOrder.parsedText && activeOrder.parsedText !== activeOrder.customerMessage && (
                                        <div className="max-w-[85%] ml-auto bg-green-50/50 rounded-2xl sm:rounded-[2rem] rounded-tr-none p-4 sm:p-5 border border-green-100/50 relative">
                                            <p className="text-[10px] font-black uppercase text-primary-green/60 mb-1">{t['SDukaan AI Parsing'] || 'SDukaan AI Parsing'}</p>
                                            <p className="text-gray-800 font-medium leading-relaxed italic text-sm sm:text-base">{activeOrder.parsedText}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Order Items Control */}
                                <div className="space-y-3 sm:space-y-4">
                                    <div className="flex items-center justify-between px-1 flex-wrap gap-2">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t['Parsed Order Items'] || 'Parsed Order Items'}</h4>
                                        <button
                                            onClick={() => editingOrderId === activeOrder._id ? cancelEditingItems(activeOrder._id) : startEditingItems(activeOrder)}
                                            className={`text-[10px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1.5 rounded-xl transition-all ${editingOrderId === activeOrder._id
                                                ? 'bg-rose-50 text-rose-500'
                                                : 'bg-green-50 text-primary-green shadow-sm'
                                                }`}
                                        >
                                            {editingOrderId === activeOrder._id ? 'CANCEL' : 'MODIFY'}
                                        </button>
                                    </div>

                                    {editingOrderId === activeOrder._id ? (
                                        <div className="rounded-2xl sm:rounded-3xl border border-dashed border-gray-200 p-4 sm:p-6 space-y-4 bg-gray-50/30">
                                            <div className="space-y-3">
                                                {(draftItemsByOrder[activeOrder._id] || []).map((item) => (
                                                    <div key={item.productId} className="bg-white p-3 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
                                                        <span className="font-bold text-gray-800 text-sm">{item.name}</span>
                                                        <div className="flex items-center gap-2 sm:gap-3">
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                value={item.quantity}
                                                                onChange={(e) => updateDraftItemQuantity(activeOrder._id, item.productId, Number(e.target.value))}
                                                                className="w-12 sm:w-16 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 text-center font-bold outline-none focus:ring-2 focus:ring-green-100 text-sm"
                                                            />
                                                            <button
                                                                onClick={() => removeDraftItem(activeOrder._id, item.productId)}
                                                                className="p-1.5 rounded-lg text-rose-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto] gap-2 pt-2">
                                                <select
                                                    value={newProductByOrder[activeOrder._id] || ''}
                                                    onChange={(e) => setNewProductByOrder((prev) => ({ ...prev, [activeOrder._id]: e.target.value }))}
                                                    className="bg-white px-3 sm:px-4 rounded-xl border border-gray-100 outline-none text-xs sm:text-sm font-bold truncate"
                                                >
                                                    <option value="">Add products...</option>
                                                    {translatedProducts.map((p) => (
                                                        <option key={p._id} value={p._id}>{p.name} ({p.stock})</option>
                                                    ))}
                                                </select>
                                                <button onClick={() => addDraftItem(activeOrder._id)} className="p-2 sm:p-3 bg-gray-900 text-white rounded-xl hover:bg-black">
                                                    <Plus size={16} />
                                                </button>
                                                <button
                                                    onClick={() => saveEditedItems(activeOrder._id)}
                                                    disabled={savingItemsId === activeOrder._id}
                                                    className="hidden sm:flex px-6 bg-primary-green text-white font-black text-sm rounded-xl shadow-lg shadow-green-100 items-center gap-2"
                                                >
                                                    <Save size={16} /> SAVE
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {activeOrder.items.map((item) => (
                                                <div key={item.productId} className="bg-white p-4 rounded-3xl border border-gray-100 flex items-center justify-between group hover:border-green-100 transition-all">
                                                    <div>
                                                        <p className="font-bold text-gray-900">{item.name}</p>
                                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{item.quantity} units • Rs.{item.unitPrice}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-black text-gray-900 leading-none">Rs.{(item.quantity * item.unitPrice).toFixed(0)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Order Bottom Actions */}
                                <div className="pt-4 sm:pt-6 border-t border-gray-50 flex items-center justify-between flex-wrap gap-4">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mb-1">TOTAL</p>
                                        <p className="text-3xl sm:text-4xl font-black text-primary-green">₹{activeOrder.totalAmount.toFixed(0)}</p>
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        {statusOptions.map((status) => (
                                            <button
                                                key={status}
                                                onClick={() => handleStatusUpdate(activeOrder._id, status)}
                                                disabled={updatingId === activeOrder._id || activeOrder.status === status}
                                                className={`px-3 sm:px-4 py-2 rounded-xl sm:rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeOrder.status === status
                                                    ? 'bg-gray-900 text-white shadow-lg'
                                                    : 'bg-white border border-gray-100 text-gray-400 hover:bg-gray-50'
                                                    } disabled:opacity-50`}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 sm:p-12 opacity-30 select-none">
                            <div className="w-24 sm:w-32 h-24 sm:h-32 bg-gray-50 rounded-full flex items-center justify-center mb-4 sm:mb-6">
                                <MessageCircle size={48} className="sm:w-16 sm:h-16 text-gray-300" />
                            </div>
                            <h3 className="text-xl sm:text-2xl font-black text-gray-900">{t['Desk Idle'] || 'Desk Idle'}</h3>
                            <p className="max-w-xs mt-2 text-sm font-medium">{t['Select a conversation to start'] || 'Select a conversation to start'}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Hidden/Desktop Rules & Diagnostics Overlay (Minimalist) */}
            <div className="hidden md:grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/50 backdrop-blur-sm rounded-3xl p-4 border border-gray-100 flex items-start gap-4">
                    <Activity size={24} className="text-gray-300 mt-1" />
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Live Socket Events</p>
                        <div className="space-y-1 max-h-20 overflow-y-auto pr-2 scrollbar-hide text-xs">
                            {events.slice(0, 5).map((e, i) => (
                                <p key={i} className="text-gray-500"><span className="font-bold text-gray-700">{e.type}</span>: {String(e.data.customer || e.data.message || 'Event')}</p>
                            ))}
                        </div>
                    </div>
                </div>
                {diagnostics.length > 0 && (
                    <div className="bg-red-50 rounded-3xl p-4 border border-red-100 flex items-start gap-4">
                        <AlertTriangle size={24} className="text-red-400 mt-1" />
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-3">Alert Diagnostics</p>
                            <div className="space-y-1 text-xs">
                                {diagnostics.slice(0, 2).map((d, i) => (
                                    <p key={i} className="text-red-600 font-medium">{d.source}: {d.message}</p>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${active
                ? 'bg-primary-green text-white shadow-md shadow-green-100'
                : 'bg-white text-gray-400 border border-gray-100 hover:bg-gray-50'
                }`}
        >
            {label}
        </button>
    );
}

