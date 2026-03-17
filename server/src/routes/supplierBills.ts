import express from 'express';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { SupplierBill } from '../models/SupplierBill.js';
import { auth } from '../middleware/auth.js';
import * as fuzzball from 'fuzzball';
import { GSTInvoice } from '../models/GSTInvoice.js';
import { GSTLedger } from '../models/GSTLedger.js';
import { calculateInvoice, RawItem } from '../services/gstCalculator.js';
import { classifyProduct } from '../services/gstClassification.js';
import { addStockBatch } from '../services/inventoryBatches.js';

const router = express.Router();

interface LineItem {
    productName: string;
    quantity: number;
    unit: string;
    totalAmount: number;
    customSellingPrice?: number;  // Custom selling price per unit
    expiryDate?: string;
    batchCode?: string;
    mfgDate?: string;
}

// Get Bill History
router.get('/', auth, async (req, res) => {
    try {
        const bills = await SupplierBill.find({ shopkeeperId: req.auth?.userId })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(bills);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

// Process Supplier Bill
router.post('/process', auth, async (req, res) => {
    const { lineItems } = req.body;
    const userId = req.auth?.userId;

    if (!lineItems || !Array.isArray(lineItems)) {
        return res.status(400).json({ message: 'Invalid line items' });
    }

        const results: any[] = [];
        const resolvedProductIds = new Map<string, string>();
    const billItems: any[] = [];
    let billTotal = 0;

    try {
        // Fetch all products for fuzzy matching
        const allProducts = await Product.find({ shopkeeperId: userId });
        const productNames = allProducts.map(p => p.name);

        for (const item of lineItems) {
            const { productName, quantity, totalAmount, customSellingPrice } = item;
            const costParam = quantity > 0 ? totalAmount / quantity : 0;
            const costPrice = Math.round(costParam); // Round to whole number as requested

            billTotal += totalAmount || 0;
            const sellingPrice = customSellingPrice || Math.round(costPrice * 1.05);

            billItems.push({
                productName,
                quantity,
                unit: item.unit || 'unit',
                totalAmount,
                costPrice,
                sellingPrice
            });

            // Fuzzy Match
            const match = fuzzball.extract(productName, productNames, { limit: 1, scorer: fuzzball.token_set_ratio });

            let action = 'ignored';
            let matchedProduct = null;
            let priceUpdate = null;

            if (match && match.length > 0 && match[0][1] > 80) {
                // High confidence match
                const matchedName = match[0][0];
                matchedProduct = allProducts.find(p => p.name === matchedName);

                if (matchedProduct) {
                    action = 'updated';
                    matchedProduct.costPrice = costPrice;

                    if (customSellingPrice) {
                        const oldPrice = matchedProduct.price;
                        matchedProduct.price = customSellingPrice;
                        if (oldPrice !== customSellingPrice) {
                            priceUpdate = { old: oldPrice, new: customSellingPrice };
                        }
                    }
                    await matchedProduct.save();
                }
            } else {
                // No match, create new product
                action = 'created';

                const newProduct = new Product({
                    shopkeeperId: userId,
                    name: productName,
                    price: sellingPrice,
                    costPrice: costPrice,
                    stock: quantity,
                    unit: item.unit || 'unit',
                    category: 'Uncategorized', // Default
                    icon: '📦'
                });

                await newProduct.save();
                matchedProduct = newProduct;
                allProducts.push(newProduct);
                productNames.push(newProduct.name);
            }

            if (matchedProduct) {
                resolvedProductIds.set(productName, String(matchedProduct._id));
                await addStockBatch(String(userId), {
                    productId: String(matchedProduct._id),
                    quantity,
                    costPricePerUnit: costPrice,
                    sellingPriceSnapshot: customSellingPrice || Number(matchedProduct.price || 0),
                    expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
                    mfgDate: item.mfgDate ? new Date(item.mfgDate) : undefined,
                    batchCode: item.batchCode,
                    source: 'supplier_bill',
                });
            }

            results.push({
                input: item,
                match: matchedProduct ? matchedProduct.name : null,
                score: match && match.length > 0 ? match[0][1] : 0,
                action,
                costPrice,
                sellingPrice: matchedProduct?.price,
                priceUpdate
            });
        }

        // Save Bill History
        const newBill = new SupplierBill({
            shopkeeperId: userId,
            items: billItems,
            totalAmount: billTotal,
            itemCount: billItems.length,
            date: new Date()
        });
        await newBill.save();

        // ── RECORD GST INPUT ──
        const gstRawItems: RawItem[] = await Promise.all(billItems.map(async (item) => {
            const classification = await classifyProduct(item.productName);
            return {
                productId: resolvedProductIds.get(item.productName) || new mongoose.Types.ObjectId().toString(),
                name: item.productName,
                hsnCode: classification.hsnCode,
                gstRate: classification.gstRate,
                quantity: item.quantity,
                unitPrice: item.costPrice,
                priceIncludesGST: true
            };
        }));

        const gstTotals = calculateInvoice(gstRawItems);
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const gstInvoice = new GSTInvoice({
            shopkeeperId: userId,
            ...gstTotals,
            invoiceType: 'purchase',
            month,
            year
        });
        await gstInvoice.save();

        const gstLedger = new GSTLedger({
            shopkeeperId: userId,
            type: 'input',
            gstInvoiceId: gstInvoice._id,
            referenceId: newBill._id,
            referenceType: 'SupplierBill',
            ...gstTotals,
            month,
            year
        });
        await gstLedger.save();

        res.json({ success: true, results, billId: newBill._id });

    } catch (err: any) {
        console.error('Supplier bill processing failed:', err);
        res.status(500).json({ message: err.message });
    }
});

export { router as supplierBillsRouter };
