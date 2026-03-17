import express from 'express';
import { GroupBuy } from '../models/GroupBuy.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const { latitude, longitude, radius = 5 } = req.query;

        let query: any = {};

        // If location provided, filter by proximity using MongoDB geospatial query
        if (latitude && longitude) {
            const lat = parseFloat(latitude as string);
            const lon = parseFloat(longitude as string);
            const maxDistance = parseFloat(radius as string) * 1000; // Convert km to meters

            query.location = {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [lon, lat] // [longitude, latitude]
                    },
                    $maxDistance: maxDistance
                }
            };
        }

        const deals = await GroupBuy.find(query)
            .populate('products.productId')
            .populate('shopkeeperId', 'name shopName');

        res.json(deals);
    } catch (err: any) {
        console.error('Get deals error:', err);
        res.status(500).json({ message: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        console.log("Creating deal with body:", JSON.stringify(req.body, null, 2));
        const { latitude, longitude, location, ...dealData } = req.body;

        // Construct Location (GeoJSON) - Handle both new (GeoJSON) and old (lat/lng) formats
        if (location && location.coordinates) {
            // Validate coordinates
            if (Array.isArray(location.coordinates) && location.coordinates.length === 2) {
                dealData.location = location;
            } else {
                console.warn("Invalid location coordinates received:", location);
            }
        } else if (latitude && longitude) {
            dealData.location = {
                type: 'Point',
                coordinates: [parseFloat(longitude), parseFloat(latitude)]
            };
        }

        // Optionally get host shop name from user
        if (dealData.shopkeeperId) {
            try {
                const User = (await import('../models/User.js')).User;
                const user = await User.findById(dealData.shopkeeperId);
                dealData.hostShopName = user?.shopName || user?.name;
            } catch (e) {
                console.warn('Could not fetch host shop name:', e);
            }
        }

        const deal = new GroupBuy(dealData);
        const newDeal = await deal.save();
        res.status(201).json(newDeal);
    } catch (err: any) {
        console.error('Create deal error:', err);
        res.status(400).json({ message: err.message, details: err.errors });
    }
});

router.patch('/:id/join', async (req, res) => {
    try {
        const { customerId, units = 1 } = req.body;

        if (!customerId) {
            return res.status(400).json({ message: 'customerId is required' });
        }

        const deal = await GroupBuy.findByIdAndUpdate(
            req.params.id,
            {
                $addToSet: { members: customerId },
                $inc: { currentUnits: Number(units) }
            },
            { new: true }
        ).populate('products.productId');

        if (!deal) return res.status(404).json({ message: 'Deal not found' });

        res.json(deal);
    } catch (err: any) {
        console.error("Join Deal Error:", err);
        res.status(400).json({ message: err.message });
    }
});

export { router as groupBuyRouter };
