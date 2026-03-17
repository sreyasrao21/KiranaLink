import { getTwilioGatherLanguage, VoiceLang } from './voiceLanguage.js';

function sanitizeForTwiml(text: string): string {
    return (text || '')
        .replace(/&/g, ' and ')
        .replace(/</g, '')
        .replace(/>/g, '')
        .replace(/₹/g, 'rupees ')
        .replace(/"/g, '')
        .replace(/\n/g, '. ')
        .replace(/\r/g, '')
        .trim() || 'Thank you. Goodbye.';
}

function voiceForLanguage(lang: VoiceLang): string {
    const explicit = process.env[`TWILIO_VOICE_${lang.toUpperCase()}` as keyof NodeJS.ProcessEnv];
    if (explicit) return explicit;
    
    // Use Google Neural voices for better quality (costs more but sounds much better)
    const GOOGLE_NEURAL_VOICES: Record<VoiceLang, string> = {
        en: 'Google.en-IN-Neural2-A',
        hi: 'Google.hi-IN-Neural2-A',
        te: 'Google.te-IN-Neural2-A',
        ta: 'Google.ta-IN-Neural2-A',
        mr: 'Google.mr-IN-Neural2-A',
        bn: 'Google.bn-IN-Neural2-A',
        ur: 'Google.ur-IN-Neural2-A',
        mixed: 'Google.en-IN-Neural2-A',
    };
    
    return GOOGLE_NEURAL_VOICES[lang] || 'Google.en-IN-Neural2-A';
}

export function buildGatherTwimlLocalized(args: {
    text: string;
    backendUrl: string;
    callCount?: number;
    lang: VoiceLang;
    withDtmfFallback?: boolean;
}): string {
    const safe = sanitizeForTwiml(args.text);
    const nextCount = (args.callCount || 0) + 1;
    const twilioLang = getTwilioGatherLanguage(args.lang);
    const voice = voiceForLanguage(args.lang);
    const inputMode = args.withDtmfFallback ? 'speech dtmf' : 'speech';
    // Enhanced settings for better Indian language recognition
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Gather input="${inputMode}" action="${args.backendUrl}/api/invoices/webhook/voice?CallCount=${nextCount}" method="POST" timeout="8" speechTimeout="auto" language="${twilioLang}" enhanced="true" speechModel="phone_call" hints="payment,rupees,date,tomorrow,today,week,month,yes,no,confirm" numDigits="1"><Say voice="${voice}" language="${twilioLang}">${safe}</Say></Gather><Say voice="${voice}" language="${twilioLang}">Sorry, I did not hear. Please call us back. Thank you.</Say></Response>`;
}

export function buildRecordFollowupTwimlLocalized(args: {
    text: string;
    backendUrl: string;
    lang: VoiceLang;
}): string {
    const safe = sanitizeForTwiml(args.text);
    const twilioLang = getTwilioGatherLanguage(args.lang);
    const voice = voiceForLanguage(args.lang);
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="${voice}" language="${twilioLang}">${safe}</Say><Record action="${args.backendUrl}/api/invoices/webhook/voice-recording" method="POST" maxLength="30" playBeep="true" timeout="6" trim="trim-silence" /><Say voice="${voice}" language="${twilioLang}">Could not hear you. We will call again. Thank you.</Say><Hangup/></Response>`;
}

export function buildHangupTwimlLocalized(text: string, lang: VoiceLang): string {
    const safe = sanitizeForTwiml(text);
    const twilioLang = getTwilioGatherLanguage(lang);
    const voice = voiceForLanguage(lang);
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="${voice}" language="${twilioLang}">${safe}</Say><Hangup/></Response>`;
}

export function buildErrorTwimlLocalized(lang: VoiceLang): string {
    const twilioLang = getTwilioGatherLanguage(lang);
    const voice = voiceForLanguage(lang);
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="${voice}" language="${twilioLang}">Sorry, there was a connection issue. We will call you back. Goodbye.</Say><Hangup/></Response>`;
}
