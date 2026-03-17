import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5001/api';

const api = axios.create({
    baseURL: API_BASE_URL,
});

// Interceptor to add token to headers
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export interface Customer {
    _id: string;
    phoneNumber: string;
    name?: string;
    email?: string;
    khataBalance?: number;
    khataScore?: number;
    khataLimit?: number;
    isLocal?: boolean;
    preferredVoiceLanguage?: string;
    lockVoiceLanguage?: boolean;
    lastDetectedVoiceLanguage?: string;
    lastVoiceLanguageConfidence?: number;
    voiceLanguageSource?: 'manual' | 'shop_default' | 'detected' | 'ivr';
}

export interface WhatsAppOrderItem {
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
}

export interface WhatsAppOrder {
    _id: string;
    customerPhone: string;
    customerMessage: string;
    parsedText?: string;
    mediaUrl?: string;
    referenceCode?: string;
    reviewState?: 'none' | 'needs_manual_review' | 'awaiting_customer_choice';
    reviewReason?: string;
    autoDecisionReason?: string;
    resolutionSource?: 'auto' | 'customer_choice' | 'shopkeeper_edit';
    channel: 'whatsapp_text' | 'whatsapp_audio';
    status: 'received' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
    items: WhatsAppOrderItem[];
    totalAmount: number;
    convertedBillId?: string;
    convertedAt?: string;
    createdAt: string;
    customerId?: {
        _id: string;
        name?: string;
        phoneNumber?: string;
    };
}

export const authApi = {
    login: (data: Record<string, unknown>) => api.post('/auth/login', data),
    register: (data: Record<string, unknown>) => api.post('/auth/register', data),
    getMe: () => api.get('/auth/me'),
};

export const productApi = {
    getAll: () => api.get('/products'),
    create: (data: Record<string, unknown>) => api.post('/products', data),
    update: (id: string, data: Record<string, unknown>) => api.patch(`/products/${id}`, data),
    seed: () => api.post('/products/seed', {}),
};

export const customerApi = {
    getAll: () => api.get('/customers'),
    getByPhone: (phone: string) => api.get(`/customers/${phone}`),
    search: (query: string) => api.get(`/customers/search?q=${query}`),
    create: (data: any) => api.post('/customers', data),
    seed: () => api.post('/customers/seed', {}),
    update: (id: string, data: any) => api.patch(`/customers/${id}`, data),
};

export const billApi = {
    getAll: () => api.get('/bills'),
    create: (data: { customerPhoneNumber: string; items: Array<{ productId: string; quantity: number; price: number }>; paymentType: string }) =>
        api.post('/bills', data),
    sendKhataOtp: (customerPhoneNumber: string) =>
        api.post('/bills/khata/send-otp', { customerPhoneNumber }),
    verifyKhataOtp: (data: { customerPhoneNumber: string; otp: string; billData: any }) =>
        api.post('/bills/khata/verify-otp', data),
    // Razorpay: creates a server-side order and returns orderId + keyId
    createRazorpayOrder: (amountInPaise: number) =>
        api.post('/bills/razorpay/create-order', { amount: amountInPaise }),
    // Razorpay: verifies signature and creates the bill in DB
    verifyRazorpayPayment: (data: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
        billData: { customerPhoneNumber: string; items: Array<{ productId: string; quantity: number; price: number }> };
    }) => api.post('/bills/razorpay/verify-payment', data),
    // Razorpay: creates a dynamic QR code for instant payment
    createRazorpayQR: (amountInPaise: number) =>
        api.post('/bills/razorpay/create-qr', { amount: amountInPaise }),
    sendBillOnWhatsApp: (billId: string) => api.post(`/bills/${billId}/send-whatsapp`),
};

export const ledgerApi = {
    getCustomerLedger: (customerId: string) => api.get(`/ledger/customer/${customerId}`),
    recordPayment: (data: { customerId: string; amount: number; paymentMode: string }) =>
        api.post('/ledger/payment', data),
};

