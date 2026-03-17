import { useEffect, useState } from 'react';
import { MessageSquare, Bell, Zap, ShoppingBag, CreditCard, Activity } from 'lucide-react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://127.0.0.1:5001';

interface WhatsappEvent {
    type: string;
    data: any;
    timestamp: string;
}

export default function WhatsAppLiveFeed() {
    const [events, setEvents] = useState<WhatsappEvent[]>([]);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        const socket = io(SOCKET_URL);
        socket.on('connect', () => {
            console.log("Connected to WhatsApp Socket");
            // Add a welcome system event
            setEvents([{ type: 'SYSTEM', data: { customer: 'System', item: 'Connected to ShopOS Network' }, timestamp: new Date().toISOString() }]);
        });

        socket.on('whatsapp-event', (event: WhatsappEvent) => {
            setEvents(prev => [event, ...prev.slice(0, 15)]);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    async function sendBulkReminder() {
        setSending(true);
        try {
            const response = await fetch(`${SOCKET_URL}/api/whatsapp/broadcast-reminders`, { method: 'POST' });
            const data = await response.json();

            if (data.count === 0 && data.errors?.length === 0) {
                // Mock simulation for demo if env missing
                setTimeout(() => {
                    setEvents(prev => [{ type: 'SYSTEM', data: { customer: 'System', item: 'Sending Simulated Reminders...' }, timestamp: new Date().toISOString() }, ...prev]);
                    alert("⚠️ Simulation Mode: No Messages Sent (Check Server Console).");
                }, 500);
            } else if (data.errors?.length > 0) {
                alert(`❌ Error: Failed to send ${data.errors.length} messages.`);
            } else {
                alert(`🚀 Reminders queued for ${data.count} customers!`);
            }
        } catch (e) {
            console.error(e);
            alert('Failed to connect to backend service.');
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="max-w-xl mx-auto md:max-w-4xl font-sans">

            {/* 1. STATUS CARD (Mobile Friendly) */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden mb-6 border border-gray-100 dark:border-gray-700">
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white relative overflow-hidden">
                    <div className="relative z-10 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-2xl flex items-center gap-2">
                                <MessageSquare className="h-6 w-6" /> Reminders
                            </h3>
                            <p className="text-green-100 text-sm mt-1 opacity-90">Live WhatsApp Intelligence Feed</p>
                        </div>
                    </div>
                </div>

                {/* ACTION BAR */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={sendBulkReminder}
                        disabled={sending}
                        className="w-full bg-gray-900 hover:bg-black dark:bg-white dark:text-black dark:hover:bg-gray-200 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                    >
                        {sending ? <Activity className="animate-spin h-4 w-4" /> : <Bell className="h-4 w-4" />}
                        {sending ? 'Processing...' : 'Send Due Reminders'}
                    </button>
                </div>

                {/* FEED AREA */}
                <div className="h-[450px] overflow-y-auto px-4 py-4 space-y-3 bg-gray-50/50 dark:bg-gray-900 scroll-smooth">
                    {events.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                            <MessageSquare className="h-12 w-12 mb-3 text-gray-300" />
                            <p className="text-sm font-medium">Waiting for incoming messages...</p>
                        </div>
                    ) : (
                        events.map((e, i) => (
                            <div key={i} className="group flex items-start gap-3 p-4 bg-white dark:bg-gray-800 hover:shadow-md transition-all rounded-2xl border border-gray-100 dark:border-gray-700 animate-in slide-in-from-bottom-2 fade-in duration-300">
                                {/* ICON INDICATOR */}
                                <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white shadow-sm mt-1
                                    ${e.type === 'NEW_ORDER' ? 'bg-blue-500' :
                                        e.type === 'PAYMENT_RECEIVED' ? 'bg-emerald-500' :
                                            e.type === 'SYSTEM' ? 'bg-gray-500' : 'bg-indigo-500'}`}>
                                    {e.type === 'NEW_ORDER' && <ShoppingBag size={18} />}
                                    {e.type === 'PAYMENT_RECEIVED' && <CreditCard size={18} />}
                                    {e.type === 'SYSTEM' && <Activity size={18} />}
                                </div>

                                {/* CONTENT */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-0.5">
                                        <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate">
                                            {e.data.customer || 'ShopOS System'}
                                        </h4>
                                        <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap ml-2">
                                            {new Date(e.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-snug">
                                        {e.data.item ? (
                                            <>
                                                <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mr-1">{e.type.replace('_', ' ')}:</span>
                                                {e.data.item}
                                            </>
                                        ) : (
                                            <>{e.data.message || `Received ₹${e.data.amount || 0}`}</>
                                        )}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* FOOTER */}
                <div className="bg-white dark:bg-gray-800 p-3 text-center border-t border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] text-gray-400 font-medium flex items-center justify-center gap-1">
                        <Zap size={10} className="fill-current" />
                        Powered by ShopOS AI Agent
                    </p>
                </div>
            </div>
        </div>
    );
}
