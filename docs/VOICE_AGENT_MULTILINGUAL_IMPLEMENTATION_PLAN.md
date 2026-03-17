# Smart Dukkan Voice Agent Multilingual Implementation Plan

Status: Planning baseline (build-ready)
Owner: Voice Recovery Team
Last Updated: 2026-03-12

## 1) Goal

Build a robust multilingual debt-recovery voice agent for kirana/MSME collections that:

- speaks in the customer's preferred language,
- understands code-mixed speech (for example Hinglish),
- extracts intent, amount, and promised date reliably,
- updates DB state safely,
- and sends language-matched follow-ups.

This plan is designed for current stack constraints:

- OpenAI model: `gpt-4o-mini` (available)
- Twilio, Deepgram, WhatsApp: free trial limits

## 2) Current State Audit

### What already works

- Recording-first call flow with Deepgram transcription and negotiation state machine.
- Voice session persistence (`VoiceCallSession`) and recovery-state UI.
- Intent/date extraction with fallback logic.

### Current multilingual gaps

- TwiML speech output is hardcoded to English in multiple builders.
- Negotiation prompts are English-only strings.
- No explicit language field in voice call session.
- No confidence-gated language fallback branch.

### Key code locations

- `server/src/routes/invoiceWebhooks.ts`
- `server/src/services/deepgram.ts`
- `server/src/services/intentClassifier.ts`
- `server/src/services/communicationService.ts`
- `server/src/models/VoiceCallSession.ts`
- `server/src/models/Customer.ts`
- `server/src/routes/invoices.ts`

## 3) External Capability Notes (Research)

1. Twilio `<Say>` supports language and configurable provider voices, including mapping by locale.
   - https://www.twilio.com/docs/voice/twiml/say/text-speech
2. Twilio `<Gather>` supports language selection and specific STT speech models.
   - https://www.twilio.com/docs/voice/twiml/gather
3. Deepgram Nova-3 supports `language=multi` and many Indian languages including Hindi/Telugu/Tamil/Marathi/Bengali/Urdu.
   - https://developers.deepgram.com/docs/models-languages-overview
4. OpenAI STT/TTS support multilingual usage; `gpt-4o-mini` is suitable for multilingual extraction and normalization.
   - https://platform.openai.com/docs/guides/speech-to-text
   - https://platform.openai.com/docs/guides/text-to-speech

## 4) Product Scope

### In scope (phaseable)

- Language detection and persistence per customer/session
- Localized call prompts for negotiation stages
- Multilingual extraction (intent/amount/date)
- Confidence-aware retry and fallback
- Language-matched WhatsApp post-call summary
- Recovery-state response includes language metadata

### Out of scope (later)

- Full real-time streaming voice agent migration
- Human-like voice cloning
- Region-specific dialect fine-tuning by district

## 5) Language Strategy

### Launch languages

P1:

- `en-IN`
- `hi-IN`
- `te-IN`

P2:

- `ta-IN`, `mr-IN`, `bn-IN`, `ur-IN`

### Canonical language keys

- `en`, `hi`, `te`, `ta`, `mr`, `bn`, `ur`, `mixed`

### Mapping tables

Maintain centralized mappings:

- `appLang -> twilioSayLang`
- `appLang -> twilioGatherLang`
- `appLang -> deepgramLang`
- `appLang -> promptLocale`

Default fallback chain:

`session.detectedLanguage` -> `customer.preferredVoiceLanguage` -> `customer.preferredLanguage` -> `en`

## 6) Architecture Changes

### 6.1 New/updated services

1. `server/src/services/voiceLanguage.ts` (new)
   - `detectLanguageFromTranscript(text): { lang, confidence, isCodeMixed }`
   - two-pass detection:
     - heuristic scripts/keywords
     - OpenAI `gpt-4o-mini` structured classification fallback

2. `server/src/services/voicePrompts.ts` (new)
   - stage-wise templates for all supported languages
   - helpers for currency/date phrase rendering
   - ultra-short, call-safe phrasing

3. `server/src/services/voiceTwiML.ts` (new)
   - `buildRecordFollowupTwimlLocalized(...)`
   - `buildHangupTwimlLocalized(...)`
   - `buildErrorTwimlLocalized(...)`
   - all with language + voice parameters

### 6.2 Model changes

#### `VoiceCallSession`

Add fields:

- `detectedLanguage: string` default `en`
- `languageConfidence: number` default `0`
- `isCodeMixed: boolean` default `false`
- `fallbackMode: 'none' | 'simple_prompt' | 'dtmf' | 'manual_callback'`

#### `Customer`

Add fields:

- `preferredVoiceLanguage: string` default `en`
- `voiceLanguageUpdatedAt: Date`

### 6.3 Route flow updates

#### `invoiceWebhooks.ts`

At first successful transcript turn:

1. detect language
2. persist language in session/customer
3. switch next prompt builder to localized templates

On each turn:

1. localize prompt generation by stage
2. call extraction with language-aware prompt
3. confidence gate
4. fallback branch if needed

Finalization:

- localized closure sentence
- localized WhatsApp settlement summary

#### `communicationService.ts`

- pass language-aware TwiML when initiating call
- avoid hardcoded `en-IN` in `<Say>` messages

#### `invoices.ts` recovery-state

- include language fields in response for UI and analytics

