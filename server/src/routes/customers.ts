import express from 'express';
import { Customer } from '../models/Customer.js';
import { CustomerAccount } from '../models/CustomerAccount.js';
import { User } from '../models/User.js';
import { auth } from '../middleware/auth.js';
import { recalculateGlobalKhataScore } from '../utils/khataScore.js';
import { sendGenericMessage } from '../services/communicationService.js';
import { normalizeLanguage } from '../services/voiceLanguage.js';

const router = express.Router();

// Get aggregated khata for a customer (Backend Utility)
router.get('/aggregated-khata/:phoneNumber', auth, async (req, res) => {
    try {
        const inputPhone = req.params['phoneNumber'] as string;
        const normalizedPhone = inputPhone.startsWith('+91') ? inputPhone : '+91' + inputPhone.replace(/\D/g, '').slice(-10);
        const customer = (await Customer.findOne({ phoneNumber: normalizedPhone })) as any;
        if (!customer) return res.status(404).json({ message: 'Customer not found' });

        const accounts = await CustomerAccount.find({ customerId: customer._id });
        const totalBalance = accounts.reduce((sum, acc: any) => sum + (acc.balance || 0), 0);

        res.json({
            ...customer._doc,
            aggregatedKhataBalance: totalBalance,
            accountCount: accounts.length
        });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

// Get all customers for the current shop (with balances)
router.get('/', auth, async (req, res) => {
    try {
        const accounts = await CustomerAccount.find({ shopkeeperId: req.auth?.userId })
            .populate('customerId');

        // Map to a friendlier format for the frontend, filtering out null customers
        const customers = accounts
            .filter((acc: any) => acc.customerId) // Filter out null/undefined customerIds
            .map((acc: any) => ({
                ...(acc.customerId as any)._doc,
                khataBalance: acc.balance,
                accountId: acc._id
            }));

        res.json(customers);
    } catch (err: any) {
        console.error('Error fetching customers:', err);
        res.status(500).json({ message: err.message });
    }
});

// Global Search (Name or Phone)
router.get('/search', auth, async (req, res) => {
    try {
        const query = req.query.q as string;
        if (!query || query.length < 3) return res.json([]);

        const normalizedQuery = /^\d+$/.test(query) && query.length >= 10 ? '+91' + query.slice(-10) : query;

        // Find customers matching name (regex) or phone (exact or partial)
        const customers = await Customer.find({
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { phoneNumber: { $regex: normalizedQuery, $options: 'i' } }
            ]
        }).limit(10); // Limit to 10 results

        // Map results to include local shop status
        const results = await Promise.all(customers.map(async (customer: any) => {
            const account = await CustomerAccount.findOne({
                customerId: customer._id,
                shopkeeperId: req.auth?.userId
            });

            return {
                ...customer._doc,
                khataBalance: account ? account.balance : 0,
                isLocal: !!account
            };
        }));

        // Trigger recalculation for all matching customers to ensure scores are fresh during testing
        customers.forEach(customer => {
            recalculateGlobalKhataScore(customer._id.toString()).catch(err => console.error('Score recalc error:', err));
        });

        res.json(results);

    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

// Get customer by phone (Global)
router.get('/:phoneNumber', auth, async (req, res) => {
    try {
        const inputPhone = req.params['phoneNumber'] as string;
        const normalizedPhone = inputPhone.startsWith('+91') ? inputPhone : '+91' + inputPhone.replace(/\D/g, '').slice(-10);
        const customer = (await Customer.findOne({ phoneNumber: normalizedPhone })) as any;
        if (!customer) return res.status(404).json({ message: 'Customer not found' });

        // Also check if they have an account in this shop
        const account = await CustomerAccount.findOne({
            customerId: customer._id,
            shopkeeperId: req.auth?.userId
        });

        res.json({
            ...customer._doc,
            khataBalance: account ? account.balance : 0
        });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

// Create/Update customer and ensure account exists for this shop
router.post('/', auth, async (req, res) => {
    try {
        const { phoneNumber, name, preferredVoiceLanguage, lockVoiceLanguage } = req.body;
        const normalizedPhone = phoneNumber.startsWith('+91') ? phoneNumber : '+91' + phoneNumber.replace(/\D/g, '').slice(-10);
        const shopkeeper = await User.findById(req.auth?.userId).select('defaultVoiceLanguage');
        const shopDefaultLang = normalizeLanguage((shopkeeper as any)?.defaultVoiceLanguage || 'en');
        const requestedLang = preferredVoiceLanguage ? normalizeLanguage(preferredVoiceLanguage) : null;

        let customer = (await Customer.findOne({ phoneNumber: normalizedPhone })) as any;
        if (!customer) {
            customer = new Customer({
                ...req.body,
                phoneNumber: normalizedPhone,
                preferredVoiceLanguage: requestedLang || shopDefaultLang,
                voiceLanguageSource: requestedLang ? 'manual' : 'shop_default',
                lockVoiceLanguage: Boolean(lockVoiceLanguage),
                voiceLanguageUpdatedAt: new Date(),
            });
            await customer.save();
        } else {
            const updates: Record<string, unknown> = {};
            if (name && !customer.name) updates.name = name;
            if (requestedLang) {
                updates.preferredVoiceLanguage = requestedLang;
                updates.voiceLanguageSource = 'manual';
                updates.voiceLanguageUpdatedAt = new Date();
            } else if (!customer.preferredVoiceLanguage) {
                updates.preferredVoiceLanguage = shopDefaultLang;
                updates.voiceLanguageSource = 'shop_default';
                updates.voiceLanguageUpdatedAt = new Date();
            }
            if (typeof lockVoiceLanguage === 'boolean') {
                updates.lockVoiceLanguage = lockVoiceLanguage;
            }
            if (Object.keys(updates).length) {
                Object.assign(customer, updates);
                await customer.save();
            }
        }

        // Ensure account exists for this shop
        let account = await CustomerAccount.findOne({
            customerId: customer._id,
            shopkeeperId: req.auth?.userId
        });

        if (!account) {
            account = new CustomerAccount({
                customerId: customer._id,
                shopkeeperId: req.auth?.userId,
                balance: 0
            });
            await account.save();

            // Send WhatsApp Welcome / OTP notification over Twilio
            const otpCode = Math.floor(100000 + Math.random() * 900000);
            const welcomeMsg = `Welcome to SDukaan, ${customer.name || 'valued customer'}! 🎉\nYour Khata account has been successfully linked.\nYour security OTP is: *${otpCode}*\n\nThank you for trusting your local Smart Dukaan!`;
            sendGenericMessage(normalizedPhone, welcomeMsg, 'whatsapp').catch(console.error);
        }

        res.json({
            ...customer._doc,
            khataBalance: account.balance
        });
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

// Update customer by ID
router.patch('/:id', auth, async (req, res) => {
    try {
        const payload = { ...req.body };
        if (payload.preferredVoiceLanguage !== undefined) {
            payload.preferredVoiceLanguage = normalizeLanguage(String(payload.preferredVoiceLanguage));
            payload.voiceLanguageSource = 'manual';
            payload.voiceLanguageUpdatedAt = new Date();
        }
        const customer = await Customer.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    ...payload,
                    phoneNumber: req.body.phoneNumber
                        ? (req.body.phoneNumber.startsWith('+91')
                            ? req.body.phoneNumber
                            : '+91' + req.body.phoneNumber.replace(/\D/g, '').slice(-10))
                        : undefined
                }
            },
            { new: true }
        );
        if (!customer) return res.status(404).json({ message: 'Customer not found' });
        res.json(customer);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});
// Seed customers
router.post('/seed', auth, async (req, res) => {
    try {
        const dummyCustomers = [
            { name: 'Raju Kumar', phoneNumber: '9876543210', khataBalance: 1200, trustScore: 85 },
            { name: 'Anita Devi', phoneNumber: '9876543211', khataBalance: 450, trustScore: 92 },
            { name: 'Suresh Yadav', phoneNumber: '9876543212', khataBalance: 2500, trustScore: 60 },
            { name: 'Meena Kumari', phoneNumber: '9876543213', khataBalance: 0, trustScore: 78 },
            { name: 'Vikram Singh', phoneNumber: '9876543214', khataBalance: 5000, trustScore: 45 }
        ];

        const results = [];

        for (const data of dummyCustomers) {
            const last10 = data.phoneNumber.replace(/\D/g, '').slice(-10);
            if (last10.length !== 10) {
                // This case should ideally not happen with dummy data, but good for robustness
                console.warn(`Skipping seeding for invalid phone number: ${data.phoneNumber}`);
                continue;
            }
            const normalizedPhone = `+91${last10}`;

            // 1. Find or Create Global Customer
            let customer = await Customer.findOne({ phoneNumber: normalizedPhone });
            if (!customer) {
                const score = data.trustScore || 600;
                customer = new Customer({
                    name: data.name,
                    phoneNumber: normalizedPhone,
                    trustScore: score,
                    khataScore: score,
                    khataLimit: score >= 800 ? 10000 : score >= 700 ? 6000 : score >= 600 ? 3000 : score >= 500 ? 1000 : 0
                });
                await customer.save();
            }

            // 2. Create Shop-Specific Account
            await CustomerAccount.findOneAndDelete({
                customerId: customer._id,
                shopkeeperId: req.auth?.userId
            });

            const account = new CustomerAccount({
                customerId: customer._id,
                shopkeeperId: req.auth?.userId,
                balance: data.khataBalance
            });
            await account.save();

            results.push({ ...customer.toObject(), khataBalance: account.balance });
        }

        res.status(201).json(results);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

export { router as customerRouter };
