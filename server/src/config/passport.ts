import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { starterProducts } from '../utils/starterProducts.js';
import dotenv from 'dotenv';

dotenv.config();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'placeholder',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'placeholder',
    callbackURL: "http://localhost:5001/api/auth/google/callback", // ABSOLUTE URL
    proxy: true
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails?.[0].value;
        if (!email) {
            return done(new Error("No email returned from Google"), undefined);
        }

        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
            // Check by email if user exists but hasn't linked Google
            user = await User.findOne({ email });

            if (user) {
                user.googleId = profile.id;
                await user.save();
            } else {
                // Allow sign up from Google
                user = await User.create({
                    googleId: profile.id,
                    name: profile.displayName,
                    email: email,
                    avatar: profile.photos?.[0].value
                });

                // Seed initial products for new Google user
                const initialProducts = starterProducts.map(p => ({
                    ...p,
                    shopkeeperId: user?._id
                }));
                await Product.insertMany(initialProducts);
            }
        }
        return done(null, user);
    } catch (err) {
        return done(err as Error, undefined);
    }
}));

passport.serializeUser((user: any, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});
