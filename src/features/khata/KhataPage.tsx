import React, { useState, useEffect } from 'react';
import { Search, Phone, AlertCircle, X, ShieldCheck, Info, CheckCircle2 } from 'lucide-react';
import { customerApi, ledgerApi } from '../../services/api';
import type { Customer } from '../../db/db';
import { db } from '../../db/db';
import { getKhataStatus, recalculateKhataScore } from '../../lib/khataLogic';
import { useLanguage } from '../../contexts/LanguageContext';

export const KhataPage: React.FC = () => {
    const { t } = useLanguage();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [khataDetails, setKhataDetails] = useState<Record<string, any>>({});
    const [selectedExplainer, setSelectedExplainer] = useState<any | null>(null);
    const [settleModal, setSettleModal] = useState<any | null>(null);
    const [settleAmount, setSettleAmount] = useState<number>(0);
    const [settleMode, setSettleMode] = useState<'cash' | 'online'>('cash');
    const [isProcessing, setIsProcessing] = useState(false);
    const [viewingCustomer, setViewingCustomer] = useState<any | null>(null);
    const [customerTransactions, setCustomerTransactions] = useState<any[]>([]);
    const [txFilter, setTxFilter] = useState<'all' | 'khata' | 'settlement' | 'instant'>('all');

    useEffect(() => {
        loadCustomers();
    }, []);

    async function loadCustomers() {
        try {
            const response = await customerApi.getAll();
            const apiCustomers = response.data.filter((c: Customer) => (c.khataBalance || 0) > 0);
            setCustomers(apiCustomers);

            // Load matching Khata details
            const details: Record<string, any> = {};
            for (const cust of apiCustomers) {
                const status = await getKhataStatus(cust.phoneNumber);
                if (status) details[cust.phoneNumber] = status;
            }
            setKhataDetails(details);
        } catch (err) {
            console.error('Failed to load customers', err);
        }
    }

    const getLedgerStyles = (balance: number) => {
        if (balance <= 500) return {
            text: 'text-green-600',
            bg: 'bg-green-50',
            border: 'border-green-200',
            badge: 'bg-green-600',
            icon: '🟢'
        };
        if (balance <= 1500) return {
            text: 'text-yellow-600',
            bg: 'bg-yellow-50',
            border: 'border-yellow-200',
            badge: 'bg-yellow-600',
            icon: '🟡'
        };
        return {
            text: 'text-red-600',
            bg: 'bg-red-50',
            border: 'border-red-200',
            badge: 'bg-red-600',
            icon: '🔴'
        };
    };



    const handleSettleDues = async () => {
        if (!settleModal || settleAmount <= 0) return;

        setIsProcessing(true);
        try {
            // 1. API Call
            await ledgerApi.recordPayment({
                customerId: settleModal._id,
                amount: settleAmount,
                paymentMode: settleMode
            });

            // 2. Local Dexie Update
            const customer = await db.customers.where('phoneNumber').equals(settleModal.phoneNumber).first();
            if (customer) {
                await db.ledger.add({
                    customerId: settleModal.phoneNumber,
                    amount: settleAmount,
                    paymentMode: settleMode.toUpperCase() as any,
                    status: 'PAID',
                    createdAt: Date.now(),
                    type: 'credit' as any
                });

                const entries = await db.ledger
                    .where('customerId').equals(settleModal.phoneNumber)
                    .toArray();

                const unpaidEntries = entries
                    .filter(e => e.paymentMode === 'KHATA' && e.status === 'PENDING')
                    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

                let remainingToSettle = settleAmount;
                for (const entry of unpaidEntries) {
                    if (remainingToSettle >= entry.amount) {
                        await db.ledger.update(entry.id!, {
                            status: 'PAID',
                            paidAt: Date.now()
                        });
                        remainingToSettle -= entry.amount;
                    } else {
                        await db.ledger.update(entry.id!, {
                            amount: entry.amount - remainingToSettle,
                        });
                        remainingToSettle = 0;
                        break;
                    }
                }

                const newActiveAmount = Math.max(0, (customer.activeKhataAmount || 0) - settleAmount);
                await db.customers.update(customer.id!, {
                    activeKhataAmount: newActiveAmount,
                    lastPaymentDate: Date.now()
                });

                await recalculateKhataScore(settleModal.phoneNumber);
            }

            setSettleModal(null);
            loadCustomers(); // Reload to remove if balance is 0
            if (viewingCustomer) {
                // Check if customer still has balance to decide if we close detailed view?
                // Optional: close it if balance is 0?
                const updatedCustomer = await db.customers.where('phoneNumber').equals(viewingCustomer.phoneNumber).first();
                if (updatedCustomer && (updatedCustomer.activeKhataAmount || 0) <= 0) {
                    setViewingCustomer(null);
                } else {
                    handleViewCustomer(viewingCustomer);
                }
            }
        } catch (err) {
            console.error('Settlement failed', err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleViewCustomer = async (customer: any) => {
        setViewingCustomer(customer);
        const transactions = await db.ledger
            .where('customerId').equals(customer.phoneNumber)
            .toArray();
        setCustomerTransactions(transactions.sort((a, b) => b.createdAt - a.createdAt));
    };


    const filteredCustomers = customers.filter(
        c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.phoneNumber.includes(searchTerm)
    );

    return (
        <div className="space-y-6 safe-area-bottom pb-48">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white">{t['Active Udhaar']}</h2>
                    <p className="text-gray-500 text-sm font-medium">{t['Pending dues management']}</p>
                </div>
                <span className="bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-full">
                    {customers.length} {t['Active Debtors']}
                </span>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder={t['Search debtors...']}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white dark:bg-gray-800 border-none rounded-2xl p-4 pl-12 shadow-sm outline-none focus:ring-2 focus:ring-primary-green/20 transition-all dark:text-white"
                />
            </div>

            <div className="space-y-3">
                {filteredCustomers.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-700">
                        <CheckCircle2 size={48} className="mx-auto text-green-300 mb-2" />
                        <p className="text-gray-500 font-medium">{t['No pending udhaar found!']}</p>
                    </div>
                ) : (
                    filteredCustomers.map((customer) => {
                        const styles = getLedgerStyles(customer.khataBalance);
                        return (
                            <div
                                key={customer._id}
                                onClick={() => handleViewCustomer(customer)}
                                className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer"
                            >
                                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-inner ${styles.bg}`}>
                                            {customer.name ? customer.name[0].toUpperCase() : <Phone size={24} className={styles.text} />}
                                        </div>
                                        <div>
                                            <div className="font-black text-gray-900 dark:text-white text-lg flex items-center gap-2">
                                                {customer.name || t['Unnamed Customer']}
                                                {customer.khataBalance > 1500 && <AlertCircle size={16} className="text-red-500" />}
                                            </div>
                                            <div className="text-gray-500 font-medium flex items-center gap-1">
                                                <Phone size={14} /> {customer.phoneNumber}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:flex items-center gap-4 md:gap-8">
                                        {/* Khata Score Section */}
                                        {khataDetails[customer.phoneNumber] && (
                                            <div className="hidden md:block">
                                                <div className="text-[10px] uppercase font-black text-gray-400 tracking-wider mb-1">{t['Udhaar Score']}</div>
                                                <div className="flex items-center gap-2">
                                                    <div className="px-2 py-1 bg-gradient-to-r from-primary-green to-blue-600 rounded-lg text-white font-black text-sm">
                                                        {khataDetails[customer.phoneNumber].score}
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedExplainer({ ...khataDetails[customer.phoneNumber], name: customer.name });
                                                        }}
                                                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                                                    >
                                                        <Info size={14} className="text-gray-400" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="text-center md:text-right order-2 md:order-1">
                                            <div className="text-[10px] uppercase font-black text-gray-400 tracking-wider">{t['Due Amount']}</div>
                                            <div className={`text-2xl font-black ${styles.text}`}>₹{customer.khataBalance} <span className="text-lg opacity-50">{styles.icon}</span></div>
                                        </div>
                                        <div className="flex flex-col gap-1 order-1 md:order-3 text-sm text-gray-500 font-bold">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSettleModal(customer);
                                                    setSettleAmount(customer.khataBalance);
                                                }}
                                                className="mt-1 text-xs bg-orange-500 text-white px-3 py-2 rounded-xl font-black uppercase tracking-tighter shadow-sm active:scale-95 transition-all flex items-center gap-1"
                                            >
                                                <CheckCircle2 size={14} /> {t['Settle Dues']}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Explainer Modal */}
            {selectedExplainer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in duration-300">
                        <div className="p-8 pb-4 flex justify-between items-start">
                            <div>
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white">{t['Credit Health']}</h3>
                                <p className="text-gray-500 font-medium">{t['Why this score for']} {selectedExplainer.name}?</p>
                            </div>
                            <button onClick={() => setSelectedExplainer(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full dark:text-gray-400"><X size={24} /></button>
                        </div>

                        <div className="px-8 py-6 space-y-6">
                            <div className="text-center">
                                <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary-green to-blue-500 mb-2">{selectedExplainer.score}</div>
                                <div className="text-xs uppercase font-black text-gray-400 tracking-[0.2em]">{t['Current Rating']}</div>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-900 rounded-3xl p-6 space-y-4">
                                <div className="flex items-start gap-3">
                                    <ShieldCheck className="text-primary-green mt-1 flex-shrink-0" size={20} />
                                    <div>
                                        <div className="font-black text-gray-900 dark:text-white text-sm">{t['Credit Limit']}: ₹{selectedExplainer.limit}</div>
                                        <p className="text-xs text-gray-500 font-medium italic">{t['Based strictly on behavior logic.']}</p>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2">
                                    <div className="text-[10px] uppercase font-black text-gray-400 tracking-wider">{t['Logic Reasons']}</div>
                                    {selectedExplainer.reasons.map((reason: string, i: number) => (
                                        <div key={i} className="flex gap-2 text-sm text-gray-600 dark:text-gray-300 leading-snug">
                                            <span className="text-primary-green">●</span>
                                            {reason}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 pt-0">
                            <button onClick={() => setSelectedExplainer(null)} className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-black text-lg shadow-xl shadow-gray-200 dark:shadow-none">{t['GOT IT']}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settle Modal */}
            {settleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in duration-300">
                        <div className="p-8 pb-0 flex justify-between items-start">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white">{t['Record Payment']}</h3>
                            <button onClick={() => setSettleModal(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full dark:text-gray-400"><X size={24} /></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">{t['Amount to Settle']}</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-400">₹</span>
                                    <input
                                        type="number"
                                        value={settleAmount}
                                        onChange={(e) => setSettleAmount(parseFloat(e.target.value) || 0)}
                                        className="w-full bg-gray-50 dark:bg-gray-900 py-6 px-10 rounded-3xl text-3xl font-black text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-green/20"
                                    />
                                </div>
                                <p className="mt-2 text-xs text-orange-500 font-bold">{t['Total Dues']}: ₹{settleModal.khataBalance}</p>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">{t['Payment Mode']}</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setSettleMode('cash')}
                                        className={`flex-1 py-3 rounded-2xl font-bold border-2 transition-all ${settleMode === 'cash' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-100 dark:border-gray-700 text-gray-500'}`}
                                    >
                                        {t['Cash']}
                                    </button>
                                    <button
                                        onClick={() => setSettleMode('online')}
                                        className={`flex-1 py-3 rounded-2xl font-bold border-2 transition-all ${settleMode === 'online' ? 'bg-purple-500 border-purple-500 text-white' : 'border-gray-100 dark:border-gray-700 text-gray-500'}`}
                                    >
                                        {t['UPI / ONLINE']}
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleSettleDues}
                                disabled={isProcessing || settleAmount <= 0}
                                className="w-full bg-primary-green text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-primary-green/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isProcessing ? t['Verifying...'] : (
                                    <><CheckCircle2 size={20} /> {t['Record Payment']}</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detailed Customer View Drawer */}
            {viewingCustomer && (
                <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setViewingCustomer(null)}>
                    <div
                        className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-gray-50 dark:bg-gray-900 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-8 space-y-8">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-primary-green rounded-2xl flex items-center justify-center text-white text-3xl font-bold">
                                        {viewingCustomer.name?.[0] || 'C'}
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-black text-gray-900 dark:text-white leading-tight">{viewingCustomer.name || t['Unnamed Customer']}</h3>
                                        <p className="text-gray-500 font-bold">{viewingCustomer.phoneNumber}</p>
                                    </div>
                                </div>
                                <button onClick={() => setViewingCustomer(null)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full dark:text-gray-400"><X size={28} /></button>
                            </div>

                            {/* Stats Bar */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
                                    <div className="text-[10px] uppercase font-black text-gray-400 tracking-wider mb-1">{t['Udhaar Score']}</div>
                                    <div className="text-3xl font-black text-primary-green">{khataDetails[viewingCustomer.phoneNumber]?.score || 600}</div>
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
                                    <div className="text-[10px] uppercase font-black text-gray-400 tracking-wider mb-1">{t['Due Balance']}</div>
                                    <div className="text-3xl font-black text-orange-500">₹{viewingCustomer.khataBalance}</div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex flex-col gap-4">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{t['Activity Log']}</h4>
                                        {viewingCustomer.khataBalance > 0 && (
                                            <button
                                                onClick={() => {
                                                    setSettleModal(viewingCustomer);
                                                    setSettleAmount(viewingCustomer.khataBalance);
                                                }}
                                                className="bg-primary-green text-white px-4 py-2 rounded-xl text-sm font-black shadow-lg shadow-primary-green/20"
                                            >
                                                {t['SETTLE DUES']}
                                            </button>
                                        )}
                                    </div>

                                    {/* Transaction Filter Tabs */}
                                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl w-fit overflow-x-auto max-w-full">
                                        {(['all', 'khata', 'settlement', 'instant'] as const).map(tab => (
                                            <button
                                                key={tab}
                                                onClick={() => setTxFilter(tab)}
                                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${txFilter === tab
                                                    ? 'bg-white dark:bg-gray-700 text-primary-green shadow-sm'
                                                    : 'text-gray-400 hover:text-gray-600'
                                                    }`}
                                            >
                                                {tab === 'all' ? t['All'] : tab === 'khata' ? t['Udhaar Debt'] : tab === 'settlement' ? t['Settlements'] : t['Instant Paid']}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {customerTransactions
                                        .filter(tx => {
                                            if (txFilter === 'all') return true;
                                            if (txFilter === 'khata') return tx.type === 'debit' && tx.paymentMode === 'KHATA';
                                            if (txFilter === 'settlement') return tx.type === 'credit';
                                            if (txFilter === 'instant') return tx.type === 'debit' && tx.paymentMode !== 'KHATA';
                                            return true;
                                        })
                                        .length === 0 ? (
                                        <div className="text-center py-10 text-gray-400 font-bold italic">No records found</div>
                                    ) : (
                                        customerTransactions
                                            .filter(tx => {
                                                if (txFilter === 'all') return true;
                                                if (txFilter === 'khata') return tx.type === 'debit' && tx.paymentMode === 'KHATA';
                                                if (txFilter === 'settlement') return tx.type === 'credit';
                                                if (txFilter === 'instant') return tx.type === 'debit' && tx.paymentMode !== 'KHATA';
                                                return true;
                                            })
                                            .map((tx, idx) => {
                                                const isCredit = tx.type === 'credit';
                                                const isKhata = tx.paymentMode === 'KHATA';
                                                const isInstant = tx.type === 'debit' && !isKhata;

                                                let cardStyle = 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700';
                                                let icon = '📦';
                                                let iconBg = 'bg-gray-100 dark:bg-gray-700 text-gray-500';
                                                let label = 'Purchase';
                                                let amountColor = 'text-gray-900 dark:text-white';
                                                let subLabel = 'Total Bill';

                                                if (isCredit) {
                                                    cardStyle = 'bg-green-50/50 dark:bg-green-900/20 border-green-100 dark:border-green-800';
                                                    icon = '💰';
                                                    iconBg = 'bg-green-500 text-white';
                                                    label = 'Repayment';
                                                    amountColor = 'text-green-600';
                                                    subLabel = 'Dues Settled';
                                                } else if (isKhata) {
                                                    cardStyle = 'bg-orange-50/50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30';
                                                    icon = '📉';
                                                    iconBg = 'bg-orange-500 text-white';
                                                    label = 'Udhaar Added';
                                                    amountColor = 'text-orange-600';
                                                    subLabel = 'Added to Debt';
                                                } else if (isInstant) {
                                                    cardStyle = 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30';
                                                    icon = '✅';
                                                    iconBg = 'bg-blue-500 text-white';
                                                    label = 'Instant Paid';
                                                    amountColor = 'text-blue-600';
                                                    subLabel = 'Cash/UPI Sale';
                                                }

                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`p-4 rounded-[2rem] border transition-all flex justify-between items-center ${cardStyle}`}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner ${iconBg}`}>
                                                                {icon}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className={`font-black uppercase tracking-tighter text-sm ${amountColor}`}>
                                                                        {label}
                                                                    </span>
                                                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase ${tx.paymentMode === 'CASH' ? 'bg-orange-100 text-orange-600' :
                                                                        tx.paymentMode === 'UPI' || tx.paymentMode === 'ONLINE' ? 'bg-purple-100 text-purple-600' :
                                                                            'bg-blue-100 text-blue-600'
                                                                        }`}>
                                                                        {tx.paymentMode}
                                                                    </span>
                                                                </div>
                                                                <div className="text-[10px] text-gray-400 font-bold mt-0.5">
                                                                    {new Date(tx.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className={`text-xl font-black ${amountColor}`}>
                                                                {isCredit ? '-' : '+'}₹{tx.amount}
                                                            </div>
                                                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">
                                                                {subLabel}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
