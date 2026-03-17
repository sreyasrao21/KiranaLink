import { VoiceLang } from './voiceLanguage.js';

type PromptKey =
    | 'opening'
    | 'noSpeechRetry'
    | 'noSpeechFinal'
    | 'askPartialNow'
    | 'askPartialAmount'
    | 'askRemainingDate'
    | 'confirmPlanFull'
    | 'confirmPlanPartial'
    | 'askDateExample'
    | 'unableToUnderstand'
    | 'manualCallback'
    | 'systemError'
    | 'noInvoice'
    | 'recordingMissing'
    | 'recordingFetchFailed'
    | 'transcriptionFailed'
    | 'closurePromised'
    | 'closurePartial'
    | 'closureDispute';

function fmtAmountTe(amount: number): string {
    const num = Math.max(0, Math.round(amount));
    return `${num}`;
}

function fmtAmountHi(amount: number): string {
    const num = Math.max(0, Math.round(amount));
    return `${num}`;
}

export function formatDateForVoice(date: Date, lang: VoiceLang): string {
    if (lang === 'hi') {
        return date.toLocaleDateString('hi-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    if (lang === 'te') {
        return date.toLocaleDateString('te-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const PROMPTS: Record<VoiceLang, Record<PromptKey, (ctx?: Record<string, unknown>) => string>> = {
    en: {
        opening: () => 'Hello. This is Smart Dukkan calling. When can you pay your pending amount?',
        noSpeechRetry: () => 'We could not hear you. Please tell your payment plan after the beep.',
        noSpeechFinal: () => 'We could not hear your response. We will call again later. Goodbye.',
        askPartialNow: (ctx) => `Can you pay at least ${fmtAmountTe(Number(ctx?.minimumPartial || 0))} rupees today?`,
        askPartialAmount: (ctx) => `How much can you pay now? Minimum is ${fmtAmountTe(Number(ctx?.minimumPartial || 0))} rupees.`,
        askRemainingDate: (ctx) => `By when will you pay ${fmtAmountTe(Number(ctx?.remainingAmount || 0))} rupees?`,
        confirmPlanFull: (ctx) => `Confirm: pay ${fmtAmountTe(Number(ctx?.remainingAmount || 0))} rupees by ${String(ctx?.promisedDateText || '')}. Yes or no?`,
        confirmPlanPartial: (ctx) => `Confirm: pay ${fmtAmountTe(Number(ctx?.partialAmount || 0))} now, ${fmtAmountTe(Number(ctx?.remainingAmount || 0))} rupees by ${String(ctx?.promisedDateText || '')}. Yes or no?`,
        askDateExample: (ctx) => `Tell the date to pay ${fmtAmountTe(Number(ctx?.remainingAmount || 0))} rupees. Like tomorrow or in 3 days.`,
        unableToUnderstand: () => 'We could not understand. We will call again tomorrow. Goodbye.',
        manualCallback: () => 'Connecting you to the shopkeeper. Thank you.',
        systemError: () => 'Sorry, connection issue. We will call back. Goodbye.',
        noInvoice: () => 'You have no pending amount. Goodbye.',
        recordingMissing: () => 'Could not record. We will call again. Goodbye.',
        recordingFetchFailed: () => 'Processing failed. We will call again. Goodbye.',
        transcriptionFailed: () => 'Could not understand. We will call again. Goodbye.',
        closurePromised: (ctx) => `Thank you. Payment noted for ${String(ctx?.promisedDateText || 'this date')}. Goodbye.`,
        closurePartial: (ctx) => `Thank you. You will pay ${fmtAmountTe(Number(ctx?.partialAmount || 0))} now, ${fmtAmountTe(Number(ctx?.remainingAmount || 0))} rupees by ${String(ctx?.promisedDateText || '')}. Goodbye.`,
        closureDispute: () => 'Understood. We will review. Thank you. Goodbye.',
    },
    hi: {
        opening: () => 'नमस्ते। स्मार्ट दुकान से कॉल आया है। आपका बकाया है। कब देंगे?',
        noSpeechRetry: () => 'सुन नहीं आया। कृपया बताइए।',
        noSpeechFinal: () => 'सुन नहीं आया। बाद में कॉल करेंगे। धन्यवाद।',
        askPartialNow: (ctx) => `क्या आज ${fmtAmountHi(Number(ctx?.minimumPartial || 0))} रुपये दे सकते हैं?`,
        askPartialAmount: (ctx) => `कितना दे सकते हैं? न्यूनतम ${fmtAmountHi(Number(ctx?.minimumPartial || 0))} रुपये।`,
        askRemainingDate: (ctx) => `${fmtAmountHi(Number(ctx?.remainingAmount || 0))} रुपये कब देंगे?`,
        confirmPlanFull: (ctx) => `पुष्टि: ${fmtAmountHi(Number(ctx?.remainingAmount || 0))} रुपये ${String(ctx?.promisedDateText || '')} तक। ठीक है?`,
        confirmPlanPartial: (ctx) => `पुष्टि: ${fmtAmountHi(Number(ctx?.partialAmount || 0))} रुपये अभी, ${fmtAmountHi(Number(ctx?.remainingAmount || 0))} रुपये ${String(ctx?.promisedDateText || '')} तक। ठीक है?`,
        askDateExample: (ctx) => `${fmtAmountHi(Number(ctx?.remainingAmount || 0))} रुपये कब देंगे? कल या तीन दिन में?`,
        unableToUnderstand: () => 'समझ नहीं आया। कल कॉल करेंगे। धन्यवाद।',
        manualCallback: () => 'केस दुकानदार को जाएगा। धन्यवाद।',
        systemError: () => 'कनेक्शन में दिक्कत है। बाद में कॉल करेंगे।',
        noInvoice: () => 'कोई बकाया नहीं है। धन्यवाद।',
        recordingMissing: () => 'रिकॉर्डिंग नहीं मिली। बाद में कॉल करेंगे।',
        recordingFetchFailed: () => 'प्रोसेस फेल। बाद में कॉल करेंगे।',
        transcriptionFailed: () => 'समझ नहीं आया। बाद में कॉल करेंगे।',
        closurePromised: (ctx) => `धन्यवाद। ${String(ctx?.promisedDateText || 'तारीख')} तक नोट किया।`,
        closurePartial: (ctx) => `धन्यवाद। प्लान: ${fmtAmountHi(Number(ctx?.partialAmount || 0))} अभी, ${fmtAmountHi(Number(ctx?.remainingAmount || 0))} रुपये ${String(ctx?.promisedDateText || '')} तक।`,
        closureDispute: () => 'समझ गया। केस रिव्यू में जाएगा। धन्यवाद।',
    },
    te: {
        opening: () => 'నమస్కరం. ఈ Smart Dukkan నుండి కాల్ వచ్చింది. మీకు బాకి ఉంది. ఎప్పుడు చెల్లిస్తారు?',
        noSpeechRetry: () => 'తెలియలేదు. చెప్పండి.',
        noSpeechFinal: () => 'తెలియలేదు. మళ్ళी కాల్‌చేస్తాము. బాయ్.',
        askPartialNow: (ctx) => `ఈరోజు ${fmtAmountTe(Number(ctx?.minimumPartial || 0))} rupees చెల్లిస్తారా?`,
        askPartialAmount: (ctx) => `ఎంత చెల్లిస్తారు? least ${fmtAmountTe(Number(ctx?.minimumPartial || 0))} rupees.`,
        askRemainingDate: (ctx) => `${fmtAmountTe(Number(ctx?.remainingAmount || 0))} rupees ఎప్పుడు చెల్లిస్తారు?`,
        confirmPlanFull: (ctx) => `Confirm: ${fmtAmountTe(Number(ctx?.remainingAmount || 0))} rupees ${String(ctx?.promisedDateText || '')} by. Accha?`,
        confirmPlanPartial: (ctx) => `Confirm: ${fmtAmountTe(Number(ctx?.partialAmount || 0))} rupees now, ${fmtAmountTe(Number(ctx?.remainingAmount || 0))} rupees ${String(ctx?.promisedDateText || '')} by. Accha?`,
        askDateExample: (ctx) => `${fmtAmountTe(Number(ctx?.remainingAmount || 0))} rupees ఎప్పుడు? Neeokati leda 3 roju lo?`,
        unableToUnderstand: () => 'అర్థం కాదు. Repu malli call chesthamu. Bai.',
        manualCallback: () => 'Case shopkeeper ki velthundi. Dhanyavaadalu.',
        systemError: () => 'Connection problem. Malli call chesthamu.',
        noInvoice: () => 'Baaki ledu.',
        recordingMissing: () => 'Recording kanabadaledu. Malli call chesthamu.',
        recordingFetchFailed: () => 'Process ayipoyindi. Malli call chesthamu.',
        transcriptionFailed: () => 'Maata artham kanabadaledu. Repu malli call chesthamu.',
        closurePromised: (ctx) => `Dhanyavaadalu. ${String(ctx?.promisedDateText || '')} ki baaki note chesam.`,
        closurePartial: (ctx) => `Dhanyavaadalu. ${fmtAmountTe(Number(ctx?.partialAmount || 0))} now, ${fmtAmountTe(Number(ctx?.remainingAmount || 0))} ${String(ctx?.promisedDateText || '')} ki.`,
        closureDispute: () => 'Artham. Case manual review ki pampam.',
    },
    ta: {} as Record<PromptKey, (ctx?: Record<string, unknown>) => string>,
    mr: {} as Record<PromptKey, (ctx?: Record<string, unknown>) => string>,
    bn: {} as Record<PromptKey, (ctx?: Record<string, unknown>) => string>,
    ur: {} as Record<PromptKey, (ctx?: Record<string, unknown>) => string>,
    mixed: {} as Record<PromptKey, (ctx?: Record<string, unknown>) => string>,
};

for (const fallbackLang of ['ta', 'mr', 'bn', 'ur', 'mixed'] as VoiceLang[]) {
    PROMPTS[fallbackLang] = PROMPTS.en;
}

export function getVoicePrompt(lang: VoiceLang, key: PromptKey, context?: Record<string, unknown>): string {
    const table = PROMPTS[lang] || PROMPTS.en;
    const fn = table[key] || PROMPTS.en[key];
    return fn(context);
}
