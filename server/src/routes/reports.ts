import express from 'express';
import { auth } from '../middleware/auth.js';
import { getGSTSummary, getITRSummary } from '../services/gstReports.js';

const router = express.Router();

// FEATURE 4: MONTHLY GST SUMMARY
// GET /api/reports/gst-summary?month=&year=
router.get('/gst-summary', auth, async (req, res) => {
    try {
        const month = Number(req.query.month) || new Date().getMonth() + 1;
        const year = Number(req.query.year) || new Date().getFullYear();

        if (month < 1 || month > 12) {
            return res.status(400).json({ message: 'Month must be between 1 and 12' });
        }

        const summary = await getGSTSummary(req.auth!.userId, month, year);
        res.json(summary);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

// FEATURE 5: ITR ASSISTANCE SUMMARY
// GET /api/reports/itr-summary?month=&year=
router.get('/itr-summary', auth, async (req, res) => {
    try {
        const month = Number(req.query.month) || new Date().getMonth() + 1;
        const year = Number(req.query.year) || new Date().getFullYear();

        if (month < 1 || month > 12) {
            return res.status(400).json({ message: 'Month must be between 1 and 12' });
        }

        const summary = await getITRSummary(req.auth!.userId, month, year);
        res.json(summary);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

export { router as reportsRouter };
