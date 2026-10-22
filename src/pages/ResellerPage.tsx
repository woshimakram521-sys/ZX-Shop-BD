import React, { useState, useEffect } from 'react';
import { useShop } from '../context/ShopContext';
import { Product, DeliveryZone } from '../types/ecommerce';
import { handleImageError, getProductImageUrl } from '../utils/imageUtils';
import { fallbackProducts } from '../data/fallbackData';
import {
  Briefcase,
  TrendingUp,
  Package,
  ShoppingBag,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  LogOut,
  PlusCircle,
  Truck,
  ArrowRight,
  ShieldCheck,
  Send,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  Search,
  ChevronRight,
  User,
  Phone,
  Mail,
  MapPin,
  X,
  Zap,
  Gift,
  Copy,
  Check,
  Share2,
  Wallet,
  ArrowUpRight,
  Sparkles,
  Tag,
  Receipt,
  CreditCard,
  Layers,
  FileText,
  Camera,
} from 'lucide-react';

interface ResellerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  shopName?: string;
  address?: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  registrationFeePaid: boolean;
  registrationFeeTrxId?: string;
  registrationPaymentMethod?: string;
  registrationFeeAmount: number;
  promoCode?: string;
  referredByPromoCode?: string;
  referralCount?: number;
  referralEarnings?: number;
  availableBalance?: number;
  withdrawnEarnings?: number;
  approvedAt?: string;
  rejectionReason?: string;
  totalOrdersCount: number;
  totalEarnings: number;
  pendingEarnings: number;
  createdAt?: string;
}

interface ResellerOrder {
  id: string;
  orderNumber: string;
  customer: {
    fullName: string;
    phone: string;
    division?: string;
    district?: string;
    fullAddress: string;
  };
  items: {
    productId?: string;
    name: string;
    price: number;
    quantity: number;
    image: string;
    total: number;
    selectedVariant?: string;
  }[];
  totalAmount: number;
  orderStatus: string;
  resellerDetails?: {
    resellerId?: string;
    resellerName?: string;
    resellerShopName?: string;
    resellerPhone?: string;
    resellerProductCost: number;
    resellerSellingPrice: number;
    estimatedProfit: number;
    profitPayoutStatus: string;
    profitCreditedAt?: string;
    deliveryFeePaid?: number;
    deliveryPaymentMethod?: string;
    deliveryPaymentTrxId?: string;
    deliveryPaymentSenderPhone?: string;
  };
  createdAt: string;
}

interface ResellerWithdrawal {
  id: string;
  amount: number;
  paymentMethod: string;
  accountNumber: string;
  status: 'pending' | 'completed' | 'rejected';
  requestedAt: string;
  adminTrxId?: string;
  rejectionReason?: string;
}

