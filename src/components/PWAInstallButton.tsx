import React, {useState} from 'react';
import {Download, Smartphone, X, CheckCircle} from 'lucide-react';
import {usePWAInstall} from '../hooks/usePWAInstall.ts';

export const PWAInstallButton: React.FC<{variant?: 'navbar' | 'banner' | 'footer'}> = ({variant = 'navbar'}) => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // If already running in standalone mode, do not show install prompt
  if (isInstalled) {
    return null;
  }

  // Handle Chrome / Android install action
  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // Fallback instruction for browser menu
      alert('ক্রোম ব্রাউজারের উপরে ডানদিকের তিনটি ডট (⋮) মেন্যুতে চাপ দিয়ে "Add to Home screen" বা "Install App" সিলেক্ট করুন।');
    }
  };

  // 1. Mobile Bottom Floating Banner Variant
  if (variant === 'banner') {
    if (bannerDismissed) return null;

    return (
      <>
        <div className="fixed bottom-4 left-4 right-4 z-40 md:hidden bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-2xl border border-rose-500/30 backdrop-blur-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center shrink-0 shadow-md">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">ZX Shop অ্যাপ ডাউনলোড করুন</p>
              <p className="text-[11px] text-slate-300 truncate">হোম স্ক্রিন থেকে ১-ক্লিকে শপিং করুন</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleInstallClick}
              className="bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-md transition active:scale-95 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ইন্সটল</span>
            </button>
            <button
              onClick={() => setBannerDismissed(true)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
              title="বন্ধ করুন"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* iOS Instruction Modal */}
        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-slate-800 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-base flex items-center gap-2 text-rose-600">
                  <Smartphone className="w-5 h-5" />
                  iPhone/iPad-এ ইন্সটল করার নিয়ম
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xs shrink-0">
                    ১
                  </div>
                  <p>Safari ব্রাউজারের নিচে <strong>Share (শেয়ার)</strong> আইকনে চাপ দিন।</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xs shrink-0">
                    ২
                  </div>
                  <p>মেন্যু থেকে নিচে স্ক্রোল করে <strong>Add to Home Screen</strong> চাপুন।</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xs shrink-0">
                    ৩
                  </div>
                  <p>উপরে ডানপাশে <strong>Add</strong> চাপুন। আপনার হোমস্ক্রিনে ZX Shop অ্যাপ চলে আসবে!</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
              >
                বুঝেছি
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // 2. Navbar Variant
  return (
    <>
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60 shadow-sm transition active:scale-95 group"
        title="ZX Shop অ্যাপ ডাউনলোড বা ইন্সটল করুন"
      >
        <Download className="w-3.5 h-3.5 text-rose-600 group-hover:translate-y-0.5 transition-transform" />
        <span className="hidden sm:inline">অ্যাপ ডাউনলোড</span>
        <span className="sm:hidden">অ্যাপ</span>
      </button>

      {/* iOS Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-rose-600 flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                iPhone / iPad-এ অ্যাপ ইন্সটল
              </h3>
              <button onClick={() => setShowIOSGuide(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              1. সাফারি ব্রাউজারের <strong>Share</strong> বাটনে চাপ দিন।<br />
              2. নিচে স্ক্রোল করে <strong>Add to Home Screen</strong> চাপুন।
            </p>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full rounded-xl bg-slate-900 py-2 text-sm font-semibold text-white"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}
    </>
  );
};
