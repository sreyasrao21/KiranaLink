import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type'], duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: Toast['type'] = 'info', duration = 1500) => {
      const id = Math.random().toString(36).substr(2, 9);
      setToasts(prev => [...prev, { id, message, type, duration }]);
      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

// ─── Per-toast config ────────────────────────────────────────────────────────

// Brand palette: primary-green=#2E7D32, danger-red=#C62828, warning-orange=#EF6C00
const CONFIG = {
  success: {
    icon: CheckCircle2,
    // forest green — matches primary-green exactly
    gradientStyle: { background: 'linear-gradient(135deg, rgba(46,125,50,0.22) 0%, rgba(27,94,32,0.10) 100%)' },
    borderStyle: { borderColor: 'rgba(46,125,50,0.40)' },
    iconBgStyle: { background: 'rgba(46,125,50,0.25)' },
    iconColor: 'text-green-400',
    barStyle: { background: '#4CAF50', boxShadow: '0 0 8px #4CAF50' },
    titleColor: 'text-green-400',
    label: 'Success',
  },
  error: {
    icon: XCircle,
    // brand danger-red=#C62828
    gradientStyle: { background: 'linear-gradient(135deg, rgba(198,40,40,0.22) 0%, rgba(183,28,28,0.10) 100%)' },
    borderStyle: { borderColor: 'rgba(198,40,40,0.40)' },
    iconBgStyle: { background: 'rgba(198,40,40,0.25)' },
    iconColor: 'text-red-400',
    barStyle: { background: '#EF5350', boxShadow: '0 0 8px #EF5350' },
    titleColor: 'text-red-400',
    label: 'Error',
  },
  warning: {
    icon: AlertTriangle,
    // brand warning-orange=#EF6C00
    gradientStyle: { background: 'linear-gradient(135deg, rgba(239,108,0,0.22) 0%, rgba(230,81,0,0.10) 100%)' },
    borderStyle: { borderColor: 'rgba(239,108,0,0.40)' },
    iconBgStyle: { background: 'rgba(239,108,0,0.25)' },
    iconColor: 'text-orange-400',
    barStyle: { background: '#FF8F00', boxShadow: '0 0 8px #FF8F00' },
    titleColor: 'text-orange-400',
    label: 'Warning',
  },
  info: {
    icon: Info,
    // neutral forest-teal — stays in the green family
    gradientStyle: { background: 'linear-gradient(135deg, rgba(46,125,50,0.14) 0%, rgba(21,101,192,0.08) 100%)' },
    borderStyle: { borderColor: 'rgba(46,125,50,0.28)' },
    iconBgStyle: { background: 'rgba(46,125,50,0.18)' },
    iconColor: 'text-green-300',
    barStyle: { background: '#66BB6A', boxShadow: '0 0 8px #66BB6A' },
    titleColor: 'text-green-300',
    label: 'Info',
  },
} as const;

// ─── Single Toast Card ────────────────────────────────────────────────────────

const ToastCard: React.FC<{ toast: Toast; onRemove: () => void }> = ({ toast, onRemove }) => {
  const cfg = CONFIG[toast.type];
  const IconComp = cfg.icon;
  const duration = toast.duration ?? 3500;

  // track visible state for exit animation
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // mount → slide in
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // shrinking progress bar
  useEffect(() => {
    if (duration <= 0) return;
    startRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - (startRef.current ?? Date.now());
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining > 0) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [duration]);

  const handleRemove = () => {
    setVisible(false);
    setTimeout(onRemove, 300); // wait for exit animation
  };

  return (
    <div
      style={{
        transform: visible ? 'translateX(0) scale(1)' : 'translateX(110%) scale(0.92)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
        ...cfg.gradientStyle,
        border: '1px solid',
        ...cfg.borderStyle,
      }}
      className="relative w-full overflow-hidden rounded-2xl backdrop-blur-xl shadow-2xl shadow-black/40"
    >
      {/* glass layer */}
      <div className="absolute inset-0 bg-gray-900/60 dark:bg-gray-950/70 rounded-2xl" />

      {/* content */}
      <div className="relative flex items-start gap-3 px-4 pt-4 pb-5">

        {/* icon circle */}
        <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={cfg.iconBgStyle}>
          <IconComp size={18} className={cfg.iconColor} strokeWidth={2.2} />
        </div>

        {/* text */}
        <div className="flex-1 min-w-0 pt-0.5">
          <p className={`text-[11px] font-black uppercase tracking-widest mb-0.5 ${cfg.titleColor}`}>
            {cfg.label}
          </p>
          <p className="text-sm font-semibold text-gray-100 leading-snug break-words">
            {toast.message}
          </p>
        </div>

        {/* close */}
        <button
          onClick={handleRemove}
          className="shrink-0 mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center
                     text-gray-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>

      {/* progress bar */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10 rounded-b-2xl overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              transition: 'width 0.1s linear',
              ...cfg.barStyle,
            }}
          />
        </div>
      )}
    </div>
  );
};

// ─── Container ────────────────────────────────────────────────────────────────

const ToastContainer: React.FC<{ toasts: Toast[]; removeToast: (id: string) => void }> = ({
  toasts,
  removeToast,
}) => {
  return (
    <div
      className="fixed bottom-24 right-3 md:bottom-6 md:right-5 z-[9999]
                 flex flex-col-reverse gap-2 pointer-events-none"
      style={{ width: 'min(340px, calc(100vw - 24px))' }}
    >
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastCard toast={toast} onRemove={() => removeToast(toast.id)} />
        </div>
      ))}
    </div>
  );
};