export const groupBuyApi = {
    getAll: (params?: { latitude?: number; longitude?: number; radius?: number }) =>
        api.get('/group-buy', { params }),
    create: (data: any) => api.post('/group-buy', data),
    join: (id: string, customerId: string, units: number = 1) =>
        api.patch(`/group-buy/${id}/join`, { customerId, units }),
};

export const analyticsApi = {
    getInsights: () => api.get('/analytics/insights'),
};

export const supplierBillApi = {
    process: (data: { lineItems: any[] }) => api.post('/supplier-bills/process', data),
    getHistory: () => api.get('/supplier-bills'),
};

export const invoiceApi = {
    getInvoices: () => api.get('/invoices'),
    getOverdueInvoices: () => api.get('/invoices/overdue'),
    createDemoInvoice: (data: any) => api.post('/invoices', data),
    markInvoicePaid: (id: string) => api.put(`/invoices/${id}/payment`),
    importKhataDues: () => api.post('/invoices/import-khata'),
    recoverNow: (customerId: string) => api.post(`/invoices/recover-now/${customerId}`),
    getRecoveryState: (invoiceId: string, since?: string) =>
        api.get<RecoveryState>(`/invoices/recovery-state/${invoiceId}`, { params: since ? { since } : undefined }),
};

export interface RecoveryState {
    invoiceId: string;
    invoiceStatus: string;
    lastIntent: string | null;
    aiConfidence: number;
    promisedDate: string | null;
    nextRetryAt: string | null;
    hasTranscript: boolean;
    hasTranscriptSince: boolean;
    latestVoiceLog: string | null;
    latestTranscriptLog: string | null;
    latestVoiceAt: string | null;
    latestTranscriptAt: string | null;
    negotiationStage: string | null;
    negotiationStatus: string | null;
    negotiationSummary: string | null;
    negotiationTurns: number;
    negotiationPartialAmountNow: number;
    negotiationRemainingAmount: number | null;
    negotiationPromisedDate: string | null;
    latestSessionCustomerTranscript: string | null;
    negotiationLanguage: string;
    negotiationLanguageConfidence: number;
    negotiationCodeMixed: boolean;
    negotiationFallbackMode: string;
    negotiationLanguageSource: string;
    customerRecoveryStatus: string | null;
    customerNextCallDate: number | null;
    customerRecoveryNotes: string | null;
    customerPreferredVoiceLanguage: string;
    customerVoiceLanguageLocked: boolean;
    customerLastDetectedVoiceLanguage: string | null;
    customerLastVoiceLanguageConfidence: number;
    customerVoiceLanguageSource: string;
}

export const whatsappApi = {
    getAnalytics: () => api.get('/whatsapp/analytics'),
    broadcastReminders: () => api.post('/whatsapp/broadcast-reminders'),
    getOrders: () => api.get<WhatsAppOrder[]>('/whatsapp/orders'),
    updateOrderStatus: (id: string, status: WhatsAppOrder['status']) => api.patch(`/whatsapp/orders/${id}/status`, { status }),
    updateOrderItems: (id: string, items: Array<{ productId: string; quantity: number }>) =>
        api.patch(`/whatsapp/orders/${id}/items`, { items }),
    fetchOrderMedia: (id: string) => api.get(`/whatsapp/orders/${id}/media`, { responseType: 'blob' }),
    convertOrderToBill: (id: string) => api.post(`/whatsapp/orders/${id}/convert-to-bill`, {}),
};

