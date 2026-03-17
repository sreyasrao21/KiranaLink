import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useCart } from '../../contexts/CartContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { productApi, customerApi, billApi } from '../../services/api';
import type { Customer } from '../../services/api';
import { db } from '../../db/db';
import type { Customer as LocalCustomer } from '../../db/db';
import { recalculateKhataScore, SCORE_DEFAULT, calculateKhataLimit, getKhataStatus, type KhataExplanation } from '../../lib/khataLogic';
import { Search, User, Phone, X, ChevronRight, Minus, Plus, Trash2, Award, Download, Share2, MessageCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTranslate } from '../../hooks/useTranslate';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://127.0.0.1:5001';

// --- Memoized Sub-components ---

const BillingProductCard = React.memo(({ product, t, cartItem, addToCart, increaseQuantity, decreaseQuantity, addToast }: any) => {
    const isOutOfStock = product.stock <= 0;
    const inCart = !!cartItem;

    return (
        <div className={`bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col relative transition-all ${isOutOfStock ? 'opacity-40 grayscale-[0.5]' : 'hover:shadow-md'}`}>
            {isOutOfStock && (
                <div className="absolute top-2 right-2 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter z-10">
                    {t['Sold Out']}
                </div>
            )}

            <div className="flex-1 flex flex-col items-center justify-center py-2">
                <div className="text-4xl mb-2">{product.icon || '📦'}</div>
                <span className="font-bold text-gray-900 dark:text-gray-100 leading-tight text-center text-sm mb-1 line-clamp-2">{product.name}</span>
                <span className="text-primary-green font-bold text-sm">₹{product.price}/{product.unit}</span>
                {product.stock <= product.minStock && product.stock > 0 && (
                    <span className="text-[10px] text-orange-500 font-semibold mt-1">{t['Only']} {product.stock} {t['left']}</span>
                )}
            </div>

            {!isOutOfStock && (
                <div className="mt-2">
                    {!inCart ? (
                        <button
                            onClick={() => {
                                const success = addToCart(product, product.stock);
                                if (!success) addToast(`${t['Only']} ${product.stock} ${product.unit} ${t['available']}`, 'warning');
                            }}
                            className="w-full bg-white dark:bg-gray-700 border-2 border-primary-green text-primary-green font-black text-sm py-2 rounded-lg hover:bg-primary-green hover:text-white transition-all active:scale-95"
                        >
                            {t['ADD']}
                        </button>
                    ) : (
                        <div className="flex items-center justify-between bg-primary-green rounded-lg overflow-hidden">
                            <button
                                onClick={() => decreaseQuantity(product._id!)}
                                className="w-10 h-9 flex items-center justify-center text-white font-black text-lg hover:bg-emerald-600 transition-colors active:scale-90"
                            >
                                <Minus size={16} />
                            </button>
                            <div className="flex-1 text-center">
                                <span className="text-white font-black text-sm">{cartItem.quantity}</span>
                                <span className="text-white/70 text-[10px] ml-1">{product.unit}</span>
                            </div>
                            <button
                                onClick={() => {
                                    const success = increaseQuantity(product._id!, product.stock);
                                    if (!success) addToast(`${t['Only']} ${product.stock} ${product.unit} ${t['available']}`, 'warning');
                                }}
                                className="w-10 h-9 flex items-center justify-center text-white font-black text-lg hover:bg-emerald-600 transition-colors active:scale-90"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {isOutOfStock && (
                <div className="absolute inset-0 bg-white/10 dark:bg-black/10 flex items-center justify-center rounded-2xl">
                    <div className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-lg rotate-[-15deg] shadow-lg ring-2 ring-white">{t['OUT OF STOCK']}</div>
                </div>
            )}
        </div>
    );
});

const CheckoutCartItem = React.memo(({ item, t, increaseQuantity, decreaseQuantity, updateQuantity, removeFromCart, addToast }: any) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-start mb-3">
            <div>
                <div className="font-bold text-gray-900 dark:text-white text-lg">{item.name}</div>
                <div className="text-gray-500 dark:text-gray-400 text-sm">₹{item.price}/{item.unit}</div>
            </div>
            <div className="font-bold text-lg text-gray-900 dark:text-white">₹{item.price * item.quantity}</div>
        </div>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 pr-3">
                <div className="flex items-center">
                    <button onClick={() => decreaseQuantity(item._id!)} className="w-8 h-8 bg-white dark:bg-gray-600 rounded-md flex items-center justify-center text-gray-700 dark:text-white"><Minus size={16} /></button>
                    <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const success = updateQuantity(item._id!, val, item.stock);
                            if (!success) addToast(`${t['Only']} ${item.stock} ${item.unit} ${t['available']}`, 'warning');
                        }}
                        className="w-16 bg-transparent text-center font-bold text-gray-900 dark:text-white border-none focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button onClick={() => {
                        const success = increaseQuantity(item._id!, item.stock);
                        if (!success) addToast(`${t['Only']} ${item.stock} ${item.unit} ${t['available']}`, 'warning');
                    }} className="w-8 h-8 bg-white dark:bg-gray-600 rounded-md flex items-center justify-center text-gray-700 dark:text-white"><Plus size={16} /></button>
                </div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.unit}</span>
            </div>
            <button onClick={() => removeFromCart(item._id!)} className="text-danger-red p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 size={18} /></button>
        </div>
    </div>
));

