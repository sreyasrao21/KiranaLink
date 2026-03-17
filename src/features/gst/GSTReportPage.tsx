import { useState, useEffect, useCallback } from 'react';
import {
    AlertCircle,
    Calculator,
    ChevronDown,
    FileText,
    IndianRupee,
    Loader2,
    RefreshCcw,
    Sparkles,
    TrendingDown,
    TrendingUp,
    Download,
    Table as TableIcon,
    ShieldCheck,
    Calendar,
    Landmark,
} from 'lucide-react';
import { gstApi } from '../../services/api';
import type { GSTSummary, ITRSummary } from '../../services/api';

import { useToast } from '../../contexts/ToastContext';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR];

function fmt(n: number): string {
    return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
    label, value, sub, color, icon,
}: {
    label: string; value: string; sub?: string; color: string; icon: React.ReactNode;
}) {
    return (
        <div className={`rounded-3xl p-6 ${color} flex flex-col justify-between min-h-[140px] shadow-sm border border-gray-100/10`}>
            <div className="flex items-start justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{label}</p>
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                    {icon}
                </div>
            </div>
            <div>
                <p className="text-2xl font-black tracking-tight">{value}</p>
                {sub && <p className="text-[10px] mt-1 opacity-70 font-bold uppercase tracking-wider">{sub}</p>}
            </div>
        </div>
    );
}

