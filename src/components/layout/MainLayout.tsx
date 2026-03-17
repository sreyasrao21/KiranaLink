import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Outlet, NavLink } from 'react-router-dom';
import { Store, Users, Package, TrendingUp, CreditCard, Menu, X, Gift, BookOpen, LogOut, Phone, MessageCircle, Landmark } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

import { UserProfileModal } from '../UserProfileModal';

export const MainLayout: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showMenu, setShowMenu] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true');

    const { t, language, toggleLanguage } = useLanguage();


    const confirmLogout = () => {
        logout();
        navigate('/login');
    };

    useEffect(() => {
        localStorage.setItem('darkMode', darkMode.toString());
        document.documentElement.classList.toggle('dark', darkMode);
    }, [darkMode]);

    const navLinks = [
        { path: '/', label: t['Billing'], icon: Store },
        { path: '/products', label: t['Products'], icon: Package },
        { path: '/customers', label: t['Customers'], icon: Users },
        { path: '/recovery', label: t['Recovery Agent'], icon: Phone },
        { path: '/records', label: t['Records'], icon: BookOpen },
        { path: '/khata', label: t['Udhaar'], icon: CreditCard },
        { path: '/deals', label: t['Group Buy'], icon: Gift },
        { path: '/expiry', label: t['Expiry & Waste'], icon: Package },
        { path: '/analytics', label: t['Analytics'], icon: TrendingUp },
        { path: '/gst', label: t['GST & ITR'], icon: Landmark },
        { path: '/whatsapp', label: t['WhatsApp Desk'], icon: MessageCircle },
    ];

    return (
        <div className={`h-screen flex flex-col ${darkMode ? 'dark bg-[#0A0A0A] text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
            <div className="flex-1 flex flex-col relative overflow-hidden backdrop-blur-3xl">
                {/* Global Header */}
                <header className={`flex-none sticky top-0 z-40 w-full ${darkMode ? 'bg-[#0A0A0A]/80 border-white/5' : 'bg-white/80 border-gray-200'} backdrop-blur-md border-b px-4 py-3 flex justify-center`}>
                    <div className="w-full max-w-5xl flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowProfileModal(true)}
                                className="w-8 h-8 rounded-full border-2 border-primary-green/30 overflow-hidden flex items-center justify-center bg-primary-green text-white"
                            >
                                {user?.avatar ? (
                                    <img src={user.avatar} className="w-full h-full object-cover" alt="S" />
                                ) : (
                                    <span className="text-xs font-bold">{user?.name?.[0] || 'S'}</span>
                                )}
                            </button>
                            <span className="font-black tracking-tight">SDukaan</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={toggleLanguage}
                                className="p-2 rounded-xl border border-gray-100 dark:border-white/5 dark:text-gray-400"
                                title={t.toggleTitle}
                            >
                                <span className="text-xs font-bold uppercase">{language}</span>
                            </button>
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="p-2 rounded-xl bg-gray-50 dark:bg-white/5 dark:text-gray-400"
                            >
                                {showMenu ? <X size={24} /> : <Menu size={24} />}
                            </button>
                        </div>
                    </div>
                </header>

                <UserProfileModal
                    isOpen={showProfileModal}
                    onClose={() => setShowProfileModal(false)}
                    darkMode={darkMode}
                    setDarkMode={setDarkMode}
                />

                {/* Menu Modal */}
                <AnimatePresence>
                    {showMenu && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowMenu(false)}
                                className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: -20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                                transition={{ type: "spring", duration: 0.3 }}
                                className={`fixed z-[70] top-16 right-4 w-64 rounded-2xl shadow-2xl overflow-hidden border ${darkMode
                                    ? 'bg-gray-800/90 border-gray-700 text-gray-100'
                                    : 'bg-white/90 border-gray-200 text-gray-900'
                                    } backdrop-blur-md`}
                            >
                                <div className="p-4 border-b border-gray-200/10 flex justify-between items-center">
                                    <h3 className="font-semibold text-sm uppercase tracking-wider opacity-70">{t['Menu']}</h3>
                                    <button
                                        onClick={() => setShowMenu(false)}
                                        className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className="p-2 space-y-1 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                    {navLinks.slice(4).map((link) => {
                                        const Icon = link.icon;
                                        return (
                                            <NavLink
                                                key={link.path}
                                                to={link.path}
                                                onClick={() => setShowMenu(false)}
                                                className={({ isActive }) =>
                                                    `flex items-center gap-3 p-3 rounded-xl transition-all ${isActive
                                                        ? 'bg-primary-green text-white font-semibold shadow-md'
                                                        : darkMode
                                                            ? 'text-gray-300 hover:bg-gray-700/50 hover:pl-4'
                                                            : 'text-gray-700 hover:bg-gray-100 hover:pl-4'
                                                    }`
                                                }
                                            >
                                                <Icon size={18} />
                                                <span className="text-sm font-medium">{link.label}</span>
                                            </NavLink>
                                        );
                                    })}
                                    <button
                                        onClick={() => {
                                            setShowMenu(false);
                                            setShowLogoutConfirm(true);
                                        }}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${darkMode ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'
                                            }`}
                                    >
                                        <LogOut size={18} />
                                        <span className="text-sm font-bold">{t['Sign Out']}</span>
                                    </button>

                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                {/* Logout Confirmation */}
                <AnimatePresence>
                    {showLogoutConfirm && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowLogoutConfirm(false)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className={`relative w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl overflow-hidden border ${darkMode
                                    ? 'bg-gray-900 border-gray-700 text-gray-100'
                                    : 'bg-white border-gray-100 text-gray-900'
                                    }`}
                            >
                                <div className="text-center space-y-6">
                                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto text-red-600">
                                        <LogOut size={40} />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-black">{t['Ready to leave?']}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                                            {t['Log out from']} <span className="font-bold text-gray-900 dark:text-white">SDukaan</span>?
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        <button
                                            onClick={confirmLogout}
                                            className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-red-500/20 transition-all active:scale-[0.98]"
                                        >
                                            {t['Sign Out Now']}
                                        </button>
                                        <button
                                            onClick={() => setShowLogoutConfirm(false)}
                                            className="w-full bg-gray-100 dark:bg-gray-800 py-4 rounded-2xl font-bold text-gray-600 dark:text-gray-400 text-sm transition-all"
                                        >
                                            {t['Stay Logged In']}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Content Area */}
                <main className="flex-1 overflow-y-auto relative custom-scrollbar flex justify-center">
                    <div className="w-full max-w-5xl p-4 md:p-8 pb-32">
                        <Outlet />
                    </div>
                </main>

                {/* Global Bottom Navigation */}
                {!showMenu && (
                    <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 px-6">
                        <nav className={`w-full max-w-lg h-16 ${darkMode ? 'bg-[#111111]/80 border-white/10' : 'bg-white/80 border-gray-200'} backdrop-blur-xl border rounded-[2rem] flex justify-around items-center px-4 shadow-[0_20px_50px_rgba(0,0,0,0.2)]`}>
                            {navLinks.slice(0, 4).map((link) => {
                                const Icon = link.icon;
                                return (
                                    <NavLink
                                        key={link.path}
                                        to={link.path}
                                        className={({ isActive }) =>
                                            `relative flex flex-col items-center justify-center transition-all ${isActive
                                                ? 'text-primary-green'
                                                : 'text-gray-400'
                                            }`
                                        }
                                    >
                                        {({ isActive }) => (
                                            <>
                                                <Icon size={24} className={isActive ? 'scale-110 -translate-y-1' : ''} />
                                                {isActive && <div className="absolute -bottom-2 w-1 h-1 bg-primary-green rounded-full" />}
                                            </>
                                        )}
                                    </NavLink>
                                );
                            })}
                        </nav>
                    </div>
                )}
            </div>
        </div>
    );
};
