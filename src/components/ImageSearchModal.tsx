import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Search, Sparkles, CheckCircle2, ArrowRight, ShoppingCart, RefreshCw, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { Product } from '../types/ecommerce';

interface SearchResultItem extends Product {
  matchScore: number;
  isExact: boolean;
  matchReason?: string;
}

export const ImageSearchModal: React.FC = () => {
  const { isImageSearchOpen, closeImageSearch, imageSearchContext, navigateToProduct, addToCart, showToast, setCurrentView } = useShop();

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [searchMessage, setSearchMessage] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [activeContext, setActiveContext] = useState<'shop' | 'reseller'>(imageSearchContext || 'shop');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Sync activeContext with modal opening context
  useEffect(() => {
    if (isImageSearchOpen) {
      setActiveContext(imageSearchContext || 'shop');
    }
  }, [isImageSearchOpen, imageSearchContext]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isImageSearchOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isImageSearchOpen]);

  if (!isImageSearchOpen) return null;

  const handleClose = () => {
    setSelectedImage(null);
    setResults([]);
    setHasSearched(false);
    setSearchMessage('');
    setIsSearching(false);
    closeImageSearch();
  };

  // Process chosen file
  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('অনুগ্রহ করে একটি সঠিক ছবির ফাইল (JPG, PNG, WebP) নির্বাচন করুন।', 'error');
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      showToast('ছবির সাইজ ১২MB এর কম হতে হবে।', 'error');
      return;
    }

    setMimeType(file.type);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setSelectedImage(base64);
      executeSearch(base64, file.type, activeContext);
    };
    reader.onerror = () => {
      showToast('ছবি লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।', 'error');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Perform backend visual search request
  const executeSearch = async (imageBase64: string, type: string, contextMode: 'shop' | 'reseller') => {
    setIsSearching(true);
    setHasSearched(false);
    setResults([]);
    setSearchMessage('');

    try {
      const res = await fetch('/api/search/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType: type,
          context: contextMode,
        }),
      });

      const data = await res.json();
      setHasSearched(true);

      if (data.success && Array.isArray(data.products) && data.products.length > 0) {
        setResults(data.products);
        setSearchMessage(data.message || `আপনার ছবির সাথে মিলে এমন ${data.products.length} টি পণ্য পাওয়া গেছে।`);
      } else {
        setResults([]);
        setSearchMessage(data.message || 'দুঃখিত, আপনার ছবির সঙ্গে মিলে এমন পণ্য পাওয়া যায়নি।');
      }
    } catch (err) {
      console.error('Image search failed:', err);
      setHasSearched(true);
      setResults([]);
      setSearchMessage('দুঃখিত, আপনার ছবির সঙ্গে মিলে এমন পণ্য পাওয়া যায়নি।');
    } finally {
      setIsSearching(false);
    }
  };

  // Demo sample image test runner for instant quick trial
  const handleQuickSample = async (samplePath: string) => {
    try {
      setIsSearching(true);
      const res = await fetch(samplePath);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setSelectedImage(base64);
        executeSearch(base64, blob.type || 'image/jpeg', activeContext);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      showToast('নমুনা ছবি লোড করতে ব্যর্থ হয়েছে', 'error');
      setIsSearching(false);
    }
  };

  const handleReset = () => {
    setSelectedImage(null);
    setResults([]);
    setHasSearched(false);
    setSearchMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/70 backdrop-blur-sm animate-fadeIn">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <div
        className="relative w-full max-w-3xl my-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-900/95 sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">AI ছবি দিয়ে পণ্য খুঁজুন</h3>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {activeContext === 'reseller' ? 'রিসেলার মোড' : 'শপ মোড'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                ক্যামেরা দিয়ে ছবি তুলুন বা গ্যালারি থেকে আপলোড করে ক্যাটালগের পণ্যের সাথে মিলান
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            aria-label="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Mode Switcher */}
          <div className="flex items-center justify-between p-2 bg-slate-800/60 rounded-xl border border-slate-700/50 text-xs">
            <span className="text-slate-300 font-medium px-2">সার্চ ক্যাটালগ নির্বাচন:</span>
            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setActiveContext('shop');
                  if (selectedImage) executeSearch(selectedImage, mimeType, 'shop');
                }}
                className={`px-3 py-1.5 rounded-md font-semibold transition ${
                  activeContext === 'shop'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                সাধারণ ক্যাটালগ
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveContext('reseller');
                  if (selectedImage) executeSearch(selectedImage, mimeType, 'reseller');
                }}
                className={`px-3 py-1.5 rounded-md font-semibold transition ${
                  activeContext === 'reseller'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                রিসেলার পাইকারি
              </button>
            </div>
          </div>

          {/* Upload / Capture Stage (when no image selected) */}
          {!selectedImage && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition flex flex-col items-center justify-center gap-4 ${
                  isDragOver
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-slate-700 hover:border-slate-600 bg-slate-800/40'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 shadow-inner">
                  <Camera className="w-8 h-8" />
                </div>

                <div className="max-w-md">
                  <h4 className="text-base font-semibold text-white mb-1">
                    পণ্যটির ছবি তুলুন অথবা গ্যালারি থেকে আপলোড করুন
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    যেকোনো ঘড়ি, হেডফোন, পোশাক, গ্যাজেট বা পণ্যের ছবি আপলোড করলে আমাদের AI সিস্টেম মুহূর্তেই ক্যাটালগের আসল পণ্য খুঁজে বের করবে।
                  </p>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2 w-full max-w-sm">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-emerald-500/25 active:scale-95"
                  >
                    <Camera className="w-4 h-4" />
                    <span>ক্যামেরা দিয়ে তুলুন</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold rounded-xl text-sm transition active:scale-95"
                  >
                    <Upload className="w-4 h-4" />
                    <span>গ্যালারি ফাইল</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-400">
                  সাপোর্টেড ফরম্যাট: JPG, PNG, WebP (সর্বোচ্চ ১২ মেগাবাইট)
                </p>
              </div>

              {/* Instant Try / Quick Sample Product Images */}
              <div className="bg-slate-800/30 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-300">
                    তাৎক্ষণিক পরীক্ষা করার জন্য নিচের যেকোনো একটি ছবিতে ক্লিক করুন:
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { label: 'স্মার্টওয়াচ', path: '/src/assets/images/product_smartwatch_black_1791605919110.jpg' },
                    { label: 'পাঞ্জাবি', path: '/src/assets/images/product_panjabi_fashion_1791605930821.jpg' },
                    { label: 'স্কিনকেয়ার সিরাম', path: '/src/assets/images/product_skincare_serum_1791605941479.jpg' },
                    { label: 'অডিও গ্যাজেট', path: '/src/assets/images/banner_audio_lux_1792320545489.jpg' },
                  ].map((sample) => (
                    <button
                      key={sample.path}
                      type="button"
                      onClick={() => handleQuickSample(sample.path)}
                      className="group relative flex items-center gap-2.5 p-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700/70 hover:border-emerald-500/50 rounded-lg text-left transition"
                    >
                      <img
                        src={sample.path}
                        alt={sample.label}
                        className="w-10 h-10 rounded-md object-cover bg-slate-900 border border-slate-700 shrink-0"
                      />
                      <div className="truncate">
                        <span className="text-xs font-medium text-slate-200 group-hover:text-emerald-400 block truncate">
                          {sample.label}
                        </span>
                        <span className="text-[10px] text-emerald-400">টেস্ট করুন →</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Active Image & Results View */}
          {selectedImage && (
            <div className="space-y-5">
              {/* Image Preview & Scanner Banner */}
              <div className="relative bg-slate-800/50 border border-slate-700/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-32 h-32 rounded-xl overflow-hidden bg-slate-950 border border-slate-700 shrink-0 group">
                  <img
                    src={selectedImage}
                    alt="আপলোড করা ছবি"
                    className="w-full h-full object-cover"
                  />
                  {/* Laser Scanner Effect when searching */}
                  {isSearching && (
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/30 to-transparent animate-pulse pointer-events-none">
                      <div className="w-full h-1 bg-emerald-400 shadow-[0_0_8px_#34d399] animate-[bounce_1.5s_infinite]" />
                    </div>
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left space-y-1.5">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="text-xs font-medium text-slate-400">আপনার আপলোড করা ছবি</span>
                    {isSearching ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                        স্ক্যান চলছে...
                      </span>
                    ) : hasSearched && results.length > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> মিল পাওয়া গেছে
                      </span>
                    ) : null}
                  </div>

                  <p className="text-sm font-semibold text-white">
                    {isSearching
                      ? 'AI ক্যাটালগে থাকা সব পণ্যের সাথে মিল খুঁজছে...'
                      : searchMessage || 'ফলাফল তৈরি হয়েছে'}
                  </p>

                  <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>অন্য ছবি তুলুন</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => executeSearch(selectedImage, mimeType, activeContext)}
                      disabled={isSearching}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-xs font-medium rounded-lg transition disabled:opacity-50"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>পুনরায় সার্চ</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Searching Skeleton Indicator */}
              {isSearching && (
                <div className="py-8 text-center space-y-3">
                  <div className="w-12 h-12 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-slate-300 font-medium">
                    AI ছবি বিশ্লেষণ ও ভিজ্যুয়াল এনকোডিং করছে...
                  </p>
                  <p className="text-xs text-slate-400">
                    আমাদের স্টোরের বাস্তব ডাটাবেস থেকে সঠিক পণ্যটি খোঁজা হচ্ছে
                  </p>
                </div>
              )}

              {/* No match error state */}
              {!isSearching && hasSearched && results.length === 0 && (
                <div className="py-8 px-4 text-center bg-slate-800/30 border border-slate-800 rounded-2xl space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-white">
                    দুঃখিত, আপনার ছবির সঙ্গে মিলে এমন পণ্য পাওয়া যায়নি।
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    অনুগ্রহ করে ভালো আলোতে পণ্যের স্পষ্ট ছবি তুলুন অথবা অন্য কোনো কোণ থেকে তুলে আবার চেষ্টা করুন।
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-500/20"
                    >
                      নতুন ছবি আপলোড করুন
                    </button>
                  </div>
                </div>
              )}

              {/* Results Grid */}
              {!isSearching && hasSearched && results.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>খুঁজে পাওয়া পণ্যসমূহ</span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-normal">
                        {results.length} টি
                      </span>
                    </h4>
                    <span className="text-xs text-emerald-400 font-medium">
                      সর্বোচ্চ মিল অনুযায়ী সাজানো
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {results.map((product, idx) => {
                      const isTopMatch = idx === 0 && (product.isExact || product.matchScore >= 80);
                      const displayPrice =
                        activeContext === 'reseller'
                          ? (product.resellerPrice ?? product.regularPrice)
                          : (product.salePrice ?? product.shopPrice ?? product.regularPrice);
                      const regularPrice = product.regularPrice;
                      const hasDiscount = activeContext === 'shop' && product.salePrice && product.salePrice < regularPrice;

                      return (
                        <div
                          key={product.id}
                          className={`group relative flex flex-col justify-between bg-slate-800/80 hover:bg-slate-800 border rounded-xl p-3.5 transition ${
                            isTopMatch
                              ? 'border-emerald-500/70 shadow-lg shadow-emerald-500/10'
                              : 'border-slate-700/80 hover:border-slate-600'
                          }`}
                        >
                          {/* Match Score Badge */}
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${
                                product.isExact || product.matchScore >= 85
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              }`}
                            >
                              {product.isExact || product.matchScore >= 85 ? '🎯' : '🔍'}{' '}
                              {product.matchScore}% {product.isExact ? 'হুবহু মিল' : 'কাছাকাছি মিল'}
                            </span>

                            {/* Stock Badge */}
                            {product.stock > 0 ? (
                              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                                স্টক: {product.stock} টি
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                                স্টক শেষ
                              </span>
                            )}
                          </div>

                          {/* Product Card Body */}
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-900 border border-slate-700 shrink-0">
                              <img
                                src={product.mainImage || product.images?.[0] || '/src/assets/images/product_smartwatch_black_1791605919110.jpg'}
                                alt={product.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/src/assets/images/product_smartwatch_black_1791605919110.jpg';
                                }}
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <h5 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition line-clamp-2 leading-snug">
                                {product.banglaTitle || product.name}
                              </h5>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                SKU: {product.sku || product.id}
                              </p>

                              {product.matchReason && (
                                <p className="text-[11px] text-emerald-400/90 mt-1 flex items-center gap-1">
                                  <span>✓</span> {product.matchReason}
                                </p>
                              )}

                              {/* Price */}
                              <div className="flex items-baseline gap-2 mt-2">
                                <span className="text-base font-bold text-emerald-400">
                                  ৳{displayPrice.toLocaleString('bn-BD')}
                                </span>
                                {hasDiscount && (
                                  <span className="text-xs text-slate-400 line-through">
                                    ৳{regularPrice.toLocaleString('bn-BD')}
                                  </span>
                                )}
                                {activeContext === 'reseller' && (
                                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                    হোলসেল
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 pt-2 border-t border-slate-700/60">
                            <button
                              type="button"
                              onClick={() => {
                                handleClose();
                                navigateToProduct(product.slug || product.id);
                              }}
                              className="flex-1 flex items-center justify-center gap-1 py-2 px-3 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg transition"
                            >
                              <span>বিস্তারিত দেখুন</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>

                            {activeContext === 'shop' ? (
                              <button
                                type="button"
                                disabled={product.stock <= 0}
                                onClick={() => {
                                  addToCart(product, 1);
                                  showToast(`${product.name} কার্টে যোগ করা হয়েছে!`, 'success');
                                }}
                                className="flex items-center justify-center gap-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-semibold rounded-lg transition shadow-md shadow-emerald-500/20"
                                title="কার্টে যোগ করুন"
                              >
                                <ShoppingCart className="w-3.5 h-3.5" />
                                <span>কার্টে যোগ</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  handleClose();
                                  setCurrentView('reseller');
                                }}
                                className="flex items-center justify-center gap-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition shadow-md shadow-emerald-500/20"
                              >
                                <span>ড্রপশিপ অর্ডার</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>AI মাল্টিমোডাল ভিশন ও লোকাল ভিজ্যুয়াল হ্যাশিং ইঞ্জিন সক্রিয়</span>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
