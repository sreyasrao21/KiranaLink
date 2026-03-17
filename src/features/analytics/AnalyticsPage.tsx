import React, { useState, useEffect } from 'react';
import { ShoppingBag, CreditCard, DollarSign, Calendar, Users } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { billApi } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTranslate } from '../../hooks/useTranslate';

const COLORS = ['#059669', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];

const KPISection = React.memo(({ stats, t }: { stats: any, t: any }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-green-100 text-green-700 rounded-lg">
          <DollarSign size={20} />
        </div>
        <span className="text-gray-500 text-sm font-medium">{t['Total Revenue']}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">₹{stats.totalRevenue.toLocaleString()}</div>
    </div>

    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
          <ShoppingBag size={20} />
        </div>
        <span className="text-gray-500 text-sm font-medium">{t['Total Orders']}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{stats.totalSales}</div>
      <div className="text-xs text-gray-500 mt-1">{t['across all channels']}</div>
    </div>

    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
          <CreditCard size={20} />
        </div>
        <span className="text-gray-500 text-sm font-medium">{t['Avg. Order Value']}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">₹{Math.round(stats.avgTransaction)}</div>
      <div className="text-xs text-gray-500 mt-1">{t['per customer']}</div>
    </div>
  </div>
));

const RevenueTrendChart = React.memo(({ data, t }: { data: any[], t: any }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <h3 className="font-semibold text-gray-800 mb-6">{t['Revenue Trend']}</h3>
    <div className="h-64 rounded-lg bg-gray-50 p-2">
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6B7280' }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6B7280' }}
              tickFormatter={(val: number) => `₹${val}`}
            />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
              formatter={(value: any) => [`₹${value}`, t['Revenue']]}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#059669"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorRevenue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center text-gray-400">{t['No revenue data available']}</div>
      )}
    </div>
  </div>
));

const PaymentDistributionChart = React.memo(({ data, t }: { data: any[], t: any }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
    <h3 className="font-semibold text-gray-800 mb-6">{t['Payment Distribution']}</h3>
    <div className="h-64 rounded-lg bg-gray-50 p-2 w-full">
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell key={`cell-pay-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center text-gray-400">{t['No payment data']}</div>
      )}
    </div>
  </div>
));

const ProductSalesShareChart = React.memo(({ data, t }: { data: any[], t: any }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
    <h3 className="font-semibold text-gray-800 mb-6">{t['Product Sales Share']}</h3>
    <div className="h-64 rounded-lg bg-gray-50 p-2 w-full">
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell key={`cell-prod-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center text-gray-400">{t['No product data']}</div>
      )}
    </div>
  </div>
));

const TopProductsBarChart = React.memo(({ data, t }: { data: any[], t: any }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <h3 className="font-semibold text-gray-800 mb-6">{t['Top Selling Products']}</h3>
    <div className="h-64 rounded-lg bg-gray-50 p-2">
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E7EB" />
            <XAxis type="number" hide />
            <YAxis
              dataKey="name"
              type="category"
              axisLine={false}
              tickLine={false}
              width={100}
              tick={{ fontSize: 13, fill: '#374151', fontWeight: 500 }}
            />
            <Tooltip
              cursor={{ fill: '#F3F4F6' }}
              contentStyle={{ borderRadius: '8px' }}
            />
            <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center text-gray-400">{t['No product data']}</div>
      )}
    </div>
  </div>
));

const TopCustomersList = React.memo(({ data, t }: { data: any[], t: any }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <h3 className="font-semibold text-gray-800 mb-6">{t['Top Customers']}</h3>
    <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
      {data.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-gray-400 text-sm">{t['No customer data yet']}</div>
      ) : (
        data.map((c, i) => (
          <div key={i} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-100 p-2 rounded-full text-indigo-600">
                <Users size={16} />
              </div>
              <div>
                <div className="font-semibold text-gray-900 text-sm">{c.name}</div>
                <div className="text-xs text-gray-500">{c.orders} {t['orders']}</div>
              </div>
            </div>
            <div className="font-bold text-gray-900 text-sm">₹{c.spend.toLocaleString()}</div>
          </div>
        ))
      )}
    </div>
  </div>
));

