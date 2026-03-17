import dotenv from 'dotenv'; // trigger restart
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import passport from 'passport';
import { createServer } from 'http';
import { Server } from 'socket.io';
import './config/passport.js';
import { authRouter } from './routes/auth.js';
import { productRouter } from './routes/products.js';
import { customerRouter } from './routes/customers.js';
import { billRouter } from './routes/bills.js';
import { ledgerRouter } from './routes/ledger.js';
import { groupBuyRouter } from './routes/groupBuy.js';
import { whatsappRouter } from './routes/whatsapp.js';
import analyticsRouter from './routes/analytics.js';
import { supplierBillsRouter } from './routes/supplierBills.js';
import { aiRouter } from './routes/ai.js';
import { invoiceRouter } from './routes/invoices.js';
import { invoiceWebhooksRouter } from './routes/invoiceWebhooks.js';
import { gstRouter } from './routes/gst.js';
import { reportsRouter } from './routes/reports.js';
import { expiryRouter } from './routes/expiry.js';
import { wasteRouter } from './routes/waste.js';
import { discountRouter } from './routes/discounts.js';
import { startExpiryScheduler } from './jobs/expiryScheduler.js';


const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Attach socket to request
app.use((req: any, res, next) => {
    req.io = io;
    next();
});

app.use((req, _res, next) => {
    if (req.path.startsWith('/api/whatsapp')) {
        console.log(`[WA DEBUG] ${req.method} ${req.path}`);
    }
    next();
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/products', productRouter);
app.use('/api/customers', customerRouter);
app.use('/api/bills', billRouter);
app.use('/api/ledger', ledgerRouter);
app.use('/api/group-buy', groupBuyRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/supplier-bills', supplierBillsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/invoices', invoiceRouter);
app.use('/api/invoices/webhook', invoiceWebhooksRouter);
app.use('/api/gst', gstRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/expiry', expiryRouter);
app.use('/api/waste', wasteRouter);
app.use('/api/discounts', discountRouter);

io.on('connection', (socket) => {
    console.log('User connected to socket:', socket.id);
});

// Database Connection
mongoose.connect(process.env.MONGODB_URI!)
    .then(() => {
        console.log('Connected to MongoDB Atlas');

        // Start background tasks
        startExpiryScheduler();

        httpServer.listen(Number(PORT), '0.0.0.0', () => {
            console.log(`Server (ShopOS) is running on port ${PORT} [pid=${process.pid}]`);
        });
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
    });

