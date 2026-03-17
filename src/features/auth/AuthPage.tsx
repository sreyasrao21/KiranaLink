import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Phone, ArrowRight } from 'lucide-react';
import { authApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';

import logo from '../../assets/logo.jpg';

export default function AuthPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [formData, setFormData] = useState({
        name: '',
        username: '',
        email: '',
        password: '',
        phoneNumber: ''
    });

    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('error') === 'auth_failed') {
            addToast("This Google account is not registered. Please sign up manually first.", "error");
        }
    }, [addToast]);

    const handleManualAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = isLogin
                ? await authApi.login({ username: formData.username, password: formData.password })
                : await authApi.register(formData);

            login(response.data.token, response.data.user);
            addToast(`Welcome back, ${response.data.user.name}!`, "success");
            navigate('/');
        } catch (err: any) {
            addToast(err.response?.data?.message || "Authentication failed", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        window.location.href = `${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5001/api'}/auth/google`;
    };

    return (
        <div className="min-h-screen bg-[#F3F4F6] dark:bg-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-green/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl p-8 relative z-10 border border-gray-100 dark:border-gray-700"
            >
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center overflow-hidden mx-auto mb-4 shadow-xl border border-gray-100">
                        <img src={logo} alt="SDukaan Logo" className="w-full h-full object-cover" />
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                        {isLogin ? 'Welcome Back Shopkeeper' : 'Join as a Shop Owner'}
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Manage your Smart Dukaan with ease</p>
                </div>

                {/* Authentication Tabs */}
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-2xl mb-8">
                    <button
                        onClick={() => setIsLogin(true)}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${isLogin ? 'bg-white dark:bg-gray-600 text-black dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                        Login
                    </button>
                    <button
                        onClick={() => setIsLogin(false)}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${!isLogin ? 'bg-white dark:bg-gray-600 text-black dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                        Register
                    </button>
                </div>

                <form onSubmit={handleManualAuth} className="space-y-4">
                    <AnimatePresence mode='wait'>
                        {!isLogin && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-4"
                            >
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-300" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Full Name"
                                        required
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-300" size={18} />
                                    <input
                                        type="email"
                                        placeholder="Email Address"
                                        required
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-300" size={18} />
                                    <input
                                        type="tel"
                                        placeholder="Phone Number"
                                        required
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none"
                                        value={formData.phoneNumber}
                                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-300" size={18} />
                        <input
                            type="text"
                            placeholder="Username"
                            required
                            className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        />
                    </div>

                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-300" size={18} />
                        <input
                            type="password"
                            placeholder="Password"
                            required
                            className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-2xl transition-all active:scale-95 disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : (isLogin ? 'Login Now' : 'Create Account')}
                        <ArrowRight size={18} />
                    </button>
                </form>

                <div className="my-8 flex items-center gap-4 text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest">
                    <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
                    <span>OR CONTINUE WITH</span>
                    <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
                </div>

                <button
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 py-4 rounded-2xl font-bold text-sm text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-all shadow-sm"
                >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                    Sign in with Google
                </button>

                <p className="mt-8 text-center text-xs text-gray-500 dark:text-gray-400 font-medium">
                    By continuing, you agree to SDukaan's <span className="text-black dark:text-white font-bold underline cursor-pointer">Terms of Service</span>
                </p>
            </motion.div>
        </div>
    );
}
