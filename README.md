<div align="center">
  <img src="https://img.shields.io/badge/SDukaan-AI%20Powered-orange?style=for-the-badge" alt="SDukaan Logo" />
  <h1>Smart Dukaan: The AI Super-App for Local Retail 🏪</h1>
  <p>Empowering local Smart Dukaan owners with AI Agentic Workflows, automated debt recovery, and smart inventory management.</p>
</div>

---

## 🚀 Overview

**Smart Dukaan** is an all-in-one smart management platform built to modernize traditional grocery stores in India. We tackle the biggest pain points of small retailers—such as manual ledger management, pending dues (Khata), and unorganized inventory—by injecting powerful **Gen-AI and Agentic workflows** into their daily operations.

## ✨ Unique Features

### 🎙️ 1. AI Voice Auto-Pilot (Smart Debt Recovery)
The crown jewel of Smart Dukaan. Recovering pending dues (Khata) is socially awkward and time-consuming for shopkeepers.
- **Autonomous AI Agent:** Sync overdue Khatas with one click. The AI agent automatically orchestrates a multi-tier recovery pipeline.
- **Smart WhatsApp Reminders:** Sends polite, localized reminders with deep-linked UPI payments.
- **Live AI Phone Calls:** If dues remain unpaid, our GPT-4o-mini powered voice agent actually **calls the customer**. It engages in a multi-turn, natural conversation, negotiates extensions, records payment promises, and handles disputes—just like a real Indian shopkeeper.
- **Instant Khata Sync:** When a customer pays, the ledger is automatically updated via the backend webhook.

### 💳 2. Khata Score (Retail Credit Scoring)
- We introduced the **Khata Score**—a proprietary credit scoring system for individual customers.
- Customers earn a higher Khata Score by repaying their debts on time, which shopkeepers can use to determine who deserves credit (Udhaar) and who doesn't.
- Gamifies the repayment process, encouraging healthy financial habits in the local community.

### 📦 3. Smart Inventory Management & OCR Billing
- **Supplier Bill OCR:** Simply upload a photo of a supplier invoice. Our AI automatically parses the items, quantities, and prices, and updates the shop's inventory in real-time.
- **Low Stock Alerts:** Dashboard warnings when inventory runs low.
- **Quick Billing:** Add items to cart and generate instant PDF receipts for customers with easy share options.

### 💬 4. WhatsApp Business Bot
- Customers can interact with the store directly via a WhatsApp chat interface.
- Includes AI-powered language detection, allowing customers to send voice notes or text in their native language to check their dues or ask questions.

---

## 🏗️ Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Framer Motion, Vite
- **Backend:** Node.js, Express, TypeScript
- **Database:** MongoDB (Mongoose)
- **AI & Integrations:** 
  - **OpenAI (GPT-4o / GPT-4o-mini)** for intent classification and Voice Agent conversations.
  - **Twilio API** for WhatsApp messaging and programmable Voice Calls (TwiML).
  - **Razorpay** for UPI payment links.

---

## 💡 How It Works (The Agentic Workflow)

1. Shopkeeper clicks **"Sync Overdue Khata"** on the dashboard.
2. The AI Agent scans the database for customers with negative balances.
3. The Agent creates an action plan and initiates contact (WhatsApp first).
4. For highly overdue accounts, the Twilio Voice Webhook triggers a live call to the client.
5. The customer speaks into the phone. GPT-4o-mini processes the speech, determines intent (`PAYMENT_PROMISED`, `EXTENSION_REQUESTED`, `DISPUTE`), updates the MongoDB state, and speaks back in real-time.
6. A post-call WhatsApp summary with a UPI link is sent automatically.

---

## ⚙️ Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd Smart-Dukaan
   ```

2. **Install dependencies:**
   ```bash
   npm install
   cd server && npm install
   ```

3. **Environment Variables:**
   Create a `.env` file in the `server` directory with your Twilio, MongoDB, and OpenAI keys.

4. **Run the Application:**
   ```bash
   # Terminal 1: Frontend
   npm run dev

   # Terminal 2: Backend
   cd server
   npm run dev
   ```

---

<div align="center">
  <i>Built with ❤️ for the Hackathon. Empowering the unsung heroes of the Indian economy.</i>
</div>
