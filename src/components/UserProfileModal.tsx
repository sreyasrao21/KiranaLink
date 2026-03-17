import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, LogOut, Check, Moon, Sun } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    darkMode: boolean;
    setDarkMode: (val: boolean) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, darkMode, setDarkMode }) => {
    const { user, token, logout, login } = useAuth();
    const { translate } = useLanguage();

    const [name, setName] = useState(user?.name || '');
    const [avatarUrl] = useState(user?.avatar || '');
    const [defaultVoiceLanguage, setDefaultVoiceLanguage] = useState(user?.defaultVoiceLanguage || 'en');
    const [fallbackVoiceLanguage, setFallbackVoiceLanguage] = useState(user?.fallbackVoiceLanguage || 'en');
    const [voiceLanguagePolicy, setVoiceLanguagePolicy] = useState<'manual' | 'hybrid' | 'auto'>((user?.voiceLanguagePolicy as any) || 'hybrid');
    const [enableVoiceLanguageMenu, setEnableVoiceLanguageMenu] = useState(Boolean(user?.enableVoiceLanguageMenu ?? true));
    const [loading, setLoading] = useState(false);

    const [showLocalLogoutConfirm, setShowLocalLogoutConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
    const [password, setPassword] = useState('');

    useEffect(() => {
        setName(user?.name || '');
        setDefaultVoiceLanguage(user?.defaultVoiceLanguage || 'en');
        setFallbackVoiceLanguage(user?.fallbackVoiceLanguage || 'en');
        setVoiceLanguagePolicy((user?.voiceLanguagePolicy as any) || 'hybrid');
        setEnableVoiceLanguageMenu(Boolean(user?.enableVoiceLanguageMenu ?? true));
    }, [user?.name, user?.defaultVoiceLanguage, user?.fallbackVoiceLanguage, user?.voiceLanguagePolicy, user?.enableVoiceLanguageMenu]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await axios.patch(
                `${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5001/api'}/auth/profile`,
                {
                    name,
                    avatar: avatarUrl,
                    defaultVoiceLanguage,
                    fallbackVoiceLanguage,
                    voiceLanguagePolicy,
                    enableVoiceLanguageMenu,
                    supportedVoiceLanguages: ['en', 'hi', 'te'],
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data) {
                login(token!, res.data);
            }
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        setLoading(true);
        try {
            await axios.delete(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5001/api'}/auth/delete-account`, {
                data: { password },
                headers: { Authorization: `Bearer ${token}` }
            });
            logout();
        } catch (err: any) {
            console.error(err);
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                        className="fixed z-[110] top-16 left-4 w-72 max-h-[85vh] overflow-y-auto rounded-3xl shadow-2xl border bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-900 dark:text-gray-100 scrollbar-hide"
                    >
                        {/* Header */}
                        <div className="p-5 border-b border-gray-100 dark:border-gray-700/50 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                            <div>
                                <h3 className="font-black text-sm uppercase tracking-widest text-gray-400">{translate('Settings')}</h3>
                                <p className="text-xs text-gray-500 font-medium">{translate('Manage your account')}</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
                            >
                                <X size={18} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-8">
                            <form onSubmit={handleUpdateProfile} className="space-y-6">
                                <div className="flex justify-center">
                                    <div className="relative group cursor-pointer">
                                        <div className="absolute inset-0 bg-primary-green/20 rounded-full blur-xl group-hover:bg-primary-green/30 transition-all" />
                                        {avatarUrl ? (
                                            <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full border-4 border-white dark:border-gray-700 shadow-xl object-cover relative z-10" />
                                        ) : (
                                            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-primary-green to-emerald-400 flex items-center justify-center text-white text-3xl font-black border-4 border-white dark:border-gray-700 shadow-xl relative z-10">
                                                {name?.[0]?.toUpperCase() || 'U'}
                                            </div>
                                        )}
                                        <div className="absolute bottom-0 right-0 bg-white dark:bg-gray-700 p-1.5 rounded-full shadow-lg border border-gray-100 dark:border-gray-600 z-20">
                                            <Camera size={14} className="text-primary-green" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-primary-green ml-1">{translate('Display Name')}</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-green outline-none transition-all text-sm font-bold shadow-sm"
                                            placeholder="Your Name"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black transition-all flex items-center justify-center gap-2 text-xs shadow-xl hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                                >
                                    <Check size={16} />
                                    {loading ? translate('SAVING...') : translate('SAVE CHANGES')}
                                </button>
                            </form>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-primary-green ml-1">Legacy Agent Language</label>
                                <div className="grid grid-cols-1 gap-2">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Default Language</label>
                                        <select
                                            value={defaultVoiceLanguage}
                                            onChange={(e) => setDefaultVoiceLanguage(e.target.value)}
                                            className="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none text-sm font-bold"
                                        >
                                            <option value="en">English</option>
                                            <option value="hi">Hindi</option>
                                            <option value="te">Telugu</option>
                                            <option value="ta">Tamil</option>
                                            <option value="mr">Marathi</option>
                                            <option value="bn">Bengali</option>
                                            <option value="ur">Urdu</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Fallback Language</label>
                                        <select
                                            value={fallbackVoiceLanguage}
                                            onChange={(e) => setFallbackVoiceLanguage(e.target.value)}
                                            className="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none text-sm font-bold"
                                        >
                                            <option value="en">English</option>
                                            <option value="hi">Hindi</option>
                                            <option value="te">Telugu</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Language Policy</label>
                                        <select
                                            value={voiceLanguagePolicy}
                                            onChange={(e) => setVoiceLanguagePolicy(e.target.value as 'manual' | 'hybrid' | 'auto')}
                                            className="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none text-sm font-bold"
                                        >
                                            <option value="manual">Manual</option>
                                            <option value="hybrid">Hybrid</option>
                                            <option value="auto">Auto Detect</option>
                                        </select>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setEnableVoiceLanguageMenu((prev) => !prev)}
                                        className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
                                    >
                                        <span className="text-sm font-bold">Enable first-call language menu</span>
                                        <span className={`text-xs font-black px-2 py-1 rounded-full ${enableVoiceLanguageMenu ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                            {enableVoiceLanguageMenu ? 'ON' : 'OFF'}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-primary-green ml-1">{translate('Interface Mode')}</label>
                                <button
                                    type="button"
                                    onClick={() => setDarkMode(!darkMode)}
                                    className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-white/5 transition-all active:scale-[0.98]"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary-green/10 flex items-center justify-center text-primary-green">
                                            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                                        </div>
                                        <span className="font-bold text-sm tracking-tight">{darkMode ? translate('Light Mode') : translate('Dark Mode')}</span>
                                    </div>
                                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${darkMode ? 'bg-primary-green shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-gray-200 dark:bg-gray-700'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 ${darkMode ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </div>
                                </button>
                            </div>

                            <div className="h-px bg-gradient-to-r from-transparent via-gray-100 dark:via-gray-700 to-transparent" />

                            <div className="space-y-3">


                                {!showDeleteConfirm && !showPasswordConfirm && (
                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="w-full text-red-500/50 text-[10px] font-black uppercase tracking-widest hover:text-red-500 transition-colors pt-2"
                                    >
                                        {translate('Delete My Account')}
                                    </button>
                                )}
                            </div>

                            {showDeleteConfirm && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-red-50 dark:bg-red-900/10 p-5 rounded-2xl border border-red-100 dark:border-red-900/20"
                                >
                                    <p className="text-xs font-black text-red-600 mb-4 text-center">{translate('DELETE PERMANENTLY?')}</p>
                                    <div className="flex gap-2">
                                        <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 bg-white dark:bg-gray-800 rounded-xl text-xs font-black shadow-sm">{translate('CANCEL')}</button>
                                        <button onClick={() => { setShowDeleteConfirm(false); setShowPasswordConfirm(true); }} className="flex-1 py-3 bg-red-600 text-white rounded-xl text-xs font-black shadow-lg">{translate('PROCEED')}</button>
                                    </div>
                                </motion.div>
                            )}

                            {showPasswordConfirm && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-3"
                                >
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">{translate('Security Check')}</p>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full p-4 border border-red-100 dark:border-red-900/30 bg-white dark:bg-gray-900 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none text-sm font-bold shadow-inner"
                                        placeholder={translate('Enter Password')}
                                    />
                                    <button
                                        onClick={handleDeleteAccount}
                                        disabled={loading || !password}
                                        className="w-full py-4 bg-red-600 text-white rounded-2xl text-xs font-black shadow-xl hover:bg-red-700 active:scale-95 disabled:opacity-50"
                                    >
                                        {loading ? translate('WAIT...') : translate('CONFIRM DELETE')}
                                    </button>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>

                    {/* Local Logout Confirmation Dialog */}
                    <AnimatePresence>
                        {showLocalLogoutConfirm && (
                            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setShowLocalLogoutConfirm(false)}
                                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                />
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                    className="relative w-full max-w-xs rounded-[2rem] p-8 shadow-2xl overflow-hidden border bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800"
                                >
                                    <div className="text-center space-y-6">
                                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto text-red-600">
                                            <LogOut size={32} />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-xl font-black text-gray-900 dark:text-white">{translate('Sign Out?')}</h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                                                {translate('Are you sure you want to log out?')}
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            <button
                                                onClick={() => {
                                                    logout();
                                                    window.location.href = '/login';
                                                }}
                                                className="w-full bg-red-600 text-white py-3.5 rounded-xl font-black text-xs shadow-lg shadow-red-500/20 transition-all active:scale-[0.98]"
                                            >
                                                {translate('LOG OUT')}
                                            </button>
                                            <button
                                                onClick={() => setShowLocalLogoutConfirm(false)}
                                                className="w-full bg-gray-100 dark:bg-gray-800 py-3.5 rounded-xl font-bold text-gray-600 dark:text-gray-400 text-xs transition-all"
                                            >
                                                {translate('CANCEL')}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </AnimatePresence>
    );
};