export interface InventoryBatch {
    _id: string;
    productId: {
        _id: string;
        name: string;
        category?: string;
        unit?: string;
        icon?: string;
        price?: number;
    } | string;
    batchCode?: string;
    mfgDate?: string;
    expiryDate?: string;
    quantityReceived: number;
    quantityAvailable: number;
    costPricePerUnit?: number;
    sellingPriceSnapshot?: number;
    status: 'active' | 'depleted' | 'expired' | 'returned';
    source?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ExpiryQueueItem {
    _id: string;
    daysToExpiry: number;
    riskBucket: 'urgent_3d' | 'week_7d' | 'month_30d' | 'expired';
    suggestedAction: 'discount' | 'bundle' | 'return' | 'waste' | 'none';
    actionStatus: 'open' | 'in_progress' | 'done' | 'ignored';
    actionMeta?: Record<string, unknown>;
    valueAtRisk: number;
    productId: {
        _id: string;
        name: string;
        category?: string;
        unit?: string;
        icon?: string;
        price?: number;
        costPrice?: number;
    };
    batchId: {
        _id: string;
        expiryDate?: string;
        quantityAvailable: number;
        costPricePerUnit?: number;
    };
}

export interface ExpiryQueueSummary {
    urgent_3d: number;
    week_7d: number;
    month_30d: number;
    expired: number;
    totalValueAtRisk: number;
}

export interface WasteLogItem {
    _id: string;
    reason: 'expired' | 'damaged' | 'spoilage' | 'leakage' | 'return_rejected' | 'other';
    quantity: number;
    unitCost: number;
    estimatedLoss: number;
    disposalMode: 'discarded' | 'donated' | 'supplier_returned';
    notes?: string;
    loggedAt: string;
    productId: {
        _id: string;
        name: string;
        category?: string;
        unit?: string;
        icon?: string;
    };
    batchId: {
        _id: string;
        expiryDate?: string;
        batchCode?: string;
    };
}

export const expiryApi = {
    createBatch: (data: {
        productId: string;
        quantity: number;
        costPricePerUnit?: number;
        sellingPriceSnapshot?: number;
        batchCode?: string;
        mfgDate?: string;
        expiryDate?: string;
    }) => api.post<InventoryBatch>('/expiry/batches', data),
    getBatches: (params?: { status?: string; productId?: string }) =>
        api.get<InventoryBatch[]>('/expiry/batches', { params }),
    updateBatch: (id: string, data: Record<string, unknown>) =>
        api.patch<InventoryBatch>(`/expiry/batches/${id}`, data),
    recompute: () => api.post('/expiry/recompute', {}),
    getQueue: (params?: { bucket?: string; status?: string }) =>
        api.get<{ summary: ExpiryQueueSummary; items: ExpiryQueueItem[] }>('/expiry/queue', { params }),
    updateAction: (id: string, data: { actionStatus: string; actionMeta?: Record<string, unknown> }) =>
        api.patch(`/expiry/actions/${id}`, data),
    getKPI: () => api.get<{ products: number; openRisks: number; atRiskValue: number }>('/expiry/kpi'),
};

export const wasteApi = {
    log: (data: {
        batchId: string;
        quantity: number;
        reason: WasteLogItem['reason'];
        disposalMode?: WasteLogItem['disposalMode'];
        notes?: string;
    }) => api.post<WasteLogItem>('/waste/log', data),
    getHistory: (params?: { from?: string; to?: string }) => api.get<WasteLogItem[]>('/waste/history', { params }),
    getKPI: (params?: { from?: string; to?: string }) =>
        api.get<{ from: string; to: string; totalWasteValue: number; totalWasteQty: number; recoveredActions: number }>('/waste/kpi', { params }),
};

// ── GST & ITR API ────────────────────────────────────────────────────────────
export interface GSTSummary {
    month: number;
    year: number;
    totalSales: number;
    totalOutputGST: number;
    totalInputGST: number;
    netGSTPayable: number;
    outputCGST: number;
    outputSGST: number;
    inputCGST: number;
    inputSGST: number;
}

export interface ITRSummary {
    month: number;
    year: number;
    revenue: number;
    revenueExGST: number;
    purchaseCost: number;
    grossProfit: number;
    gstCollected: number;
    gstPaid: number;
    netGSTPayable: number;
    estimatedTaxableIncome: number;
    disclaimer: string;
}

export const gstApi = {
    // Classify a product (uses DB cache then OpenAI)
    classifyProduct: (name: string, productId?: string) =>
        api.post('/gst/classify', { name, productId }),

    // Bulk-classify all unclassified products
    classifyAll: () =>
        api.post('/gst/classify-all'),

    // Preview GST calculation without persisting
    calculate: (items: any[]) =>
        api.post('/gst/calculate', { items }),

    // Create a sale GST invoice (persists + ledger entry)
    createSaleInvoice: (data: { items: any[]; customerId?: string; billId?: string }) =>
        api.post('/gst/invoices', { ...data }),

    // Create a purchase GST entry (supplier purchase)
    createPurchaseEntry: (data: { items: any[]; supplierBillId?: string }) =>
        api.post('/gst/purchases', { ...data }),

    // List GST invoices
    getInvoices: (params?: { type?: string; month?: number; year?: number }) =>
        api.get('/gst/invoices', { params }),

    // List GST ledger entries
    getLedger: (params?: { type?: string; month?: number; year?: number }) =>
        api.get('/gst/ledger', { params }),

    // Monthly GST summary
    getGSTSummary: (month: number, year: number) =>
        api.get<GSTSummary>('/reports/gst-summary', { params: { month, year } }),

    // Monthly ITR assistance summary
    getITRSummary: (month: number, year: number) =>
        api.get<ITRSummary>('/reports/itr-summary', { params: { month, year } }),
};

export interface DiscountCode {
    _id: string;
    code: string;
    shopkeeperId: string;
    productId?: { _id: string; name: string; icon?: string };
    description: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    minPurchase: number;
    maxUses: number;
    usedCount: number;
    validFrom: string;
    validUntil: string;
    isActive: boolean;
    createdFor: 'expiry' | 'manual' | 'promotional';
    linkedBatchId?: string;
    createdAt: string;
    updatedAt: string;
}

export interface DiscountValidation {
    valid: boolean;
    message?: string;
    discount?: {
        code: string;
        description: string;
        discountType: string;
        discountValue: number;
        discountAmount: number;
    };
}

export interface DiscountCustomer {
    _id: string;
    name: string;
    phoneNumber: string;
    lastPurchased: string;
    purchaseCount: number;
    totalSpent: number;
}

export const discountApi = {
    create: (data: {
        productId?: string;
        description?: string;
        discountType: 'percentage' | 'fixed';
        discountValue: number;
        minPurchase?: number;
        maxUses?: number;
        validUntil: string;
        createdFor?: 'expiry' | 'manual' | 'promotional';
        linkedBatchId?: string;
    }) => api.post<DiscountCode>('/discounts', data),
    
    getAll: (params?: { isActive?: boolean; createdFor?: string }) =>
        api.get<DiscountCode[]>('/discounts', { params }),
    
    update: (id: string, data: {
        isActive?: boolean;
        discountValue?: number;
        maxUses?: number;
        validUntil?: string;
    }) => api.patch<DiscountCode>(`/discounts/${id}`, data),
    
    validate: (data: { code: string; customerId?: string; billAmount?: number }) =>
        api.post<DiscountValidation>('/discounts/validate', data),
    
    apply: (id: string, data: { billId?: string; customerId?: string; billAmount?: number }) =>
        api.post<{ success: boolean; discountAmount: number; remainingUses: number }>(`/discounts/${id}/apply`, data),
    
    getCustomers: (productId: string, limit?: number) =>
        api.get<DiscountCustomer[]>(`/discounts/customers/${productId}`, { params: { limit } }),
    
    notifyCustomers: (data: {
        productId: string;
        discountCode: string;
        message?: string;
        expiryDays?: number;
    }) => api.post<{ success: boolean; sent: number; failed: number; total: number }>('/discounts/notify-customers', data),
};


export default api;

