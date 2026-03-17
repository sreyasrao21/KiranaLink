import React from 'react';
import { PhoneOutgoing } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

const DefaulterCard = React.memo(({ customer, onRecover }: { customer: any, onRecover: (customer: any) => void }) => {
    const { t } = useLanguage();
    return (
        <div className="bg-white dark:bg-[#111111] p-5 rounded-[1.5rem] border border-gray-100 dark:border-white/5 shadow-sm flex items-center justify-between hover:border-primary-green/30 transition-all hover:bg-gray-50 dark:hover:bg-white/[0.02] group relative overflow-hidden h-24">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-green/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-primary-green/10 transition-colors"></div>

            <div className="flex items-center gap-4 relative z-10 flex-1">
                {/* Left: Avatar */}
                <div className="w-14 h-14 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-full flex items-center justify-center font-black text-xl border border-gray-200 dark:border-white/10 shrink-0">
                    {customer.name[0]}
                </div>

                {/* Middle: Name, Amount, Risk */}
                <div className="flex flex-col min-w-0">
                    <h3 className="font-black text-gray-900 dark:text-white text-base truncate tracking-tight mb-0.5">
                        {customer.name}
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="text-primary-green font-black text-sm font-mono">
                            ₹{customer.amount.toLocaleString()}
                        </span>
                        <div className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${customer.risk === 'HIGH' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                            customer.risk === 'MEDIUM' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                                'bg-green-500/10 text-green-500 border-green-500/20'
                            }`}>
                            {t[customer.risk] || customer.risk}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right: Action Button */}
            <div className="relative z-10 ml-4">
                <button
                    onClick={() => onRecover(customer)}
                    className="h-10 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 bg-primary-green text-white shadow-lg shadow-primary-green/20 hover:bg-green-600"
                >
                    <PhoneOutgoing size={14} />
                    {t['RECOVER']}
                </button>
            </div>
        </div>
    );
});

export default DefaulterCard;
