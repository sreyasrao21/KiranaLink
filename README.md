<div align="center">
  <img src="https://img.shields.io/badge/KiranaLink-AI%20Powered-orange?style=for-the-badge" alt="Kirana Link Logo" />
  <h1>Kirana Link: The AI Super-App for Local Retail 🏪</h1>
  <p>Empowering local Kirana store owners with AI Agentic Workflows, automated debt recovery, GST/ITR compliance, and smart inventory management.</p>
</div>

---

## 🚀 Overview

**Kirana Link** is an all-in-one smart management platform built to modernize traditional grocery (Kirana) stores in India. We tackle the biggest pain points of small retailers—manual ledger management, pending dues (Khata), unorganized inventory, and complex tax compliance—by injecting powerful **Gen-AI and Agentic workflows** into their daily operations.

## ✨ Unique Features

### 🎙️ 1. AI Voice Auto-Pilot (Smart Debt Recovery)
The crown jewel of Kirana Link. Recovering pending dues (Khata) is socially awkward and time-consuming for shopkeepers.
- **Autonomous AI Agent:** Sync overdue Khatas with one click. The AI agent automatically orchestrates a multi-tier recovery pipeline.
- **Smart WhatsApp Reminders:** Sends polite, localized reminders with deep-linked UPI payments.
- **Live AI Phone Calls:** If dues remain unpaid, our GPT-4o-mini powered voice agent actually **calls the customer**. It engages in a multi-turn, natural conversation, negotiates extensions, records payment promises, and handles disputes—just like a real Indian shopkeeper.
- **Instant Khata Sync:** When a customer pays, the ledger is automatically updated via backend webhooks.

### 📊 2. GST Compliance & ITR Assistance
Modernizing Kirana stores means bringing them into the formal economy.
- **Automated GST Classification:** Uses AI to automatically classify inventory items into correct GST slabs (5%, 12%, 18%, 28%) based on product names.
- **GST Invoicing & Ledger:** Generates GST-compliant invoices for sales and records input tax credit (ITC) for supplier purchases.
- **Monthly GST Summaries:** One-click generation of output vs. input GST reports for filing.
- **ITR Assistance Dashboard:** Provides a "ready-to-file" summary including Gross Revenue, Purchase Costs, Gross Profit, and Estimated Taxable Income to simplify Income Tax Return filing.

### 💳 3. Khata Score (Retail Credit Scoring)
- **Proprietary Credit Algorithm:** We introduced the **Khata Score** (300-900)—an alternative credit scoring system for individual customers based on repayment behavior.
- **Data-Driven Underwriting:** Shopkeepers can use this score to determine authorized credit limits (`Udhaar`) for customers, reducing bad debt risk.
- **Gamified Repayment:** Encourages healthy financial habits within the local community.

### 📦 4. Smart Inventory Management & OCR Billing
- **Supplier Bill OCR:** Simply upload a photo of a supplier invoice. Our AI (Tesseract.js + Fuzzy Matching) parses items, quantities, and prices, updating inventory in real-time.
- **Low Stock Alerts:** Dashboard warnings when inventory runs low based on predefined thresholds.
- **Quick Billing:** Add items to cart and generate instant PDF receipts with easy WhatsApp sharing.

### 💬 5. Multi-Lingual WhatsApp Business Bot
- **Conversational Commerce:** Customers can check their dues, ask about item availability, or place orders via WhatsApp.
- **Native Language Support:** Supports voice notes and text in multiple Indian languages with AI-powered intent detection.

---

## 🏗️ Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Framer Motion, Vite, IndexedDB (Dexie.js)
- **Backend:** Node.js, Express, TypeScript, MongoDB (Mongoose)
- **AI & Integrations:** 
  - **OpenAI (GPT-4o / GPT-4o-mini)** for intent classification, translation, and Voice Agent logic.
  - **Twilio API** for WhatsApp messaging and programmable Voice Calls (TwiML).
  - **Razorpay** for UPI payment link generation.
  - **Tesseract.js** for client-side OCR processing.

---

## 💡 How It Works (The Agentic Workflow)

1. **Detection:** Shopkeeper clicks "Sync Overdue Khata". The Agent scans for negative balances.
2. **Action Plan:** The Agent initiates contact via localized WhatsApp messages.
3. **Escalation:** For highly overdue accounts, the Twilio Voice Webhook triggers a live call.
4. **Negotiation:** GPT-4o-mini processes speech, determines intent (`PAYMENT_PROMISED`, `EXTENSION_REQUESTED`, `DISPUTE`), updates MongoDB, and responds in real-time.
5. **Resolution:** A post-call WhatsApp summary with a Razorpay UPI link is sent automatically.

---

## ⚙️ Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sreyasrao21/KiranaLink.git
   cd KiranaLink
   ```

2. **Install dependencies:**
   ```bash
   npm install
   npm install --prefix server
   ```

3. **Environment Variables:**
   Configure your `.env` file in the `server` directory using the provided `.env.example` as a template.

4. **Run the Application:**
   ```bash
   # Terminal 1: Frontend
   npm run dev

   # Terminal 2: Backend
   npm run dev --prefix server
   ```

---

<div align="center">
  <i>Built with ❤️ for the Hackathon. Empowering the unsung heroes of the Indian economy.</i>
</div>
