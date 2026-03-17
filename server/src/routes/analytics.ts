import express from 'express';
import { Bill } from '../models/Bill.js';
import { generateInsights, AnalyticsData } from '../utils/ollama.js';

const router = express.Router();

router.get('/insights', async (req, res) => {
    try {
        // 1. Fetch raw data (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const bills = await Bill.find({
            createdAt: { $gte: thirtyDaysAgo }
        }).populate('items.productId');

        if (bills.length === 0) {
            return res.json({
                trends: "No sales data available for the last 30 days.",
                productPerformance: "Start selling to see product performance.",
                customerBehavior: "No customer data yet.",
                recommendations: ["Record your first sale to get AI insights!"]
            });
        }

        // 2. Aggregate Data
        const totalRevenue = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
        const totalTransactions = bills.length;
        const averageTransactionValue = totalRevenue / totalTransactions;

        // Top Products
        const productMap = new Map<string, { count: number; revenue: number }>();
        bills.forEach(bill => {
            bill.items.forEach(item => {
                const current = productMap.get(item.name) || { count: 0, revenue: 0 };
                productMap.set(item.name, {
                    count: current.count + item.quantity,
                    revenue: current.revenue + (item.price * item.quantity)
                });
            });
        });

        const topProducts = Array.from(productMap.entries())
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        // Sales Trend (Daily)
        const salesTrendMap = new Map<string, number>();
        bills.forEach(bill => {
            // Handle both string and Date objects safely
            const dateObj = new Date(bill.createdAt as any);
            if (!isNaN(dateObj.getTime())) {
                const dateParams = dateObj.toISOString().split('T')[0];
                salesTrendMap.set(dateParams, (salesTrendMap.get(dateParams) || 0) + bill.totalAmount);
            }
        });

        // Sort dates properly
        const salesTrend = Array.from(salesTrendMap.entries())
            .map(([date, revenue]) => ({ date, revenue }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Payment Methods
        const paymentMethodMap = new Map<string, number>();
        bills.forEach(bill => {
            paymentMethodMap.set(bill.paymentType, (paymentMethodMap.get(bill.paymentType) || 0) + 1);
        });
        const paymentMethods = Array.from(paymentMethodMap.entries())
            .map(([method, count]) => ({ method, count }));

        // 3. Prepare payload for AI
        const analyticsData: AnalyticsData = {
            totalRevenue,
            totalTransactions,
            averageTransactionValue: parseFloat(averageTransactionValue.toFixed(2)),
            topProducts,
            salesTrend,
            paymentMethods
        };

        // 4. Generate Insights
        const insights = await generateInsights(analyticsData);

        res.json(insights);

    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({
            error: 'Failed to generate insights',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;
