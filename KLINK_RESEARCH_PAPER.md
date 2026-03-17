# RESEARCH PAPER: Kirana Link - AI-Driven Micro-Credit Recovery & Retail Automation in Semi-Urban Markets

**Authors:** Team Kirana Link  
**Keywords:** Conversational AI, Micro-Finance, Alternative Credit Scoring, Optical Character Recognition, Large Language Models (LLMs), Event-Driven Architecture.

---

## 1. ABSTRACT
In emerging economies, the informal retail sector (Kirana stores) serves as the backbone of daily commerce. A critical component of this ecosystem is *Udhaar* (informal micro-credit), which fosters customer loyalty but creates severe liquidity bottlenecks for shopkeepers due to manual, inefficient debt recovery processes. Furthermore, these transactions are entirely undocumented by traditional credit bureaus, leaving millions of individuals "credit invisible."

**Kirana Link** proposes a comprehensive, autonomous software architecture to digitize this sector. Kirana Link introduces an Event-Driven, LLM-powered Voice Agent to automate conversational debt recovery over public telephone networks (PSTN), eliminating the friction of human-to-human collections. Additionally, the system computes a proprietary **"Global Khata Score"**—an alternative credit algorithm based on behavioral transaction consistency. Finally, Kirana Link utilizes edge-computed Optical Character Recognition (OCR) to democratize inventory digitization for shopkeepers.

## 2. INTRODUCTION
Traditional Point-of-Sale (POS) systems are designed for formal retail, ignoring the unique socio-economic realities of semi-urban and rural markets where internet connectivity is intermittent, and relationships are driven by trust rather than credit cards. 

The primary research objectives of Kirana Link are:
1.  **Automated Empathy in Debt Collection:** Can a Large Language Model (LLM) effectively negotiate micro-debt over a phone call, classifying intents (e.g., Disputes, Extensions) without human intervention?
2.  **Shadow Credit Scoring:** Can we mathematically map informal repayment behavior into a standardized credit score (300-900) to allow data-driven underwriting?
3.  **Bypassing Data Entry Friction:** Can client-side OCR pipelines eliminate the manual labor of inventory management?

---

## 3. ARCHITECTURAL METHODOLOGY & SYSTEM DESIGN

Kirana Link utilizes a **Microservice-Oriented Event Architecture** to ensure high availability and offline resilience. 

### 3.1. Dual-Persistence & "Offline-First" Edge Computing
Internet penetration in rural India is unreliable. Kirana Link solves the "offline problem" by implementing a dual-persistence strategy. 
*   **Client-Side (Edge):** The React frontend utilizes IndexedDB (`Dexie.js`) to store transaction ledgers and shopping carts. 
*   **Server-Side (Cloud):** A Node.js (Express) Gateway queues transactions and synchronizes asynchronously with a highly available MongoDB Atlas cluster when internet connectivity is restored.

### 3.2. Visual AI & Edge-Based Stock Digitization
To lower the barrier to entry, Kirana Link allows shopkeepers to digitize supplier bills by taking a photograph. 
*   **Pipeline:** Instead of uploading heavy images to a centralized server, Kirana Link processes images natively within the browser using `Tesseract.js` (WebAssembly-compiled OCR).
*   **Heuristic Extraction & Fuzzy Matching:** The parsed raw text is evaluated using Regular Expressions to identify quantities and prices. A probabilistic fuzzy-string matching algorithm (`fuzzball`) compares extracted product names against the shop's existing MongoDB inventory dictionary. Matches exceeding an 80% confidence threshold trigger an autonomous database `$inc` (increment) operation, while completely novel items trigger document creation.

---

## 4. THE CONVERSATIONAL DEBT RECOVERY PIPELINE

The core innovation of Kirana Link is the removal of the shopkeeper from the debt-collection process, replacing them with a highly contextual AI agent.

### 4.1. The Telephony Webhook Loop
When a shopkeeper initiates the "Sync Khata" routine, the backend queries MongoDB for defaulters (`balance > 0`). 
1.  **Outbound Dispatch:** The system triggers the Twilio REST API to initialize an outbound PSTN (Public Switched Telephone Network) call. 
2.  **Acoustic Transcription:** When the customer answers, Twilio utilizes a `<Gather>` Extensible Markup Language (TwiML) verb to stream the customer's raw speech back to the Kirana Link server as a stateless, asynchronous webhook.
3.  **Intent Classification (GPT-4o-mini):** The Kirana Link Express API routes the transcribed text payload, along with the specific customer's *Conversation History Array*, to the OpenAI API.
4.  **Dynamic Response Generation:** The LLM is instructed via a strict System Prompt to classify the intent (`PAYMENT_PROMISED`, `DISPUTE`, or `EXTENSION_REQUESTED`). It simultaneously generates a culturally empathetic response (e.g., *"Okay, I will give you 3 more days."*).
5.  **State Mutation:** The API Gateway intercepts the LLM's classification, mutates the `Invoice` Document status in MongoDB, and returns the generated dialogue as XML to Twilio to be synthesized back into speech for the customer.

This loop repeats dynamically, creating a seamless human-computer interaction (HCI) until a resolution is reached.

---

## 5. ALTERNATIVE CREDIT: THE GLOBAL KHATA SCORE 

Kirana Link pioneers an alternative credit scoring mechanism for the "unbanked" demographic. The algorithm evaluates informal behavioral data to generate a score ranging from 300 (High Risk) to 900 (Excellent).

### 5.1. Algorithmic Variables
The algorithm dynamically assigns weighted value to four primary vectors:
*   **Payment Timeliness (PTS - 35%):** Measures the delta between the stipulated due date and the actual settlement date recorded in the Ledger.
*   **Repayment Consistency (CS - 30%):** Evaluates the variance in repayment speeds over the lifetime of the customer account, rewarding habitual punctuality.
*   **Outstanding Risk (ORS - 20%):** A ratio comparing the customer's active unpaid balance against their historical maximum cleared balance. High current debt relative to historical capacity lowers this metric.
*   **Recency of Activity (RS - 15%):** A decay function that lowers the score if the customer has not interacted with the ecosystem within the last 60 days.

### 5.2. Autonomous Financial Fulfillment
Upon successful intent classification of `PAYMENT_PROMISED` by the Voice Agent, Kirana Link dispatches a targeted Razorpay UPI deep-link via the Twilio WhatsApp API. When the asynchronous Razorpay webhook confirms settlement, the Node.js API auto-deducts the Khata payload and instantly re-calculates the Global Khata Score, dynamically adjusting the customer's authorized `khataLimit`.

---

## 6. CONCLUSION & FUTURE SCOPE
Kirana Link successfully demonstrates that high-friction, informal economic sectors can be digitized without requiring high digital literacy from the end-user. By combining Edge computing (Offline POS, Client-side OCR) with Cloud AI (LLM-driven Telephony), Kirana Link transforms the Kirana store from a chaotic ledger into a data-driven micro-bank.

**Future Scope:** 
The aggregated behavioral data comprising the Global Khata Score holds immense value. In the future, this dataset could be exposed via secure APIs to formal banking institutions (NBFCs), allowing them to underwrite legitimate MSME (Micro, Small & Medium Enterprises) business loans to shopkeepers based on the provable reliability of their local customer base.
