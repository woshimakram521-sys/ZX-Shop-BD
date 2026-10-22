import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, Category, DeliveryZone, StoreSettings, Order, OrderItemSnapshot } from '../types/ecommerce';
import {
  fallbackCategories,
  fallbackDeliveryZones,
  fallbackSettings,
  fallbackProducts,
} from '../data/fallbackData';

export interface CartItem {
  product: Product;
  quantity: number;
  selectedVariants: Record<string, string>;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ShopContextType {
  // Navigation & Page State
  currentView: string;
  setCurrentView: (view: string) => void;
  selectedProductSlug: string | null;
  setSelectedProductSlug: (slug: string | null) => void;
  selectedCategorySlug: string | null;
  setSelectedCategorySlug: (slug: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  // Store Data
  settings: StoreSettings | null;
  categories: Category[];
  deliveryZones: DeliveryZone[];
  products: Product[];
  featuredProducts: Product[];
  popularProducts: Product[];
  isLoadingBootstrap: boolean;
  reloadBootstrap: () => Promise<void>;
  
  // Cart
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, selectedVariants?: Record<string, string>) => void;
  updateCartQuantity: (productId: string, quantity: number, selectedVariants?: Record<string, string>) => void;
  removeFromCart: (productId: string, selectedVariants?: Record<string, string>) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;
  
  // Toast notifications
  toasts: ToastMessage[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  
  // Last Placed Order for Confirmation Page
  lastPlacedOrder: Order | null;
  setLastPlacedOrder: (order: Order | null) => void;

  // Visual Image Search Modal
  isImageSearchOpen: boolean;
  imageSearchContext: 'shop' | 'reseller';
  openImageSearch: (context?: 'shop' | 'reseller') => void;
  closeImageSearch: () => void;

  // View specific helpers
  navigateToProduct: (slugOrId: string) => void;
  navigateToCategory: (categorySlug: string) => void;
  navigateToCheckout: () => void;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

// Helper to parse route from browser URL
const parseRouteFromUrl = (): { view: string; productSlug: string | null; categorySlug: string | null } => {
  if (typeof window === 'undefined') {
    return { view: 'home', productSlug: null, categorySlug: null };
  }
  const path = window.location.pathname;
  const searchParams = new URLSearchParams(window.location.search);

  // Check /product/:slugOrId
  if (path.startsWith('/product/')) {
    const rawSlug = path.replace('/product/', '').split('/')[0].trim();
    if (rawSlug) {
      return { view: 'product-detail', productSlug: decodeURIComponent(rawSlug), categorySlug: null };
    }
  }

  // Fallback query parameter ?product=:slugOrId
  if (searchParams.has('product')) {
    const rawSlug = searchParams.get('product')!.trim();
    if (rawSlug) {
      return { view: 'product-detail', productSlug: decodeURIComponent(rawSlug), categorySlug: null };
    }
  }

  if (path === '/products' || path.startsWith('/products')) {
    const cat = searchParams.get('category');
    return { view: 'products', productSlug: null, categorySlug: cat || null };
  }
  if (path === '/cart') return { view: 'cart', productSlug: null, categorySlug: null };
  if (path === '/checkout') return { view: 'checkout', productSlug: null, categorySlug: null };
  if (path === '/order-success') return { view: 'order-success', productSlug: null, categorySlug: null };
  if (path === '/track') return { view: 'track', productSlug: null, categorySlug: null };
  if (path === '/contact') return { view: 'contact', productSlug: null, categorySlug: null };
  if (path === '/about') return { view: 'about', productSlug: null, categorySlug: null };
  if (path === '/faq') return { view: 'faq', productSlug: null, categorySlug: null };
  if (path === '/policies') return { view: 'policies', productSlug: null, categorySlug: null };
  if (path === '/admin') return { view: 'admin', productSlug: null, categorySlug: null };
  if (path === '/reseller' || path.startsWith('/reseller')) return { view: 'reseller', productSlug: null, categorySlug: null };

  return { view: 'home', productSlug: null, categorySlug: null };
};

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialRoute = parseRouteFromUrl();
  const [currentView, setCurrentViewState] = useState<string>(initialRoute.view);
  const [selectedProductSlug, setSelectedProductSlug] = useState<string | null>(initialRoute.productSlug);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(initialRoute.categorySlug);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [settings, setSettings] = useState<StoreSettings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const custom = localStorage.getItem('zx_custom_settings');
        if (custom) {
          const parsed = JSON.parse(custom);
          if (parsed && typeof parsed === 'object') {
            return { ...fallbackSettings, ...parsed };
          }
        }
      } catch {}
    }
    return fallbackSettings;
  });
  const [categories, setCategories] = useState<Category[]>(fallbackCategories);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>(fallbackDeliveryZones);
  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>(fallbackProducts.filter(p => p.isFeatured));
  const [popularProducts, setPopularProducts] = useState<Product[]>(fallbackProducts.filter(p => p.isPopular));
  const [isLoadingBootstrap, setIsLoadingBootstrap] = useState<boolean>(false);
  
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(null);

  // Synchronize browser history and popstate
  useEffect(() => {
    const handlePopState = () => {
      const route = parseRouteFromUrl();
      setCurrentViewState(route.view);
      setSelectedProductSlug(route.productSlug);
      if (route.categorySlug) {
        setSelectedCategorySlug(route.categorySlug);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setCurrentView = (view: string, pushHistory = true) => {
    setCurrentViewState(view);
    if (pushHistory && typeof window !== 'undefined') {
      let targetPath = '/';
      if (view === 'home') targetPath = '/';
      else if (view === 'product-detail' && selectedProductSlug) targetPath = `/product/${selectedProductSlug}`;
      else targetPath = `/${view}`;

      if (window.location.pathname !== targetPath) {
        window.history.pushState({ view, productSlug: selectedProductSlug }, '', targetPath);
      }
    }
  };

  // Initialize cart from localStorage
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('zx_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('zx_cart', JSON.stringify(cart));
    } catch (e) {
      console.error('Failed to save cart to localStorage:', e);
    }
  }, [cart]);

  // Load bootstrap config from API (with instant localStorage cache and static mirror fallback for Vercel)
  const reloadBootstrap = async () => {
    try {
      // 1. First, load from localStorage if available
      if (typeof window !== 'undefined') {
        try {
          const custom = localStorage.getItem('zx_custom_settings');
          if (custom) {
            const parsed = JSON.parse(custom);
            if (parsed) setSettings(prev => ({ ...prev, ...parsed }));
          }
          const cached = localStorage.getItem('zx_shop_cache');
          if (cached) {
            const cachedData = JSON.parse(cached);
            if (cachedData.settings) setSettings(prev => ({ ...prev, ...cachedData.settings }));
            if (cachedData.categories?.length) setCategories(cachedData.categories);
            if (cachedData.deliveryZones?.length) setDeliveryZones(cachedData.deliveryZones);
            if (cachedData.products?.length) {
              setProducts(cachedData.products);
              setFeaturedProducts(cachedData.featuredProducts || cachedData.products.filter((p: any) => p.isFeatured));
              setPopularProducts(cachedData.popularProducts || cachedData.products.filter((p: any) => p.isPopular));
            }
          }
        } catch {}
      }

      // 2. Fetch from /api/bootstrap with a 3.5s timeout
      let loaded = false;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch('/api/bootstrap', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (data && Array.isArray(data.products) && data.products.length > 0) {
              let mergedSettings = data.settings || fallbackSettings;
              if (typeof window !== 'undefined') {
                try {
                  const custom = localStorage.getItem('zx_custom_settings');
                  if (custom) {
                    mergedSettings = { ...mergedSettings, ...JSON.parse(custom) };
                  }
                } catch {}
              }
              setSettings(mergedSettings);
              setCategories(data.categories?.length ? data.categories : fallbackCategories);
              setDeliveryZones(data.deliveryZones?.length ? data.deliveryZones : fallbackDeliveryZones);
              setProducts(data.products);
              setFeaturedProducts(data.featuredProducts || data.products.filter((p: any) => p.isFeatured));
              setPopularProducts(data.popularProducts || data.products.filter((p: any) => p.isPopular));
              loaded = true;

              if (typeof window !== 'undefined') {
                try {
                  localStorage.setItem('zx_shop_cache', JSON.stringify({
                    settings: data.settings,
                    categories: data.categories,
                    deliveryZones: data.deliveryZones,
                    products: data.products,
                    featuredProducts: data.featuredProducts,
                    popularProducts: data.popularProducts,
                  }));
                } catch {}
              }
            }
          }
        }
      } catch (apiErr) {
        // API offline or static hosting
      }

      // 3. Fallback: If /api/bootstrap was unavailable (e.g. static Vercel deployment), fetch /data/db.json directly
      if (!loaded) {
        try {
          const staticRes = await fetch('/data/db.json');
          if (staticRes.ok) {
            const staticDb = await staticRes.json();
            if (staticDb && Array.isArray(staticDb.products) && staticDb.products.length > 0) {
              const shopProds = staticDb.products.filter((p: any) => p.isPublished && p.showInShop !== false);
              setSettings(staticDb.settings || fallbackSettings);
              setCategories(staticDb.categories || fallbackCategories);
              setDeliveryZones(staticDb.deliveryZones || fallbackDeliveryZones);
              setProducts(shopProds.length ? shopProds : fallbackProducts);
              setFeaturedProducts(shopProds.filter((p: any) => p.isFeatured));
              setPopularProducts(shopProds.filter((p: any) => p.isPopular));
              loaded = true;
            }
          }
        } catch {}
      }

      // 4. Guaranteed Safety: If still not loaded, ensure fallbackProducts are active
      if (!loaded && (!products || products.length === 0)) {
        setProducts(fallbackProducts);
        setCategories(fallbackCategories);
        setDeliveryZones(fallbackDeliveryZones);
        setSettings(fallbackSettings);
        setFeaturedProducts(fallbackProducts.filter(p => p.isFeatured));
        setPopularProducts(fallbackProducts.filter(p => p.isPopular));
      }
    } catch (err) {
      console.error('Error initializing store data:', err);
    }
  };

  useEffect(() => {
    reloadBootstrap();
  }, []);

  // Toast Notification
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Helper to compare variants
  const areVariantsEqual = (v1?: Record<string, string>, v2?: Record<string, string>) => {
    if (!v1 && !v2) return true;
    if (!v1 || !v2) return false;
    const keys1 = Object.keys(v1);
    const keys2 = Object.keys(v2);
    if (keys1.length !== keys2.length) return false;
    return keys1.every(k => v1[k] === v2[k]);
  };

  const addToCart = (product: Product, quantity = 1, selectedVariants: Record<string, string> = {}) => {
    if (product.stock <= 0) {
      showToast('দুঃখিত, এই পণ্যটি বর্তমানে স্টক আউট।', 'error');
      return;
    }

    setCart(prev => {
      const existingIndex = prev.findIndex(
        item => item.product.id === product.id && areVariantsEqual(item.selectedVariants, selectedVariants)
      );

      if (existingIndex > -1) {
        const existing = prev[existingIndex];
        const newQty = existing.quantity + quantity;
        if (newQty > product.stock) {
          showToast(`সর্বোচ্চ স্টক সীমা (${product.stock} টি) পৌঁছানো হয়েছে।`, 'info');
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = { ...existing, quantity: newQty };
        return updated;
      } else {
        const initialQty = Math.min(quantity, product.stock);
        return [...prev, { product, quantity: initialQty, selectedVariants }];
      }
    });

    showToast(`"${product.name}" কার্টে যুক্ত হয়েছে!`, 'success');
  };

  const updateCartQuantity = (productId: string, quantity: number, selectedVariants?: Record<string, string>) => {
    if (quantity <= 0) {
      removeFromCart(productId, selectedVariants);
      return;
    }

    setCart(prev =>
      prev.map(item => {
        if (item.product.id === productId && areVariantsEqual(item.selectedVariants, selectedVariants)) {
          const validQty = Math.min(quantity, item.product.stock);
          return { ...item, quantity: validQty };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string, selectedVariants?: Record<string, string>) => {
    setCart(prev =>
      prev.filter(item => !(item.product.id === productId && areVariantsEqual(item.selectedVariants, selectedVariants)))
    );
    showToast('পণ্যটি কার্ট থেকে মুছে ফেলা হয়েছে।', 'info');
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const cartSubtotal = cart.reduce((acc, item) => {
    const price = item.product.salePrice ?? item.product.regularPrice;
    return acc + price * item.quantity;
  }, 0);

  const navigateToProduct = (slugOrId: string) => {
    setSelectedProductSlug(slugOrId);
    setCurrentViewState('product-detail');
    if (typeof window !== 'undefined') {
      const targetPath = `/product/${slugOrId}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ view: 'product-detail', productSlug: slugOrId }, '', targetPath);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const navigateToCategory = (categorySlug: string) => {
    setSelectedCategorySlug(categorySlug);
    setCurrentViewState('products');
    if (typeof window !== 'undefined') {
      const targetPath = categorySlug ? `/products?category=${encodeURIComponent(categorySlug)}` : '/products';
      window.history.pushState({ view: 'products', categorySlug }, '', targetPath);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Visual Image Search State
  const [isImageSearchOpen, setIsImageSearchOpen] = useState<boolean>(false);
  const [imageSearchContext, setImageSearchContext] = useState<'shop' | 'reseller'>('shop');

  const openImageSearch = (context: 'shop' | 'reseller' = 'shop') => {
    setImageSearchContext(context);
    setIsImageSearchOpen(true);
  };

  const closeImageSearch = () => {
    setIsImageSearchOpen(false);
  };

  const navigateToCheckout = () => {
    if (cart.length === 0) {
      showToast('আপনার কার্ট খালি। প্রথমে পণ্য যোগ করুন।', 'error');
      return;
    }
    setCurrentView('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <ShopContext.Provider
      value={{
        isImageSearchOpen,
        imageSearchContext,
        openImageSearch,
        closeImageSearch,
        currentView,
        setCurrentView,
        selectedProductSlug,
        setSelectedProductSlug,
        selectedCategorySlug,
        setSelectedCategorySlug,
        searchQuery,
        setSearchQuery,
        settings,
        categories,
        deliveryZones,
        products,
        featuredProducts,
        popularProducts,
        isLoadingBootstrap,
        reloadBootstrap,
        cart,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        cartCount,
        cartSubtotal,
        toasts,
        showToast,
        removeToast,
        lastPlacedOrder,
        setLastPlacedOrder,
        navigateToProduct,
        navigateToCategory,
        navigateToCheckout,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
};