const CustomerSuggestionRow = React.memo(({ cust, t, identifyCustomer, isGlobal }: any) => (
    <button
        onClick={() => identifyCustomer(cust)}
        className={`w-full flex items-center justify-between p-4 ${isGlobal ? 'bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700'} rounded-2xl hover:shadow-md transition-all group`}
    >
        <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${isGlobal ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'} rounded-xl flex items-center justify-center font-bold uppercase`}>
                {cust.name?.[0] || 'C'}
            </div>
            <div className="text-left">
                <div className="flex items-center gap-2">
                    <div className="font-black text-gray-900 dark:text-white">{cust.name || t['Unnamed Customer']}</div>
                    {isGlobal && <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full">GLOBAL</span>}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-bold">{cust.phoneNumber}</div>
            </div>
        </div>
        <ChevronRight className={`${isGlobal ? 'text-blue-300 group-hover:text-blue-500' : 'text-gray-300 group-hover:text-primary-green'}`} />
    </button>
));

const PaymentOptionLabel = React.memo(({ value, currentMethod, onChange, t, title, description, disabled, khataInfo }: any) => (
    <label
        className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all relative ${currentMethod === value
            ? 'border-primary-green bg-green-50 dark:bg-green-900/10'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        <div className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${currentMethod === value
                ? 'border-primary-green bg-primary-green'
                : 'border-gray-300 dark:border-gray-600'
                }`}>
                {currentMethod === value && (
                    <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                )}
            </div>
            <div>
                <div className="font-semibold text-gray-900 dark:text-white">{t[title] || title}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                    {value === 'ledger' && khataInfo ? `₹${khataInfo.availableCredit} ${t['available']}` : t[description] || description}
                </div>
            </div>
        </div>
        <input
            type="radio"
            name="payment"
            value={value}
            checked={currentMethod === value}
            onChange={() => onChange(value)}
            disabled={disabled}
            className="sr-only"
        />
        {value === 'ledger' && disabled && (
            <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {t['Limit Exceeded']}
            </div>
        )}
    </label>
));

export const BillingPage: React.FC = () => {
    const { cart, addToCart, increaseQuantity, decreaseQuantity, updateQuantity, removeFromCart, clearCart, cartTotal } = useCart();
    const { t } = useLanguage();
    const { addToast } = useToast();
    const [products, setProducts] = useState<any[]>([]);
    const translatedProducts = useTranslate(products, ['name', 'category']);
    const translatedCart = useTranslate(cart, ['name', 'unit']);

    useSpeechRecognition({
        onResult: (transcript: string) => {
            setSearchTerm(transcript);
        },
    });

    const [showCheckout, setShowCheckout] = useState(false);
    const [checkoutStep, setCheckoutStep] = useState<'SUMMARY' | 'CUSTOMER' | 'PAYMENT'>('SUMMARY');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online' | 'ledger' | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [animationType, setAnimationType] = useState<'cash' | 'online' | 'ledger' | null>(null);
    const [otp, setOtp] = useState('');
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [otpLoading, setOtpLoading] = useState(false);
    const [latestBillId, setLatestBillId] = useState<string | null>(null);
    const [sendingBillWhatsApp, setSendingBillWhatsApp] = useState(false);

    // Customer identification states
    const [customerInput, setCustomerInput] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<(Customer & LocalCustomer) | null>(null);
    const [isNewCustomer, setIsNewCustomer] = useState(false);
    const [khataInfo, setKhataInfo] = useState<KhataExplanation | null>(null);
    const [customerVoiceLanguage, setCustomerVoiceLanguage] = useState<string>('en');

    // Global Search State
    const [globalResults, setGlobalResults] = useState<Customer[]>([]);
    const [isGlobalLoading, setIsGlobalLoading] = useState(false);

    const loadCustomers = React.useCallback(async () => {
        try {
            const response = await customerApi.getAll();
            setAllCustomers(response.data);
        } catch (err) {
            console.error('Failed to load customers', err);
        }
    }, []);

    const loadProducts = React.useCallback(async () => {
        try {
            const response = await productApi.getAll();
            setProducts(response.data);
        } catch (err) {
            console.error('Failed to load products', err);
        }
    }, []);

    useEffect(() => {
        loadProducts();
        loadCustomers();

        // ── Real-time Payment Listening ──
        const socket = io(SOCKET_URL);
        socket.on('payment-success', async (data) => {
            console.log('Payment success received via socket:', data);
        });

        return () => {
            socket.disconnect();
        };
    }, [loadProducts, loadCustomers]);

    // Effect: Global Search
    useEffect(() => {
        const fetchGlobal = async () => {
            if (!customerInput || customerInput.length < 3) {
                setGlobalResults([]);
                return;
            }

            setIsGlobalLoading(true);
            try {
                const res = await customerApi.search(customerInput);
                const localIds = new Set(allCustomers.map(c => c._id));
                const uniqueGlobal = res.data.filter((c: any) => !localIds.has(c._id));
                setGlobalResults(uniqueGlobal);
            } catch (error) {
                console.error('Global search failed', error);
                setGlobalResults([]);
            } finally {
                setIsGlobalLoading(false);
            }
        };

        const timer = setTimeout(fetchGlobal, 400);
        return () => clearTimeout(timer);
    }, [customerInput, allCustomers]);


    const getLedgerColor = React.useCallback((balance: number) => {
        if (balance <= 500) return 'text-green-600 bg-green-50 border-green-200';
        if (balance <= 1500) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        return 'text-red-600 bg-red-50 border-red-200';
    }, []);

    const identifyCustomer = React.useCallback(async (cust?: Customer) => {
        const phone = cust ? cust.phoneNumber : phoneNumber;
        const name = cust ? cust.name : customerName;

        const last10 = phone.replace(/\D/g, '').slice(-10);
        if (last10.length !== 10) {
            addToast(t['Enter valid 10-digit phone number'], 'error');
            return;
        }
        const normalizedPhone = `+91${last10}`;

        try {
            const response = await customerApi.create({ phoneNumber: normalizedPhone, name });
            const customerData = response.data;

            let localCustomer = await db.customers.where('phoneNumber').equals(normalizedPhone).first();
            if (!localCustomer) {
                const globalScore = customerData.khataScore || SCORE_DEFAULT;
                const newLocalId = await db.customers.add({
                    phoneNumber: normalizedPhone,
                    name: name || customerData.name || 'Unnamed Customer',
                    khataScore: globalScore,
                    khataBalance: customerData.khataBalance || 0,
                    khataLimit: customerData.khataLimit || calculateKhataLimit(globalScore),
                    activeKhataAmount: customerData.khataBalance || 0,
                    maxHistoricalKhataAmount: customerData.khataBalance || 0,
                    totalTransactions: 0,
                    khataTransactions: 0,
                    latePayments: 0,
                    createdAt: Date.now()
                });
                localCustomer = await db.customers.get(newLocalId);
            } else {
                await db.customers.update(localCustomer.id!, {
                    khataScore: customerData.khataScore || localCustomer.khataScore,
                    khataLimit: customerData.khataLimit || localCustomer.khataLimit,
                    khataBalance: customerData.khataBalance
                });
                localCustomer = await db.customers.get(localCustomer.id!);
            }

            setSelectedCustomer({
                ...customerData,
                ...localCustomer,
                name: customerData.name || localCustomer?.name || 'Unnamed Customer'
            } as Customer & LocalCustomer);

            // Set voice language from customer data
            setCustomerVoiceLanguage((customerData as any).preferredVoiceLanguage || 'en');

            const status = await getKhataStatus(normalizedPhone, customerData.khataScore, customerData.khataLimit);
            setKhataInfo(status);

            setCheckoutStep('PAYMENT');
            addToast(response.status === 201 ? t['New customer created'] : t['Customer identified'], 'success');
            loadCustomers();
        } catch (e: any) {
            console.error(e);
            addToast(t['Error identifying customer'] || 'Error identifying customer', 'error');
        }
    }, [phoneNumber, customerName, t, addToast, loadCustomers]);

    const filteredCustomers = React.useMemo(() => allCustomers.filter(c =>
        (c.name?.toLowerCase().includes(customerInput.toLowerCase()) ||
            c.phoneNumber.includes(customerInput)) && customerInput.length > 0
    ), [allCustomers, customerInput]);

    const filteredProducts = React.useMemo(() => translatedProducts?.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()))
    ), [translatedProducts, searchTerm]);

    const processTransaction = React.useCallback(async (method: 'cash' | 'online' | 'ledger') => {
        if (!selectedCustomer) return false;

        try {
            const billRes = await billApi.create({
                customerPhoneNumber: selectedCustomer.phoneNumber,
                items: cart.map(i => ({ productId: i._id!, quantity: i.quantity, price: i.price })),
                paymentType: method
            });
            setLatestBillId(billRes.data?._id || null);

            if (method === 'ledger') {
                const customer = await db.customers.where('phoneNumber').equals(selectedCustomer.phoneNumber).first();
                if (customer) {
                    const newActiveAmount = (customer.activeKhataAmount || 0) + cartTotal;
                    await db.customers.update(customer.id!, {
                        activeKhataAmount: newActiveAmount,
                        maxHistoricalKhataAmount: Math.max((customer.maxHistoricalKhataAmount || 0), newActiveAmount),
                        khataTransactions: (customer.khataTransactions || 0) + 1
                    });

                    await db.ledger.add({
                        customerId: selectedCustomer.phoneNumber,
                        amount: cartTotal,
                        paymentMode: 'KHATA',
                        type: 'debit',
                        status: 'PENDING',
                        createdAt: Date.now(),
                        items: cart
                    });

                    await recalculateKhataScore(selectedCustomer.phoneNumber);
                }
            } else {
                await db.ledger.add({
                    customerId: selectedCustomer.phoneNumber,
                    amount: cartTotal,
                    paymentMode: method.toUpperCase() as any,
                    type: 'debit',
                    status: 'PAID',
                    createdAt: Date.now(),
                    paidAt: Date.now(),
                    items: cart
                });

                const customer = await db.customers.where('phoneNumber').equals(selectedCustomer.phoneNumber).first();
                if (customer) {
                    await db.customers.update(customer.id!, {
                        totalTransactions: (customer.totalTransactions || 0) + 1
                    });
                }
            }

            addToast(t['Transaction successful!'], 'success');
            loadProducts();
            return true;
        } catch (e: any) {
            console.error(e);
            addToast(e.response?.data?.message || t['Transaction Failed'] || 'Transaction Failed', 'error');
            return false;
        }
    }, [selectedCustomer, cart, cartTotal, t, addToast, loadProducts]);

    const handleCashPayment = React.useCallback(async () => {
        setAnimationType('cash');
        setShowStatusModal(true);
        setIsProcessing(true);

        const success = await processTransaction('cash');
        if (success) {
            setIsProcessing(false);
        } else {
            setShowStatusModal(false);
        }
    }, [processTransaction]);

    const handleUpiPayment = React.useCallback(async () => {
        if (!selectedCustomer) return;

        setIsProcessing(true);

        try {
            const amountInPaise = cartTotal * 100;
            const res = await (billApi as any).createRazorpayOrder(amountInPaise);
            const { orderId, keyId } = res.data;

            const options = {
                key: keyId,
                amount: amountInPaise,
                currency: "INR",
                name: "SDukaan",
                description: "Purchase from SDukaan",
                order_id: orderId,
                handler: async function (response: any) {
                    try {
                        setAnimationType('online');
                        setShowStatusModal(true);
                        setIsProcessing(true);

                        const verifyRes = await (billApi as any).verifyRazorpayPayment({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            billData: {
                                customerPhoneNumber: selectedCustomer.phoneNumber,
                                items: cart.map(i => ({ productId: i._id!, quantity: i.quantity, price: i.price }))
                            }
                        });

                        setLatestBillId(verifyRes.data.bill?._id || null);

                        await db.ledger.add({
                            customerId: selectedCustomer.phoneNumber,
                            amount: cartTotal,
                            paymentMode: 'UPI',
                            type: 'debit',
                            status: 'PAID',
                            createdAt: Date.now(),
                            paidAt: Date.now(),
                            items: cart
                        });

                        const customer = await db.customers.where('phoneNumber').equals(selectedCustomer.phoneNumber).first();
                        if (customer) {
                            await db.customers.update(customer.id!, {
                                totalTransactions: (customer.totalTransactions || 0) + 1
                            });
                        }

                        addToast(t['UPI Payment Successful!'], 'success');
                        loadProducts(); // Refresh local stock
                        setIsProcessing(false);
                    } catch (verifyErr: any) {
                        console.error('[Razorpay Verify Error]', verifyErr);
                        addToast(verifyErr.response?.data?.message || t['Payment Verification Failed'] || 'Payment Verification Failed', 'error');
                        setShowStatusModal(false);
                        setIsProcessing(false);
                    }
                },
                prefill: {
                    name: selectedCustomer.name || "",
                    contact: selectedCustomer.phoneNumber.replace("+91", "")
                },
                theme: {
                    color: "#16a34a"
                },
                modal: {
                    ondismiss: function () {
                        setIsProcessing(false);
                    }
                }
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.on('payment.failed', function (response: any) {
                console.error('[Razorpay Error]', response.error);
                addToast(response.error.description || 'Payment Failed', 'error');
                setIsProcessing(false);
            });
            rzp.open();
        } catch (err: any) {
            console.error('[Razorpay Order Error]', err);
            addToast(err.response?.data?.message || 'Failed to initialize payment gateway', 'error');
            setShowStatusModal(false);
            setIsProcessing(false);
        }
    }, [selectedCustomer, cartTotal, cart, t, addToast, loadProducts]);

    const handleLedgePayment = React.useCallback(async () => {
        if (khataInfo && cartTotal > khataInfo.availableCredit) {
            addToast(`${t['Credit Limit Exceeded!']} ${t['Available']}: ₹${khataInfo.availableCredit}`, 'error');
            return;
        }

        if (!selectedCustomer) return;

        setAnimationType('ledger');
        setShowStatusModal(true);
        setIsProcessing(true);
        setShowOtpInput(true);
        setOtpLoading(true);

        try {
            const res = await billApi.sendKhataOtp(selectedCustomer.phoneNumber);
            addToast(t['Verification code sent to customer'], 'success');

            if (res.data?.demoOtp) {
                setOtp(res.data.demoOtp);
                addToast(`[DEMO] OTP auto-filled: ${res.data.demoOtp}`, 'info');
            }
        } catch (err: any) {
            addToast(err.response?.data?.message || t['Failed to send OTP'], 'error');
            setShowStatusModal(false);
            setIsProcessing(false);
            setShowOtpInput(false);
        } finally {
            setOtpLoading(false);
        }
    }, [khataInfo, cartTotal, selectedCustomer, t, addToast]);

    const handleVerifyOtp = React.useCallback(async () => {
        if (!selectedCustomer || otp.length !== 6) return;

        setOtpLoading(true);
        try {
            const billData = {
                customerPhoneNumber: selectedCustomer.phoneNumber,
                items: cart.map(i => ({ productId: i._id!, quantity: i.quantity, price: i.price })),
            };

            const verifyOtpRes = await billApi.verifyKhataOtp({
                customerPhoneNumber: selectedCustomer.phoneNumber,
                otp,
                billData
            });
            setLatestBillId(verifyOtpRes.data?._id || null);

            const customer = await db.customers.where('phoneNumber').equals(selectedCustomer.phoneNumber).first();
            if (customer) {
                const newActiveAmount = (customer.activeKhataAmount || 0) + cartTotal;
                await db.customers.update(customer.id!, {
                    activeKhataAmount: newActiveAmount,
                    maxHistoricalKhataAmount: Math.max((customer.maxHistoricalKhataAmount || 0), newActiveAmount),
                    khataTransactions: (customer.khataTransactions || 0) + 1
                });

                await db.ledger.add({
                    customerId: selectedCustomer.phoneNumber,
                    amount: cartTotal,
                    paymentMode: 'KHATA',
                    type: 'debit',
                    status: 'PENDING',
                    createdAt: Date.now(),
                    items: cart
                });

                await recalculateKhataScore(selectedCustomer.phoneNumber);
            }

            addToast(t['Udhaar Verified & Transaction Complete!'], 'success');
            setShowOtpInput(false);
            setIsProcessing(false);
            loadProducts();
        } catch (err: any) {
            addToast(err.response?.data?.message || t['Verification Failed'] || 'Verification Failed', 'error');
            if (err.response?.data?.message?.includes('Max attempts')) {
                setShowStatusModal(false);
                setIsProcessing(false);
                setShowOtpInput(false);
            }
        } finally {
            setOtpLoading(false);
            setOtp('');
        }
    }, [selectedCustomer, otp, cart, cartTotal, t, addToast, loadProducts]);

    const generateBillPDF = React.useCallback(() => {
        const doc = new jsPDF();

        doc.setFontSize(20);
        doc.setTextColor(40, 167, 69); // Green color
        doc.text(`SDukaan - ${t['Retail Invoice'] || 'Retail Invoice'}`, 105, 15, { align: "center" });
        doc.setTextColor(0, 0, 0); // Black

        doc.setFontSize(10);
        const dateStr = new Date().toLocaleString();

        doc.text(`${t['Date'] || 'Date'}: ${dateStr}`, 14, 25);
        doc.text(`${t['Customer'] || 'Customer'}: ${selectedCustomer?.name || t['Walk-in Customer'] || 'Walk-in Customer'}`, 14, 30);
        doc.text(`${t['Phone Number'] || 'Phone'}: ${selectedCustomer?.phoneNumber || 'N/A'}`, 14, 35);
        if (paymentMethod) {
            doc.text(`${t['Payment Method'] || 'Payment Mode'}: ${paymentMethod.toUpperCase()}`, 14, 40);
        }

        const tableData = cart.map(item => [
            item.name,
            `${item.quantity} ${item.unit}`,
            `Rs. ${item.price}`,
            `Rs. ${item.price * item.quantity}`
        ]);

        autoTable(doc, {
            startY: 45,
            head: [[t['Item'] || 'Item', t['Qty'] || 'Qty', t['Rate'] || 'Rate', t['Amount'] || 'Amount']],
            body: tableData,
            foot: [['', '', `${t['Grand Total'] || 'Grand Total'}:`, `Rs. ${cartTotal}`]],
            theme: 'striped',
            headStyles: { fillColor: [40, 167, 69] },
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(10);
        doc.text(t['Thank you for shopping!'] || "Thank you for shopping with SDukaan!", 105, finalY, { align: "center" });
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`${t['Powered by'] || 'Powered by'} 4Bytes`, 105, finalY + 5, { align: "center" });

        return doc;
    }, [t, selectedCustomer, paymentMethod, cart, cartTotal]);

    const handleDownloadPDF = React.useCallback(() => {
        try {
            const doc = generateBillPDF();
            doc.save(`Invoice_${Date.now()}.pdf`);
            addToast(t['Invoice Downloaded'], 'success');
        } catch (err) {
            console.error(err);
            addToast(t['Failed to download invoice'] || 'Failed to download invoice', 'error');
        }
    }, [generateBillPDF, t, addToast]);

    const handleSharePDF = React.useCallback(async () => {
        try {
            const doc = generateBillPDF();
            const pdfBlob = doc.output('blob');
            const file = new File([pdfBlob], `Invoice_${Date.now()}.pdf`, { type: 'application/pdf' });

            if (navigator.share) {
                await navigator.share({
                    title: t['Shop Invoice'] || 'Shop Invoice',
                    text: `${t['Here is your invoice for'] || 'Here is your invoice for'} ₹${cartTotal}`,
                    files: [file]
                });
                addToast(t['Invoice Shared Successfully'], 'success');
            } else {
                handleDownloadPDF();
                addToast('Sharing not supported on this device, downloading instead.', 'info');
            }
        } catch (err) {
            console.error('Share failed', err);
            if ((err as any).name !== 'AbortError') {
                addToast('Failed to share invoice', 'error');
            }
        }
    }, [generateBillPDF, t, cartTotal, addToast, handleDownloadPDF]);

    const handleTransactionComplete = React.useCallback(() => {
        clearCart();
        closeCheckout();
    }, [clearCart]);

    const handleSendBillOnWhatsApp = React.useCallback(async () => {
        if (!latestBillId) {
            addToast('Bill not available to send', 'error');
            return;
        }

        try {
            setSendingBillWhatsApp(true);
            await billApi.sendBillOnWhatsApp(latestBillId);
            addToast(t['Bill sent to customer on WhatsApp'], 'success');
        } catch (err: any) {
            addToast(err.response?.data?.message || t['Failed to send bill on WhatsApp'] || 'Failed to send bill on WhatsApp', 'error');
        } finally {
            setSendingBillWhatsApp(false);
        }
    }, [latestBillId, t, addToast]);

    const closeCheckout = React.useCallback(() => {
        setShowCheckout(false);
        setCheckoutStep('SUMMARY');
        setPaymentMethod(null);
        setShowStatusModal(false);
        setPhoneNumber('');
        setCustomerName('');
        setCustomerInput('');
        setIsNewCustomer(false);
        setSelectedCustomer(null);
        setAnimationType(null);
        setOtp('');
        setShowOtpInput(false);
        setLatestBillId(null);
        setSendingBillWhatsApp(false);
    }, []);

    return (
        <div className="flex flex-col relative bg-gray-50 dark:bg-gray-900 min-h-full">
            {/* Search Bar */}
            <div className="sticky top-0 p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 space-y-3 z-30">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.tapToAdd}</h2>
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder={t['Search products...']}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg p-2 pl-10 placeholder-gray-500 dark:placeholder-gray-400"
                        />
                    </div>
                </div>
            </div>


            {/* Product Grid */}
            <div className="p-4 pb-48">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredProducts?.map(product => (
                        <BillingProductCard
                            key={product._id}
                            product={product}
                            t={t}
                            cartItem={cart.find(item => item._id === product._id)}
                            addToCart={addToCart}
                            increaseQuantity={increaseQuantity}
                            decreaseQuantity={decreaseQuantity}
                            addToast={addToast}
                        />
                    ))}
                </div>
            </div>

            {/* Sticky View Cart Button */}
            {!showCheckout && cart.length > 0 && (
                <div className="fixed bottom-24 left-4 right-4 md:bottom-6 md:left-72 md:right-8 z-40 animate-slide-up">
                    <button
                        onClick={() => setShowCheckout(true)}
                        className="w-full relative overflow-hidden rounded-2xl text-white p-0 shadow-2xl active:scale-[0.97] transition-transform duration-150"
                        style={{
                            background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 45%, #388E3C 100%)',
                            boxShadow: '0 8px 32px rgba(46,125,50,0.45), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12)'
                        }}
                    >
                        {/* shimmer sweep */}
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)',
                                backgroundSize: '200% 100%',
                                animation: 'shimmer 2.5s infinite linear'
                            }}
                        />
                        <div className="relative flex items-center justify-between px-5 py-4">
                            {/* left: badge + label */}
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm"
                                    style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(4px)' }}
                                >
                                    {cart.reduce((a, b) => a + b.quantity, 0)}
                                </div>
                                <div>
                                    <div className="font-black text-base tracking-tight leading-none">{t.viewCart}</div>
                                    <div className="text-white/60 text-[11px] font-semibold mt-0.5">
                                        {cart.length} {cart.length === 1 ? 'item' : 'items'}
                                    </div>
                                </div>
                            </div>
                            {/* right: total */}
                            <div className="flex items-center gap-2">
                                <span className="font-black text-2xl tracking-tight">₹{cartTotal}</span>
                                <ChevronRight size={20} className="text-white/70" />
                            </div>
                        </div>
                    </button>
                </div>
            )}

            {/* FULL SCREEN CHECKOUT MODAL */}
            {showCheckout && (
                <div className="fixed inset-0 z-[60] bg-gray-50 dark:bg-gray-900 flex flex-col animate-in slide-in-from-bottom duration-200">
                    {/* Header */}
                    <div className="bg-white dark:bg-gray-800 p-4 shadow-sm flex items-center gap-3">
                        <button
                            onClick={() => {
                                if (checkoutStep === 'SUMMARY') closeCheckout();
                                else if (checkoutStep === 'CUSTOMER') setCheckoutStep('SUMMARY');
                                else if (checkoutStep === 'PAYMENT' && !paymentMethod) setCheckoutStep('CUSTOMER');
                                else setPaymentMethod(null);
                            }}
                            className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white"
                        >
                            <X size={24} />
                        </button>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center flex-1">
                            {checkoutStep === 'SUMMARY' ? t['Order Summary'] :
                                checkoutStep === 'CUSTOMER' ? t['Identify Customer'] : t['Select Payment']}
                        </h2>
                        {checkoutStep === 'SUMMARY' && (
                            <button
                                onClick={() => {
                                    if (window.confirm(t['Are you sure you want to clear the entire cart?'])) {
                                        clearCart();
                                        closeCheckout();
                                        addToast(t['Cart cleared'], 'info');
                                    }
                                }}
                                className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors"
                                title={t['Clear All']}
                            >
                                <Trash2 size={24} />
                            </button>
                        )}
                        {checkoutStep !== 'SUMMARY' && <div className="w-10" />} {/* Spacer for balance */}
                    </div>

                    {/* Step 1: SUMMARY */}
                    {checkoutStep === 'SUMMARY' && (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {translatedCart.map(item => (
                                    <CheckoutCartItem
                                        key={item._id}
                                        item={item}
                                        t={t}
                                        increaseQuantity={increaseQuantity}
                                        decreaseQuantity={decreaseQuantity}
                                        updateQuantity={updateQuantity}
                                        removeFromCart={removeFromCart}
                                        addToast={addToast}
                                    />
                                ))}
                            </div>
                            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 shadow-lg">
                                <div className="flex justify-between items-end mb-4">
                                    <span className="text-gray-500 font-medium">{t['Items']}: {cart.length}</span>
                                    <div className="text-right">
                                        <div className="text-3xl font-black text-gray-900 dark:text-white">₹{cartTotal}</div>
                                    </div>
                                </div>
                                <button onClick={() => setCheckoutStep('CUSTOMER')} className="w-full bg-primary-green text-white py-4 rounded-xl font-bold text-lg shadow-lg flex justify-center items-center gap-2">{t['Proceed']} <ChevronRight size={20} /></button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: CUSTOMER */}
                    {checkoutStep === 'CUSTOMER' && (
                        <div className="flex-1 p-6 overflow-y-auto w-full max-w-xl mx-auto">
                            {!isNewCustomer ? (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <div className="bg-primary-green/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <User className="text-primary-green" size={40} />
                                        </div>
                                        <h3 className="text-2xl font-black text-gray-900 dark:text-white">{t['Select Customer']}</h3>
                                        <p className="text-gray-500 dark:text-gray-400">{t['Search by name or phone']}</p>
                                    </div>

                                    <div className="relative">
                                        <Search className="absolute left-4 top-4 text-gray-400" size={20} />
                                        <input
                                            type="text"
                                            placeholder={t['Type name or 10-digit phone...']}
                                            value={customerInput}
                                            onChange={(e) => setCustomerInput(e.target.value)}
                                            className="w-full bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 py-4 px-12 rounded-2xl text-lg font-bold text-gray-900 dark:text-white outline-none focus:border-primary-green transition-all shadow-sm"
                                        />
                                    </div>

                                    {/* Quick Suggestions */}
                                    <div className="space-y-2">
                                        {/* Display Local Matches First */}
                                        {filteredCustomers.map(cust => (
                                            <CustomerSuggestionRow
                                                key={cust._id}
                                                cust={cust}
                                                t={t}
                                                identifyCustomer={identifyCustomer}
                                                isGlobal={false}
                                            />
                                        ))}

                                        {/* Display Global Matches */}
                                        {globalResults.map(cust => (
                                            <CustomerSuggestionRow
                                                key={cust._id}
                                                cust={cust}
                                                t={t}
                                                identifyCustomer={identifyCustomer}
                                                isGlobal={true}
                                            />
                                        ))}

                                        {isGlobalLoading && (
                                            <div className="text-center py-4 text-gray-400 text-sm animate-pulse">
                                                {t['Searching globally...']}
                                            </div>
                                        )}

                                        {customerInput.length >= 3 && filteredCustomers.length === 0 && globalResults.length === 0 && !isGlobalLoading && (
                                            <div className="text-center py-6 text-gray-400">
                                                {t['No results found for']} "{customerInput}"
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-4">
                                        <button
                                            onClick={() => {
                                                setIsNewCustomer(true);
                                                if (/^\d{10}$/.test(customerInput)) setPhoneNumber(customerInput);
                                                else setCustomerName(customerInput);
                                            }}
                                            className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                        >
                                            <Plus size={20} /> {t['Register New Customer']}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                                    <div className="text-center">
                                        <h3 className="text-2xl font-black text-gray-900 dark:text-white">{t['New Customer']}</h3>
                                        <p className="text-gray-500">{t['Add to your shop network']}</p>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-black text-gray-400 uppercase ml-2 mb-1 block">{t['Full Name']}</label>
                                            <input
                                                type="text"
                                                placeholder={t['e.g. Rahul Sharma']}
                                                value={customerName}
                                                onChange={(e) => setCustomerName(e.target.value)}
                                                className="w-full bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 py-4 px-6 rounded-2xl text-xl font-bold text-gray-900 dark:text-white outline-none focus:border-primary-green transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-black text-gray-400 uppercase ml-2 mb-1 block">{t['Phone Number']}</label>
                                            <input
                                                type="tel"
                                                placeholder={t['10-digit mobile']}
                                                maxLength={10}
                                                value={phoneNumber}
                                                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                                                className="w-full bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 py-4 px-6 rounded-2xl text-xl font-bold text-gray-900 dark:text-white outline-none focus:border-primary-green transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        <button onClick={() => setIsNewCustomer(false)} className="flex-1 py-4 rounded-2xl font-black text-gray-500 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:bg-gray-100 transition-colors">{t['Back']}</button>
                                        <button
                                            onClick={() => identifyCustomer()}
                                            disabled={phoneNumber.length !== 10 || !customerName}
                                            className={`flex-[2] py-4 rounded-2xl font-black text-lg shadow-lg transition-all ${phoneNumber.length === 10 && customerName ? 'bg-primary-green text-white shadow-green-200' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                                        >
                                            {t['Save & Pay']}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: PAYMENT */}
                    {checkoutStep === 'PAYMENT' && (
                        <div className="flex-1 p-4 overflow-y-auto">
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <User size={24} className="text-gray-600" />
                                    <div>
                                        <div className="font-bold text-gray-900 dark:text-white">{selectedCustomer?.name}</div>
                                        <div className="text-gray-500 font-medium flex items-center gap-1">
                                            <Phone size={14} /> {selectedCustomer?.phoneNumber}
                                        </div>
                                    </div>
                                </div>
                                <div className={`px-4 py-2 rounded-xl border-2 text-center ${getLedgerColor(selectedCustomer?.khataBalance || 0)}`}>
                                    <div className="text-xs uppercase font-bold">{t['Dues']}</div>
                                    <div className="text-lg font-black font-mono">₹{selectedCustomer?.khataBalance || 0}</div>
                                </div>
                            </div>

                            {/* Voice Language Selection for Recovery Calls */}
                            {paymentMethod === 'ledger' && (
                                <div className="mb-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Phone className="text-blue-600" size={18} />
                                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Voice Call Language</span>
                                        </div>
                                        <select
                                            value={customerVoiceLanguage}
                                            onChange={async (e) => {
                                                const newLang = e.target.value;
                                                setCustomerVoiceLanguage(newLang);
                                                // Use _id (MongoDB) not id (IndexedDB) for API update
                                                if (selectedCustomer?._id) {
                                                    try {
                                                        await customerApi.update(selectedCustomer._id, { preferredVoiceLanguage: newLang });
                                                        addToast('Voice language updated!', 'success');
                                                    } catch (err) {
                                                        console.error('Failed to update voice language', err);
                                                    }
                                                } else if (selectedCustomer?.phoneNumber) {
                                                    // Fallback: try to update by phone number if _id not available
                                                    try {
                                                        await customerApi.update(selectedCustomer.phoneNumber, { preferredVoiceLanguage: newLang });
                                                        addToast('Voice language updated!', 'success');
                                                    } catch (err) {
                                                        console.error('Failed to update voice language', err);
                                                    }
                                                }
                                            }}
                                            className="px-3 py-1.5 rounded-lg border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-800 text-sm font-medium"
                                        >
                                            <option value="en">English</option>
                                            <option value="hi">हिंदी (Hindi)</option>
                                            <option value="te">తెలుగు (Telugu)</option>
                                        </select>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">This language will be used for automated recovery calls</p>
                                </div>
                            )}

                            {khataInfo && (
                                <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-primary-green/5 to-primary-green/20 border border-primary-green/20">
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center gap-2">
                                            <Award className="text-primary-green" size={20} />
                                            <span className="font-black text-gray-900 dark:text-white uppercase tracking-tighter">{t['Udhaar Score']}</span>
                                        </div>
                                        <span className={`text-2xl font-black ${khataInfo.score >= 700 ? 'text-green-600' : khataInfo.score >= 500 ? 'text-yellow-600' : 'text-red-600'}`}>
                                            {khataInfo.score}
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500 font-bold">{t['Available Credit']}:</span>
                                            <span className="font-black text-gray-900 dark:text-white">₹{khataInfo.availableCredit} / ₹{khataInfo.limit}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary-green transition-all duration-500"
                                                style={{ width: `${(khataInfo.score - 300) / 600 * 100}%` }}
                                            />
                                        </div>
                                        {khataInfo.reasons.length > 0 && (
                                            <p className="text-[10px] text-gray-500 leading-tight italic mt-2">
                                                💡 {khataInfo.reasons[0]}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-6">
                                {/* Payment Method Selection */}
                                <div>
                                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">{t['Select Payment Method']}</h3>
                                    <div className="space-y-3">
                                        <PaymentOptionLabel
                                            value="cash"
                                            currentMethod={paymentMethod}
                                            onChange={setPaymentMethod}
                                            t={t}
                                            title="Cash"
                                            description="Pay with physical currency"
                                        />
                                        <PaymentOptionLabel
                                            value="online"
                                            currentMethod={paymentMethod}
                                            onChange={setPaymentMethod}
                                            t={t}
                                            title="UPI / Online"
                                            description="PhonePe, GPay, Paytm"
                                        />
                                        <PaymentOptionLabel
                                            value="ledger"
                                            currentMethod={paymentMethod}
                                            onChange={setPaymentMethod}
                                            t={t}
                                            title="Udhaar (Credit)"
                                            description="Pay on credit"
                                            disabled={khataInfo !== null && cartTotal > khataInfo.availableCredit}
                                            cartTotal={cartTotal}
                                            khataInfo={khataInfo}
                                        />
                                    </div>
                                </div>

                                {/* Total Amount */}
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">{t['Total Amount']}</span>
                                        <span className="text-2xl font-black text-gray-900 dark:text-white">₹{cartTotal}</span>
                                    </div>
                                </div>

                                {/* Make Payment Button */}
                                <button
                                    onClick={paymentMethod === 'online' ? handleUpiPayment : paymentMethod === 'cash' ? handleCashPayment : handleLedgePayment}
                                    disabled={!paymentMethod || (paymentMethod === 'ledger' && khataInfo !== null && cartTotal > khataInfo.availableCredit)}
                                    className="w-full relative overflow-hidden rounded-2xl text-white py-5 font-black text-lg active:scale-[0.97] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                                    style={!paymentMethod || (paymentMethod === 'ledger' && khataInfo !== null && cartTotal > khataInfo.availableCredit)
                                        ? { background: '#374151' }
                                        : paymentMethod === 'cash'
                                            ? {
                                                background: 'linear-gradient(135deg,#1B5E20 0%,#2E7D32 50%,#388E3C 100%)',
                                                boxShadow: '0 8px 28px rgba(46,125,50,0.5), inset 0 1px 0 rgba(255,255,255,0.12)'
                                            }
                                            : paymentMethod === 'online'
                                                ? {
                                                    background: 'linear-gradient(135deg,#4A148C 0%,#7B1FA2 50%,#9C27B0 100%)',
                                                    boxShadow: '0 8px 28px rgba(123,31,162,0.5), inset 0 1px 0 rgba(255,255,255,0.12)'
                                                }
                                                : {
                                                    background: 'linear-gradient(135deg,#BF360C 0%,#EF6C00 50%,#FF8F00 100%)',
                                                    boxShadow: '0 8px 28px rgba(239,108,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)'
                                                }
                                    }
                                >
                                    {/* shimmer sweep */}
                                    {paymentMethod && (
                                        <div
                                            className="absolute inset-0 pointer-events-none"
                                            style={{
                                                background: 'linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.10) 50%,transparent 60%)',
                                                backgroundSize: '200% 100%',
                                                animation: 'shimmer 2s infinite linear'
                                            }}
                                        />
                                    )}
                                    <span className="relative flex items-center justify-center gap-2">
                                        {paymentMethod === 'cash' && <span className="text-xl">💵</span>}
                                        {paymentMethod === 'online' && <span className="text-xl">📲</span>}
                                        {paymentMethod === 'ledger' && <span className="text-xl">📒</span>}
                                        {!paymentMethod && <span className="text-xl">💳</span>}
                                        {
                                            !paymentMethod ? t['Select a payment method']
                                                : paymentMethod === 'cash' ? `${t['Collect']} ₹${cartTotal} ${t['Cash']}`
                                                    : paymentMethod === 'online' ? `${t['Pay']} ₹${cartTotal} ${t['via UPI']}`
                                                        : `${t['Add']} ₹${cartTotal} ${t['to Udhaar']}`
                                        }
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )
            }

            {
                showStatusModal && (
                    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden">
                        {/* Cash Flood Animation */}
                        {animationType === 'cash' && isProcessing && (
                            <div className="absolute inset-0 pointer-events-none">
                                {Array.from({ length: 30 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="absolute animate-bounce text-4xl"
                                        style={{
                                            left: `${(i * 3.33 + Math.sin(i) * 10) % 100}%`, // Semi-random but deterministic
                                            top: `-10%`,
                                            animationDuration: `${0.5 + (i % 5) * 0.3}s`,
                                            animationDelay: `${(i % 10) * 0.2}s`,
                                            transform: `rotate(${i * 12}deg)`
                                        }}
                                    >
                                        💵
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="bg-white dark:bg-gray-800 rounded-[3rem] p-10 max-w-sm w-full text-center shadow-2xl animate-in zoom-in duration-300 relative z-10">
                            {isProcessing ? (
                                <div className="space-y-6">
                                    <div className="relative w-28 h-28 mx-auto">
                                        <div className={`absolute inset-0 border-8 ${animationType === 'online' ? 'border-purple-100 dark:border-purple-900' : animationType === 'cash' ? 'border-green-100 dark:border-green-900' : 'border-orange-100 dark:border-orange-900'} rounded-full`}></div>
                                        <div className={`absolute inset-0 border-8 ${animationType === 'online' ? 'border-purple-600' : animationType === 'cash' ? 'border-green-600' : 'border-orange-600'} border-t-transparent rounded-full animate-spin`}></div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-4xl">
                                                {animationType === 'online' ? '📱' : animationType === 'cash' ? '💰' : '📒'}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
                                            {animationType === 'online' ? t['Verifying UPI...'] : animationType === 'cash' ? t['Processing Cash...'] : t['Customer Verification']}
                                        </h3>
                                        {showOtpInput ? (
                                            <div className="mt-6 space-y-6 animate-in fade-in slide-in-from-bottom duration-300">
                                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                                                    <p className="text-sm text-blue-700 dark:text-blue-300 font-semibold">
                                                        📱 {t["OTP sent to customer's WhatsApp"]}
                                                    </p>
                                                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                                        {selectedCustomer?.phoneNumber}
                                                    </p>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
                                                        {t['Enter 6-Digit Code']}
                                                    </label>
                                                    <div className="flex justify-center gap-2">
                                                        {[0, 1, 2, 3, 4, 5].map((index) => (
                                                            <input
                                                                key={index}
                                                                type="text"
                                                                maxLength={1}
                                                                value={otp[index] || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value.replace(/\D/g, '');
                                                                    if (val) {
                                                                        const newOtp = otp.split('');
                                                                        newOtp[index] = val;
                                                                        setOtp(newOtp.join(''));
                                                                        // Auto-focus next input
                                                                        if (index < 5 && val) {
                                                                            const nextInput = e.target.parentElement?.children[index + 1] as HTMLInputElement;
                                                                            nextInput?.focus();
                                                                        }
                                                                    } else {
                                                                        const newOtp = otp.split('');
                                                                        newOtp[index] = '';
                                                                        setOtp(newOtp.join(''));
                                                                    }
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Backspace' && !otp[index] && index > 0) {
                                                                        const prevInput = e.currentTarget.parentElement?.children[index - 1] as HTMLInputElement;
                                                                        prevInput?.focus();
                                                                    }
                                                                }}
                                                                disabled={otpLoading}
                                                                className="w-12 h-14 text-center text-2xl font-black bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-primary-green focus:ring-2 focus:ring-primary-green/20 outline-none transition-all dark:text-white disabled:opacity-50"
                                                            />
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-3 pt-2">
                                                    <button
                                                        onClick={handleVerifyOtp}
                                                        disabled={otp.length !== 6 || otpLoading}
                                                        className="w-full bg-gradient-to-r from-primary-green to-emerald-500 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-green-500/20 disabled:opacity-50 disabled:grayscale transition-all active:scale-95 hover:shadow-2xl hover:shadow-green-500/30"
                                                    >
                                                        {otpLoading ? (
                                                            <span className="flex items-center justify-center gap-2">
                                                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                                </svg>
                                                                {t['Verifying...']}
                                                            </span>
                                                        ) : (
                                                            t['Confirm & Complete']
                                                        )}
                                                    </button>

                                                    <button
                                                        onClick={() => {
                                                            setShowOtpInput(false);
                                                            setIsProcessing(false);
                                                            setShowStatusModal(false);
                                                            setOtp('');
                                                        }}
                                                        className="w-full py-4 text-gray-500 font-bold hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                                                    >
                                                        {t['Cancel']}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-gray-500 dark:text-gray-400 mt-4 font-medium animate-pulse">{t['Sending verification code...']}</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="animate-in zoom-in duration-300">
                                    <div className="w-28 h-28 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-200">
                                        <span className="text-6xl text-white">✓</span>
                                    </div>
                                    <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-2">{t['Success!']}</h3>
                                    <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-xs">{t['Payment Received']}</p>

                                    <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700">
                                        <div className="text-4xl font-black text-gray-900 dark:text-white">₹{cartTotal}</div>
                                        <div className="text-[10px] text-gray-400 font-bold mt-1 uppercase">{t['Total Amount Paid']}</div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3 mt-6">
                                        <button
                                            onClick={handleDownloadPDF}
                                            className="flex flex-col items-center justify-center gap-1 p-3 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                        >
                                            <Download size={20} className="text-gray-700 dark:text-white" />
                                            <span className="text-xs font-bold text-gray-700 dark:text-white">{t['Download PDF']}</span>
                                        </button>
                                        <button
                                            onClick={handleSharePDF}
                                            className="flex flex-col items-center justify-center gap-1 p-3 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                        >
                                            <Share2 size={20} className="text-gray-700 dark:text-white" />
                                            <span className="text-xs font-bold text-gray-700 dark:text-white">{t['Share PDF']}</span>
                                        </button>
                                        <button
                                            onClick={handleSendBillOnWhatsApp}
                                            disabled={!latestBillId || sendingBillWhatsApp}
                                            className="flex flex-col items-center justify-center gap-1 p-3 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors disabled:opacity-50"
                                        >
                                            <MessageCircle size={20} className="text-emerald-700 dark:text-emerald-300" />
                                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                                {sendingBillWhatsApp ? t['Sending...'] : t['Send WhatsApp']}
                                            </span>
                                        </button>
                                    </div>

                                    <button
                                        onClick={handleTransactionComplete}
                                        className="mt-6 w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-transform"
                                    >
                                        {t['OK, NEXT BILL']}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
};