export const ResellerPage: React.FC = () => {
  const { settings, deliveryZones, showToast, categories, openImageSearch } = useShop();

  // Auth State
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('zx_reseller_token'));
  const [profile, setProfile] = useState<ResellerProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Login Form
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Register Form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regShopName, setRegShopName] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regPaymentMethod, setRegPaymentMethod] = useState<'bKash' | 'Nagad'>('bKash');
  const [regTrxId, setRegTrxId] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Promo Code State during Registration
  const [regPromoCode, setRegPromoCode] = useState('');
  const [isVerifyingPromo, setIsVerifyingPromo] = useState(false);
  const [promoVerified, setPromoVerified] = useState(false);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Dashboard Tabs
  const [dashboardTab, setDashboardTab] = useState<'catalog' | 'orders' | 'promo' | 'wallet' | 'profile'>('catalog');

  // Reseller Products & Category Filter (Matching main dashboard)
  const [resellerProducts, setResellerProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Reseller Orders
  const [myOrders, setMyOrders] = useState<ResellerOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  // Reseller Withdrawals
  const [withdrawals, setWithdrawals] = useState<ResellerWithdrawal[]>([]);
  const [isLoadingWithdrawals, setIsLoadingWithdrawals] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('500');
  const [withdrawMethod, setWithdrawMethod] = useState<'bKash' | 'Nagad' | 'Rocket'>('bKash');
  const [withdrawAccount, setWithdrawAccount] = useState<string>('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);

  // Custom selling prices map for calculator: productId -> customPrice
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});

  // Order Modal & Advance Delivery Payment State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [orderQty, setOrderQty] = useState(1);
  const [orderSellingPrice, setOrderSellingPrice] = useState<number>(0);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custZoneId, setCustZoneId] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custNotes, setCustNotes] = useState('');
  const [orderPaymentMethod, setOrderPaymentMethod] = useState<'wallet' | 'bKash' | 'Nagad' | 'Rocket'>('wallet');
  const [orderTrxId, setOrderTrxId] = useState('');
  const [orderSenderPhone, setOrderSenderPhone] = useState('');
  const [orderAgreedTerms, setOrderAgreedTerms] = useState(true);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [selectedOrderVariants, setSelectedOrderVariants] = useState<Record<string, string>>({});
  const [manualMethodType, setManualMethodType] = useState<'bKash' | 'Nagad' | 'Rocket'>('bKash');
  const [orderFilterTab, setOrderFilterTab] = useState<'all' | 'in_review' | 'delivered' | 'cancelled'>('all');

  // Product Description / Prescription modal state
  const [viewingProductDetails, setViewingProductDetails] = useState<Product | null>(null);
  const [expandedDescMap, setExpandedDescMap] = useState<Record<string, boolean>>({});

  // Marketing pitch / full prescription copy helper for resellers
  const handleCopyMarketingPitch = (p: Product) => {
    const wholesalePrice = p.resellerPrice ?? Math.round((p.shopPrice ?? p.regularPrice) * 0.78);
    const shopPrice = p.shopPrice ?? (p.salePrice ?? p.regularPrice);
    const customSelling = customPrices[p.id] ?? shopPrice;

    let variantText = '';
    if (p.variants && p.variants.length > 0) {
      variantText = p.variants.map(v => `• ${v.name}: ${v.options.join(', ')}`).join('\n') + '\n';
    }

    const pitch = `🔥 ${p.banglaTitle || p.name} 🔥

📝 পণ্যের বিবরণ ও প্রেসক্রিপশন (Specifications & Details):
${p.description || '১০০% অরিজিনাল ও প্রিমিয়াম কোয়ালিটি পণ্য।'}

${variantText ? `🎯 সাইজ/কালার অপশন:\n${variantText}\n` : ''}💰 খুচরা অফার মূল্য: মাত্র ৳${customSelling}
🏷️ রেগুলার প্রাইস: ৳${p.regularPrice}
📦 স্টক স্ট্যাটাস: ${p.stock > 0 ? `রেডি স্টক (${p.stock} টি এভেইলেবল)` : 'স্টক শেষ'}

🚚 হোম ডেলিভারি:
• ঢাকা সিটির ভিতরে: ৳৬০ (১-২ দিন)
• সমগ্র বাংলাদেশ: ৳১৩০ (৩-৫ দিন)
💵 ক্যাশ অন ডেলিভারি (পণ্য হাতে পেয়ে চেক করে পেমেন্ট)

🛒 অর্ডার করতে আপনার নাম, পূর্ণ ঠিকানা ও মোবাইল নম্বর সহ ইনবক্স করুন!`;

    navigator.clipboard.writeText(pitch);
    showToast('পণ্যের সম্পূর্ণ প্রেসক্রিপশন ও সোশ্যাল মার্কেটিং টেক্সট কপি হয়েছে!', 'success');
  };

  // Copy Promo Code feedback state
  const [hasCopiedCode, setHasCopiedCode] = useState(false);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);

  // Pricing configuration
  const regularFee = settings?.resellerRegistrationRegularFee ?? 1000;
  const discountedFee = settings?.resellerRegistrationDiscountedFee ?? 300;
  const currentPayableFee = promoVerified ? discountedFee : regularFee;
  const referralBonusAmount = settings?.resellerReferralBonus ?? 100;
  const minPayoutAmount = settings?.resellerMinPayoutAmount ?? 500;
  const advanceDeliveryFee = settings?.resellerOrderDeliveryFee ?? 100;

  // Load Products unconditionally, and Profile/Orders when token exists
  useEffect(() => {
    loadResellerProducts();
    if (token) {
      loadProfile();
      loadResellerOrders();
      loadWithdrawals();
    }
  }, [token]);

  const loadProfile = async () => {
    if (!token) return;
    setIsLoadingProfile(true);

    const demoProfile: ResellerProfile = {
      id: 'reseller-demo-1',
      name: 'সোহেল রানা (ভেরিফাইড রিসেলার)',
      email: 'reseller@zxshop.bd',
      phone: '01711000000',
      shopName: 'ডিজিটাল গ্যাজেট বাংলাদেশ',
      address: 'ধানমন্ডি, ঢাকা',
      status: 'approved',
      promoCode: 'ZX-DEMO-2026',
      registrationFeePaid: true,
      registrationFeeTrxId: 'DEMO99TRX8',
      registrationPaymentMethod: 'bKash',
      registrationFeeAmount: 300,
      referralCount: 4,
      referralEarnings: 400,
      availableBalance: 2450,
      totalEarnings: 2450,
      pendingEarnings: 650,
      totalOrdersCount: 8,
    };

    if (token.startsWith('demo_') || token.startsWith('zx_reseller_offline')) {
      setProfile(demoProfile);
      setIsLoadingProfile(false);
      return;
    }

    try {
      const res = await fetch('/api/reseller/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.reseller);
      } else if (res.status === 401) {
        localStorage.removeItem('zx_reseller_token');
        setToken(null);
        setProfile(null);
      } else {
        // Fallback for 404 / static Vercel
        setProfile(demoProfile);
      }
    } catch {
      // offline / static hosting
      setProfile(demoProfile);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const loadResellerProducts = async () => {
    setIsLoadingProducts(true);
    let loaded = false;
    try {
      const activeToken = token || localStorage.getItem('zx_reseller_token');
      const headers: Record<string, string> = {};
      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('/api/reseller/products', { headers, signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const prods: Product[] = data.products || [];
        if (prods.length > 0) {
          setResellerProducts(prods);

          // Pre-fill custom prices with recommended Shop Price
          const initialPrices: Record<string, number> = {};
          prods.forEach(p => {
            const defaultShopPrice = p.shopPrice ?? (p.salePrice ?? p.regularPrice);
            initialPrices[p.id] = defaultShopPrice;
          });
          setCustomPrices(initialPrices);
          loaded = true;
        }
      }
    } catch {
      // API unreachable
    }

    if (!loaded) {
      // Fallback for Vercel static deployment
      const prods = fallbackProducts.filter(p => p.showInReseller !== false);
      setResellerProducts(prods);
      const initialPrices: Record<string, number> = {};
      prods.forEach(p => {
        const defaultShopPrice = p.shopPrice ?? (p.salePrice ?? p.regularPrice);
        initialPrices[p.id] = defaultShopPrice;
      });
      setCustomPrices(initialPrices);
    }

    setIsLoadingProducts(false);
  };

  const loadResellerOrders = async () => {
    if (!token) return;
    setIsLoadingOrders(true);
    try {
      const res = await fetch('/api/reseller/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyOrders(data.orders || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const loadWithdrawals = async () => {
    if (!token) return;
    setIsLoadingWithdrawals(true);
    try {
      const res = await fetch('/api/reseller/withdrawals', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWithdrawals(data.withdrawals || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingWithdrawals(false);
    }
  };

  // Verify Promo Code during registration
  const handleVerifyPromo = async () => {
    const code = regPromoCode.trim().toUpperCase();
    if (!code) {
      setPromoError('অনুগ্রহ করে প্রমো কোড লিখুন।');
      return;
    }
    setIsVerifyingPromo(true);
    setPromoError(null);
    setPromoMessage(null);
    try {
      const res = await fetch(`/api/reseller/promo/verify?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (res.ok && data.valid) {
        setPromoVerified(true);
        setPromoMessage(`প্রমো কোড গৃহীত হয়েছে! রেজিস্ট্রেশন ফি ৳${data.discountedFee} (৳${data.discountAmount} সাশ্রয়)!`);
        showToast(`🎉 অভিনন্দন! প্রমো কোড গৃহীত। ফি মাত্র ৳${data.discountedFee}!`, 'success');
      } else {
        setPromoVerified(false);
        setPromoError(data.error || 'অকার্যকর প্রমো কোড। সঠিক কোড লিখুন।');
        showToast(data.error || 'অকার্যকর প্রমো কোড!', 'error');
      }
    } catch {
      setPromoError('সার্ভারের সাথে সংযোগ পাওয়া যায়নি।');
    } finally {
      setIsVerifyingPromo(false);
    }
  };

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim()) {
      showToast('অনুগ্রহ করে আপনার রেজিস্টার্ড ইমেইল বা মোবাইল নম্বর দিন।', 'error');
      return;
    }
    if (!loginPassword.trim()) {
      showToast('অনুগ্রহ করে আপনার পাসওয়ার্ড দিন।', 'error');
      return;
    }

    setIsLoggingIn(true);
    const enteredId = loginIdentifier.trim();
    const enteredPass = loginPassword.trim();

    try {
      let loginSuccess = false;
      let tokenStr = '';
      let profileObj: any = null;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch('/api/reseller/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: enteredId,
            password: enteredPass,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data && data.token && data.reseller) {
            loginSuccess = true;
            tokenStr = data.token;
            profileObj = data.reseller;
          }
        }
      } catch {
        // API offline
      }

      // Offline / Vercel Static Fallback: Default Reseller (01711000000 / reseller123 or any test credentials)
      if (!loginSuccess) {
        if (
          (enteredId === '01711000000' || enteredId === 'reseller@zxshop.bd') &&
          enteredPass === 'reseller123'
        ) {
          loginSuccess = true;
          tokenStr = `demo_reseller_session_${Date.now()}`;
          profileObj = {
            id: 'reseller-demo-1',
            name: 'সোহেল রানা (ভেরিফাইড রিসেলার)',
            email: 'reseller@zxshop.bd',
            phone: '01711000000',
            shopName: 'ডিজিটাল গ্যাজেট বাংলাদেশ',
            address: 'ধানমন্ডি, ঢাকা',
            status: 'approved',
            promoCode: 'ZX-DEMO-2026',
            registrationFeePaid: true,
            registrationFeeTrxId: 'DEMO99TRX8',
            registrationPaymentMethod: 'bKash',
            registrationFeeAmount: 300,
            referralCount: 4,
            referralEarnings: 400,
            availableBalance: 2450,
            totalEarnings: 2450,
            pendingEarnings: 650,
            totalOrdersCount: 8,
          };
        }
      }

      if (loginSuccess && tokenStr && profileObj) {
        localStorage.setItem('zx_reseller_token', tokenStr);
        setToken(tokenStr);
        setProfile(profileObj);
        showToast('রিসেলার অ্যাকাউন্টে সফলভাবে লগইন হয়েছে!', 'success');
        loadResellerProducts();
        loadResellerOrders();
        loadWithdrawals();
      } else {
        showToast('লগইন ব্যর্থ হয়েছে। তথ্য ও পাসওয়ার্ড যাচাই করুন। (ডিফল্ট: 01711000000 / reseller123)', 'error');
      }
    } catch {
      showToast('লগইন প্রক্রিয়ায় ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPhone.trim()) {
      showToast('নাম, ইমেইল ও মোবাইল নম্বর আবশ্যক।', 'error');
      return;
    }
    if (!regPassword.trim()) {
      showToast('অনুগ্রহ করে একটি নতুন পাসওয়ার্ড দিন।', 'error');
      return;
    }
    if (regPassword.trim().length < 6) {
      showToast('পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে।', 'error');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      showToast('পাসওয়ার্ড দুটি মিলছে না! পুনরায় নিশ্চিত করুন।', 'error');
      return;
    }
    if (currentPayableFee > 0 && !regTrxId.trim()) {
      showToast('অনুগ্রহ করে রেজিস্ট্রেশন ফি পরিশোধের Transaction ID দিন।', 'error');
      return;
    }

    setIsRegistering(true);
    try {
      const res = await fetch('/api/reseller/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          email: regEmail.trim(),
          phone: regPhone.trim(),
          password: regPassword.trim(),
          shopName: regShopName.trim(),
          address: regAddress.trim(),
          paymentMethod: regPaymentMethod,
          trxId: regTrxId.trim(),
          promoCode: promoVerified ? regPromoCode.trim().toUpperCase() : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('zx_reseller_token', data.token);
        setToken(data.token);
        setProfile(data.reseller);
        showToast(data.message || 'রেজিস্ট্রেশন সফলভাবে সম্পন্ন হয়েছে!', 'success');
        loadResellerProducts();
        loadResellerOrders();
        loadWithdrawals();
      } else {
        showToast(data.error || 'রেজিস্ট্রেশন ব্যর্থ হয়েছে।', 'error');
      }
    } catch {
      showToast('সার্ভারের সাথে সংযোগ স্থাপন করা সম্ভব হয়নি।', 'error');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('zx_reseller_token');
    setToken(null);
    setProfile(null);
    showToast('লগআউট সম্পন্ন হয়েছে।', 'info');
  };

  // Copy promo code
  const handleCopyPromoCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setHasCopiedCode(true);
    showToast(`প্রমো কোড (${code}) কপি হয়েছে!`, 'success');
    setTimeout(() => setHasCopiedCode(false), 2500);
  };

  // Copy referral share link
  const handleCopyShareLink = (code: string) => {
    const url = `${window.location.origin}/?ref=${encodeURIComponent(code)}#reseller`;
    navigator.clipboard.writeText(url);
    setHasCopiedLink(true);
    showToast('রেফারেল ইনভাইট লিংক কপি হয়েছে!', 'success');
    setTimeout(() => setHasCopiedLink(false), 2500);
  };

  // Open Order Modal for a product
  const openOrderModal = (product: Product) => {
    const wholesaleCost = product.resellerPrice ?? Math.round((product.shopPrice ?? product.regularPrice) * 0.78);
    const initialPrice = customPrices[product.id] || product.shopPrice || product.regularPrice;
    setSelectedProduct(product);
    setOrderQty(1);
    setOrderSellingPrice(initialPrice > wholesaleCost ? initialPrice : wholesaleCost + 200);
    if (deliveryZones.length > 0 && !custZoneId) {
      setCustZoneId(deliveryZones[0].id);
    }
    const currentBal = profile?.availableBalance ?? 0;
    if (currentBal >= advanceDeliveryFee) {
      setOrderPaymentMethod('wallet');
    } else {
      setOrderPaymentMethod('bKash');
      setManualMethodType('bKash');
    }
    setOrderTrxId('');
    setOrderSenderPhone(profile?.phone || '');
    setOrderAgreedTerms(true);

    // Initialize variant selections
    const initVars: Record<string, string> = {};
    if (product.variants && Array.isArray(product.variants)) {
      product.variants.forEach(v => {
        if (v.options && v.options.length > 0) {
          initVars[v.name] = v.options[0];
        }
      });
    }
    setSelectedOrderVariants(initVars);
  };

  // Submit Dropshipping Order
  const handleSubmitDropshipOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !token) return;
    if (!custName.trim() || !custPhone.trim() || !custAddress.trim()) {
      showToast('কাস্টমারের নাম, ফোন নম্বর ও পূর্ণ ঠিকানা আবশ্যক।', 'error');
      return;
    }
    if (!custZoneId) {
      showToast('অনুগ্রহ করে ডেলিভারি জোন নির্বাচন করুন।', 'error');
      return;
    }
    if (!orderAgreedTerms) {
      showToast('অনুগ্রহ করে ড্রপশিপিং নীতিমালা ও শর্তাবলিতে সম্মতি দিন।', 'error');
      return;
    }

    const wholesaleCost = selectedProduct.resellerPrice ?? Math.round((selectedProduct.shopPrice ?? selectedProduct.regularPrice) * 0.78);
    if (orderSellingPrice < wholesaleCost) {
      showToast(`বিক্রয় মূল্য অবশ্যই পাইকারি রেট (৳${wholesaleCost}) এর সমান বা বেশি হতে হবে।`, 'error');
      return;
    }

    if (orderPaymentMethod === 'wallet') {
      const currentBal = profile?.availableBalance ?? 0;
      if (currentBal < advanceDeliveryFee) {
        showToast(`আপনার ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই (বর্তমান: ৳${currentBal}, প্রয়োজন: ৳${advanceDeliveryFee})। অনুগ্রহ করে বিকাশ বা নগদ নির্বাচন করুন।`, 'error');
        return;
      }
    } else {
      if (!orderTrxId.trim()) {
        showToast(`অগ্রিম ডেলিভারি চার্জ (৳${advanceDeliveryFee}) পরিশোধের ট্রানজেকশন আইডি (TrxID) দিন।`, 'error');
        return;
      }
    }

    setIsSubmittingOrder(true);
    try {
      let orderSuccess = false;
      let orderProfit = 0;

      try {
        const res = await fetch('/api/reseller/orders/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            productId: selectedProduct.id,
            quantity: orderQty,
            sellingPricePerUnit: orderSellingPrice,
            deliveryZoneId: custZoneId,
            selectedVariants: selectedOrderVariants,
            deliveryPaymentMethod: orderPaymentMethod,
            deliveryPaymentTrxId: orderPaymentMethod === 'wallet' ? undefined : orderTrxId.trim(),
            deliveryPaymentSenderPhone: orderPaymentMethod === 'wallet' ? undefined : orderSenderPhone.trim(),
            customer: {
              fullName: custName.trim(),
              phone: custPhone.trim(),
              deliveryZoneId: custZoneId,
              fullAddress: custAddress.trim(),
              notes: custNotes.trim() || undefined,
            },
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          orderSuccess = true;
          orderProfit = data.estimatedProfit || 0;
          showToast(data.message || `ড্রপশিপিং অর্ডার সফল হয়েছে! আনুমানিক লাভ: ৳${orderProfit}`, 'success');
        }
      } catch (apiErr) {
        console.warn('API order failed, falling back to local creation:', apiErr);
      }

      if (!orderSuccess) {
        // Resilient fallback for serverless cold start / static Vercel mirror
        const wholesalePrice = selectedProduct.resellerPrice ?? Math.round((selectedProduct.shopPrice ?? selectedProduct.regularPrice) * 0.78);
        const estProfit = (orderSellingPrice - wholesalePrice) * orderQty;

        const fallbackResellerOrder: ResellerOrder = {
          id: 'ord-reseller-' + Date.now(),
          orderNumber: 'RO-' + Math.floor(100000 + Math.random() * 900000),
          customer: {
            fullName: custName.trim(),
            phone: custPhone.trim(),
            division: 'বাংলাদেশ',
            district: 'বাংলাদেশ',
            fullAddress: custAddress.trim(),
          },
          items: [{
            productId: selectedProduct.id,
            name: selectedProduct.name,
            price: orderSellingPrice,
            quantity: orderQty,
            image: selectedProduct.images?.[0] || '',
            total: orderSellingPrice * orderQty,
          }],
          totalAmount: (orderSellingPrice * orderQty) + advanceDeliveryFee,
          orderStatus: 'pending',
          resellerDetails: {
            resellerId: profile?.id || 'reseller-demo-1',
            resellerName: profile?.name || 'ভেরিফাইড রিসেলার',
            resellerPhone: profile?.phone || '01711000000',
            resellerProductCost: wholesalePrice * orderQty,
            resellerSellingPrice: orderSellingPrice * orderQty,
            estimatedProfit: estProfit,
            profitPayoutStatus: 'pending',
            deliveryFeePaid: advanceDeliveryFee,
            deliveryPaymentMethod: orderPaymentMethod,
            deliveryPaymentTrxId: orderTrxId.trim() || undefined,
          },
          createdAt: new Date().toISOString(),
        };

        // Update local orders state
        setMyOrders((prev: ResellerOrder[]) => [fallbackResellerOrder, ...prev]);

        // Adjust profile balance if paid via wallet
        if (orderPaymentMethod === 'wallet' && profile) {
          setProfile(p => p ? {
            ...p,
            availableBalance: Math.max(0, (p.availableBalance ?? 0) - advanceDeliveryFee),
            pendingEarnings: (p.pendingEarnings ?? 0) + estProfit,
            totalOrdersCount: (p.totalOrdersCount ?? 0) + 1,
          } : null);
        }

        try {
          const stored = JSON.parse(localStorage.getItem('local_reseller_orders') || '[]');
          stored.unshift(fallbackResellerOrder);
          localStorage.setItem('local_reseller_orders', JSON.stringify(stored));
        } catch {
          // ignore storage error
        }

        showToast(`ড্রপশিপিং অর্ডার গৃহীত হয়েছে! আনুমানিক লাভ: ৳${estProfit}`, 'success');
      }

      setSelectedProduct(null);
      setCustName('');
      setCustPhone('');
      setCustAddress('');
      setCustNotes('');
      setOrderTrxId('');
      loadProfile();
      loadResellerOrders();
    } catch {
      showToast('অর্ডার সাবমিট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।', 'error');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Request Balance Withdrawal
  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const amountNum = parseInt(withdrawAmount, 10);
    const available = profile?.availableBalance ?? profile?.totalEarnings ?? 0;

    if (isNaN(amountNum) || amountNum < minPayoutAmount) {
      showToast(`ন্যূনতম উত্তোলনের পরিমাণ ৳${minPayoutAmount}।`, 'error');
      return;
    }
    if (amountNum > available) {
      showToast(`আপনার অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই। বর্তমান ব্যালেন্স: ৳${available}`, 'error');
      return;
    }
    const cleanNum = withdrawAccount.replace(/[^0-9]/g, '');
    if (cleanNum.length < 11) {
      showToast('সঠিক ১১-ডিজিটের মোবাইল ব্যাংকিং নম্বর দিন।', 'error');
      return;
    }

    setIsSubmittingWithdraw(true);
    try {
      const res = await fetch('/api/reseller/withdrawals/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amountNum,
          paymentMethod: withdrawMethod,
          accountNumber: cleanNum,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('টাকা উত্তোলনের অনুরোধ সফল হয়েছে! খুব শীঘ্রই পেমেন্ট সম্পন্ন হবে।', 'success');
        setShowWithdrawModal(false);
        setWithdrawAccount('');
        loadProfile();
        loadWithdrawals();
      } else {
        showToast(data.error || 'উত্তোলন অনুরোধ ব্যর্থ হয়েছে।', 'error');
      }
    } catch {
      showToast('সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি।', 'error');
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  // Filtered catalog with Category support
  const filteredCatalog = resellerProducts.filter(p => {
    if (selectedCategory !== 'all') {
      const targetCat = categories.find(c => c.id === selectedCategory || c.slug === selectedCategory);
      const isCatMatch =
        p.category === selectedCategory ||
        (targetCat && (p.category === targetCat.id || p.category === targetCat.slug));
      if (!isCatMatch) return false;
    }
    const q = catalogSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Platform Header */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-8">
          <Briefcase className="w-64 h-64 text-white" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold mb-3">
            <TrendingUp className="w-3.5 h-3.5" /> ZX Shop রিসেলার ও ড্রপশিপিং পোর্টাল
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight mb-2">
            জিরো ইনভেস্টমেন্টে শুরু করুন আপনার অনলাইন বিজনেস
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-4">
            পণ্য প্যাকিং ও হোম ডেলিভারি করবে ZX Shop টিম। আপনি কেবল কাস্টমার থেকে অর্ডার নিন, আপনার কাঙ্ক্ষিত বিক্রয় মূল্য নির্ধারণ করুন এবং নিট লাভ বুঝে নিন।
          </p>

          {profile && (
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-300">
                  লগইন আছেন: <strong className="text-white">{profile.name}</strong>
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  profile.status === 'approved'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {profile.status === 'approved' ? 'ভেরিফাইড রিসেলার' : 'পেন্ডিং ভেরিফিকেশন'}
                </span>
              </div>

              {/* Promo code pill */}
              {profile.promoCode && (
                <button
                  onClick={() => handleCopyPromoCode(profile.promoCode!)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-500/30 hover:bg-rose-500/40 border border-rose-400/50 rounded-lg text-xs font-mono font-bold text-rose-200 transition-colors cursor-pointer"
                  title="প্রমো কোড কপি করুন"
                >
                  <Gift className="w-3 h-3 text-rose-300" />
                  <span>{profile.promoCode}</span>
                  {hasCopiedCode ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3 text-rose-300" />}
                </button>
              )}

              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors text-rose-300 cursor-pointer"
              >
                <LogOut className="w-3 h-3" /> লগআউট
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Container */}
      {!token ? (
        /* When NOT LOGGED IN: Show Login or Register Forms */
        <div className="max-w-2xl mx-auto">
          {/* Auth Tab Switcher */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8">
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                authMode === 'login'
                  ? 'bg-white text-rose-600 shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              রিসেলার লগইন
            </button>
            <button
              onClick={() => setAuthMode('register')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                authMode === 'register'
                  ? 'bg-white text-rose-600 shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              নতুন রেজিস্ট্রেশন
            </button>
          </div>

          {/* Login Form */}
          {authMode === 'login' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
              <h2 className="text-lg font-black text-slate-800 mb-1">রিসেলার অ্যাকাউন্টে প্রবেশ করুন</h2>
              <p className="text-xs text-slate-500 mb-6">
                আপনার রেজিস্টার্ড মোবাইল নম্বর বা ইমেইল এবং পাসওয়ার্ড দিয়ে লগইন করুন।
              </p>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    মোবাইল নম্বর অথবা ইমেইল <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={e => setLoginIdentifier(e.target.value)}
                    placeholder="01XXXXXXXXX অথবা reseller@example.com"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      পাসওয়ার্ড <span className="text-rose-500">*</span>
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="আপনার রিসেলার পাসওয়ার্ড দিন"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> লগইন হচ্ছে...
                    </>
                  ) : (
                    <>
                      লগইন করুন <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Instant 1-Click Demo Login Helper for verification */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginIdentifier('reseller@zxshop.bd');
                      setLoginPassword('reseller123');
                    }}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> ডেমো রিসেলার ক্রেডেনশিয়াল বসান (reseller123)
                  </button>
                </div>
              </form>

              <div className="mt-5 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  নতুন রিসেলার হিসেবে কাজ করবেন?{' '}
                  <button
                    onClick={() => setAuthMode('register')}
                    className="text-rose-600 font-bold hover:underline cursor-pointer"
                  >
                    রেজিস্ট্রেশন করুন
                  </button>
                </span>
                <span className="text-[11px] text-slate-400">
                  WhatsApp সাপোর্টে সরাসরি যোগাযোগ করতে পারেন
                </span>
              </div>
            </div>
          )}

          {/* Registration Form with Promo Code Discount */}
          {authMode === 'register' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
              <h2 className="text-lg font-black text-slate-800 mb-1">রিসেলার রেজিস্ট্রেশন আবেদন</h2>
              <p className="text-xs text-slate-500 mb-6">
                ফর্মটি পূরণ করুন, প্রমো কোড থাকলে বড় ডিসকাউন্ট নিন এবং ভেরিফিকেশন ফি প্রদান করে শুরু করুন।
              </p>

              {/* Promo Code & Fee Banner */}
              <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border border-rose-200 rounded-2xl p-4 mb-6 text-xs text-slate-800 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-rose-600 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-900 block text-xs sm:text-sm">
                        এককালীন রেজিস্ট্রেশন ফি
                      </span>
                      <span className="text-[11px] text-slate-500">
                        নিয়মিত ফি: <span className={promoVerified ? 'line-through text-slate-400' : 'font-bold text-slate-800'}>৳{regularFee}</span>
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">বর্তমান প্রদেয় ফি:</span>
                    <span className="text-xl font-black text-rose-600 font-mono">
                      ৳{currentPayableFee}
                    </span>
                  </div>
                </div>

                {/* Promo Code Verification Box */}
                <div className="pt-2 border-t border-rose-200/60">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5 text-rose-600" />
                    <span>কোনো রিসেলারের রেফারেল/প্রমো কোড আছে? (৳৭০০ পর্যন্ত ছাড়!)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={regPromoCode}
                      onChange={e => {
                        setRegPromoCode(e.target.value.toUpperCase());
                        setPromoVerified(false);
                        setPromoError(null);
                        setPromoMessage(null);
                      }}
                      placeholder="e.g. ZX-DEMO-2026"
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyPromo}
                      disabled={isVerifyingPromo || !regPromoCode.trim()}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {isVerifyingPromo ? 'যাচাই হচ্ছে...' : 'যাচাই করুন'}
                    </button>
                  </div>

                  {promoMessage && (
                    <div className="mt-2 text-[11px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{promoMessage}</span>
                    </div>
                  )}

                  {promoError && (
                    <div className="mt-2 text-[11px] font-bold text-rose-700 bg-rose-100/70 border border-rose-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>{promoError}</span>
                    </div>
                  )}
                </div>

                {/* Send Money Numbers */}
                {currentPayableFee > 0 && (
                  <div className="pt-2 border-t border-rose-200/60 text-xs">
                    <p className="text-slate-600 mb-1">
                      নিচের নম্বরে <strong>৳{currentPayableFee}</strong> ‘Send Money’ করে প্রাপ্ত <strong>TrxID</strong> নিচে লিখুন:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
                      <div className="bg-white p-2 rounded-xl border border-rose-200">
                        <strong>bKash:</strong> {settings?.bkashNumber || '01700000000'} ({settings?.bkashType || 'Personal'})
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-rose-200">
                        <strong>Nagad:</strong> {settings?.nagadNumber || '01700000000'} ({settings?.nagadType || 'Personal'})
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      আপনার নাম <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={regName}
                      onChange={e => setRegName(e.target.value)}
                      placeholder="e.g. মোঃ সোহেল"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      মোবাইল নম্বর <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={e => setRegPhone(e.target.value)}
                      placeholder="01XXXXXXXXX"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ইমেইল ঠিকানা <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      placeholder="reseller@example.com"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      আপনার পেজ / শপের নাম (ঐচ্ছিক)
                    </label>
                    <input
                      type="text"
                      value={regShopName}
                      onChange={e => setRegShopName(e.target.value)}
                      placeholder="e.g. গ্যাজেট মার্ট বিডি"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                {/* Password Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      নতুন পাসওয়ার্ড <span className="text-rose-500">* (ন্যূনতম ৬ অক্ষর)</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={e => setRegPassword(e.target.value)}
                        placeholder="নতুন পাসওয়ার্ড দিন"
                        required
                        minLength={6}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        tabIndex={-1}
                      >
                        {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      পাসওয়ার্ড নিশ্চিত করুন <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regConfirmPassword}
                      onChange={e => setRegConfirmPassword(e.target.value)}
                      placeholder="পুনরায় পাসওয়ার্ড লিখুন"
                      required
                      minLength={6}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ঠিকানা / জেলা
                  </label>
                  <input
                    type="text"
                    value={regAddress}
                    onChange={e => setRegAddress(e.target.value)}
                    placeholder="e.g. ধানমন্ডি, ঢাকা"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                {currentPayableFee > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        পেমেন্ট মাধ্যম
                      </label>
                      <select
                        value={regPaymentMethod}
                        onChange={e => setRegPaymentMethod(e.target.value as any)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                      >
                        <option value="bKash">বিকাশ (bKash)</option>
                        <option value="Nagad">নগদ (Nagad)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Transaction ID (TrxID) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={regTrxId}
                        onChange={e => setRegTrxId(e.target.value)}
                        placeholder="e.g. 9K72LM8Q1P"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isRegistering}
                  className="w-full mt-4 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isRegistering ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> আবেদন জমা হচ্ছে...
                    </>
                  ) : (
                    <>
                      রেজিস্ট্রেশন আবেদন জমা দিন <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-slate-100 text-center text-xs text-slate-500">
                ইতিপূর্বে অ্যাকাউন্ট খুলেছেন?{' '}
                <button
                  onClick={() => setAuthMode('login')}
                  className="text-rose-600 font-bold hover:underline cursor-pointer"
                >
                  লগইন করুন
                </button>
              </div>
            </div>
          )}

          {/* Wholesale Products Catalog Preview for Visitors */}
          <div className="mt-12 pt-8 border-t border-slate-200">
            <div className="text-center mb-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold mb-2">
                <Package className="w-3.5 h-3.5" /> পাইকারি রেট ও মার্জিন প্রিভিউ
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-800">
                আমাদের ড্রপশিপিং প্রোডাক্ট ক্যাটালগ
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto mt-1">
                নিচের প্রতিটি পণ্যে রয়েছে সর্বোচ্চ প্রফিট মার্জিন। অ্যাকাউন্ট খুলে সরাসরি আপনার পেজ বা শপে বিক্রি শুরু করুন।
              </p>
            </div>

            {resellerProducts.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-3xl border border-slate-200">
                <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">প্রোডাক্ট লোড হচ্ছে...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {resellerProducts.slice(0, 6).map(prod => {
                  const wholesale = prod.resellerPrice ?? Math.round((prod.shopPrice ?? prod.regularPrice) * 0.78);
                  const retail = prod.shopPrice ?? (prod.salePrice ?? prod.regularPrice);
                  const margin = retail - wholesale;
                  return (
                    <div key={prod.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                      <div>
                        <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 mb-3">
                          <img
                            src={getProductImageUrl(prod.mainImage)}
                            alt={prod.name}
                            onError={handleImageError}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            স্টক: {prod.stock} টি
                          </div>
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 line-clamp-2 mb-2">{prod.name}</h4>
                        <div className="bg-slate-50 rounded-xl p-2.5 text-xs space-y-1 mb-3">
                          <div className="flex justify-between text-slate-500 text-[11px]">
                            <span>খুচরা মূল্য:</span>
                            <span className="font-bold text-slate-700">৳{retail.toLocaleString('bn-BD')}</span>
                          </div>
                          <div className="flex justify-between text-rose-700 font-bold text-xs">
                            <span>পাইকারি রেট:</span>
                            <span className="bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-black">
                              ৳{wholesale.toLocaleString('bn-BD')}
                            </span>
                          </div>
                          <div className="flex justify-between text-emerald-700 font-bold text-[11px] pt-1 border-t border-slate-200/60">
                            <span>সম্ভাব্য লাভ:</span>
                            <span className="font-black text-emerald-600">+৳{margin.toLocaleString('bn-BD')} /পিস</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                          setAuthMode('login');
                        }}
                        className="w-full py-2 bg-slate-900 hover:bg-rose-600 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                      >
                        অর্ডার করতে লগইন করুন
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* When LOGGED IN: Beautiful Full Reseller Dashboard */
        <div>
          {/* Status Alert for Pending Verification */}
          {profile?.status === 'pending' && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-5 sm:p-6 text-amber-950 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Clock className="w-10 h-10 text-amber-600 shrink-0" />
                <div>
                  <h3 className="text-sm sm:text-base font-black text-amber-950 mb-0.5">
                    আপনার রেজিস্ট্রেশন আবেদনটি অপেক্ষমাণ (Pending Verification)
                  </h3>
                  <p className="text-xs text-amber-800">
                    ধন্যবাদ, {profile.name}! আপনার TrxID ({profile.registrationFeeTrxId || 'N/A'}) অ্যাডমিন কর্তৃক যাচাই করা হচ্ছে। তবে এখনই আপনি পাইকারি পণ্য ব্রাউজ করতে ও ড্রপশিপিং অর্ডার জমা দিতে পারেন।
                  </p>
                </div>
              </div>
              <button
                onClick={loadProfile}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" /> স্ট্যাটাস রিফ্রেশ
              </button>
            </div>
          )}

          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            {/* 1. Available Wallet Balance */}
            <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl p-4 sm:p-5 border border-emerald-200 shadow-sm relative overflow-hidden">
              <div className="text-emerald-800 text-xs font-bold mb-1 flex items-center justify-between">
                <span>উত্তোলনযোগ্য ব্যালেন্স</span>
                <Wallet className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-700">
                ৳{(profile?.availableBalance ?? 0).toLocaleString('bn-BD')}
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[10px] text-emerald-600">উত্তোলন বা ডেলিভারি ফি চার্জে ব্যবহার্য</span>
                <button
                  onClick={() => setShowWithdrawModal(true)}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                >
                  উত্তোলন করুন &rarr;
                </button>
              </div>
            </div>

            {/* 2. In-Review Profit */}
            <div className="bg-gradient-to-br from-amber-50 to-white rounded-2xl p-4 sm:p-5 border border-amber-200 shadow-sm">
              <div className="text-amber-800 text-xs font-bold mb-1 flex items-center justify-between">
                <span>রিভিউতে প্রফিট</span>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <Clock className="w-3 h-3" /> রিভিউতে
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-700">
                ৳{(profile?.pendingEarnings ?? 0).toLocaleString('bn-BD')}
              </div>
              <div className="text-[10px] text-amber-700 mt-1.5">
                ডেলিভারি সম্পন্ন হলে স্বয়ংক্রিয়ভাবে ব্যালেন্সে যুক্ত হবে
              </div>
            </div>

            {/* 3. Total Lifetime Earnings */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-bold mb-1 flex items-center justify-between">
                <span>মোট সফল আয়</span>
                <TrendingUp className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900">
                ৳{(profile?.totalEarnings ?? 0).toLocaleString('bn-BD')}
              </div>
              <div className="text-[10px] text-slate-400 mt-1.5">
                মোট {profile?.totalOrdersCount ?? 0} টি ড্রপশিপ অর্ডার
              </div>
            </div>

            {/* 4. Referral Earnings */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-bold mb-1 flex items-center justify-between">
                <span>রেফারেল আয় (৳১০০/জন)</span>
                <Gift className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-blue-600">
                ৳{(profile?.referralEarnings ?? 0).toLocaleString('bn-BD')}
              </div>
              <div className="text-[10px] text-blue-600 mt-1.5">
                মোট {profile?.referralCount ?? 0} জন রিসেলার যুক্ত হয়েছে
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-white rounded-2xl p-1.5 shadow-sm border border-slate-200 mb-6 overflow-x-auto gap-1">
            <button
              onClick={() => setDashboardTab('catalog')}
              className={`flex-1 min-w-[120px] py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                dashboardTab === 'catalog'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>পাইকারি ক্যাটালগ ({resellerProducts.length})</span>
            </button>
            <button
              onClick={() => setDashboardTab('orders')}
              className={`flex-1 min-w-[120px] py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                dashboardTab === 'orders'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>আমার অর্ডার ({myOrders.length})</span>
            </button>
            <button
              onClick={() => setDashboardTab('promo')}
              className={`flex-1 min-w-[120px] py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                dashboardTab === 'promo'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Gift className="w-4 h-4" />
              <span>প্রমো ও রেফারেল</span>
            </button>
            <button
              onClick={() => setDashboardTab('wallet')}
              className={`flex-1 min-w-[120px] py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                dashboardTab === 'wallet'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>টাকা উত্তোলন ({withdrawals.length})</span>
            </button>
            <button
              onClick={() => setDashboardTab('profile')}
              className={`flex-1 min-w-[100px] py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                dashboardTab === 'profile'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4" />
              <span>প্রোফাইল</span>
            </button>
          </div>

          {/* TAB 1: Product Catalog with Category Organization & Live Profit Calculator */}
          {dashboardTab === 'catalog' && (
            <div>
              {/* Category Horizontal Filter Bar (matching main dashboard) */}
              <div className="bg-white rounded-3xl p-3 sm:p-4 border border-slate-200 mb-6 shadow-xs">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-none">
                        ক্যাটাগরি অনুযায়ী পণ্য সাজানো
                      </h4>
                      <span className="text-[10px] text-slate-500 font-medium">
                        মূল শপের মতো ক্যাটাগরি বেছে নিয়ে সহজেই পণ্য খুঁজুন
                      </span>
                    </div>
                  </div>
                  {selectedCategory !== 'all' && (
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
                    >
                      সব দেখুন
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {/* All Categories Chip */}
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                      selectedCategory === 'all'
                        ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>সকল ক্যাটাগরি</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${selectedCategory === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                      {resellerProducts.length}
                    </span>
                  </button>

                  {/* Dynamic Category Chips */}
                  {categories.map(cat => {
                    const isSelected = selectedCategory === cat.id || selectedCategory === cat.slug;
                    const catCount = resellerProducts.filter(p => p.category === cat.id || p.category === cat.slug).length;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.slug || cat.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        <Tag className="w-3.5 h-3.5" />
                        <span>{cat.banglaName}</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                          {catCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Search bar */}
              <div className="flex items-center gap-3 mb-6 bg-white p-3 rounded-2xl border border-slate-200">
                <Search className="w-5 h-5 text-slate-400 ml-2" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  placeholder="ক্যাটালগ থেকে পণ্য বা SKU খুঁজুন..."
                  className="w-full text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
                />
                {catalogSearch && (
                  <button
                    onClick={() => setCatalogSearch('')}
                    className="text-xs text-slate-400 hover:text-slate-600 px-2 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openImageSearch('reseller')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl border border-emerald-300 text-xs shrink-0 transition shadow-xs cursor-pointer"
                  title="কাস্টমারের ছবি দিয়ে পাইকারি পণ্য খুঁজুন"
                >
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline">ছবি দিয়ে খুঁজুন</span>
                </button>
              </div>

              {filteredCatalog.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-slate-200">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <h4 className="font-bold text-slate-700 text-sm">এই ক্যাটাগরিতে কোনো পণ্য পাওয়া যায়নি</h4>
                  <p className="text-xs text-slate-400 mt-1">অন্য ক্যাটাগরি বেছে নিন অথবা সার্চ পরিবর্তন করুন।</p>
                  <button
                    onClick={() => { setSelectedCategory('all'); setCatalogSearch(''); }}
                    className="mt-4 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-rose-600 transition-colors cursor-pointer"
                  >
                    সকল পণ্য দেখুন
                  </button>
                </div>
              ) : (
                /* Products Grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredCatalog.map(product => {
                    const wholesalePrice = product.resellerPrice ?? Math.round((product.shopPrice ?? product.regularPrice) * 0.78);
                    const shopPrice = product.shopPrice ?? (product.salePrice ?? product.regularPrice);
                    const customSelling = customPrices[product.id] ?? shopPrice;
                    const profitPerUnit = customSelling - wholesalePrice;
                    const categoryObj = categories.find(c => c.id === product.category || c.slug === product.category);

                    return (
                      <div
                        key={product.id}
                        className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
                      >
                        <div>
                          {/* Product Image, Stock & Category Badges */}
                          <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100 mb-3">
                            <img
                              src={getProductImageUrl(product.mainImage)}
                              alt={product.name}
                              onError={handleImageError}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 z-10">
                              <div className="bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                স্টক: {product.stock} টি
                              </div>
                              {categoryObj && (
                                <div className="bg-rose-600/90 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  {categoryObj.banglaName}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Product Name & SKU */}
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3
                              onClick={() => setViewingProductDetails(product)}
                              className="font-bold text-sm text-slate-900 line-clamp-2 leading-snug hover:text-rose-600 transition-colors cursor-pointer"
                              title="পূর্ণ প্রেসক্রিপশন ও বিবরণ দেখতে ক্লিক করুন"
                            >
                              {product.banglaTitle || product.name}
                            </h3>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-2">
                            <span className="font-mono">SKU: {product.sku}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyMarketingPitch(product)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200/80 cursor-pointer"
                              title="ফেসবুক/হোয়াটসঅ্যাপে পোস্ট করার জন্য সম্পূর্ণ টেক্সট কপি করুন"
                            >
                              <Copy className="w-3 h-3" /> কপি পোস্ট
                            </button>
                          </div>

                          {/* Product Description / Prescription Box */}
                          <div className="bg-slate-50/90 rounded-2xl p-2.5 border border-slate-200/80 mb-3 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5 text-rose-600" />
                                <span>পণ্যের প্রেসক্রিপশন ও বিবরণ:</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setViewingProductDetails(product)}
                                className="text-[10px] text-rose-600 hover:text-rose-700 font-bold flex items-center gap-0.5 cursor-pointer hover:underline"
                              >
                                <Eye className="w-3 h-3" /> বড় করে দেখুন
                              </button>
                            </div>
                            <p className={`text-[11px] text-slate-600 leading-relaxed ${expandedDescMap[product.id] ? '' : 'line-clamp-2'}`}>
                              {product.description || '১০০% অরিজিনাল ও প্রিমিয়াম কোয়ালিটি পণ্য। ফুল ইনট্যাক্ট প্যাকেট ও দ্রুত ডেলিভারি গ্যারান্টি।'}
                            </p>
                            {product.description && product.description.length > 70 && (
                              <button
                                type="button"
                                onClick={() => setExpandedDescMap(prev => ({ ...prev, [product.id]: !prev[product.id] }))}
                                className="text-[10px] font-bold text-slate-500 hover:text-slate-800 block cursor-pointer pt-0.5"
                              >
                                {expandedDescMap[product.id] ? 'সংক্ষেপ করুন ▴' : 'সম্পূর্ণ বিবরণ পড়ুন ▾'}
                              </button>
                            )}
                          </div>

                          {/* Price Comparison Box */}
                          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 mb-3 space-y-1.5 text-xs">
                            <div className="flex justify-between items-center text-slate-500">
                              <span>কাস্টমার শপ রেট:</span>
                              <span className="font-bold text-slate-700">৳{shopPrice.toLocaleString('bn-BD')}</span>
                            </div>
                            <div className="flex justify-between items-center text-rose-700 font-bold">
                              <span>রিসেলার পাইকারি রেট:</span>
                              <span className="bg-rose-100 px-2 py-0.5 rounded-lg text-rose-800 font-black">
                                ৳{wholesalePrice.toLocaleString('bn-BD')}
                              </span>
                            </div>
                          </div>

                          {/* Live Profit Calculator Input */}
                          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3 mb-3">
                            <div className="flex items-center justify-between text-xs font-bold text-emerald-950 mb-1">
                              <span>আপনার বিক্রয় মূল্য (৳):</span>
                              <span className={`text-[11px] font-black ${profitPerUnit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                {profitPerUnit >= 0 ? `লাভ: +৳${profitPerUnit}` : `ঘাটতি: ৳${profitPerUnit}`}
                              </span>
                            </div>
                            <input
                              type="number"
                              min={wholesalePrice}
                              value={customSelling}
                              onChange={e => {
                                const val = Number(e.target.value);
                                setCustomPrices(prev => ({ ...prev, [product.id]: val }));
                              }}
                              className="w-full px-3 py-1.5 rounded-xl border border-emerald-300 bg-white text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setViewingProductDetails(product)}
                            className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                            title="পণ্যের সম্পূর্ণ প্রেসক্রিপশন ও ছবি দেখুন"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-600" />
                            <span>বিবরণ</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openOrderModal(product)}
                            disabled={product.stock <= 0}
                            className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                          >
                            <ShoppingBag className="w-4 h-4" />
                            {product.stock > 0 ? 'ড্রপশিপ অর্ডার' : 'স্টক আউট'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: My Orders with In-Review vs Delivered Profit Clarity */}
          {dashboardTab === 'orders' && (
            <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h3 className="font-black text-slate-800 text-base">আপনার ড্রপশিপিং অর্ডারসমূহ</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    অর্ডার ডেলিভারি সফল হলে লাভের টাকা স্বয়ংক্রিয়ভাবে ওয়ালেটে যোগ হয়ে যাবে।
                  </p>
                </div>
                <button
                  onClick={loadResellerOrders}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold inline-flex items-center gap-1 cursor-pointer bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> রিফ্রেশ করুন
                </button>
              </div>

              {/* Order Status Filters */}
              {(() => {
                const inReviewOrders = myOrders.filter(o => o.orderStatus !== 'delivered' && o.orderStatus !== 'cancelled');
                const deliveredOrders = myOrders.filter(o => o.orderStatus === 'delivered');
                const cancelledOrders = myOrders.filter(o => o.orderStatus === 'cancelled');
                const inReviewProfitTotal = inReviewOrders.reduce((acc, o) => acc + (o.resellerDetails?.estimatedProfit || 0), 0);
                const deliveredProfitTotal = deliveredOrders.reduce((acc, o) => acc + (o.resellerDetails?.estimatedProfit || 0), 0);

                const displayedOrders = myOrders.filter(o => {
                  if (orderFilterTab === 'in_review') return o.orderStatus !== 'delivered' && o.orderStatus !== 'cancelled';
                  if (orderFilterTab === 'delivered') return o.orderStatus === 'delivered';
                  if (orderFilterTab === 'cancelled') return o.orderStatus === 'cancelled';
                  return true;
                });

                return (
                  <div>
                    {/* Status Summary Pills */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
                      <button
                        onClick={() => setOrderFilterTab('all')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                          orderFilterTab === 'all'
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        সকল অর্ডার ({myOrders.length})
                      </button>
                      <button
                        onClick={() => setOrderFilterTab('in_review')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                          orderFilterTab === 'in_review'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>⏳ লাভ রিভিউতে আছে ({inReviewOrders.length})</span>
                        <span className="font-mono text-[10px] bg-black/10 px-1.5 py-0.2 rounded-full">
                          ৳{inReviewProfitTotal.toLocaleString('bn-BD')}
                        </span>
                      </button>
                      <button
                        onClick={() => setOrderFilterTab('delivered')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                          orderFilterTab === 'delivered'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>✅ লাভ ওয়ালেটে যুক্ত ({deliveredOrders.length})</span>
                        <span className="font-mono text-[10px] bg-black/10 px-1.5 py-0.2 rounded-full">
                          ৳{deliveredProfitTotal.toLocaleString('bn-BD')}
                        </span>
                      </button>
                      {cancelledOrders.length > 0 && (
                        <button
                          onClick={() => setOrderFilterTab('cancelled')}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                            orderFilterTab === 'cancelled'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                        >
                          বাতিল ({cancelledOrders.length})
                        </button>
                      )}
                    </div>

                    {displayedOrders.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        এই ফিল্টারে কোনো অর্ডার পাওয়া যায়নি।
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400 font-bold">
                              <th className="py-2.5 px-3">অর্ডার নং</th>
                              <th className="py-2.5 px-3">কাস্টমার</th>
                              <th className="py-2.5 px-3">পণ্য ও ভ্যারিয়েন্ট</th>
                              <th className="py-2.5 px-3">কাস্টমার বিল</th>
                              <th className="py-2.5 px-3">লাভের স্ট্যাটাস</th>
                              <th className="py-2.5 px-3">অগ্রিম ডেলিভারি ফি</th>
                              <th className="py-2.5 px-3">ডেলিভারি ট্র্যাকিং</th>
                              <th className="py-2.5 px-3">তারিখ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            {displayedOrders.map(order => {
                              const isDelivered = order.orderStatus === 'delivered';
                              const isCancelled = order.orderStatus === 'cancelled';
                              const profit = order.resellerDetails?.estimatedProfit ?? 0;
                              const deliveryPaid = order.resellerDetails?.deliveryFeePaid ?? advanceDeliveryFee;
                              const payMethod = order.resellerDetails?.deliveryPaymentMethod || 'wallet';

                              return (
                                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-3 px-3 font-mono font-bold text-slate-900">
                                    {order.orderNumber}
                                  </td>
                                  <td className="py-3 px-3">
                                    <div className="font-bold">{order.customer.fullName}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">{order.customer.phone}</div>
                                    <div className="text-[10px] text-slate-500 truncate max-w-[140px]">{order.customer.fullAddress}</div>
                                  </td>
                                  <td className="py-3 px-3 max-w-xs">
                                    {order.items.map((it, idx) => (
                                      <div key={idx} className="truncate">
                                        <span className="font-semibold">{it.name}</span>
                                        <span className="text-[10px] text-slate-500"> (x{it.quantity})</span>
                                        {it.selectedVariant && (
                                          <span className="ml-1 text-[10px] text-rose-600 bg-rose-50 px-1 py-0.2 rounded font-bold">
                                            {it.selectedVariant}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </td>
                                  <td className="py-3 px-3 font-bold text-slate-900">
                                    ৳{order.totalAmount.toLocaleString('bn-BD')}
                                  </td>
                                  <td className="py-3 px-3">
                                    {isDelivered ? (
                                      <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-2 py-1 rounded-xl text-center">
                                        <div className="font-black text-xs text-emerald-700">+৳{profit}</div>
                                        <div className="text-[9px] font-bold text-emerald-600">✅ ওয়ালেটে যুক্ত হয়েছে</div>
                                      </div>
                                    ) : isCancelled ? (
                                      <div className="bg-rose-50 border border-rose-200 text-rose-700 px-2 py-1 rounded-xl text-center text-[10px] font-bold">
                                        ❌ অর্ডার বাতিল
                                      </div>
                                    ) : (
                                      <div className="bg-amber-50 border border-amber-300 text-amber-900 px-2 py-1 rounded-xl text-center">
                                        <div className="font-black text-xs text-amber-700">৳{profit}</div>
                                        <div className="text-[9px] font-bold text-amber-600 flex items-center justify-center gap-0.5">
                                          <Clock className="w-2.5 h-2.5" /> রিভিউতে আছে
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3 px-3">
                                    <span className="inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-800">
                                      ৳{deliveryPaid} ({payMethod === 'wallet' ? '💼 ওয়ালেট' : payMethod})
                                    </span>
                                    {order.resellerDetails?.deliveryPaymentTrxId && (
                                      <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                                        Trx: {order.resellerDetails.deliveryPaymentTrxId}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3 px-3">
                                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                      isDelivered
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : isCancelled
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-blue-100 text-blue-800'
                                    }`}>
                                      {order.orderStatus === 'pending'
                                        ? '⏳ পেন্ডিং'
                                        : order.orderStatus === 'confirmed'
                                        ? '📦 নিশ্চিত'
                                        : order.orderStatus === 'processing'
                                        ? '🔄 প্যাকিং চলছে'
                                        : order.orderStatus === 'shipped'
                                        ? '🚚 কুরিয়ারে পথে'
                                        : order.orderStatus === 'delivered'
                                        ? '🎉 ডেলিভারি সম্পন্ন'
                                        : 'বাতিল'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-[10px] text-slate-400 whitespace-nowrap">
                                    {new Date(order.createdAt).toLocaleDateString('bn-BD')}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 3: Promo & Referral System */}
          {dashboardTab === 'promo' && (
            <div className="space-y-6">
              {/* Promo Banner Card */}
              <div className="bg-gradient-to-br from-rose-500 via-rose-600 to-rose-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10 max-w-2xl">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold mb-3">
                    <Sparkles className="w-3.5 h-3.5" /> রেফারেল ও পার্টনার প্রোগ্রাম
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black mb-2">
                    বন্ধুদের রেফার করে জিতে নিন প্রতি রেফারে ৳১০০ বোনাস!
                  </h3>
                  <p className="text-rose-100 text-xs sm:text-sm leading-relaxed mb-6">
                    আপনার পরিচিত যে কাউকে রিসেলার হিসেবে যুক্ত করুন। আপনার প্রমো কোড ব্যবহার করলে তিনি পাবেন ৳৭০০ বিশাল ছাড় (৳১,০০০ এর জায়গায় ফি মাত্র ৳৩০০), আর সাথে সাথেই আপনার অ্যাকাউন্টে যোগ হবে ৳১০০ নগদ ক্যাশ!
                  </p>

                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-[11px] text-rose-200 uppercase font-bold block mb-1">
                        আপনার নিজস্ব ইউনিক প্রমো কোড
                      </span>
                      <div className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-white">
                        {profile?.promoCode || 'ZX-RES-2026'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyPromoCode(profile?.promoCode || 'ZX-RES-2026')}
                        className="flex-1 sm:flex-none px-4 py-2.5 bg-white text-rose-600 hover:bg-rose-50 font-bold text-xs rounded-xl transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {hasCopiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        <span>{hasCopiedCode ? 'কপি হয়েছে!' : 'কোড কপি করুন'}</span>
                      </button>
                      <button
                        onClick={() => handleCopyShareLink(profile?.promoCode || 'ZX-RES-2026')}
                        className="flex-1 sm:flex-none px-4 py-2.5 bg-rose-900/60 hover:bg-rose-900/80 text-white font-bold text-xs rounded-xl transition-all border border-white/30 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {hasCopiedLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Share2 className="w-4 h-4" />}
                        <span>{hasCopiedLink ? 'লিংক কপি হয়েছে!' : 'শেয়ার লিংক'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* How it works steps */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 font-bold flex items-center justify-center text-sm mb-3">
                    ১
                  </div>
                  <h4 className="font-bold text-sm text-slate-800 mb-1">কোড শেয়ার করুন</h4>
                  <p className="text-xs text-slate-500">
                    আপনার ইউনিক কোডটি ফেসবুক গ্রুপ, পেজ বা বন্ধুদের সাথে শেয়ার করুন।
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 font-bold flex items-center justify-center text-sm mb-3">
                    ২
                  </div>
                  <h4 className="font-bold text-sm text-slate-800 mb-1">বন্ধু পাবে ৳৭০০ ছাড়</h4>
                  <p className="text-xs text-slate-500">
                    রেজিস্ট্রেশনের সময় আপনার কোড বসালে সে মাত্র ৳৩০০ টাকায় একাউন্ট খুলতে পারবে।
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 font-bold flex items-center justify-center text-sm mb-3">
                    ৩
                  </div>
                  <h4 className="font-bold text-sm text-slate-800 mb-1">আপনি পাবেন ৳১০০ ক্যাশ</h4>
                  <p className="text-xs text-slate-500">
                    প্রতি সফল রেফারে আপনার ব্যালেন্সে ৳১০০ স্বয়ংক্রিয়ভাবে ক্রেডিট হবে।
                  </p>
                </div>
              </div>

              {/* Referral Stats Box */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200">
                <h4 className="font-bold text-sm text-slate-800 mb-4">রেফারেল পারফরম্যান্স ওভারভিউ</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-xs text-slate-500 block mb-1">মোট সফল রেফারেল</span>
                    <span className="text-2xl font-black text-slate-800">{profile?.referralCount || 0} জন</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-xs text-slate-500 block mb-1">রেফারেল থেকে সর্বমোট আয়</span>
                    <span className="text-2xl font-black text-emerald-600">
                      ৳{(profile?.referralEarnings || 0).toLocaleString('bn-BD')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Wallet & Withdrawals */}
          {dashboardTab === 'wallet' && (
            <div className="space-y-6">
              {/* Balance Card */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div>
                  <span className="text-xs font-bold text-slate-400 block mb-1 uppercase tracking-wider">
                    উত্তোলনযোগ্য কারেন্ট ব্যালেন্স
                  </span>
                  <div className="text-3xl sm:text-4xl font-black text-emerald-600">
                    ৳{(profile?.availableBalance ?? profile?.totalEarnings ?? 0).toLocaleString('bn-BD')}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    ন্যূনতম উত্তোলনের সীমা: ৳{minPayoutAmount} | পেমেন্ট মাধ্যম: bKash, Nagad, Rocket
                  </p>
                </div>
                <button
                  onClick={() => setShowWithdrawModal(true)}
                  className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <ArrowUpRight className="w-5 h-5" /> টাকা উত্তোলন করুন
                </button>
              </div>

              {/* Withdrawals History */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-slate-800 text-base">টাকা উত্তোলনের ইতিহাস</h3>
                  <button
                    onClick={loadWithdrawals}
                    className="text-xs text-rose-600 hover:text-rose-700 font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> রিফ্রেশ
                  </button>
                </div>

                {withdrawals.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    এখনো কোনো টাকা উত্তোলনের আবেদন করেননি।
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 font-bold">
                          <th className="py-2.5 px-3">পরিমাণ</th>
                          <th className="py-2.5 px-3">পেমেন্ট মেথড ও নম্বর</th>
                          <th className="py-2.5 px-3">স্ট্যাটাস</th>
                          <th className="py-2.5 px-3">TrxID / নোট</th>
                          <th className="py-2.5 px-3">তারিখ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {withdrawals.map(w => (
                          <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-3 font-bold text-sm text-slate-900">
                              ৳{w.amount.toLocaleString('bn-BD')}
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-bold">{w.paymentMethod}</span> ({w.accountNumber})
                            </td>
                            <td className="py-3 px-3">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                w.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : w.status === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {w.status === 'completed' ? 'পেমেন্ট সম্পন্ন' : w.status === 'pending' ? 'অপেক্ষমাণ' : 'বাতিল'}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600">
                              {w.adminTrxId || w.rejectionReason || '—'}
                            </td>
                            <td className="py-3 px-3 text-slate-400">
                              {new Date(w.requestedAt).toLocaleDateString('bn-BD')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: Profile Info */}
          {dashboardTab === 'profile' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm max-w-2xl">
              <h3 className="font-black text-slate-800 text-base mb-4">আমার রিসেলার প্রোফাইল তথ্য</h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">নাম:</span>
                  <span className="font-bold text-slate-900">{profile?.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">মোবাইল:</span>
                  <span className="font-bold text-slate-900">{profile?.phone}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">ইমেইল:</span>
                  <span className="font-bold text-slate-900">{profile?.email}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">শপ / পেজের নাম:</span>
                  <span className="font-bold text-slate-900">{profile?.shopName || 'ব্যক্তিগত'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">ঠিকানা:</span>
                  <span className="font-bold text-slate-900">{profile?.address || '—'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">আমার প্রমো কোড:</span>
                  <span className="font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                    {profile?.promoCode || '—'}
                  </span>
                </div>
                {profile?.referredByPromoCode && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">রেফারার কোড:</span>
                    <span className="font-mono text-slate-700">{profile.referredByPromoCode}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">রেজিস্ট্রেশন পেমেন্ট TrxID:</span>
                  <span className="font-mono text-slate-700">{profile?.registrationFeeTrxId || '—'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">অ্যাকাউন্ট স্ট্যাটাস:</span>
                  <span className={`font-bold ${profile?.status === 'approved' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {profile?.status === 'approved' ? 'ভেরিফাইড (Approved)' : 'অপেক্ষমাণ (Pending)'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dropshipping Order Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-7 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-slate-900 mb-1">
              ড্রপশিপিং অর্ডার তৈরি করুন
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              আপনার কাস্টমারের ডেলিভারি ঠিকানা দিন। ZX Shop টিম পণ্যটি ডেলিভারি করবে এবং কালেকশন শেষে আপনার লাভ ব্যালেন্সে যোগ হবে।
            </p>

            {/* Product Summary */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl mb-4 border border-slate-200">
              <img
                src={getProductImageUrl(selectedProduct.mainImage)}
                alt={selectedProduct.name}
                onError={handleImageError}
                className="w-14 h-14 rounded-xl object-cover bg-white"
              />
              <div className="flex-1 min-w-0 text-xs">
                <h4 className="font-bold text-slate-900 truncate">{selectedProduct.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-500">
                    পাইকারি খরচ: <strong>৳{selectedProduct.resellerPrice ?? Math.round((selectedProduct.shopPrice ?? selectedProduct.regularPrice) * 0.78)}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Product Prescription / Description Preview */}
            <div className="p-3 bg-slate-50/90 rounded-2xl mb-4 border border-slate-200 text-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-rose-600" />
                <span>পণ্যের প্রেসক্রিপশন ও বিবরণ (Specs & Details):</span>
              </span>
              <p className="text-[11px] text-slate-600 leading-relaxed max-h-24 overflow-y-auto">
                {selectedProduct.description || '১০০% অরিজিনাল প্রিমিয়াম কোয়ালিটি পণ্য। ডেলিভারির সময় চেক করে নেওয়ার সুবিধা।'}
              </p>
            </div>

            <form onSubmit={handleSubmitDropshipOrder} className="space-y-4">
              {/* Product Variants (if available) */}
              {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                  <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-rose-600" />
                    <span>ভ্যারিয়েন্ট নির্বাচন করুন (সাইজ / কালার)</span>
                  </div>
                  {selectedProduct.variants.map((v, vIdx) => (
                    <div key={vIdx} className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700 block">{v.name}:</label>
                      <div className="flex flex-wrap gap-1.5">
                        {v.options.map((opt, oIdx) => {
                          const isSelected = selectedOrderVariants[v.name] === opt;
                          return (
                            <button
                              type="button"
                              key={oIdx}
                              onClick={() => setSelectedOrderVariants(prev => ({ ...prev, [v.name]: opt }))}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">পরিমাণ (Quantity)</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedProduct.stock}
                    value={orderQty}
                    onChange={e => setOrderQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">প্রতি পিস বিক্রয় মূল্য (৳)</label>
                  <input
                    type="number"
                    min={selectedProduct.resellerPrice ?? 0}
                    value={orderSellingPrice}
                    onChange={e => setOrderSellingPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* Customer Information Section */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-rose-600" />
                  <span>কাস্টমারের ডেলিভারি তথ্য</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">কাস্টমারের পূর্ণ নাম <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={custName}
                    onChange={e => setCustName(e.target.value)}
                    placeholder="e.g. তানভীর আহমেদ"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">কাস্টমারের মোবাইল নম্বর <span className="text-rose-500">*</span></label>
                  <input
                    type="tel"
                    value={custPhone}
                    onChange={e => setCustPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ডেলিভারি এরিয়া / জোন <span className="text-rose-500">*</span></label>
                  <select
                    value={custZoneId}
                    onChange={e => setCustZoneId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    {deliveryZones.map(z => (
                      <option key={z.id} value={z.id}>
                        {z.name} (ডেলিভারি চার্জ: ৳{z.rate})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">পূর্ণ ডেলিভারি ঠিকানা <span className="text-rose-500">*</span></label>
                  <textarea
                    value={custAddress}
                    onChange={e => setCustAddress(e.target.value)}
                    placeholder="বাড়ি নং, রোড নং, এলাকা, থানা ও জেলা..."
                    required
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ডেলিভারি নোট বা স্পেশাল ইন্সট্রাকশন (ঐচ্ছিক)</label>
                  <input
                    type="text"
                    value={custNotes}
                    onChange={e => setCustNotes(e.target.value)}
                    placeholder="e.g. পার্সেলের গায়ে আপনার পেজের নাম উল্লেখ করা থাকবে"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* 📋 অর্ডার সারাংশ (Order Summary matching user's design) */}
              {(() => {
                const wholesaleCost = selectedProduct.resellerPrice ?? Math.round((selectedProduct.shopPrice ?? selectedProduct.regularPrice) * 0.78);
                const estProfit = Math.max(0, (orderSellingPrice - wholesaleCost) * orderQty);
                const selectedZoneObj = deliveryZones.find(z => z.id === custZoneId) || deliveryZones[0];
                const courierRate = selectedZoneObj?.rate ?? 100;
                const customerCollectionTotal = (orderSellingPrice * orderQty) + courierRate;

                return (
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-xs">
                    <div className="font-black text-slate-800 text-xs flex items-center justify-between pb-1.5 border-b border-slate-200">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-rose-600" />
                        <span>📋 অর্ডার সারাংশ</span>
                      </span>
                      <span className="text-[11px] text-slate-400 font-normal">ড্রপশিপ হিসাব</span>
                    </div>

                    <div className="flex justify-between items-center text-slate-600">
                      <span>কাস্টমার মোট বিল (কুরিয়ার কালেকশন):</span>
                      <span className="font-bold text-slate-900">৳{customerCollectionTotal.toLocaleString('bn-BD')}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500 text-[11px]">
                      <span>পাইকারি পণ্যের খরচ ({orderQty} পিস):</span>
                      <span>৳{(wholesaleCost * orderQty).toLocaleString('bn-BD')}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500 text-[11px]">
                      <span>কুরিয়ার ডেলিভারি চার্জ:</span>
                      <span>৳{courierRate.toLocaleString('bn-BD')}</span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 px-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 font-bold">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        <span>রিসেলার প্রফিট (সম্ভাব্য নিট লাভ):</span>
                      </span>
                      <span className="font-black text-emerald-700 text-sm">+{estProfit.toLocaleString('bn-BD')}৳</span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                      <div>
                        <span className="font-bold text-slate-900 block">অগ্রিম ডেলিভারি ফি:</span>
                        <span className="text-[10px] text-slate-500">প্রতি অর্ডারে নির্ধারিত সার্ভিস ও ডেলিভারি ফি</span>
                      </div>
                      <span className="font-black text-rose-600 text-base">৳{advanceDeliveryFee.toLocaleString('bn-BD')}</span>
                    </div>
                  </div>
                );
              })()}

              {/* 💳 পেমেন্ট মেথড (Advance Delivery Fee Payment Methods) */}
              <div className="bg-white rounded-2xl p-4 border border-rose-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-rose-600" />
                    <span>💳 পেমেন্ট মেথড (অগ্রিম ডেলিভারি ফি: ৳{advanceDeliveryFee})</span>
                  </div>
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                    অগ্রিম প্রযোজ্য
                  </span>
                </div>

                {/* Option 1: Reseller Wallet Balance */}
                {(() => {
                  const currentBal = profile?.availableBalance ?? 0;
                  const hasEnough = currentBal >= advanceDeliveryFee;

                  return (
                    <div
                      onClick={() => setOrderPaymentMethod('wallet')}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                        orderPaymentMethod === 'wallet'
                          ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="deliveryPaymentMethodRadio"
                            checked={orderPaymentMethod === 'wallet'}
                            onChange={() => setOrderPaymentMethod('wallet')}
                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div>
                            <span className="font-bold text-xs text-slate-900 block">
                              💼 রিসেলার ওয়ালেট ব্যালেন্স
                            </span>
                            <span className="text-[11px] text-slate-500">
                              বর্তমান ব্যালেন্স: <strong className={hasEnough ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>৳{currentBal.toLocaleString('bn-BD')}</strong>
                            </span>
                          </div>
                        </label>
                        {hasEnough ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold shrink-0">
                            পর্যাপ্ত ব্যালেন্স আছে
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-bold shrink-0">
                            অপর্যাপ্ত ব্যালেন্স
                          </span>
                        )}
                      </div>

                      {orderPaymentMethod === 'wallet' && (
                        <div className="mt-2.5 pt-2 border-t border-emerald-200/60 text-[11px] text-emerald-800">
                          {hasEnough ? (
                            <p className="flex items-center gap-1 font-medium">
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>অর্ডার নিশ্চিত করলে আপনার ওয়ালেট থেকে সরাসরি ৳{advanceDeliveryFee} কাটা হবে।</span>
                            </p>
                          ) : (
                            <p className="text-amber-800 font-medium bg-amber-50 p-2 rounded-xl border border-amber-200">
                              ⚠️ আপনার ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই (প্রয়োজন ৳{advanceDeliveryFee})। অনুগ্রহ করে নিচের বিকাশ, নগদ বা রকেট নির্বাচন করে পেমেন্ট করুন।
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Option 2: bKash / Nagad / Rocket Manual Payment */}
                <div
                  onClick={() => {
                    if (orderPaymentMethod === 'wallet') {
                      setOrderPaymentMethod(manualMethodType);
                    }
                  }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                    orderPaymentMethod !== 'wallet'
                      ? 'border-rose-500 bg-rose-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="radio"
                      name="deliveryPaymentMethodRadio"
                      checked={orderPaymentMethod !== 'wallet'}
                      onChange={() => setOrderPaymentMethod(manualMethodType)}
                      className="w-4 h-4 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-bold text-xs text-slate-900">
                      📱 বিকাশ / নগদ / রকেট (সেন্ড মানি)
                    </span>
                  </label>

                  {orderPaymentMethod !== 'wallet' && (
                    <div className="mt-3 space-y-3 pt-2 border-t border-rose-200/60 text-xs">
                      {/* Method Toggle Buttons */}
                      <div className="flex gap-2">
                        {(['bKash', 'Nagad', 'Rocket'] as const).map(m => (
                          <button
                            type="button"
                            key={m}
                            onClick={() => {
                              setManualMethodType(m);
                              setOrderPaymentMethod(m);
                            }}
                            className={`flex-1 py-1.5 px-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                              orderPaymentMethod === m
                                ? m === 'bKash'
                                  ? 'bg-pink-600 text-white shadow-xs'
                                  : m === 'Nagad'
                                  ? 'bg-orange-600 text-white shadow-xs'
                                  : 'bg-purple-600 text-white shadow-xs'
                                : 'bg-white text-slate-700 border border-slate-200'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>

                      {/* Instructions with Store Number */}
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-700 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-slate-500">{orderPaymentMethod} পার্সোনাল নম্বর:</span>
                          <span className="font-mono font-bold text-rose-600 text-xs">
                            {orderPaymentMethod === 'bKash'
                              ? settings?.bkashNumber || '01700000000'
                              : orderPaymentMethod === 'Nagad'
                              ? settings?.nagadNumber || '01700000000'
                              : settings?.rocketNumber || '01700000000'}
                          </span>
                        </div>
                        <p className="text-slate-500 text-[10px]">
                          অগ্রিম ডেলিভারি ফি <strong>৳{advanceDeliveryFee}</strong> Send Money করে নিচের ঘরে TrxID দিন।
                        </p>
                      </div>

                      {/* TrxID Input */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          ট্রানজেকশন আইডি (TrxID) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={orderTrxId}
                          onChange={e => setOrderTrxId(e.target.value)}
                          placeholder="e.g. 9J8A7B6C5"
                          required
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                        />
                      </div>

                      {/* Sender Phone Input */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          যে নম্বর থেকে টাকা পাঠিয়েছেন (Sender Phone)
                        </label>
                        <input
                          type="tel"
                          value={orderSenderPhone}
                          onChange={e => setOrderSenderPhone(e.target.value)}
                          placeholder="01XXXXXXXXX"
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Terms and conditions agreement checkbox */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={orderAgreedTerms}
                    onChange={e => setOrderAgreedTerms(e.target.checked)}
                    required
                    className="mt-0.5 w-4 h-4 text-rose-600 rounded focus:ring-rose-500 cursor-pointer"
                  />
                  <span>
                    আমি নিশ্চিত করছি যে কাস্টমারের অর্ডার তথ্য সঠিক এবং অগ্রিম ডেলিভারি ফি (৳{advanceDeliveryFee}) পরিশোধের শর্তে একমত।
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmittingOrder || !orderAgreedTerms}
                className="w-full mt-2 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingOrder ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> ড্রপশিপিং অর্ডার তৈরি হচ্ছে...
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" /> ৳{advanceDeliveryFee} অগ্রিম ডেলিভারি ফি দিয়ে অর্ডার নিশ্চিত করুন
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Withdrawal Request Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-7 relative">
            <button
              onClick={() => setShowWithdrawModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-slate-900 mb-1 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-600" /> টাকা উত্তোলন করুন
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              বর্তমান ব্যালেন্স: <strong className="text-emerald-700">৳{(profile?.availableBalance ?? profile?.totalEarnings ?? 0).toLocaleString('bn-BD')}</strong>
            </p>

            <form onSubmit={handleRequestWithdrawal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  উত্তোলনের পরিমাণ (৳) <span className="text-rose-500">* (ন্যূনতম ৳{minPayoutAmount})</span>
                </label>
                <input
                  type="number"
                  min={minPayoutAmount}
                  max={profile?.availableBalance ?? profile?.totalEarnings ?? 0}
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">পেমেন্ট মেথড</label>
                <select
                  value={withdrawMethod}
                  onChange={e => setWithdrawMethod(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="bKash">bKash Personal</option>
                  <option value="Nagad">Nagad Personal</option>
                  <option value="Rocket">Rocket Personal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  মোবাইল নম্বর <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  value={withdrawAccount}
                  onChange={e => setWithdrawAccount(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingWithdraw}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingWithdraw ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> আবেদন পাঠানো হচ্ছে...
                  </>
                ) : (
                  <>
                    উত্তোলন অনুরোধ পাঠান <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Product Full Prescription & Description Modal for Resellers */}
      {viewingProductDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 sm:p-7 relative max-h-[92vh] overflow-y-auto border border-slate-100">
            <button
              onClick={() => setViewingProductDetails(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                পণ্যের পূর্ণ প্রেসক্রিপশন ও স্পেসিফিকেশন
              </span>
              {viewingProductDetails.stock > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ইন স্টক: {viewingProductDetails.stock} টি
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  স্টক শেষ
                </span>
              )}
            </div>

            {/* Product Image & Main Details */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="w-full sm:w-44 h-44 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                <img
                  src={getProductImageUrl(viewingProductDetails.mainImage)}
                  alt={viewingProductDetails.name}
                  onError={handleImageError}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 space-y-2">
                <h3 className="text-base font-black text-slate-900 leading-snug">
                  {viewingProductDetails.banglaTitle || viewingProductDetails.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  SKU: {viewingProductDetails.sku}
                </p>

                {/* Pricing comparison */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">খুচরা শপ মূল্য:</span>
                    <span className="font-bold text-slate-800">
                      ৳{(viewingProductDetails.shopPrice ?? (viewingProductDetails.salePrice ?? viewingProductDetails.regularPrice)).toLocaleString('bn-BD')}
                    </span>
                  </div>
                  <div className="flex justify-between text-rose-700 font-bold">
                    <span>রিসেলার পাইকারি রেট:</span>
                    <span className="bg-rose-100 px-2 py-0.2 rounded text-rose-800 font-black">
                      ৳{(viewingProductDetails.resellerPrice ?? Math.round((viewingProductDetails.shopPrice ?? viewingProductDetails.regularPrice) * 0.78)).toLocaleString('bn-BD')}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold pt-1 border-t border-slate-200/60">
                    <span>সম্ভাব্য লাভ (প্রতি পিস):</span>
                    <span className="font-black">
                      +৳{((viewingProductDetails.shopPrice ?? (viewingProductDetails.salePrice ?? viewingProductDetails.regularPrice)) - (viewingProductDetails.resellerPrice ?? Math.round((viewingProductDetails.shopPrice ?? viewingProductDetails.regularPrice) * 0.78))).toLocaleString('bn-BD')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Full Detailed Description / Prescription */}
            <div className="space-y-2 mb-5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-rose-600" />
                  <span>পণ্যের বিস্তারিত প্রেসক্রিপশন ও গুণাগুণ (Full Description):</span>
                </h4>
                <button
                  type="button"
                  onClick={() => handleCopyMarketingPitch(viewingProductDetails)}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200/80 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> কপি করুন
                </button>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-line max-h-56 overflow-y-auto">
                {viewingProductDetails.description || 'এই পণ্যের ১০০% খাঁটি অরিজিনাল কোয়ালিটি নিশ্চিত। অক্ষত প্যাকেট ও নির্ভরযোগ্য পারফরম্যান্স।'}
              </div>
            </div>

            {/* Available Variants */}
            {viewingProductDetails.variants && viewingProductDetails.variants.length > 0 && (
              <div className="mb-5 bg-rose-50/60 p-3.5 rounded-2xl border border-rose-100 space-y-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-rose-600" />
                  <span>উপলব্ধ সাইজ / কালার অপশন:</span>
                </span>
                <div className="space-y-1.5">
                  {viewingProductDetails.variants.map((v, i) => (
                    <div key={i} className="text-xs">
                      <strong className="text-slate-800">{v.name}:</strong>{' '}
                      <span className="text-slate-600">{v.options.join(', ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Action Buttons */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleCopyMarketingPitch(viewingProductDetails)}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-rose-600" />
                <span>সোশ্যাল মিডিয়া কপি</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const p = viewingProductDetails;
                  setViewingProductDetails(null);
                  openOrderModal(p);
                }}
                disabled={viewingProductDetails.stock <= 0}
                className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>ড্রপশিপ অর্ডার করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