// ── Row ───────────────────────────────────────────────────────────────────────
function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div className={`flex items-center justify-between py-3.5 border-b border-gray-50 dark:border-gray-700/50 last:border-0 ${highlight ? 'font-black text-gray-900 dark:text-white' : ''}`}>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
            <span className={`text-sm font-bold ${highlight ? 'text-base text-primary-green' : 'text-gray-900 dark:text-white'}`}>{value}</span>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function GSTReportPage() {
    const { addToast } = useToast();
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
    const [gstData, setGSTData] = useState<GSTSummary | null>(null);
    const [itrData, setITRData] = useState<ITRSummary | null>(null);
    const [yearlySummaries, setYearlySummaries] = useState<GSTSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [classifying, setClassifying] = useState(false);
    const [exporting, setExporting] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [gstRes, itrRes] = await Promise.all([
                gstApi.getGSTSummary(selectedMonth, selectedYear),
                gstApi.getITRSummary(selectedMonth, selectedYear),
            ]);
            setGSTData(gstRes.data);
            setITRData(itrRes.data);

            // Also load monthly data for the table (parallel fetch for efficiency)
            const promises = Array.from({ length: 12 }, (_, i) =>
                gstApi.getGSTSummary(i + 1, selectedYear).catch(() => ({ data: null }))
            );
            const results = await Promise.all(promises);
            setYearlySummaries(results.map(r => r.data).filter(Boolean) as GSTSummary[]);

        } catch (err: any) {
            addToast(err.response?.data?.message || 'Failed to load GST data', 'error');
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, selectedYear, addToast]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleClassifyAll = async () => {
        setClassifying(true);
        try {
            const res = await gstApi.classifyAll();
            addToast(`Classified ${res.data.classified} products via AI ✓`, 'success');
            loadData();
        } catch (err: any) {
            addToast(err.response?.data?.message || 'Classification failed', 'error');
        } finally {
            setClassifying(false);
        }
    };

    const handleExportCSV = async () => {
        setExporting(true);
        try {
            const invoicesRes = await gstApi.getInvoices({ month: selectedMonth, year: selectedYear });
            const invoices = invoicesRes.data;

            if (!invoices || invoices.length === 0) {
                addToast('No transaction data found to export', 'error');
                return;
            }

            const headers = ['Date', 'Type', 'Item Name', 'Taxable Amount', 'GST Amount', 'Total Amount'];
            const csvRows = [headers.join(',')];

            invoices.forEach((inv: any) => {
                inv.items.forEach((item: any) => {
                    const row = [
                        new Date(inv.createdAt).toLocaleDateString('en-IN'),
                        inv.invoiceType === 'sale' ? 'Sale' : 'Purchase',
                        `"${item.name.replace(/"/g, '""')}"`,
                        item.baseAmount.toFixed(2),
                        (item.cgstAmount + item.sgstAmount).toFixed(2),
                        item.totalAmount.toFixed(2)
                    ];
                    csvRows.push(row.join(','));
                });
            });

            const blob = new Blob([csvRows.join('\u000a')], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `GST_Report_${MONTHS[selectedMonth - 1]}_${selectedYear}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            addToast('GST Report downloaded successfully', 'success');
        } catch (err) {
            addToast('Failed to generate export', 'error');
        } finally {
            setExporting(false);
        }
    };

    const netPayable = gstData?.netGSTPayable ?? 0;

    return (
        <div className="space-y-6 pb-48 animate-in fade-in duration-500">
            {/* ── Hero Header ── */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-white dark:bg-gray-800 p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-green/5 rounded-full -mr-32 -mt-32 blur-3xl" />

                <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-green/10 text-primary-green rounded-full mb-3">
                            <ShieldCheck size={14} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Verified Tax Centre</span>
                        </div>
                        <h1 className="text-4xl font-black tracking-tighter text-gray-900 dark:text-white">
                            GST &amp; ITR <span className="text-primary-green">Dashboard</span>
                        </h1>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        {/* Month / Year pickers */}
                        <div className="flex bg-gray-50 dark:bg-gray-900 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700">
                            <div className="relative">
                                <select
                                    value={selectedMonth}
                                    onChange={e => setSelectedMonth(Number(e.target.value))}
                                    className="appearance-none bg-transparent pl-4 pr-10 py-2 text-sm font-bold text-gray-700 dark:text-gray-200 focus:outline-none"
                                >
                                    {MONTHS.map((m, i) => (
                                        <option key={m} value={i + 1} className="text-gray-900">{m}</option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-40 text-gray-500" />
                            </div>
                            <div className="w-[1px] bg-gray-200 dark:bg-gray-700 my-1 mx-1" />
                            <div className="relative">
                                <select
                                    value={selectedYear}
                                    onChange={e => setSelectedYear(Number(e.target.value))}
                                    className="appearance-none bg-transparent pl-4 pr-10 py-2 text-sm font-bold text-gray-700 dark:text-gray-200 focus:outline-none"
                                >
                                    {YEARS.map(y => (
                                        <option key={y} value={y} className="text-gray-900">{y}</option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-40 text-gray-500" />
                            </div>
                        </div>

                        <button
                            onClick={loadData}
                            disabled={loading}
                            className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {loading ? <Loader2 size={20} className="animate-spin" /> : <RefreshCcw size={20} />}
                        </button>

                        <button
                            onClick={handleClassifyAll}
                            disabled={classifying}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 border border-primary-green/30 text-primary-green rounded-2xl text-sm font-black uppercase tracking-tighter hover:bg-primary-green/5 transition-all active:scale-95 disabled:opacity-60"
                        >
                            {classifying ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            AI-Classify
                        </button>

                        <button
                            onClick={handleExportCSV}
                            disabled={exporting || loading}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-green text-white rounded-2xl text-sm font-black uppercase tracking-tighter shadow-lg shadow-primary-green/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60"
                        >
                            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            Download Report
                        </button>
                    </div>
                </div>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-24 bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 size={48} className="animate-spin text-primary-green" />
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Recalculating Tax Data...</p>
                    </div>
                </div>
            )}

            {!loading && gstData && (
                <>
                    {/* ── Top Section: GST Summary ── */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <StatCard
                            label="GST Collected"
                            value={fmt(gstData.totalOutputGST)}
                            sub="Total Output GST"
                            color="bg-primary-green text-white"
                            icon={<TrendingUp size={20} />}
                        />
                        <StatCard
                            label="GST Paid"
                            value={fmt(gstData.totalInputGST)}
                            sub="Total Input Credit"
                            color="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-700"
                            icon={<TrendingDown size={20} className="text-gray-400" />}
                        />
                        <StatCard
                            label="Net Liability"
                            value={fmt(netPayable)}
                            sub={netPayable > 0 ? 'Monthly Tax Due' : 'Balance Carryforward'}
                            color={netPayable > 0
                                ? 'bg-orange-500 text-white'
                                : 'bg-blue-500 text-white'}
                            icon={<IndianRupee size={20} />}
                        />
                    </div>

                    {/* ── Second Section: Monthly Breakdown Table ── */}
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                        <div className="px-8 py-6 border-b border-gray-50 dark:border-gray-700 flex items-center gap-3">
                            <div className="p-2 bg-primary-green/10 text-primary-green rounded-xl">
                                <TableIcon size={20} />
                            </div>
                            <h2 className="text-xl font-black text-gray-900 dark:text-white">Monthly GST Breakdown</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 dark:bg-gray-900 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    <tr>
                                        <th className="px-8 py-4">Month</th>
                                        <th className="px-8 py-4">Sales GST</th>
                                        <th className="px-8 py-4">Purchase GST</th>
                                        <th className="px-8 py-4 text-right">Net GST</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                    {yearlySummaries.map((s, i) => (
                                        <tr key={i} className={`hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors ${s.month === selectedMonth ? 'bg-primary-green/5' : ''}`}>
                                            <td className="px-8 py-4">
                                                <div className="font-black text-gray-900 dark:text-white text-sm">
                                                    {MONTHS[s.month - 1]}
                                                </div>
                                            </td>
                                            <td className="px-8 py-4 text-sm font-bold text-gray-600 dark:text-gray-300">
                                                {fmt(s.totalOutputGST)}
                                            </td>
                                            <td className="px-8 py-4 text-sm font-bold text-gray-600 dark:text-gray-300">
                                                {fmt(s.totalInputGST)}
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <span className={`text-sm font-black ${s.netGSTPayable > 0 ? 'text-orange-600' : 'text-primary-green'}`}>
                                                    {fmt(s.netGSTPayable)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {yearlySummaries.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-8 py-12 text-center text-gray-400 font-bold italic">
                                                No monthly records found for {selectedYear}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* ── Detailed Breakdown ── */}
                        <div className="rounded-[2.5rem] border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-sm">
                            <div className="mb-6 flex items-center gap-3">
                                <div className="rounded-2xl bg-gray-50 dark:bg-gray-900 p-3 text-primary-green">
                                    <Calculator size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-gray-900 dark:text-white">Tax Type Breakdown</h2>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{MONTHS[selectedMonth - 1]} {selectedYear}</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="p-6 rounded-[2rem] bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
                                    <p className="mb-3 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">Section I: Output GST (Sales)</p>
                                    <Row label="CGST Collected" value={fmt(gstData.outputCGST)} />
                                    <Row label="SGST Collected" value={fmt(gstData.outputSGST)} />
                                    <Row label="Total Output GST" value={fmt(gstData.totalOutputGST)} highlight />
                                </div>

                                <div className="p-6 rounded-[2rem] bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
                                    <p className="mb-3 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">Section II: Input Credit (Purchases)</p>
                                    <Row label="CGST Paid" value={fmt(gstData.inputCGST)} />
                                    <Row label="SGST Paid" value={fmt(gstData.inputSGST)} />
                                    <Row label="Total Input Credit" value={fmt(gstData.totalInputGST)} highlight />
                                </div>
                            </div>

                            <div className="mt-6 flex items-center justify-between p-6 rounded-[2rem] bg-gray-900 dark:bg-white">
                                <div className="flex items-center gap-2">
                                    <Landmark className="text-primary-green" size={20} />
                                    <span className="text-sm font-black text-white dark:text-gray-900 uppercase tracking-widest">Net GST Due</span>
                                </div>
                                <span className={`text-2xl font-black ${netPayable > 0 ? 'text-orange-400' : 'text-primary-green'}`}>
                                    {fmt(netPayable)}
                                </span>
                            </div>
                        </div>

                        {/* ── ITR Assistance ── */}
                        {itrData && (
                            <div className="rounded-[2.5rem] border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-sm">
                                <div className="mb-6 flex items-center gap-3">
                                    <div className="rounded-2xl bg-gray-50 dark:bg-gray-900 p-3 text-orange-500">
                                        <FileText size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-gray-900 dark:text-white">ITR Assistance</h2>
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Estimated for {selectedYear}</p>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Row label="Gross Revenue (incl. GST)" value={fmt(itrData.revenue)} />
                                    <Row label="Revenue (ex-GST)" value={fmt(itrData.revenueExGST)} />
                                    <Row label="Purchase Cost" value={fmt(itrData.purchaseCost)} />
                                    <Row label="GST Collected (Output)" value={fmt(itrData.gstCollected)} />
                                    <Row label="GST Paid (Input Credit)" value={fmt(itrData.gstPaid)} />
                                    <Row label="Net GST Payable" value={fmt(itrData.netGSTPayable)} />
                                    <div className="h-4" />
                                    <Row label="Gross Profit" value={fmt(itrData.grossProfit)} highlight />
                                    <Row label="Est. Taxable Income" value={fmt(itrData.estimatedTaxableIncome)} highlight />
                                </div>

                                <div className="mt-8 flex gap-4 p-5 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
                                    <AlertCircle size={24} className="shrink-0 text-orange-500" />
                                    <p className="text-xs text-gray-500 font-medium leading-relaxed italic">{itrData.disclaimer}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {!loading && !gstData && (
                <div className="rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-gray-700 p-24 text-center">
                    <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Calendar size={32} className="text-gray-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-600 dark:text-gray-300 mb-2">No GST Records Found</h3>
                    <p className="text-sm text-gray-400 max-w-sm mx-auto">
                        Create GST invoices or use the AI-Classify button to populate tax data for {MONTHS[selectedMonth - 1]} {selectedYear}.
                    </p>
                </div>
            )}
        </div>
    );
}


