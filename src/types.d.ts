export { };

declare global {
    interface Window {
        webkitSpeechRecognition: any;
        SpeechRecognition: any;
        Razorpay: any; // Loaded via CDN checkout.js
    }
}
