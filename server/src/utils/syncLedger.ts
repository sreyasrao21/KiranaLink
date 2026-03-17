import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';
import { Customer } from '../models/Customer.js';
import { LedgerEntry } from '../models/LedgerEntry.js';
import { Bill } from '../models/Bill.js';
import dotenv from 'dotenv';

dotenv.config();

async function syncLegeEntries() {
    try {
        console.log('Starting Ledger Repair Sync...');
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('Connected to MongoDB');

        // 1. Reset all customer balances to 0
        console.log('Resetting all customer balances...');
        await Customer.updateMany({}, { khataBalance: 0 });

        // 2. Fetch all bills that were done on ledger
        const ledgerBills = await Bill.find({ paymentType: 'ledger' });
        console.log(`Found ${ledgerBills.length} ledger bills to process.`);

        let restoredCount = 0;
        for (const bill of ledgerBills) {
            // Check if entry already exists (in case user only deleted some)
            const exists = await LedgerEntry.findOne({ billId: bill._id });
            if (!exists) {
                // Create missing LedgerEntry
                const entry = new LedgerEntry({
                    customerId: bill.customerId,
                    billId: bill._id,
                    amount: bill.totalAmount,
                    type: 'debit',
                    status: 'pending'
                });
                await entry.save();
                restoredCount++;
            }

            // Update customer balance
            await Customer.findByIdAndUpdate(bill.customerId, {
                $inc: { khataBalance: bill.totalAmount }
            });
        }

        console.log(`Successfully restored ${restoredCount} ledger entries and re-synced customer balances.`);

    } catch (err) {
        console.error('Sync failed:', err);
    } finally {
        await mongoose.disconnect();
    }
}

syncLegeEntries();
