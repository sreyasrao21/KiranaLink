import React, { useState, useEffect } from 'react';
import { billApi } from '../../services/api';
import { Receipt, Calendar, User, Tag } from 'lucide-react';
import type { Transaction } from '../../db/db';
import { useTranslate } from '../../hooks/useTranslate';
import { useLanguage } from '../../contexts/LanguageContext';

const LedgerTransactionRow = React.memo(({
    bill,
    formatDate,
    itemNameMap,
    statusStyles
}: {
    bill: Transaction,
    formatDate: (d: any) => string,
    itemNameMap: Record<string, string>,
    statusStyles: string
}) => {
    return (
        <div className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm border ${statusStyles}`}>
                        {bill.paymentType === 'cash' ? '💵' : '📱'}
                    </div>
                    <div>
                        <div className="text-2xl font-black text-gray-900 dark:text-white">₹{bill.totalAmount}</div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-0.5">
                            <Calendar size={12} /> {formatDate(bill.createdAt)}
                            <span className="w-1 h-1 bg-gray-300 rounded-full" />
                            {bill.paymentType}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="text-[10px] text-gray-400 font-medium">
                        ID: {bill._id.slice(-8).toUpperCase()}
                    </div>
                </div>
            </div>

            <div className="w-full pt-4 border-t border-gray-100 dark:border-gray-700">
                {bill.customerId && (
                    <div className="mb-3 bg-gray-50 dark:bg-gray-800 p-2 px-3 rounded-xl flex items-center gap-2 w-fit">
                        <User size={14} className="text-gray-400" />
                        <div className="text-xs font-bold text-gray-700 dark:text-gray-300">
                            {bill.customerId.phoneNumber}
                        </div>
                    </div>
                )}
                <div className="flex flex-wrap gap-2">
                    {bill.items?.map((item, idx) => (
                        <div key={idx} className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 px-3 py-1.5 rounded-lg flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{itemNameMap[item.name] || item.name}</span>
                            <span className="text-[10px] font-black text-gray-400">×{item.quantity}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});

export const LedgerPage: React.FC = () => {
    const [bills, setBills] = useState<Transaction[]>([]);
    const [filterMode, setFilterMode] = useState<'ALL' | 'cash' | 'online' | 'ledger'>('ALL');
    const { t, language } = useLanguage();

    const loadBills = React.useCallback(async () => {
        try {
            const response = await billApi.getAll();
            setBills(response.data);
        } catch (err) {
            console.error('Failed to load bills', err);
        }
    }, []);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
        loadBills();
    }, [loadBills]);

    const filteredEntries = React.useMemo(() =>
        filterMode === 'ALL'
            ? bills
            : bills.filter(e => e.paymentType === filterMode)
        , [bills, filterMode]);

    const stats = React.useMemo(() => {
        const totalCash = bills
            .filter(e => e.paymentType === 'cash')
            .reduce((sum, e) => sum + e.totalAmount, 0);

        const totalUpi = bills
            .filter(e => e.paymentType === 'online')
            .reduce((sum, e) => sum + e.totalAmount, 0);

        const totalRevenue = bills
            .filter(e => e.paymentType !== 'ledger')
            .reduce((sum, e) => sum + e.totalAmount, 0);

        return { totalCash, totalUpi, totalRevenue };
    }, [bills]);

    const formatDate = React.useCallback((dateString: string | number) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }, []);

    // Flatten all items to translate their names
    const allItems = React.useMemo(() => bills.flatMap(b => b.items || []).map(i => ({ name: i.name })), [bills]);
    const translatedItems = useTranslate(allItems, ['name']);

    const memoizedItemNameMap = React.useMemo(() => {
        const map: Record<string, string> = {};
        if (language !== 'en') {
            allItems.forEach((orig, idx) => {
                if (translatedItems[idx]) {
                    map[orig.name] = translatedItems[idx].name;
                }
            });
        }
        return map;
    }, [language, allItems, translatedItems]);

    const getStatusStyles = React.useCallback((mode: string) => {
        switch (mode) {
            case 'cash': return 'bg-green-100 text-green-700 border-green-200';
            case 'online': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'ledger': return 'bg-orange-100 text-orange-700 border-orange-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    }, []);

    return (
        <div className="space-y-6 pb-48">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white">{t['Shop Ledger']}</h2>
                    <p className="text-gray-500 text-sm">{t['Real-time audit of all sales and payments']}</p>
                </div>
                <div className="flex gap-2">
                    <div className="bg-white dark:bg-gray-800 p-1 rounded-2xl border border-gray-100 dark:border-gray-700 flex">
                        {(['ALL', 'cash', 'online'] as const).map(mode => (
                            <button
                                key={mode}
                                onClick={() => setFilterMode(mode)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterMode === mode
                                    ? 'bg-primary-green text-white shadow-md'
                                    : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                            >
                                {mode.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-[2rem] text-white shadow-xl shadow-green-200 dark:shadow-none">
                    <div className="text-sm font-bold opacity-80 mb-1 uppercase tracking-wider">Total Sales</div>
                    <div className="text-4xl font-black">₹{stats.totalRevenue.toLocaleString('en-IN')}</div>
                    <div className="mt-4 flex items-center gap-2 text-xs font-bold bg-white/20 w-fit px-3 py-1 rounded-full">
                        <Tag size={12} /> Live from Cloud
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="text-gray-400 text-xs font-bold mb-1 uppercase tracking-wider">Cash Collected</div>
                    <div className="text-3xl font-black text-gray-900 dark:text-white">₹{stats.totalCash.toLocaleString('en-IN')}</div>
                    <div className="mt-4 text-[10px] text-green-500 font-black">Verified in Hand</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="text-gray-400 text-xs font-bold mb-1 uppercase tracking-wider">UPI (Razorpay)</div>
                    <div className="text-3xl font-black text-gray-900 dark:text-white">₹{stats.totalUpi.toLocaleString('en-IN')}</div>
                    <div className="mt-4 text-[10px] text-purple-500 font-black">Settled in Bank</div>
                </div>
            </div>

            {/* Transactions */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="font-black text-gray-900 dark:text-white">{t['Recent Transactions']}</h3>
                    <Receipt size={20} className="text-gray-300" />
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-700">
                    {filteredEntries.length === 0 ? (
                        <div className="p-10 text-center text-gray-400 font-medium">No transactions found for this filter</div>
                    ) : (
                        filteredEntries.map((bill) => (
                            <LedgerTransactionRow
                                key={bill._id}
                                bill={bill}
                                formatDate={formatDate}
                                itemNameMap={memoizedItemNameMap}
                                statusStyles={getStatusStyles(bill.paymentType)}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