export const AnalyticsPage: React.FC = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<any[]>([]);

  const loadAnalytics = React.useCallback(async () => {
    try {
      const response = await billApi.getAll();
      setBills(response.data);
    } catch (err) {
      console.error('Failed to load analytics', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const analyticsData = React.useMemo(() => {
    if (bills.length === 0) return null;

    let totalRevenue = 0;
    const trendMap: Record<string, number> = {};
    const payMap: Record<string, number> = {};
    const prodMap: Record<string, number> = {};
    const custMap: Record<string, { name: string, spend: number, orders: number }> = {};

    bills.forEach((b: any) => {
      const amount = b.totalAmount || 0;
      totalRevenue += amount;

      // Trend
      const date = new Date(b.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      trendMap[date] = (trendMap[date] || 0) + amount;

      // Payment Methods
      const method = b.paymentType || 'cash';
      payMap[method] = (payMap[method] || 0) + 1;

      // Products
      if (b.items) {
        b.items.forEach((item: any) => {
          prodMap[item.name] = (prodMap[item.name] || 0) + item.quantity;
        });
      }

      // Customers
      const c = b.customerId;
      if (c && typeof c === 'object') {
        const key = c._id || c.phoneNumber || 'unknown';
        const name = c.name || c.phoneNumber || 'Unknown';
        if (!custMap[key]) {
          custMap[key] = { name, spend: 0, orders: 0 };
        }
        custMap[key].spend += amount;
        custMap[key].orders += 1;
      }
    });

    const totalSales = bills.length;
    const avgTransaction = totalSales > 0 ? totalRevenue / totalSales : 0;

    const revenueTrendData = Object.entries(trendMap)
      .map(([date, amount]) => ({ date, amount }))
      .reverse()
      .slice(-7);

    const paymentMethodsData = Object.entries(payMap).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value
    }));

    const sortedProducts = Object.entries(prodMap)
      .map(([name, count]) => ({ name, count, value: count }))
      .sort((a, b) => b.count - a.count);

    const topProductsRaw = sortedProducts.slice(0, 5);

    const productPieDataRaw = sortedProducts.slice(0, 5).map(p => ({ name: p.name, value: p.value }));
    const othersCount = sortedProducts.slice(5).reduce((sum, p) => sum + p.value, 0);
    if (othersCount > 0) {
      productPieDataRaw.push({ name: 'Others', value: othersCount });
    }

    const topCustomersData = Object.values(custMap)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);

    return {
      stats: { totalRevenue, totalSales, avgTransaction },
      revenueTrendData,
      paymentMethodsData,
      topProductsRaw,
      productPieDataRaw,
      topCustomersData
    };
  }, [bills]);

  // Handle translations
  const translatedTopProducts = useTranslate(analyticsData?.topProductsRaw || [], ['name']);
  const translatedProductPieData = useTranslate(analyticsData?.productPieDataRaw || [], ['name']);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const data = analyticsData || {
    stats: { totalRevenue: 0, totalSales: 0, avgTransaction: 0 },
    revenueTrendData: [],
    paymentMethodsData: [],
    topCustomersData: []
  };

  return (
    <div className="space-y-6 pb-48">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">{t['Dashboard']}</h2>
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shadow-sm text-sm text-gray-600">
          <Calendar size={16} />
          <span>{t['Last 30 Days']}</span>
        </div>
      </div>

      <KPISection stats={data.stats} t={t} />

      <RevenueTrendChart data={data.revenueTrendData} t={t} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PaymentDistributionChart data={data.paymentMethodsData} t={t} />
        <ProductSalesShareChart data={translatedProductPieData} t={t} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TopProductsBarChart data={translatedTopProducts} t={t} />
        <TopCustomersList data={data.topCustomersData} t={t} />
      </div>
    </div>
  );
};
