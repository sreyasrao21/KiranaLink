import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { GlobalProduct } from '../models/GlobalProduct.js';
import { starterProducts } from '../utils/starterProducts.js';
import { normalizeLanguage } from '../services/voiceLanguage.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'hackathon_secret_123';

// Manual Registration
router.post('/register', async (req, res) => {
    try {
        const { name, username, email, password, phoneNumber } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ message: 'Username or Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const normalizedPhone = phoneNumber ? (phoneNumber.startsWith('+91') ? phoneNumber : '+91' + phoneNumber.replace(/\D/g, '').slice(-10)) : undefined;
        const user = await User.create({
            name,
            username,
            email,
            password: hashedPassword,
            phoneNumber: normalizedPhone
        });

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

        // Seed initial products for the new shopkeeper
        let sourceProducts: any[] = await GlobalProduct.find().lean();

        if (sourceProducts.length === 0) {
            console.log('No GlobalProducts found in DB, falling back to starterProducts file');
            sourceProducts = starterProducts;
        }

        const initialProducts = sourceProducts.map(p => ({
            shopkeeperId: user._id,
            name: p.name,
            price: p.price,
            stock: p.stock,
            category: p.category,
            unit: p.unit,
            icon: p.icon
        }));

        await Product.insertMany(initialProducts);

        res.status(201).json({ token, user: { id: user._id, name: user.name, username: user.username, email: user.email } });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Manual Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user || !user.password) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, name: user.name, username: user.username, email: user.email } });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Google Auth start
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'
}));

// Google Auth callback
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5174'}/login?error=auth_failed`, session: false }),
    (req: any, res) => {
        // Successful authentication
        const token = jwt.sign({ userId: req.user._id }, JWT_SECRET, { expiresIn: '7d' });
        // Redirect to frontend with token in URL (simple for hackathons)
        // In production, use cookies or a secure way
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5174'}/auth-success?token=${token}`);
    }
);

// Get Current User Info
router.get('/me', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });

        const decoded: any = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        res.status(401).json({ message: 'Invalid token' });
    }
});

// Update Profile
router.patch('/profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });

        const decoded: any = jwt.verify(token, JWT_SECRET);
        const {
            name,
            avatar,
            defaultVoiceLanguage,
            fallbackVoiceLanguage,
            voiceLanguagePolicy,
            enableVoiceLanguageMenu,
            supportedVoiceLanguages,
        } = req.body;

        const patch: Record<string, unknown> = {};
        if (typeof name === 'string') patch.name = name;
        if (typeof avatar === 'string' || avatar === null) patch.avatar = avatar;

        if (defaultVoiceLanguage !== undefined) {
            patch.defaultVoiceLanguage = normalizeLanguage(String(defaultVoiceLanguage));
        }
        if (fallbackVoiceLanguage !== undefined) {
            patch.fallbackVoiceLanguage = normalizeLanguage(String(fallbackVoiceLanguage));
        }
        if (voiceLanguagePolicy !== undefined && ['manual', 'hybrid', 'auto'].includes(String(voiceLanguagePolicy))) {
            patch.voiceLanguagePolicy = voiceLanguagePolicy;
        }
        if (typeof enableVoiceLanguageMenu === 'boolean') {
            patch.enableVoiceLanguageMenu = enableVoiceLanguageMenu;
        }
        if (Array.isArray(supportedVoiceLanguages)) {
            const allowed = ['en', 'hi', 'te', 'ta', 'mr', 'bn', 'ur'];
            const normalized = supportedVoiceLanguages
                .map((lang) => normalizeLanguage(String(lang)))
                .filter((lang) => allowed.includes(lang));
            patch.supportedVoiceLanguages = Array.from(new Set(normalized.length ? normalized : ['en', 'hi', 'te']));
        }

        const updatedUser = await User.findByIdAndUpdate(
            decoded.userId,
            { $set: patch },
            { new: true }
        ).select('-password');

        res.json(updatedUser);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

// Delete Account
router.delete('/delete-account', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });

        const decoded: any = jwt.verify(token, JWT_SECRET);
        const { password } = req.body;

        const user = await User.findById(decoded.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // If user has a password (manual auth), verify it
        if (user.password) {
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ message: 'Invalid password' });
            }
        }

        // Delete user data (cascade manually if needed, for now just user)
        // Ideally we delete products, customers, bills etc. linked to this user
        // But for MVP just deleting user logic
        await Product.deleteMany({ shopkeeperId: user._id });
        // await Customer.deleteMany({ shopkeeperId: user._id }); // If strictly private
        await User.findByIdAndDelete(decoded.userId);

        res.json({ message: 'Account deleted successfully' });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

export { router as authRouter };