## 7) Negotiation Prompt/Extraction Design

### Extraction contract (strict JSON)

```
{
  "intent": "PAYMENT_PROMISED|EXTENSION_REQUESTED|DISPUTE|PARTIAL_PAYMENT|REFUSAL|UNKNOWN",
  "confidence": 0.0,
  "promisedDateISO": null,
  "partialAmountNow": null,
  "wantsPartialPlan": null,
  "customerConfirmed": false,
  "language": "hi",
  "isCodeMixed": true
}
```

### Language-aware extraction rules

- Accept Arabic numerals and spoken forms in Romanized text.
- Parse relative date phrases across launch languages.
- Normalize to canonical date and amount.
- Never update invoice with low-confidence unresolved date without confirmation loop.

### Prompt policy

- Keep prompts <= 2 lines of speech.
- Keep one question per turn.
- Always repeat amount/date in confirmation turn.

## 8) Reliability & Fallback Tree

### Confidence thresholds

- `languageConfidence < 0.60` -> ask language confirmation prompt
- `intentConfidence < 0.65` -> simplified re-ask in detected language
- `intentConfidence < 0.50` twice -> DTMF fallback

### DTMF fallback example

- Press 1: pay full today
- Press 2: partial today
- Press 3: need extension
- Press 4: dispute

Then capture date with short follow-up question.

### End-of-flow safety

- If unresolved after max turns: mark `manual_callback_required` and schedule retry.

## 9) Trial-Limit Aware Design

Because APIs are on trial:

- enforce short call scripts and max turns
- store transcripts and session outputs for replay demos
- add `SIMULATE_VOICE_AGENT=true` fallback mode for stage demos
- keep one golden demo number and stable language test scripts

## 10) Security/Compliance Baseline

- No raw API keys in logs.
- Mask phone numbers in analytics logs (`last4` display in UI).
- Keep transcript retention configurable (`VOICE_TRANSCRIPT_RETENTION_DAYS`).
- Mark AI-generated voice disclosure in product/legal copy.

## 11) Implementation Phases

### Phase A (Foundation) - 1 day

- Add language fields to models
- Add language detection service
- Add mapping constants and defaults
- Expose language in recovery-state API

Acceptance:

- session + customer language saved for new calls
- no regression in current English flow

### Phase B (Localized Prompt Runtime) - 1 day

- Introduce localized prompt catalog
- Replace hardcoded English prompt strings in stage machine
- Build language-aware TwiML builders

Acceptance:

- call prompt language follows session language
- proper fallback to English when unsupported

### Phase C (Extraction Hardening) - 1 day

- Upgrade extraction prompt to include code-mixed handling
- add language-specific fallback regex dictionaries
- date/amount canonicalization tests

Acceptance:

- Hindi/Telugu code-mix samples parse correctly
- low-confidence path triggers re-ask, not blind update

### Phase D (Fallback + Ops) - 1 day

- confidence gate + DTMF fallback branch
- manual callback status + retry schedule
- localized WhatsApp settlement summaries

Acceptance:

- unresolved low-confidence calls handled safely
- post-call message language matched

### Phase E (QA + Demo Hardening) - 1 day

- run multilingual test matrix
- tune prompts and confidence thresholds
- prepare demo scripts

Acceptance:

- 3-language happy path passes
- logs and UI show language + extracted outcomes

## 12) Test Matrix (must-pass)

### Language tests

- pure English
- pure Hindi
- pure Telugu
- Hinglish
- Telugu + English numerals

### Intent tests

- full payment promise
- partial now + remaining date
- extension only
- dispute
- refusal

### Date tests

- today/tomorrow
- kal ambiguity resolution
- next weekday
- after N days

### Failure tests

- no speech
- noisy speech
- low-confidence transcript
- missing API keys fallback behavior

## 13) KPI Targets

- Language detection accuracy >= 90% (sample QA set)
- Promise-date extraction success >= 85%
- Partial amount extraction success >= 85%
- Call completion without manual callback >= 70% initial target
- Incorrect commitment writes <= 2%

## 14) File-Level Change Checklist

### Add

- `server/src/services/voiceLanguage.ts`
- `server/src/services/voicePrompts.ts`
- `server/src/services/voiceTwiML.ts`

### Update

- `server/src/models/VoiceCallSession.ts`
- `server/src/models/Customer.ts`
- `server/src/routes/invoiceWebhooks.ts`
- `server/src/services/communicationService.ts`
- `server/src/routes/invoices.ts`
- `src/components/recovery/LiveCallModal.tsx`
- `src/services/api.ts` (language metadata typing)

## 15) Demo Script (Jury-facing)

1. Trigger call in Hindi customer profile.
2. Customer replies in Hinglish partial-payment phrase.
3. Agent continues in Hindi, captures partial amount + date.
4. Show DB/session state: language, extracted fields, confidence.
5. Show localized WhatsApp summary.
6. Repeat with Telugu profile for multilingual proof.

## 16) Go/No-Go Checklist Before Rollout

- [ ] No hardcoded `en-IN` prompts remain in recovery path.
- [ ] Confidence fallback tested on noisy input.
- [ ] Language metadata visible in recovery-state UI.
- [ ] Trial quota monitoring in place.
- [ ] Demo script succeeds 3 times consecutively.
