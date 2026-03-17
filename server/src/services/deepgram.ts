const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';

export async function transcribeAudioWithDeepgram(args: {
    audioBuffer: Buffer;
    mimeType?: string;
    language?: string;
}): Promise<string | null> {
    const { audioBuffer, mimeType = 'audio/mpeg', language = 'multi' } = args;

    if (!DEEPGRAM_API_KEY) {
        console.warn('[Deepgram] Missing DEEPGRAM_API_KEY');
        return null;
    }

    try {
        const response = await fetch(
            `https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&language=${encodeURIComponent(language)}`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Token ${DEEPGRAM_API_KEY}`,
                    'Content-Type': mimeType,
                },
                body: new Uint8Array(audioBuffer),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Deepgram] Transcription request failed:', errorText);
            return null;
        }

        const data = await response.json() as any;
        const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
        if (!transcript || typeof transcript !== 'string') {
            return null;
        }

        return transcript.trim() || null;
    } catch (error) {
        console.error('[Deepgram] Transcription error:', error);
        return null;
    }
}
