import React from 'react';
import { ShopProvider, useShop } from './context/ShopContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { ProductsPage } from './pages/ProductsPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { OrderTrackingPage } from './pages/OrderTrackingPage';
import { ContactPage, AboutPage, FAQPage, PoliciesPage } from './pages/StaticPages';
import { AdminPage } from './pages/AdminPage';
import { ResellerPage } from './pages/ResellerPage';
import { ImageSearchModal } from './components/ImageSearchModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { Home, Package, ShoppingBag, Truck, MessageCircle, X, ChevronUp } from 'lucide-react';

const MainRouter: React.FC = () => {
  const { currentView, setCurrentView, cartCount, toasts, removeToast, settings } = useShop();
  const [showBackToTop, setShowBackToTop] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <HomePage />;
      case 'products':
        return <ProductsPage />;
      case 'product-detail':
        return <ProductDetailPage />;
      case 'cart':
        return <CartPage />;
      case 'checkout':
        return <CheckoutPage />;
      case 'order-success':
        return <OrderConfirmationPage />;
      case 'track':
        return <OrderTrackingPage />;
      case 'contact':
        return <ContactPage />;
      case 'about':
        return <AboutPage />;
      case 'faq':
        return <FAQPage />;
      case 'policies':
        return <PoliciesPage />;
      case 'admin':
        return <AdminPage />;
      case 'reseller':
        return <ResellerPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f3f8] text-[#1e293b]">
      {/* Top Navbar */}
      <Navbar />

      {/* Main Page Body */}
      <main className="flex-1 pb-20 md:pb-6">
        {renderView()}
      </main>

      {/* Footer (hidden on admin page to keep admin clean) */}
      {currentView !== 'admin' && <Footer />}

      {/* Mobile Sticky Thumb Navigation Bar (hidden on admin, checkout, and product details to prevent UI overlapping) */}
      {currentView !== 'admin' && currentView !== 'checkout' && currentView !== 'product-detail' && (
        <nav
          aria-label="মোবাইল নেভিগেশন"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-white/90 px-4 py-2 flex items-center justify-around shadow-[0_-6px_20px_rgba(160,175,205,0.22)]"
        >
          <button
            onClick={() => {
              setCurrentView('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-bold transition-colors ${
              currentView === 'home' ? 'text-rose-600' : 'text-slate-500'
            }`}
          >
            <Home className="w-5 h-5" />
            <span>হোম</span>
          </button>

          <button
            onClick={() => {
              setCurrentView('products');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-bold transition-colors ${
              currentView === 'products' ? 'text-rose-600' : 'text-slate-500'
            }`}
          >
            <Package className="w-5 h-5" />
            <span>পণ্য</span>
          </button>

          <button
            onClick={() => {
              setCurrentView('cart');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-bold transition-colors relative ${
              currentView === 'cart' ? 'text-rose-600' : 'text-slate-500'
            }`}
          >
            <div className="relative">
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-rose-600 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </div>
            <span>কার্ট</span>
          </button>

          <button
            onClick={() => {
              setCurrentView('track');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-bold transition-colors ${
              currentView === 'track' ? 'text-rose-600' : 'text-slate-500'
            }`}
          >
            <Truck className="w-5 h-5" />
            <span>ট্র্যাক</span>
          </button>

          <a
            href={`https://wa.me/${(settings?.whatsappNumber || '01711234567').replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-bold text-emerald-600"
          >
            <MessageCircle className="w-5 h-5" />
            <span>হোয়াটসঅ্যাপ</span>
          </a>
        </nav>
      )}

      {/* Global Floating Action Buttons (WhatsApp & Back to Top) - Visible on store pages */}
      {currentView !== 'admin' && (
        <div className="fixed bottom-20 md:bottom-8 right-4 sm:right-6 z-40 flex flex-col items-end gap-2.5 pointer-events-none">
          {/* Back to Top */}
          {showBackToTop && (
            <button
              onClick={scrollToTop}
              className="pointer-events-auto w-10 h-10 rounded-full bg-white/90 backdrop-blur-md text-slate-700 hover:text-slate-900 border border-slate-200/80 shadow-md flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer animate-in fade-in zoom-in-75 duration-200"
              aria-label="পৃষ্ঠার শুরুতে যান"
              title="উপরে যান"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          )}

          {/* Floating WhatsApp Quick Support */}
          <a
            href={`https://wa.me/${(settings?.whatsappNumber || '01711234567').replace(/[^0-9]/g, '')}?text=${encodeURIComponent('হ্যালো, আমি ZX Shop থেকে পণ্য সম্পর্কে জানতে চাই।')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto bg-emerald-500 hover:bg-emerald-600 text-white p-3 sm:px-4 sm:py-2.5 rounded-full shadow-[0_8px_20px_rgba(16,185,129,0.35)] flex items-center gap-2 font-bold text-xs sm:text-sm transition-all hover:scale-105 active:scale-95 cursor-pointer group"
            aria-label="WhatsApp সরাসরি মেসেজ করুন"
            title="WhatsApp সহায়তা"
          >
            <MessageCircle className="w-5 h-5 fill-white shrink-0" />
            <span className="hidden sm:inline font-bold">WhatsApp সহায়তা</span>
          </a>
        </div>
      )}

      {/* Global PWA Mobile Install Banner */}
      <PWAInstallButton variant="banner" />

      {/* Global AI Image Search Modal */}
      <ImageSearchModal />

      {/* Floating Toast Notifications */}
      <div className="fixed bottom-16 md:bottom-6 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-xl flex items-center justify-between gap-3 text-xs font-bold animate-in slide-in-from-bottom duration-200 ${
              toast.type === 'success'
                ? 'bg-slate-900 text-white border border-slate-700'
                : toast.type === 'error'
                ? 'bg-rose-600 text-white border border-rose-700'
                : 'bg-white text-slate-800 border border-slate-200'
            }`}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/60 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ShopProvider>
      <MainRouter />
    </ShopProvider>
  );
}
