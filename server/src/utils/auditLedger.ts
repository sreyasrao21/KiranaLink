import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';
import { Customer } from '../models/Customer.js';
import { LedgerEntry } from '../models/LedgerEntry.js';
import { Bill } from '../models/Bill.js';
import { CustomerAccount } from '../models/CustomerAccount.js';
import dotenv from 'dotenv';

dotenv.config();

async function audit() {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('Connected to MongoDB');

        const totalBills = await Bill.countDocuments();
        const totalCustomers = await Customer.countDocuments();
        console.log(`Total Bills: ${totalBills}`);
        console.log(`Total Customers (Global): ${totalCustomers}`);

        const ledgerCount = await LedgerEntry.countDocuments();
        console.log(`Total LedgerEntries: ${ledgerCount}`);

        const accountsWithBalance = await CustomerAccount.find({ balance: { $gt: 0 } }).populate('customerId');
        console.log(`Active Customer Accounts (Balance > 0): ${accountsWithBalance.length}`);

        for (const account of accountsWithBalance) {
            const customer = account.customerId as any;
            if (!customer) continue;

            const entryTotal = (await LedgerEntry.find({
                customerId: customer._id,
                shopkeeperId: account.shopkeeperId
            }))
                .reduce((sum, entry: any) => sum + (entry.type === 'debit' ? entry.amount : -entry.amount), 0);

            console.log(`Shop: ${account.shopkeeperId} | Customer: ${customer.phoneNumber} | Balance: ${account.balance} | LedgerSum: ${entryTotal}`);
        }

        const billsWithLedger = await Bill.countDocuments({ paymentType: 'ledger' });
        console.log(`Bills with paymentType ledger: ${billsWithLedger}`);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

audit();
