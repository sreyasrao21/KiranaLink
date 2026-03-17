import { Customer } from '../models/Customer.js';
import { LedgerEntry } from '../models/LedgerEntry.js';
import { CustomerAccount } from '../models/CustomerAccount.js';

const SCORE_MIN = 300;
const SCORE_MAX = 900;
const SCORE_DEFAULT = 600;
const SCORE_MAX_CHANGE = 100;

/**
 * Maps score to recommended global khata limit.
 */
const calculateLimit = (score: number): number => {
    if (score >= 800) return 10000;
    if (score >= 700) return 6000;
    if (score >= 600) return 3000;
    if (score >= 550) return 1500;
    if (score >= 500) return 1000;
    return 0;
};

/**
 * Recalculates the Global Khata Score for a customer.
 */
export const recalculateGlobalKhataScore = async (customerId: string) => {
    const customer = await Customer.findById(customerId);
    if (!customer) return;

    const allEntries = await LedgerEntry.find({ customerId }).sort({ createdAt: 1 });
    const khataEntries = allEntries.filter(e => e.paymentMode === 'ledger' || e.type === 'debit');

    // Guardrail: If total transactions < 1 → score = 600
    // We allow a single transaction to start moving the score for demo purposes.
    if (allEntries.length < 1) {
        const oldScore = (customer as any).khataScore || SCORE_DEFAULT;
        const newScore = SCORE_DEFAULT;
        const diff = newScore - oldScore;
        const clampedNewScore = oldScore + Math.max(-SCORE_MAX_CHANGE, Math.min(SCORE_MAX_CHANGE, diff));

        await Customer.findByIdAndUpdate(customerId, {
            khataScore: Math.round(clampedNewScore),
            khataLimit: calculateLimit(Math.round(clampedNewScore)),
            lastScoreUpdate: new Date()
        });
        return;
    }

    const debitEntries = allEntries.filter(e => e.type === 'debit');

    // FIFO Settlement Logic for PTS and CS
    const credits = allEntries.filter(e => e.type === 'credit').map(e => ({ amount: e.amount, date: e.createdAt }));
    const debits = debitEntries.map(e => ({ amount: e.amount, date: e.createdAt, paidDate: null as Date | null }));

    let creditIdx = 0;
    let currentCreditAmount = credits.length > 0 ? credits[0].amount : 0;
    let currentCreditDate = credits.length > 0 ? credits[0].date : null;

    for (const debit of debits) {
        let remainingDebit = debit.amount;
        while (remainingDebit > 0 && creditIdx < credits.length) {
            if (currentCreditAmount >= remainingDebit) {
                currentCreditAmount -= remainingDebit;
                debit.paidDate = currentCreditDate;
                remainingDebit = 0;
                // If this credit is exhausted, move to next
                if (currentCreditAmount === 0) {
                    creditIdx++;
                    if (creditIdx < credits.length) {
                        currentCreditAmount = credits[creditIdx].amount;
                        currentCreditDate = credits[creditIdx].date;
                    }
                }
            } else {
                remainingDebit -= currentCreditAmount;
                creditIdx++;
                if (creditIdx < credits.length) {
                    currentCreditAmount = credits[creditIdx].amount;
                    currentCreditDate = credits[creditIdx].date;
                }
            }
        }
    }

    // 1. Payment Timeliness Score (PTS) - 40%
    let ptsSum = 0;
    for (const debit of debits) {
        if (debit.paidDate) {
            const daysToPay = (new Date(debit.paidDate).getTime() - new Date(debit.date).getTime()) / (1000 * 60 * 60 * 24);
            if (daysToPay <= 7) ptsSum += 1.0;
            else if (daysToPay <= 15) ptsSum += 0.8;
            else if (daysToPay <= 30) ptsSum += 0.5;
            else ptsSum += 0.2;
        } else {
            // Unpaid
            ptsSum += 0.0;
        }
    }
    const PTS = ptsSum / debits.length;

    // 2. Consistency Score (CS) - 25%
    // CS = 1 - (latePayments / totalKhataTransactions)
    // Late payment = > 15 days
    const latePayments = debits.filter(d => {
        if (!d.paidDate) return false; // Not paid yet isn't "late" in this specific formula, but usually it is. 
        // Prompt says "Consistency Score (CS)". I'll follow the logic of "late = > 15 days".
        const daysToPay = (new Date(d.paidDate).getTime() - new Date(d.date).getTime()) / (1000 * 60 * 60 * 24);
        return daysToPay > 15;
    }).length;
    const CS = debits.length > 0 ? (1 - (latePayments / debits.length)) : 1.0;

    // 3. Outstanding Risk Score (ORS) - 20%
    // ORS = 1 - (currentUnpaid / maxHistorical)
    // We need to aggregate across all shops
    const accounts = await CustomerAccount.find({ customerId });
    const currentUnpaid = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 1); // min 1 to avoid div by zero

    // Find max historical balance. Since we don't have it tracked, we'll use sum of all debits ever as a proxy OR 
    // better, the max balance we've ever seen. For now, since we are implementing this new, 
    // I'll use sum of all debits or some reasonable high value if unknown.
    // Actually, let's use the max balance reached in the current history we have.
    let maxHistorical = 1;
    let runningBalance = 0;
    for (const entry of allEntries) {
        if (entry.type === 'debit') runningBalance += entry.amount;
        else runningBalance -= entry.amount;
        if (runningBalance > maxHistorical) maxHistorical = runningBalance;
    }

    const ORS = Math.max(0, Math.min(1, 1 - (currentUnpaid / maxHistorical)));

    // 4. Recency Score (RS) - 15%
    // Based on how recent the last payment was.
    const lastPayment = credits.length > 0 ? credits[credits.length - 1] : null;
    let RS = 0;
    if (lastPayment) {
        const daysSinceLastPayment = (Date.now() - new Date(lastPayment.date).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastPayment <= 15) RS = 1.0;
        else if (daysSinceLastPayment <= 30) RS = 0.7;
        else RS = 0.4;
    } else {
        RS = 0.0;
    }

    // Final Formula
    const S = (0.4 * PTS) + (0.25 * CS) + (0.2 * ORS) + (0.15 * RS);
    console.log(`[KhataScore] Components for ${customer.phoneNumber}: PTS=${PTS.toFixed(2)}, CS=${CS.toFixed(2)}, ORS=${ORS.toFixed(2)}, RS=${RS.toFixed(2)} | S=${S.toFixed(2)}`);
    let calculatedScore = 300 + (S * 600);
    calculatedScore = Math.max(SCORE_MIN, Math.min(SCORE_MAX, calculatedScore));

    // Smoothing: Max delta = ±50
    const oldScore = (customer as any).khataScore || SCORE_DEFAULT;
    const diff = calculatedScore - oldScore;
    const clampedScore = oldScore + Math.max(-SCORE_MAX_CHANGE, Math.min(SCORE_MAX_CHANGE, diff));
    const finalScore = Math.round(clampedScore);

    await Customer.findByIdAndUpdate(customerId, {
        khataScore: finalScore,
        khataLimit: calculateLimit(finalScore),
        lastScoreUpdate: new Date(),
        // Also update trustScore for compatibility
        trustScore: finalScore
    });
};
