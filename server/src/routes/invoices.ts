import { Router, Request, Response } from 'express';
import { Invoice } from '../models/Invoice.js';
import { CustomerAccount } from '../models/CustomerAccount.js';
import { auth } from '../middleware/auth.js';
import { sendNotification, sendGenericMessage } from '../services/communicationService.js';
import { generateMessage } from '../services/messageGenerator.js';
import { Customer } from '../models/Customer.js';
import { LedgerEntry } from '../models/LedgerEntry.js';
import { recalculateGlobalKhataScore } from '../utils/khataScore.js';
import { VoiceCallSession } from '../models/VoiceCallSession.js';

export const invoiceRouter = Router();

function isVoiceTargetPhone(phone: string): boolean {
    const target = process.env.VOICE_AGENT_TARGET_PHONE || '+918712316204';
    const normalize = (value: string) => value.replace(/[^0-9]/g, '').slice(-10);
    return normalize(phone) === normalize(target);
}

// Create new invoice
invoiceRouter.post('/', async (req, res) => {
    try {
        const invoice = new Invoice(req.body);
        await invoice.save();
        res.status(201).json(invoice);
    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({ error: 'Failed to create invoice' });
    }
});

// Import Live Pending Khata Balances AND immediately trigger WhatsApp + Call
invoiceRouter.post('/import-khata', auth, async (req, res) => {
    try {
        const overdueAccounts = await CustomerAccount.find({
            shopkeeperId: req.auth?.userId,
            balance: { $gt: 0 }
        }).populate('customerId');

        let importedCount = 0;
        let calledCount = 0;
        const results: string[] = [];
        const pastDate = new Date();
        pastDate.setMinutes(pastDate.getMinutes() - 5);

        for (const account of overdueAccounts) {
            const customer = account.customerId as any;
            if (!customer || !customer.phoneNumber) continue;

            const last10 = customer.phoneNumber.replace(/[^0-9]/g, '').slice(-10);
            if (!last10 || last10.length < 10) continue;

            // Check if already being chased
            const existingInvoice = await Invoice.findOne({
                client_phone: { $regex: new RegExp(last10 + '$') },
                status: { $in: ['unpaid', 'overdue', 'promised', 'disputed'] }
            });

            let invoice = existingInvoice;

            if (!invoice) {
                invoice = new Invoice({
                    invoice_id: `KHATA-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    client_name: customer.name || 'Valued Customer',
                    client_email: `${(customer.name || 'user').replace(/\s/g, '').toLowerCase()}@example.com`,
                    client_phone: customer.phoneNumber,
                    amount: account.balance,
                    due_date: pastDate,
                    status: 'overdue',
                    reminder_level: 0
                });
                await invoice.save();
                importedCount++;
            }

            await Customer.findByIdAndUpdate(customer._id, {
                $set: {
                    nextCallDate: Date.now(),
                    recoveryStatus: 'Call Again',
                    recoveryNotes: 'Synced into auto-recovery pipeline.'
                }
            });

            // ── ALWAYS IMMEDIATELY SEND WHATSAPP & CALL ON BUTTON CLICK ──
            // We removed the 'if (!invoice)' skip logic here because the user wants a forced demonstration.
            // The autonomous scheduler is now blocked from double-calling by 'timeSinceContact' logic in Escalation Engine.
            try {
                const waMessage = `Hello ${invoice.client_name}! 🙏\n\nThis is a friendly reminder from your Smart Dukaan store.\n\nYou have a pending balance of *₹${invoice.amount}*.\n\nPlease pay at your earliest convenience.\n\n- SDukaan AI Agent`;
                const waStatus = await sendGenericMessage(customer.phoneNumber, waMessage, 'whatsapp');

                invoice.reminder_history.push({
                    timestamp: new Date(),
                    channel: 'whatsapp',
                    message_content: waMessage,
                    delivery_status: waStatus
                });
                invoice.last_contacted_at = new Date();
                results.push(`WhatsApp sent to ${invoice.client_name}: ${waStatus}`);
                console.log(`[ImportKhata] ✅ WhatsApp sent to ${invoice.client_name} (${waStatus})`);
            } catch (waErr) {
                console.error(`[ImportKhata] WhatsApp failed for ${invoice.client_name}:`, waErr);
                results.push(`WhatsApp FAILED for ${invoice.client_name}`);
            }

            // ── IMMEDIATELY MAKE VOICE CALL ──
            try {
                const callMessage = await generateMessage(invoice, 'friendly reminder', 'call');
                const callStatus = await sendNotification(invoice, callMessage, 'call');

                invoice.reminder_level = 3; // Mark as called
                invoice.reminder_history.push({
                    timestamp: new Date(),
                    channel: 'call',
                    message_content: callMessage,
                    delivery_status: callStatus
                });
                calledCount++;
                results.push(`Call to ${invoice.client_name}: ${callStatus}`);
                console.log(`[ImportKhata] ✅ Call placed to ${invoice.client_name} (${callStatus})`);
            } catch (callErr) {
                console.error(`[ImportKhata] Call failed for ${invoice.client_name}:`, callErr);
                results.push(`Call FAILED for ${invoice.client_name}`);
            }

            await invoice.save();
        }

        res.json({
            message: `Synced ${importedCount} customers. Sent ${results.filter(r => r.includes('WhatsApp sent')).length} WhatsApp messages. Placed ${calledCount} calls.`,
            details: results
        });
    } catch (error) {
        console.error('Error in import-khata:', error);
        res.status(500).json({ error: 'Failed to sync Khata' });
    }
});

// List overdue
invoiceRouter.get('/overdue', async (req, res) => {
    try {
        const invoices = await Invoice.find({ status: 'overdue' }).sort({ due_date: 1 });
        res.json(invoices);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch overdue invoices' });
    }
});

// List ALL invoices
invoiceRouter.get('/', async (req, res) => {
    try {
        const invoices = await Invoice.find().sort({ createdAt: -1 });
        res.json(invoices);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});

// Update invoice status
invoiceRouter.put('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const invoice = await Invoice.findOneAndUpdate(
            { invoice_id: req.params.id },
            { status },
            { new: true }
        );
        if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }
        res.json(invoice);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update invoice status' });
    }
});

// Record payment
invoiceRouter.put('/:id/payment', async (req, res) => {
    try {
        const now = new Date();
        const invoice = await Invoice.findOneAndUpdate(
            { invoice_id: req.params.id },
            {
                status: 'paid',
                last_contacted_at: now,
                $push: {
                    reminder_history: {
                        timestamp: now,
                        channel: 'system',
                        message_content: 'Payment confirmed. Escalation halted.',
                        delivery_status: 'delivered'
                    }
                }
            },
            { new: true }
        );
        if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }

        // ── AUTO-RESOLVE KHATA BALANCE & KHATA SCORE ──
        try {
            const cleanPhone = invoice.client_phone.replace('whatsapp:', '').replace('+', '\\+').slice(-10);
            const customer = await Customer.findOne({ phoneNumber: { $regex: new RegExp(cleanPhone + '$') } });

            if (customer) {
                // Find Khata accounts to deduct from
                const accounts = await CustomerAccount.find({ customerId: customer._id, balance: { $gt: 0 } });
                let remainingPayment = invoice.amount;

                for (const account of accounts) {
                    if (remainingPayment <= 0) break;
                    const deduct = Math.min(account.balance, remainingPayment);
                    account.balance -= deduct;
                    remainingPayment -= deduct;
                    await account.save();

                    // Create Ledger Entry for the resolution
                    const entry = new LedgerEntry({
                        shopkeeperId: account.shopkeeperId,
                        customerId: customer._id,
                        amount: deduct,
                        type: 'credit',
                        paymentMode: 'auto-resolve',
                        status: 'settled'
                    });
                    await entry.save();
                }

                // Recalculate Khata Score
                await recalculateGlobalKhataScore(customer._id.toString());
                console.log(`[AutoResolve] Reduced Khata balance by ₹${invoice.amount} and recalculated Khata Score for ${customer.name || customer.phoneNumber}`);
            }
        } catch (khataError) {
            console.error('[AutoResolve] Khata Sync Error:', khataError);
        }

        res.json(invoice);
    } catch (error) {
        res.status(500).json({ error: 'Failed to record payment' });
    }
});

invoiceRouter.get('/recovery-state/:invoiceId', auth, async (req: Request, res: Response) => {
    try {
        const invoice = await Invoice.findOne({ invoice_id: req.params.invoiceId });
        if (!invoice) {
            res.status(404).json({ message: 'Invoice not found' });
            return;
        }

        const last10 = invoice.client_phone.replace(/[^0-9]/g, '').slice(-10);
        const customer = await Customer.findOne({ phoneNumber: { $regex: new RegExp(`${last10}$`) } });

        const sinceRaw = String(req.query?.since || '');
        const sinceDate = sinceRaw ? new Date(sinceRaw) : null;
        const hasValidSince = Boolean(sinceDate && !Number.isNaN(sinceDate.getTime()));

        const latestVoiceHistory = [...invoice.reminder_history]
            .reverse()
            .find((entry) => entry.channel === 'voice_call');

        const latestTranscriptHistory = [...invoice.reminder_history]
            .reverse()
            .find((entry) => entry.channel === 'voice_call' && entry.message_content?.includes('[Deepgram]:'));

        // Get session that was created AFTER the sinceDate to avoid returning old completed sessions
        const sessionQuery: any = { invoiceId: invoice.invoice_id };
        if (hasValidSince && sinceDate) {
            sessionQuery.createdAt = { $gte: sinceDate };
        }
        const latestSession = await VoiceCallSession.findOne(sessionQuery).sort({ createdAt: -1 });
        
        // If no session found with date filter, try getting any session for this invoice
        const fallbackSession = !latestSession 
            ? await VoiceCallSession.findOne({ invoiceId: invoice.invoice_id }).sort({ createdAt: -1 })
            : null;
        
        const activeSession = latestSession || fallbackSession;
        const latestSessionCustomerTurn = activeSession?.transcriptTurns
            ? [...activeSession.transcriptTurns].reverse().find((turn: any) => turn.speaker === 'customer')
            : null;

        const hasTranscript = Boolean(latestTranscriptHistory);
        const hasTranscriptSince = hasValidSince
            ? invoice.reminder_history.some((entry) =>
                entry.channel === 'voice_call'
                && entry.message_content?.includes('[Deepgram]:')
                && new Date(entry.timestamp).getTime() >= (sinceDate as Date).getTime()
            )
            : hasTranscript;

        res.json({
            invoiceId: invoice.invoice_id,
            invoiceStatus: invoice.status,
            lastIntent: invoice.last_intent,
            aiConfidence: invoice.ai_confidence,
            promisedDate: invoice.promised_date,
            nextRetryAt: invoice.next_retry_at,
            hasTranscript,
            hasTranscriptSince,
            latestVoiceLog: latestVoiceHistory?.message_content || null,
            latestTranscriptLog: latestTranscriptHistory?.message_content || null,
            latestVoiceAt: latestVoiceHistory?.timestamp || null,
            latestTranscriptAt: latestTranscriptHistory?.timestamp || null,
            negotiationStage: activeSession?.stage || null,
            negotiationStatus: activeSession?.status || null,
            negotiationSummary: activeSession?.finalSummary || null,
            negotiationTurns: activeSession?.turnCount || 0,
            negotiationPartialAmountNow: activeSession?.partialAmountNow || 0,
            negotiationRemainingAmount: activeSession?.remainingAmount || null,
            negotiationPromisedDate: activeSession?.promisedDate || null,
            latestSessionCustomerTranscript: latestSessionCustomerTurn?.text || null,
            negotiationLanguage: activeSession?.detectedLanguage || customer?.preferredVoiceLanguage || customer?.preferredLanguage || 'en',
            negotiationLanguageConfidence: activeSession?.languageConfidence || 0,
            negotiationCodeMixed: activeSession?.isCodeMixed || false,
            negotiationFallbackMode: activeSession?.fallbackMode || 'none',
            negotiationLanguageSource: activeSession?.selectedLanguageSource || 'fallback',
            customerRecoveryStatus: customer?.recoveryStatus || null,
            customerNextCallDate: customer?.nextCallDate || null,
            customerRecoveryNotes: customer?.recoveryNotes || null,
            customerPreferredVoiceLanguage: customer?.preferredVoiceLanguage || customer?.preferredLanguage || 'en',
            customerVoiceLanguageLocked: Boolean(customer?.lockVoiceLanguage),
            customerLastDetectedVoiceLanguage: customer?.lastDetectedVoiceLanguage || null,
            customerLastVoiceLanguageConfidence: customer?.lastVoiceLanguageConfidence || 0,
            customerVoiceLanguageSource: customer?.voiceLanguageSource || 'shop_default',
        });
    } catch (error) {
        console.error('recovery-state error:', error);
        res.status(500).json({ message: 'Failed to fetch recovery state' });
    }
});

invoiceRouter.post('/recover-now/:customerId', auth, async (req: Request, res: Response) => {
    try {
        const customer = await Customer.findById(req.params.customerId);
        if (!customer) {
            res.status(404).json({ message: 'Customer not found' });
            return;
        }

        if (!isVoiceTargetPhone(customer.phoneNumber || '')) {
            res.status(400).json({
                message: `Voice demo is restricted to target number ${(process.env.VOICE_AGENT_TARGET_PHONE || '+918712316204')}.`,
            });
            return;
        }

        const accounts = await CustomerAccount.find({
            customerId: customer._id,
            shopkeeperId: req.auth?.userId,
            balance: { $gt: 0 }
        });

        const pending = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
        if (pending <= 0) {
            res.status(400).json({ message: 'No pending khata for this customer' });
            return;
        }

        const last10 = customer.phoneNumber.replace(/[^0-9]/g, '').slice(-10);
        const existingInvoice = await Invoice.findOne({
            client_phone: { $regex: new RegExp(`${last10}$`) },
            status: { $in: ['unpaid', 'overdue', 'promised', 'disputed'] }
        });

        const invoice = existingInvoice || new Invoice({
            invoice_id: `KHATA-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            client_name: customer.name || 'Valued Customer',
            client_email: `${(customer.name || 'user').replace(/\s/g, '').toLowerCase()}@example.com`,
            client_phone: customer.phoneNumber,
            amount: pending,
            due_date: new Date(Date.now() - 60 * 1000),
            status: 'overdue',
            reminder_level: 2
        });

        invoice.amount = pending;
        invoice.status = 'overdue';
        const callMessage = await generateMessage(invoice, 'urgent reminder', 'call');
        const callStatus = await sendNotification(invoice, callMessage, 'call');
        invoice.last_contacted_at = new Date();
        invoice.reminder_history.push({
            timestamp: new Date(),
            channel: 'call',
            message_content: callMessage,
            delivery_status: callStatus
        });
        await invoice.save();

        await Customer.findByIdAndUpdate(customer._id, {
            $set: {
                recoveryStatus: callStatus === 'delivered' ? 'Busy' : 'Call Again',
                recoveryNotes: `Manual recovery call triggered (${callStatus})`
            }
        });

        res.json({
            message: 'Recovery call initiated',
            invoiceId: invoice.invoice_id,
            callStatus
        });
    } catch (error) {
        console.error('recover-now error:', error);
        res.status(500).json({ message: 'Failed to trigger recovery call' });
    }
});
