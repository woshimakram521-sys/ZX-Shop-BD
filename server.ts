import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { dbInstance } from './server/db.ts';
import type { Product, Order, OrderStatus, PaymentStatus, Review, Coupon, Category, DeliveryZone, StoreSettings, Reseller, ResellerStatus } from './src/types/ecommerce.ts';
import {
  sendOrderNotificationEmail,
  sendTestNotificationEmail,
  isEmailConfigured,
  getEmailServiceStatus,
  sendResellerRegistrationEmail,
  sendResellerOrderEmail,
  sendResellerWithdrawalEmail,
  sendContactNotificationEmail
} from './server/emailService.ts';
import { searchProductsByImage } from './server/visualSearch.ts';

const app = express();

const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const cliPort = portIndex !== -1 && args[portIndex + 1] ? parseInt(args[portIndex + 1], 10) : undefined;
const hostIndex = args.indexOf('--host');
const cliHost = hostIndex !== -1 && args[hostIndex + 1] ? args[hostIndex + 1] : undefined;

const PORT = cliPort || (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);
const HOST = cliHost || process.env.HOST || '0.0.0.0';
const isProd = process.env.NODE_ENV === 'production';

// Ensure uploads folder exists
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/src/assets', express.static(path.resolve(process.cwd(), 'src/assets')));
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
}

// In-memory admin session storage (backed by persistent DB storage)
const activeAdminTokens = new Set<string>();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'অননুমোদিত প্রবেশ। অনুগ্রহ করে অ্যাডমিন লগইন করুন।' });
  }
  const token = authHeader.split(' ')[1];
  if (!activeAdminTokens.has(token) && !dbInstance.isValidAdminToken(token)) {
    return res.status(401).json({ error: 'লগইন সেশন মেয়াদোত্তীর্ণ বা অবৈধ। অনুগ্রহ করে আবার লগইন করুন।' });
  }
  activeAdminTokens.add(token);
  next();
}

// ==========================================
// 1. PUBLIC STOREFRONT APIS
// ==========================================

// Helper to sanitize product for public shop (strip reseller-specific prices & cost)
function sanitizePublicProduct(p: Product): Product {
  const effectiveShopPrice = p.shopPrice ?? (p.salePrice ?? p.regularPrice);
  return {
    ...p,
    // Keep regularPrice and salePrice in sync with shopPrice for full backward compatibility
    salePrice: p.salePrice ? effectiveShopPrice : undefined,
    regularPrice: p.salePrice ? p.regularPrice : effectiveShopPrice,
    shopPrice: effectiveShopPrice,
    resellerPrice: undefined, // Never leak reseller price to public
    costPrice: undefined, // Never leak cost price to public
  };
}

// Bootstrap initial configuration
app.get('/api/bootstrap', (req: Request, res: Response) => {
  const data = dbInstance.getData();
  const publishedCategories = data.categories
    .filter(c => c.isPublished)
    .sort((a, b) => a.order - b.order);
  const activeDeliveryZones = data.deliveryZones.filter(z => z.isActive);
  
  // Publicly safe settings: strip server-side credentials
  const { smtpPass, smtpUser, ...publicSettings } = data.settings;

  // Public shop products (must be published and showInShop !== false)
  const shopProducts = data.products
    .filter(p => p.isPublished && p.showInShop !== false)
    .map(sanitizePublicProduct);

  res.json({
    settings: publicSettings,
    categories: publishedCategories,
    deliveryZones: activeDeliveryZones,
    products: shopProducts,
    featuredProducts: shopProducts.filter(p => p.isFeatured).slice(0, 12),
    popularProducts: shopProducts.filter(p => p.isPopular).slice(0, 12),
    totalPublishedProducts: shopProducts.length,
  });
});

// Products listing with filters
app.get('/api/products', (req: Request, res: Response) => {
  const data = dbInstance.getData();
  let items = data.products
    .filter(p => p.isPublished && p.showInShop !== false)
    .map(sanitizePublicProduct);

  const { category, search, minPrice, maxPrice, sort, featured, popular, page = '1', limit = '12' } = req.query;

  // Filter by category
  if (category && typeof category === 'string' && category !== 'all') {
    const targetCat = data.categories.find(c => c.slug === category || c.id === category);
    if (targetCat) {
      items = items.filter(p => p.category === targetCat.id || p.category === targetCat.slug);
    }
  }

  // Filter by search query
  if (search && typeof search === 'string') {
    const q = search.trim().toLowerCase();
    items = items.filter(p => 
      p.name.toLowerCase().includes(q) ||
      (p.banglaTitle && p.banglaTitle.toLowerCase().includes(q)) ||
      p.description.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)
    );
  }

  // Filter by price
  if (minPrice && !isNaN(Number(minPrice))) {
    items = items.filter(p => (p.salePrice ?? p.regularPrice) >= Number(minPrice));
  }
  if (maxPrice && !isNaN(Number(maxPrice))) {
    items = items.filter(p => (p.salePrice ?? p.regularPrice) <= Number(maxPrice));
  }

  // Filter by flags
  if (featured === 'true') {
    items = items.filter(p => p.isFeatured);
  }
  if (popular === 'true') {
    items = items.filter(p => p.isPopular);
  }

  // Sorting
  if (sort === 'price_asc') {
    items.sort((a, b) => (a.salePrice ?? a.regularPrice) - (b.salePrice ?? b.regularPrice));
  } else if (sort === 'price_desc') {
    items.sort((a, b) => (b.salePrice ?? b.regularPrice) - (a.salePrice ?? a.regularPrice));
  } else if (sort === 'popular') {
    items.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  } else {
    // Default newest
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Pagination
  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.max(1, parseInt(limit as string, 10));
  const total = items.length;
  const totalPages = Math.ceil(total / limitNum);
  const paginated = items.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  res.json({
    products: paginated,
    total,
    page: pageNum,
    totalPages,
  });
});

// AI Image Product Search Endpoint
app.post('/api/search/image', async (req: Request, res: Response) => {
  const { imageBase64, mimeType, context, clientFeatures } = req.body;
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'অনুগ্রহ করে অনুসন্ধানের জন্য একটি ছবি নির্বাচন করুন।',
    });
  }

  try {
    const data = dbInstance.getData();
    const result = await searchProductsByImage(
      imageBase64,
      mimeType || 'image/jpeg',
      data.products,
      data.categories,
      context === 'reseller' ? 'reseller' : 'shop',
      clientFeatures
    );

    if (context !== 'reseller') {
      result.products = result.products.map(p => ({
        ...sanitizePublicProduct(p),
        matchScore: p.matchScore,
        isExact: p.isExact,
        matchReason: p.matchReason,
      }));
    }

    return res.json(result);
  } catch (err: any) {
    console.error('[API /api/search/image Error]:', err);
    return res.status(500).json({
      success: false,
      count: 0,
      products: [],
      error: 'ছবি বিশ্লেষণ করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
    });
  }
});

// Single product details
app.get('/api/products/:slugOrId', (req: Request, res: Response) => {
  const data = dbInstance.getData();
  const { slugOrId } = req.params;
  const rawProduct = data.products.find(p => (p.id === slugOrId || p.slug === slugOrId) && p.isPublished && p.showInShop !== false);

  if (!rawProduct) {
    return res.status(404).json({ error: 'পণ্যটি পাওয়া যায়নি।' });
  }

  const product = sanitizePublicProduct(rawProduct);

  // Related products:
  // 1. First, products from the exact same category (excluding current product)
  const sameCategory = data.products
    .filter(p => p.isPublished && p.showInShop !== false && p.category === product.category && p.id !== product.id)
    .map(sanitizePublicProduct);

  let related = [...sameCategory];

  // 2. If fewer than 8 in same category, supplement with popular / other published products
  if (related.length < 8) {
    const existingIds = new Set([product.id, ...related.map(r => r.id)]);
    const remainingNeeded = 8 - related.length;
    const additional = data.products
      .filter(p => p.isPublished && !existingIds.has(p.id))
      .sort((a, b) => {
        if (a.isPopular && !b.isPopular) return -1;
        if (!a.isPopular && b.isPopular) return 1;
        return (b.rating || 0) - (a.rating || 0);
      })
      .slice(0, remainingNeeded);
    related = [...related, ...additional];
  } else {
    related = related.slice(0, 8);
  }

  // Reviews for this product
  const reviews = data.reviews.filter(r => r.productId === product.id && r.isApproved);

  res.json({
    product,
    related,
    reviews,
  });
});

// Check & Apply Coupon
app.post('/api/coupons/apply', (req: Request, res: Response) => {
  const { code, subtotal } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ valid: false, message: 'কুপন কোড প্রদান করুন।' });
  }

  const data = dbInstance.getData();
  const coupon = data.coupons.find(c => c.code.toUpperCase() === code.trim().toUpperCase() && c.isActive);

  if (!coupon) {
    return res.status(400).json({ valid: false, message: 'অবৈধ অথবা মেয়াদোত্তীর্ণ কুপন কোড।' });
  }

  if (subtotal < coupon.minOrderAmount) {
    return res.status(400).json({
      valid: false,
      message: `এই কুপনটি ব্যবহারের জন্য সর্বনিম্ন ৳${coupon.minOrderAmount} টাকার অর্ডার প্রয়োজন।`,
    });
  }

  let discount = 0;
  if (coupon.discountType === 'percentage') {
    discount = Math.round((subtotal * coupon.discountValue) / 100);
  } else {
    discount = coupon.discountValue;
  }
  discount = Math.min(discount, subtotal);

  res.json({
    valid: true,
    code: coupon.code,
    discount,
    message: `অভিনন্দন! ৳${discount} ছাড় যুক্ত হয়েছে।`,
  });
});

// Guest Checkout & Order Creation
app.post('/api/orders', (req: Request, res: Response) => {
  const { customer, items, paymentMethod, transactionId, senderPhone, deliveryZoneId, couponCode } = req.body;

  // Validate customer inputs
  if (!customer?.fullName?.trim()) {
    return res.status(400).json({ error: 'অনুগ্রহ করে আপনার পূর্ণ নাম লিখুন।' });
  }
  const phoneClean = (customer?.phone || '').replace(/[^0-9]/g, '');
  if (!phoneClean || phoneClean.length < 11) {
    return res.status(400).json({ error: 'সঠিক বাংলাদেশি ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।' });
  }
  if (!customer?.fullAddress?.trim()) {
    return res.status(400).json({ error: 'সম্পূর্ণ ডেলিভারি ঠিকানা লিখুন।' });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'কার্টে কোনো পণ্য নেই।' });
  }

  const data = dbInstance.getData();

  // Validate delivery zone
  const zone = data.deliveryZones.find(z => z.id === deliveryZoneId || z.name === customer.deliveryArea);
  if (!zone) {
    return res.status(400).json({ error: 'অনুগ্রহ করে সঠিক ডেলিভারি এলাকা নির্বাচন করুন।' });
  }

  // Validate stock and snapshot prices server-side
  let calculatedSubtotal = 0;
  const verifiedItems = [];

  for (const item of items) {
    const prod = data.products.find(p => p.id === item.productId && p.isPublished);
    if (!prod) {
      return res.status(400).json({ error: 'একটি পণ্য পাওয়া যায়নি বা এটি শপ থেকে সরানো হয়েছে।' });
    }
    if (prod.stock < item.quantity) {
      return res.status(400).json({
        error: `দুঃখিত! "${prod.name}" পণ্যটির পর্যাপ্ত স্টক নেই। বর্তমান স্টক: ${prod.stock} টি।`,
      });
    }

    // Server-side authoritative public shop price snapshot
    const itemPrice = prod.shopPrice ?? (prod.salePrice ?? prod.regularPrice);
    const itemTotal = itemPrice * item.quantity;
    calculatedSubtotal += itemTotal;

    verifiedItems.push({
      productId: prod.id,
      name: prod.name,
      sku: prod.sku,
      price: itemPrice,
      quantity: item.quantity,
      image: prod.mainImage,
      selectedVariants: item.selectedVariants || {},
      total: itemTotal,
    });
  }

  // Coupon calculation
  let discountAmount = 0;
  if (couponCode) {
    const coupon = data.coupons.find(c => c.code.toUpperCase() === couponCode.trim().toUpperCase() && c.isActive);
    if (coupon && calculatedSubtotal >= coupon.minOrderAmount) {
      if (coupon.discountType === 'percentage') {
        discountAmount = Math.round((calculatedSubtotal * coupon.discountValue) / 100);
      } else {
        discountAmount = coupon.discountValue;
      }
      discountAmount = Math.min(discountAmount, calculatedSubtotal);
    }
  }

  // Delivery charge calculation
  let deliveryFee = zone.rate;
  if (data.settings.freeDeliveryThreshold && calculatedSubtotal >= data.settings.freeDeliveryThreshold) {
    deliveryFee = 0;
  }

  const finalTotal = calculatedSubtotal - discountAmount + deliveryFee;

  // Deduct stock atomically
  for (const item of items) {
    const prod = data.products.find(p => p.id === item.productId);
    if (prod) {
      prod.stock -= item.quantity;
      prod.updatedAt = new Date().toISOString();
    }
  }

  // Generate unique order number
  const timestamp = Date.now().toString().slice(-4);
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const orderNumber = `ZX-${timestamp}${randomSuffix}`;

  const newOrder: Order = {
    id: `ord-${Date.now()}-${randomSuffix}`,
    orderNumber,
    customer: {
      fullName: customer.fullName.trim(),
      phone: phoneClean,
      division: customer.division || '',
      district: customer.district || '',
      deliveryArea: zone.name,
      fullAddress: customer.fullAddress.trim(),
      notes: customer.notes?.trim() || '',
    },
    items: verifiedItems,
    subtotal: calculatedSubtotal,
    discount: discountAmount,
    couponCode: couponCode ? couponCode.trim().toUpperCase() : undefined,
    deliveryCharge: deliveryFee,
    deliveryZoneName: zone.name,
    totalAmount: finalTotal,
    paymentMethod: paymentMethod || 'cod',
    paymentStatus: paymentMethod === 'cod' ? 'pending' : (transactionId ? 'pending' : 'pending'),
    transactionId: transactionId?.trim() || undefined,
    senderPhone: senderPhone?.trim() || undefined,
    orderStatus: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    statusHistory: [
      {
        status: 'pending',
        timestamp: new Date().toISOString(),
        note: 'অর্ডারটি সফলভাবে জমা নেওয়া হয়েছে। খুব শীঘ্রই আমাদের প্রতিনিধি কল দিয়ে নিশ্চিত করবেন।',
      },
    ],
  };

  newOrder.emailNotificationStatus = isEmailConfigured() ? 'pending' : 'not_configured';

  data.orders.unshift(newOrder);
  dbInstance.save();

  // Send asynchronous Gmail notification to admin (never blocks customer checkout response)
  sendOrderNotificationEmail(newOrder)
    .then((result) => {
      if (result.success && !result.skipped) {
        newOrder.emailNotificationStatus = 'sent';
        newOrder.emailSentAt = new Date().toISOString();
        dbInstance.save();
      } else if (!result.success) {
        newOrder.emailNotificationStatus = isEmailConfigured() ? 'failed' : 'not_configured';
        newOrder.emailNotificationError = result.error;
        dbInstance.save();
      }
    })
    .catch((err) => {
      console.error(`[Email Notification UNCAUGHT] Error for order ${newOrder.orderNumber}:`, err);
    });

  res.status(201).json({
    success: true,
    orderNumber: newOrder.orderNumber,
    order: newOrder,
  });
});

// Track Order with Order Number + Phone
app.post('/api/orders/track', (req: Request, res: Response) => {
  const { orderNumber, phone } = req.body;
  if (!orderNumber || !phone) {
    return res.status(400).json({ error: 'অর্ডার নম্বর এবং মোবাইল নম্বর দুটোই প্রয়োজন।' });
  }

  const cleanNum = orderNumber.trim().toUpperCase();
  const cleanPhone = phone.replace(/[^0-9]/g, '');

  const data = dbInstance.getData();
  const order = data.orders.find(o => 
    o.orderNumber.toUpperCase() === cleanNum &&
    (o.customer.phone === cleanPhone || o.customer.phone.endsWith(cleanPhone) || cleanPhone.endsWith(o.customer.phone))
  );

  if (!order) {
    return res.status(404).json({ error: 'প্রদত্ত তথ্য অনুযায়ী কোনো অর্ডার পাওয়া যায়নি। সঠিক অর্ডার নম্বর ও নম্বর যাচাই করুন।' });
  }

  // Safe tracking info - mask customer phone and address slightly for privacy
  const maskedPhone = order.customer.phone.slice(0, 3) + '*****' + order.customer.phone.slice(-3);

  res.json({
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt,
    statusHistory: order.statusHistory,
    totalAmount: order.totalAmount,
    deliveryZoneName: order.deliveryZoneName,
    items: order.items.map(i => ({
      name: i.name,
      quantity: i.quantity,
      price: i.price,
      image: i.image,
      selectedVariants: i.selectedVariants,
    })),
    maskedPhone,
    deliveryArea: order.customer.deliveryArea,
  });
});

// Submit product review
app.post('/api/reviews', (req: Request, res: Response) => {
  const { productId, customerName, rating, comment } = req.body;
  if (!productId || !customerName || !rating || !comment) {
    return res.status(400).json({ error: 'সকল তথ্য পূরণ করা আবশ্যক।' });
  }

  const data = dbInstance.getData();
  const product = data.products.find(p => p.id === productId);
  if (!product) {
    return res.status(404).json({ error: 'পণ্যটি পাওয়া যায়নি।' });
  }

  const newReview: Review = {
    id: `rev-${Date.now()}`,
    productId,
    productName: product.name,
    customerName: customerName.trim(),
    rating: Math.min(5, Math.max(1, Number(rating))),
    comment: comment.trim(),
    isApproved: true, // Auto approve for instant engagement
    createdAt: new Date().toISOString(),
  };

  data.reviews.unshift(newReview);
  
  // Recompute product rating
  const prodReviews = data.reviews.filter(r => r.productId === productId && r.isApproved);
  const avg = prodReviews.reduce((acc, cur) => acc + cur.rating, 0) / prodReviews.length;
  product.rating = Math.round(avg * 10) / 10;
  product.reviewCount = prodReviews.length;

  dbInstance.save();

  res.status(201).json({ success: true, review: newReview, message: 'আপনার মূল্যবান মতামতের জন্য ধন্যবাদ!' });
});

// Image Upload Endpoint (stores base64 into uploads/ folder)
app.post('/api/upload', (req: Request, res: Response) => {
  try {
    const { filename, base64 } = req.body;
    if (!base64 || typeof base64 !== 'string') {
      return res.status(400).json({ error: 'ছবির ডেটা পাওয়া যায়নি।' });
    }

    const cleanBase64 = base64.trim();
    const matches = cleanBase64.match(/^data:([^;]+);base64,([\s\S]+)$/);
    let buffer: Buffer;
    let ext = 'jpg';

    if (matches && matches.length === 3) {
      const mime = matches[1].toLowerCase();
      if (mime.includes('png')) ext = 'png';
      else if (mime.includes('webp')) ext = 'webp';
      else if (mime.includes('gif')) ext = 'gif';
      else if (mime.includes('svg')) ext = 'svg';
      else if (mime.includes('avif')) ext = 'avif';
      else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(cleanBase64, 'base64');
    }

    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const safeName = `img_${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeName);
    fs.writeFileSync(filePath, buffer);

    // Also mirror to public/uploads if public exists
    const publicUploads = path.resolve(process.cwd(), 'public', 'uploads');
    try {
      if (!fs.existsSync(publicUploads)) fs.mkdirSync(publicUploads, { recursive: true });
      fs.writeFileSync(path.join(publicUploads, safeName), buffer);
    } catch {}

    const fileUrl = `/uploads/${safeName}`;
    res.json({ success: true, url: fileUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'ছবি সংরক্ষণ করতে ব্যর্থ হয়েছে।' });
  }
});

// ==========================================
// 2. ADMIN AUTH & DASHBOARD APIS
// ==========================================

// Admin Login
app.post('/api/admin/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'ইউজারনেম ও পাসওয়ার্ড প্রদান করুন।' });
  }

  const isValid = dbInstance.verifyAdmin(username, password);
  if (!isValid) {
    return res.status(401).json({ error: 'ভুল ইউজারনেম অথবা পাসওয়ার্ড।' });
  }

  // Generate secure token
  const token = crypto.randomBytes(32).toString('hex');
  activeAdminTokens.add(token);
  dbInstance.addAdminToken(token);

  res.json({
    success: true,
    token,
    username,
    message: 'স্বাগতম! অ্যাডমিন প্যানেলে সফলভাবে লগইন হয়েছে।',
  });
});

// Admin Logout
app.post('/api/admin/logout', requireAdmin, (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    activeAdminTokens.delete(token);
    dbInstance.removeAdminToken(token);
  }
  res.json({ success: true, message: 'লগআউট সফল হয়েছে।' });
});

// Verify Admin Session
app.get('/api/admin/me', requireAdmin, (req: Request, res: Response) => {
  res.json({ success: true, username: 'admin' });
});

// Admin Dashboard Counters
app.get('/api/admin/stats', requireAdmin, (req: Request, res: Response) => {
  const data = dbInstance.getData();
  const totalProducts = data.products.length;
  const totalOrders = data.orders.length;
  const pendingOrders = data.orders.filter(o => o.orderStatus === 'pending').length;
  const processingOrders = data.orders.filter(o => o.orderStatus === 'processing').length;
  const completedOrders = data.orders.filter(o => o.orderStatus === 'delivered').length;
  const cancelledOrders = data.orders.filter(o => o.orderStatus === 'cancelled').length;
  
  const totalRevenue = data.orders
    .filter(o => o.orderStatus === 'delivered')
    .reduce((acc, o) => acc + o.totalAmount, 0);

  const lowStockProducts = data.products.filter(p => p.stock <= 5);
  const recentOrders = data.orders.slice(0, 5);

  res.json({
    totalProducts,
    totalOrders,
    pendingOrders,
    processingOrders,
    completedOrders,
    cancelledOrders,
    totalRevenue,
    lowStockCount: lowStockProducts.length,
    lowStockProducts,
    recentOrders,
  });
});

// Admin Products CRUD
app.get('/api/admin/products', requireAdmin, (req: Request, res: Response) => {
  const data = dbInstance.getData();
  res.json({ products: data.products });
});

app.post('/api/admin/products', requireAdmin, (req: Request, res: Response) => {
  const {
    name, sku, category, description,
    regularPrice, salePrice, shopPrice, resellerPrice, costPrice,
    showInShop, showInReseller, allowDropship,
    stock, images, mainImage, variants, isFeatured, isPopular, isPublished
  } = req.body;

  if (!name || (regularPrice === undefined && shopPrice === undefined)) {
    return res.status(400).json({ error: 'পণ্যের নাম ও নিয়মিত/শপ মূল্য আবশ্যক।' });
  }

  const regPrice = Number(regularPrice ?? shopPrice);
  const sPrice = salePrice ? Number(salePrice) : undefined;
  const determinedShopPrice = shopPrice !== undefined ? Number(shopPrice) : (sPrice ?? regPrice);
  const determinedResellerPrice = resellerPrice !== undefined
    ? Number(resellerPrice)
    : (costPrice !== undefined ? Number(costPrice) : Math.round(determinedShopPrice * 0.78));

  if (determinedShopPrice < 0 || determinedResellerPrice < 0) {
    return res.status(400).json({ error: 'মূল্য ঋণাত্মক (নেগেটিভ) হতে পারে না।' });
  }

  const data = dbInstance.getData();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `prod-${Date.now()}`;
  const generatedSku = sku?.trim() || `ZX-${Math.floor(1000 + Math.random() * 9000)}`;

  const newProduct: Product = {
    id: `prod-${Date.now()}`,
    slug: `${slug}-${Math.floor(100 + Math.random() * 900)}`,
    sku: generatedSku,
    name: name.trim(),
    category: category || 'cat-1',
    description: description?.trim() || '',
    regularPrice: regPrice,
    salePrice: sPrice,
    shopPrice: determinedShopPrice,
    resellerPrice: determinedResellerPrice,
    costPrice: costPrice !== undefined ? Number(costPrice) : undefined,
    showInShop: showInShop !== false,
    showInReseller: showInReseller !== false,
    allowDropship: allowDropship !== false,
    stock: Number(stock) || 0,
    images: Array.isArray(images) && images.length ? images : (mainImage ? [mainImage] : []),
    mainImage: mainImage || (Array.isArray(images) && images[0]) || '',
    variants: Array.isArray(variants) ? variants : [],
    isFeatured: Boolean(isFeatured),
    isPopular: Boolean(isPopular),
    isPublished: isPublished !== false,
    rating: 5.0,
    reviewCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  data.products.unshift(newProduct);
  const saveSuccess = dbInstance.save();
  if (!saveSuccess) {
    data.products.shift(); // Rollback in-memory state
    return res.status(500).json({ error: 'সার্ভার ডেটাবেসে পণ্য সংরক্ষণ করতে ব্যর্থ হয়েছে।' });
  }

  res.status(201).json({ success: true, product: newProduct });
});

app.put('/api/admin/products/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const data = dbInstance.getData();
  const index = data.products.findIndex(p => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'পণ্যটি পাওয়া যায়নি।' });
  }

  const existing = data.products[index];
  const oldProduct = { ...existing };

  // Parse independent prices safely without overwriting each other
  let newRegularPrice = existing.regularPrice;
  if (req.body.regularPrice !== undefined && req.body.regularPrice !== null && req.body.regularPrice !== '') {
    newRegularPrice = Number(req.body.regularPrice);
  }

  let newSalePrice = existing.salePrice;
  if (req.body.salePrice !== undefined) {
    newSalePrice = req.body.salePrice ? Number(req.body.salePrice) : undefined;
  }

  // Shop price: user-specified shopPrice OR fallback to existing.shopPrice OR salePrice ?? regularPrice
  let newShopPrice = existing.shopPrice ?? (newSalePrice ?? newRegularPrice);
  if (req.body.shopPrice !== undefined && req.body.shopPrice !== null && req.body.shopPrice !== '') {
    newShopPrice = Number(req.body.shopPrice);
  }

  // Reseller price: independent. Never automatically changed when shopPrice changes!
  let newResellerPrice = existing.resellerPrice ?? Math.round(newShopPrice * 0.78);
  if (req.body.resellerPrice !== undefined && req.body.resellerPrice !== null && req.body.resellerPrice !== '') {
    newResellerPrice = Number(req.body.resellerPrice);
  }

  if (newShopPrice < 0 || newResellerPrice < 0) {
    return res.status(400).json({ error: 'মূল্য ঋণাত্মক হতে পারে না।' });
  }

  const updated: Product = {
    ...existing,
    ...req.body,
    regularPrice: newRegularPrice,
    salePrice: newSalePrice,
    shopPrice: newShopPrice,
    resellerPrice: newResellerPrice,
    costPrice: req.body.costPrice !== undefined ? (req.body.costPrice ? Number(req.body.costPrice) : undefined) : existing.costPrice,
    showInShop: req.body.showInShop !== undefined ? Boolean(req.body.showInShop) : (existing.showInShop ?? true),
    showInReseller: req.body.showInReseller !== undefined ? Boolean(req.body.showInReseller) : (existing.showInReseller ?? true),
    allowDropship: req.body.allowDropship !== undefined ? Boolean(req.body.allowDropship) : (existing.allowDropship ?? true),
    stock: req.body.stock !== undefined ? Number(req.body.stock) : existing.stock,
    updatedAt: new Date().toISOString(),
  };

  data.products[index] = updated;
  const saveSuccess = dbInstance.save();
  if (!saveSuccess) {
    data.products[index] = oldProduct; // Rollback
    return res.status(500).json({ error: 'পণ্য আপডেট ডেটাবেসে সংরক্ষণ ব্যর্থ হয়েছে।' });
  }

  res.json({ success: true, product: updated });
});

app.delete('/api/admin/products/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const data = dbInstance.getData();
  const initialLen = data.products.length;
  const existing = data.products.find(p => p.id === id);
  data.products = data.products.filter(p => p.id !== id);

  if (data.products.length === initialLen) {
    return res.status(404).json({ error: 'পণ্যটি পাওয়া যায়নি।' });
  }

  const saveSuccess = dbInstance.save();
  if (!saveSuccess) {
    if (existing) data.products.push(existing); // Rollback
    return res.status(500).json({ error: 'পণ্য মুছে ফেলার পর ডেটাবেস সংরক্ষণ ব্যর্থ হয়েছে।' });
  }

  res.json({ success: true, message: 'পণ্যটি সফলভাবে মুছে ফেলা হয়েছে।' });
});

// Bulk actions for products
app.post('/api/admin/products/bulk', requireAdmin, (req: Request, res: Response) => {
  const { action, ids } = req.body;
  if (!action || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'অ্যাকশন ও প্রোডাক্ট নির্বাচন করুন।' });
  }

  const data = dbInstance.getData();
  const backupProducts = [...data.products];

  if (action === 'delete') {
    data.products = data.products.filter(p => !ids.includes(p.id));
  } else if (action === 'publish') {
    data.products.forEach(p => {
      if (ids.includes(p.id)) p.isPublished = true;
    });
  } else if (action === 'unpublish') {
    data.products.forEach(p => {
      if (ids.includes(p.id)) p.isPublished = false;
    });
  }

  const saveSuccess = dbInstance.save();
  if (!saveSuccess) {
    data.products = backupProducts; // Rollback
    return res.status(500).json({ error: 'বাল্ক পরিবর্তন ডেটাবেসে সংরক্ষণ ব্যর্থ হয়েছে।' });
  }

  res.json({ success: true, message: 'অপারেশন সফলভাবে সম্পন্ন হয়েছে।' });
});

// Duplicate product
app.post('/api/admin/products/duplicate/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const data = dbInstance.getData();
  const original = data.products.find(p => p.id === id);

  if (!original) {
    return res.status(404).json({ error: 'পণ্যটি পাওয়া যায়নি।' });
  }

  const copy: Product = {
    ...original,
    id: `prod-${Date.now()}`,
    name: `${original.name} (কপি)`,
    sku: `ZX-${Math.floor(1000 + Math.random() * 9000)}`,
    slug: `${original.slug}-copy-${Math.floor(100 + Math.random() * 900)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  data.products.unshift(copy);
  const saveSuccess = dbInstance.save();
  if (!saveSuccess) {
    data.products.shift(); // Rollback
    return res.status(500).json({ error: 'পণ্য ক্লোন ডেটাবেসে সংরক্ষণ ব্যর্থ হয়েছে।' });
  }

  res.json({ success: true, product: copy });
});

// Admin Database Manual Backup
app.post('/api/admin/backup', requireAdmin, (req: Request, res: Response) => {
  const backupPath = dbInstance.createExplicitBackup('manual');
  if (backupPath) {
    res.json({ success: true, message: 'সফলভাবে ডেটাবেস ব্যাকআপ তৈরি হয়েছে!', filename: path.basename(backupPath) });
  } else {
    res.status(500).json({ error: 'ব্যাকআপ সংরক্ষণ ব্যর্থ হয়েছে।' });
  }
});

// Admin Orders
app.get('/api/admin/orders', requireAdmin, (req: Request, res: Response) => {
  const data = dbInstance.getData();
  const { status, search } = req.query;
  let orders = [...data.orders];

  if (status && typeof status === 'string' && status !== 'all') {
    orders = orders.filter(o => o.orderStatus === status);
  }

  if (search && typeof search === 'string') {
    const q = search.trim().toLowerCase();
    orders = orders.filter(o => 
      o.orderNumber.toLowerCase().includes(q) ||
      o.customer.fullName.toLowerCase().includes(q) ||
      o.customer.phone.includes(q) ||
      (o.transactionId && o.transactionId.toLowerCase().includes(q))
    );
  }

  res.json({ orders });
});

// Update Order Status
app.patch('/api/admin/orders/:id/status', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, note } = req.body as { status: OrderStatus; note?: string };

  const data = dbInstance.getData();
  const order = data.orders.find(o => o.id === id || o.orderNumber === id);

  if (!order) {
    return res.status(404).json({ error: 'অর্ডারটি পাওয়া যায়নি।' });
  }

  const prevStatus = order.orderStatus;
  order.orderStatus = status;
  order.updatedAt = new Date().toISOString();
  order.statusHistory.push({
    status,
    timestamp: new Date().toISOString(),
    note: note || `অর্ডারের অবস্থা পরিবর্তিত হয়েছে: ${status}`,
  });

  // If order was cancelled, restore stock!
  if (status === 'cancelled' && prevStatus !== 'cancelled') {
    for (const item of order.items) {
      const prod = data.products.find(p => p.id === item.productId);
      if (prod) {
        prod.stock += item.quantity;
      }
    }
  }

  // Automatic Reseller Profit Processing upon Delivery Completion
  if (order.isResellerOrder && order.resellerDetails?.resellerId) {
    const reseller = data.resellers?.find(r => r.id === order.resellerDetails?.resellerId);
    if (reseller) {
      const profit = order.resellerDetails.estimatedProfit || 0;
      if (status === 'delivered' && order.resellerDetails.profitPayoutStatus !== 'completed') {
        // Auto credit profit to available balance and total earnings
        reseller.availableBalance = (reseller.availableBalance || 0) + profit;
        reseller.totalEarnings = (reseller.totalEarnings || 0) + profit;
        reseller.pendingEarnings = Math.max(0, (reseller.pendingEarnings || 0) - profit);
        reseller.updatedAt = new Date().toISOString();
        order.resellerDetails.profitPayoutStatus = 'completed';
        order.resellerDetails.profitCreditedAt = new Date().toISOString();
        order.statusHistory.push({
          status: 'delivered',
          timestamp: new Date().toISOString(),
          note: `ডেলিভারি সম্পন্ন হওয়ায় রিসেলারের ওয়ালেটে ৳${profit} লাভ স্বয়ংক্রিয়ভাবে যোগ করা হয়েছে।`,
        });
      } else if (status === 'cancelled') {
        if (order.resellerDetails.profitPayoutStatus === 'pending') {
          reseller.pendingEarnings = Math.max(0, (reseller.pendingEarnings || 0) - profit);
        } else if (order.resellerDetails.profitPayoutStatus === 'completed') {
          reseller.availableBalance = Math.max(0, (reseller.availableBalance || 0) - profit);
          reseller.totalEarnings = Math.max(0, (reseller.totalEarnings || 0) - profit);
        }
        reseller.updatedAt = new Date().toISOString();
        order.resellerDetails.profitPayoutStatus = 'cancelled';
      }
    }
  }

  dbInstance.save();
  res.json({ success: true, order });
});

// Verify Payment
app.patch('/api/admin/orders/:id/payment', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { paymentStatus } = req.body as { paymentStatus: PaymentStatus };

  const data = dbInstance.getData();
  const order = data.orders.find(o => o.id === id || o.orderNumber === id);

  if (!order) {
    return res.status(404).json({ error: 'অর্ডারটি পাওয়া যায়নি।' });
  }

  order.paymentStatus = paymentStatus;
  order.updatedAt = new Date().toISOString();
  dbInstance.save();

  res.json({ success: true, order });
});

// Admin Email Notification Status
app.get('/api/admin/email-status', requireAdmin, (req: Request, res: Response) => {
  res.json(getEmailServiceStatus());
});

// Admin Resend Order Notification Email
app.post('/api/admin/orders/:id/resend-email', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = dbInstance.getData();
  const order = data.orders.find(o => o.id === id || o.orderNumber === id);

  if (!order) {
    return res.status(404).json({ error: 'অর্ডারটি পাওয়া যায়নি।' });
  }

  const result = await sendOrderNotificationEmail(order);
  if (result.success) {
    order.emailNotificationStatus = 'sent';
    order.emailSentAt = new Date().toISOString();
    order.emailNotificationError = undefined;
    dbInstance.save();
    return res.json({ success: true, message: 'অর্ডার নোটিফিকেশন ইমেইল সফলভাবে পাঠানো হয়েছে।' });
  } else {
    order.emailNotificationStatus = isEmailConfigured() ? 'failed' : 'not_configured';
    order.emailNotificationError = result.error;
    dbInstance.save();
    return res.status(500).json({
      success: false,
      error: result.error || 'ইমেইল পাঠানো ব্যর্থ হয়েছে। অনুগ্রহ করে সার্ভার SMTP কনফিগারেশন চেক করুন।',
    });
  }
});

// Admin Send Test Email
app.post('/api/admin/test-email', requireAdmin, async (req: Request, res: Response) => {
  const { recipient } = req.body;
  const result = await sendTestNotificationEmail(recipient);

  if (result.success) {
    return res.json({
      success: true,
      message: `টেস্ট ইমেইল সফলভাবে পাঠানো হয়েছে! প্রাপক: ${result.recipient}`,
      messageId: result.messageId,
      recipient: result.recipient,
    });
  } else {
    return res.status(400).json({
      success: false,
      error: result.error || 'টেস্ট ইমেইল পাঠানো সম্ভব হয়নি।',
      recipient: result.recipient,
    });
  }
});

// Admin Notifications List & Mark Read
app.get('/api/admin/notifications', requireAdmin, (req: Request, res: Response) => {
  const data = dbInstance.getData();
  const notifs = data.adminNotifications || [];
  const unreadCount = notifs.filter(n => !n.read).length;
  res.json({ success: true, notifications: notifs.slice(0, 50), unreadCount });
});

app.patch('/api/admin/notifications/mark-read', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.body;
  const data = dbInstance.getData();
  if (!data.adminNotifications) data.adminNotifications = [];
  if (id) {
    const target = data.adminNotifications.find(n => n.id === id);
    if (target) target.read = true;
  } else {
    data.adminNotifications.forEach(n => { n.read = true; });
  }
  dbInstance.save();
  const unreadCount = data.adminNotifications.filter(n => !n.read).length;
  res.json({ success: true, unreadCount });
});

app.delete('/api/admin/notifications/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const data = dbInstance.getData();
  if (!data.adminNotifications) data.adminNotifications = [];
  data.adminNotifications = data.adminNotifications.filter(n => n.id !== id);
  dbInstance.save();
  res.json({ success: true });
});

// Categories Management
app.post('/api/admin/categories', requireAdmin, (req: Request, res: Response) => {
  const { name, banglaName, icon, isPublished } = req.body;
  if (!name && !banglaName) {
    return res.status(400).json({ error: 'ক্যাটাগরির নাম আবশ্যক।' });
  }

  const data = dbInstance.getData();
  const slug = (name || banglaName).toLowerCase().replace(/[^a-z0-9]+/g, '-') || `cat-${Date.now()}`;
  const newCat: Category = {
    id: `cat-${Date.now()}`,
    slug,
    name: name || banglaName,
    banglaName: banglaName || name,
    icon: icon || 'Tag',
    isPublished: isPublished !== false,
    order: data.categories.length + 1,
  };

  data.categories.push(newCat);
  dbInstance.save();
  res.status(201).json({ success: true, category: newCat });
});

app.put('/api/admin/categories/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const data = dbInstance.getData();
  const cat = data.categories.find(c => c.id === id);

  if (!cat) {
    return res.status(404).json({ error: 'ক্যাটাগরি পাওয়া যায়নি।' });
  }

  Object.assign(cat, req.body);
  dbInstance.save();
  res.json({ success: true, category: cat });
});

app.delete('/api/admin/categories/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const data = dbInstance.getData();
  data.categories = data.categories.filter(c => c.id !== id);
  dbInstance.save();
  res.json({ success: true, message: 'ক্যাটাগরি মুছে ফেলা হয়েছে।' });
});

// Delivery Zones
app.put('/api/admin/delivery-zones', requireAdmin, (req: Request, res: Response) => {
  const { zones } = req.body as { zones: DeliveryZone[] };
  if (!Array.isArray(zones)) {
    return res.status(400).json({ error: 'অবৈধ ডেলিভারি জোনের তালিকা।' });
  }

  const data = dbInstance.getData();
  data.deliveryZones = zones;
  dbInstance.save();
  res.json({ success: true, zones: data.deliveryZones });
});

// Coupons
app.post('/api/admin/coupons', requireAdmin, (req: Request, res: Response) => {
  const { code, discountType, discountValue, minOrderAmount } = req.body;
  if (!code || !discountValue) {
    return res.status(400).json({ error: 'কুপন কোড ও ছাড়ের পরিমাণ প্রয়োজন।' });
  }

  const data = dbInstance.getData();
  const newCoupon: Coupon = {
    code: code.trim().toUpperCase(),
    discountType: discountType || 'fixed',
    discountValue: Number(discountValue),
    minOrderAmount: Number(minOrderAmount) || 0,
    isActive: true,
  };

  data.coupons = data.coupons.filter(c => c.code !== newCoupon.code);
  data.coupons.push(newCoupon);
  dbInstance.save();

  res.status(201).json({ success: true, coupon: newCoupon });
});

app.delete('/api/admin/coupons/:code', requireAdmin, (req: Request, res: Response) => {
  const { code } = req.params;
  const data = dbInstance.getData();
  data.coupons = data.coupons.filter(c => c.code !== code.toUpperCase());
  dbInstance.save();
  res.json({ success: true, message: 'কুপন মুছে ফেলা হয়েছে।' });
});

// Settings - GET Admin Settings (Authenticated only, safe representation of secrets)
app.get('/api/admin/settings', requireAdmin, (req: Request, res: Response) => {
  const data = dbInstance.getData();
  const safeSettings: StoreSettings = {
    ...data.settings,
    smtpPass: '', // Never leak raw password to client browser
    hasSmtpPass: Boolean(data.settings.smtpPass),
  };
  res.json({ success: true, settings: safeSettings });
});

// Settings - PUT Admin Settings (Validated, normalized, safe persistence)
app.put('/api/admin/settings', requireAdmin, (req: Request, res: Response) => {
  try {
    const data = dbInstance.getData();
    const body = req.body || {};

    // 1. Validate Store Name if provided
    if (body.storeName !== undefined && typeof body.storeName === 'string' && !body.storeName.trim()) {
      return res.status(400).json({ success: false, error: 'দোকানের নাম খালি রাখা যাবে না।' });
    }

    // 2. Validate Admin Notification Email
    let adminEmail: string | undefined = undefined;
    if (body.adminNotificationEmail !== undefined && body.adminNotificationEmail !== null) {
      const emailStr = String(body.adminNotificationEmail).trim();
      if (emailStr !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailStr)) {
          return res.status(400).json({
            success: false,
            error: 'অ্যাডমিন নোটিফিকেশন ইমেইলটি সঠিক নয়। অনুগ্রহ করে একটি বৈধ ইমেইল দিন (যেমন: mdmohammad.644633815@gmail.com)।',
            field: 'adminNotificationEmail',
          });
        }
        adminEmail = emailStr;
      } else {
        adminEmail = 'mdmohammad.644633815@gmail.com';
      }
    }

    // 3. Validate SMTP User (Gmail address)
    let smtpUser: string | undefined = undefined;
    if (body.smtpUser !== undefined && body.smtpUser !== null) {
      const userStr = String(body.smtpUser).trim();
      if (userStr !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(userStr)) {
          return res.status(400).json({
            success: false,
            error: 'প্রেরক Gmail আইডি (SMTP User) একটি সঠিক ইমেইল হতে হবে (যেমন: yourstore@gmail.com)।',
            field: 'smtpUser',
          });
        }
        smtpUser = userStr;
      } else {
        smtpUser = '';
      }
    }

    // 4. Validate SMTP Host
    let smtpHost: string | undefined = undefined;
    if (body.smtpHost !== undefined && body.smtpHost !== null) {
      const hostStr = String(body.smtpHost).trim();
      if (hostStr !== '') {
        const hostRegex = /^[a-zA-Z0-9.-]+$/;
        if (!hostRegex.test(hostStr)) {
          return res.status(400).json({
            success: false,
            error: 'SMTP Host এর মান সঠিক নয় (যেমন: smtp.gmail.com)।',
            field: 'smtpHost',
          });
        }
        smtpHost = hostStr;
      } else {
        smtpHost = 'smtp.gmail.com';
      }
    }

    // 5. Validate SMTP Port
    let smtpPort: number | undefined = undefined;
    if (body.smtpPort !== undefined && body.smtpPort !== null && body.smtpPort !== '') {
      const portNum = Number(body.smtpPort);
      if (isNaN(portNum) || !Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
        return res.status(400).json({
          success: false,
          error: 'SMTP Port ১ থেকে ৬৫৫৩৫ এর মধ্যে একটি বৈধ পূর্ণসংখ্যা হতে হবে (যেমন: 465 বা 587)।',
          field: 'smtpPort',
        });
      }
      smtpPort = portNum;
    } else if (body.smtpPort === '') {
      smtpPort = 465;
    }

    // 6. Validate & Normalize App Password (smtpPass)
    let finalSmtpPass = data.settings.smtpPass;
    if (body.clearSmtpPass === true) {
      finalSmtpPass = undefined;
    } else if (typeof body.smtpPass === 'string' && body.smtpPass.trim() !== '') {
      // Remove spaces between 4-char groups (e.g. 'xxxx xxxx xxxx xxxx' -> 'xxxxxxxxxxxxxxxx')
      const cleanPass = body.smtpPass.replace(/\s+/g, '');
      if (cleanPass.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'Google App Password কমপক্ষে ৮ অক্ষরের (সাধারণত ১৬-ডিজিটের) হতে হবে।',
          field: 'smtpPass',
        });
      }
      finalSmtpPass = cleanPass;
    }

    // 7. Coherency Check: if smtpUser provided without any password
    if (smtpUser && !finalSmtpPass && !process.env.SMTP_PASS && !process.env.GMAIL_APP_PASSWORD) {
      return res.status(400).json({
        success: false,
        error: 'প্রেরক Gmail আইডির সাথে ১৬-ডিজিটের Google App Password প্রদান করা আবশ্যক।',
        field: 'smtpPass',
      });
    }

    // 8. Construct sanitized updated settings
    const cleanBody = { ...body };
    if (!cleanBody.smtpPass || typeof cleanBody.smtpPass !== 'string' || !cleanBody.smtpPass.trim()) {
      delete cleanBody.smtpPass;
    }

    const updatedSettings: StoreSettings = {
      ...data.settings,
      ...cleanBody,
      ...(adminEmail !== undefined ? { adminNotificationEmail: adminEmail } : {}),
      ...(smtpUser !== undefined ? { smtpUser: smtpUser } : {}),
      ...(smtpHost !== undefined ? { smtpHost: smtpHost } : {}),
      ...(smtpPort !== undefined ? { smtpPort: smtpPort } : {}),
    };

    if (finalSmtpPass) {
      updatedSettings.smtpPass = finalSmtpPass;
    } else if (body.clearSmtpPass === true) {
      delete updatedSettings.smtpPass;
    }

    data.settings = updatedSettings;
    const saveSuccess = dbInstance.save();
    if (!saveSuccess) {
      return res.status(500).json({
        success: false,
        error: 'ডেটাবেস ফাইলে সেটিংস সংরক্ষণ ব্যর্থ হয়েছে। অনুগ্রহ করে সার্ভার ফাইল পারমিশন পরীক্ষা করুন।',
      });
    }

    console.log('[Admin Settings] Successfully updated and persisted store settings to db.json');

    // Safe settings response without raw password
    const safeResponseSettings: StoreSettings = {
      ...data.settings,
      smtpPass: '',
      hasSmtpPass: Boolean(data.settings.smtpPass),
    };

    res.json({
      success: true,
      settings: safeResponseSettings,
      message: 'সেটিংস সফলভাবে ডেটাবেসে সংরক্ষিত হয়েছে।',
    });
  } catch (err: any) {
    console.error('[Admin Settings ERROR]', err?.message || 'Unknown error');
    res.status(500).json({
      success: false,
      error: 'সার্ভারে অভ্যন্তরীণ ত্রুটি ঘটেছে: ' + (err?.message || 'অজানা ত্রুটি'),
    });
  }
});

// Change Admin Password
app.put('/api/admin/password', requireAdmin, (req: Request, res: Response) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' });
  }

  dbInstance.updateAdminPassword(newPassword);
  res.json({ success: true, message: 'অ্যাডমিন পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে।' });
});

// Reviews Moderation
app.get('/api/admin/reviews', requireAdmin, (req: Request, res: Response) => {
  const data = dbInstance.getData();
  res.json({ reviews: data.reviews });
});

app.patch('/api/admin/reviews/:id/approve', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const data = dbInstance.getData();
  const review = data.reviews.find(r => r.id === id);
  if (!review) return res.status(404).json({ error: 'রিভিউ পাওয়া যায়নি।' });

  review.isApproved = !review.isApproved;
  dbInstance.save();
  res.json({ success: true, review });
});

app.delete('/api/admin/reviews/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const data = dbInstance.getData();
  data.reviews = data.reviews.filter(r => r.id !== id);
  dbInstance.save();
  res.json({ success: true, message: 'রিভিউ মুছে ফেলা হয়েছে।' });
});

// ==========================================
// 3. RESELLER & DROPSHIPPING SYSTEM APIS
// ==========================================

// Reseller Auth Middleware
function requireReseller(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'রিসেলার অ্যাকাউন্টে লগইন করা আবশ্যক।' });
  }
  const token = authHeader.split(' ')[1];
  const reseller = dbInstance.getResellerByToken(token);
  if (!reseller) {
    return res.status(401).json({ error: 'রিসেলার সেশন মেয়াদোত্তীর্ণ বা অবৈধ।' });
  }
  (req as any).reseller = reseller;
  next();
}

// Optional Reseller Middleware (Attaches reseller if valid token provided, otherwise continues)
function optionalReseller(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const reseller = dbInstance.getResellerByToken(token);
    if (reseller) {
      (req as any).reseller = reseller;
    }
  }
  next();
}

// Reseller Public: Get Registration Status & Fee settings
app.get('/api/reseller/settings', (req: Request, res: Response) => {
  const data = dbInstance.getData();
  res.json({
    enabled: data.settings.resellerRegistrationEnabled !== false,
    registrationFee: data.settings.resellerRegistrationFee ?? 200,
    bkashNumber: data.settings.bkashNumber,
    bkashType: data.settings.bkashType,
    nagadNumber: data.settings.nagadNumber,
    nagadType: data.settings.nagadType,
    notice: data.settings.resellerNotice || 'ZX Shop রিসেলার ও ড্রপশিপিং প্রোগ্রামে স্বাগতম!',
  });
});

// Helper to hash reseller password securely
function hashResellerPassword(password: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

function sanitizeReseller(reseller: Reseller): Reseller {
  const safe = { ...reseller };
  delete safe.passwordHash;
  delete safe.salt;
  return safe;
}

// Reseller Register (Requires unique password)
app.post('/api/reseller/register', (req: Request, res: Response) => {
  const data = dbInstance.getData();
  if (data.settings.resellerRegistrationEnabled === false) {
    return res.status(400).json({ error: 'বর্তমানে নতুন রিসেলার রেজিস্ট্রেশন সাময়িকভাবে বন্ধ আছে।' });
  }

  const { name, email, phone, password, shopName, address, trxId, paymentMethod, promoCode } = req.body;
  if (!name?.trim() || !email?.trim() || !phone?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'নাম, ইমেইল, মোবাইল নম্বর এবং পাসওয়ার্ড আবশ্যক।' });
  }

  if (password.trim().length < 6) {
    return res.status(400).json({ error: 'পাসওয়ার্ড অবশ্যই ন্যূনতম ৬ অক্ষরের হতে হবে।' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone.replace(/[^0-9]/g, '');

  if (cleanPhone.length < 11) {
    return res.status(400).json({ error: 'সঠিক ১১-ডিজিটের মোবাইল নম্বর দিন।' });
  }

  if (!Array.isArray(data.resellers)) {
    data.resellers = [];
  }

  const existing = data.resellers.find(r => r.email.toLowerCase() === cleanEmail || r.phone === cleanPhone);
  if (existing) {
    return res.status(400).json({ error: 'এই ইমেইল বা মোবাইল নম্বর দিয়ে ইতিপূর্বে একটি রিসেলার অ্যাকাউন্ট খোলা হয়েছে।' });
  }

  // Promo code & Referral verification
  const inputPromo = String(promoCode || '').trim().toUpperCase();
  let referrerReseller: Reseller | undefined = undefined;
  if (inputPromo) {
    referrerReseller = data.resellers.find(r => r.promoCode && r.promoCode.toUpperCase() === inputPromo);
  }

  const regularFee = data.settings.resellerRegistrationRegularFee ?? 1000;
  const discountedFee = data.settings.resellerRegistrationDiscountedFee ?? 300;
  const referralBonus = data.settings.resellerReferralBonus ?? 100;

  // Fee calculation: if valid promo code used -> discounted fee, else regular fee
  const feeAmount = referrerReseller ? discountedFee : (data.settings.resellerRegistrationFee ?? regularFee);

  // Credit referral reward to referrer
  if (referrerReseller) {
    referrerReseller.referralCount = (referrerReseller.referralCount || 0) + 1;
    referrerReseller.referralEarnings = (referrerReseller.referralEarnings || 0) + referralBonus;
    referrerReseller.availableBalance = (referrerReseller.availableBalance || 0) + referralBonus;
    referrerReseller.totalEarnings = (referrerReseller.totalEarnings || 0) + referralBonus;
    referrerReseller.updatedAt = new Date().toISOString();
  }

  // Generate unique promo code for the newly registering reseller
  let newPromoCode = `ZX-${cleanPhone.slice(-4)}-${Math.floor(1000 + Math.random() * 9000)}`;
  while (data.resellers.some(r => r.promoCode === newPromoCode)) {
    newPromoCode = `ZX-${cleanPhone.slice(-4)}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashResellerPassword(password.trim(), salt);

  const newReseller: Reseller = {
    id: `reseller-${Date.now()}`,
    name: name.trim(),
    email: cleanEmail,
    phone: cleanPhone,
    passwordHash,
    salt,
    shopName: shopName?.trim() || `${name.trim()} শপ`,
    address: address?.trim() || '',
    status: feeAmount > 0 ? 'pending' : 'approved',
    registrationFeePaid: Boolean(trxId?.trim()),
    registrationFeeTrxId: trxId?.trim() || undefined,
    registrationPaymentMethod: paymentMethod || 'bKash',
    registrationFeeAmount: feeAmount,
    promoCode: newPromoCode,
    referredByPromoCode: referrerReseller ? referrerReseller.promoCode : undefined,
    referredByResellerId: referrerReseller?.id,
    referralCount: 0,
    referralEarnings: 0,
    availableBalance: 0,
    withdrawnEarnings: 0,
    totalOrdersCount: 0,
    totalEarnings: 0,
    pendingEarnings: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  data.resellers.unshift(newReseller);
  dbInstance.save();

  // Async email notification to admin Gmail
  sendResellerRegistrationEmail(newReseller, referrerReseller).catch(() => {});

  const token = dbInstance.createResellerSession(newReseller.id);

  res.status(201).json({
    success: true,
    token,
    reseller: sanitizeReseller(newReseller),
    appliedPromo: Boolean(referrerReseller),
    discountSaved: referrerReseller ? regularFee - discountedFee : 0,
    message: feeAmount > 0
      ? 'রেজিস্ট্রেশন সফল হয়েছে! অ্যাডমিন পেমেন্ট ভেরিফাই করার পর আপনার অ্যাকাউন্ট সক্রিয় হবে।'
      : 'রেজিস্ট্রেশন সফল ও অ্যাকাউন্ট সক্রিয় হয়েছে!',
  });
});

// Verify Promo Code before registration
app.get('/api/reseller/promo/verify', (req: Request, res: Response) => {
  const code = String(req.query.code || '').trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ valid: false, error: 'অনুগ্রহ করে প্রমো কোড প্রদান করুন।' });
  }

  const data = dbInstance.getData();
  const referrer = (data.resellers || []).find(r => r.promoCode && r.promoCode.toUpperCase() === code);
  const regularFee = data.settings.resellerRegistrationRegularFee ?? 1000;
  const discountedFee = data.settings.resellerRegistrationDiscountedFee ?? 300;
  const referralBonus = data.settings.resellerReferralBonus ?? 100;

  if (!referrer) {
    return res.status(404).json({ valid: false, error: 'অকার্যকর প্রমো কোড! সঠিক রেফারেল কোড লিখুন।' });
  }

  return res.json({
    valid: true,
    promoCode: referrer.promoCode,
    referrerName: referrer.name,
    regularFee,
    discountedFee,
    discountAmount: Math.max(0, regularFee - discountedFee),
    referralBonus,
    message: `প্রমো কোড গৃহীত হয়েছে! রেজিস্ট্রেশন ফি ৳${discountedFee} (৳${regularFee - discountedFee} ছাড়)!`,
  });
});

// Reseller Login (Requires phone/email + password)
app.post('/api/reseller/login', (req: Request, res: Response) => {
  const { identifier, phone, password } = req.body;
  const input = (identifier || phone || '').trim().toLowerCase();
  if (!input) {
    return res.status(400).json({ error: 'মোবাইল নম্বর বা ইমেইল ঠিকানা প্রদান করুন।' });
  }
  if (!password?.trim()) {
    return res.status(400).json({ error: 'অনুগ্রহ করে পাসওয়ার্ড প্রদান করুন।' });
  }

  const data = dbInstance.getData();
  if (!Array.isArray(data.resellers)) data.resellers = [];

  const cleanPhone = input.replace(/[^0-9]/g, '');
  const reseller = data.resellers.find(r => 
    r.email.toLowerCase() === input ||
    (cleanPhone.length >= 10 && (r.phone === cleanPhone || r.phone.endsWith(cleanPhone)))
  );

  if (!reseller) {
    return res.status(401).json({ error: 'ভুল ইমেইল/মোবাইল নম্বর অথবা অ্যাকাউন্ট পাওয়া যায়নি।' });
  }

  // Verify password
  if (reseller.passwordHash && reseller.salt) {
    const computed = hashResellerPassword(password.trim(), reseller.salt);
    if (computed !== reseller.passwordHash) {
      return res.status(401).json({ error: 'ভুল পাসওয়ার্ড! সঠিক পাসওয়ার্ড দিন।' });
    }
  } else {
    // Migration: set password for legacy accounts
    const salt = crypto.randomBytes(16).toString('hex');
    reseller.salt = salt;
    reseller.passwordHash = hashResellerPassword(password.trim(), salt);
    dbInstance.save();
  }

  const token = dbInstance.createResellerSession(reseller.id);
  res.json({
    success: true,
    token,
    reseller: sanitizeReseller(reseller),
    message: 'রিসেলার অ্যাকাউন্টে সফলভাবে লগইন হয়েছে।',
  });
});

// Reseller Profile & Verification Check
app.get('/api/reseller/me', requireReseller, (req: Request, res: Response) => {
  const reseller = (req as any).reseller as Reseller;
  res.json({ success: true, reseller: sanitizeReseller(reseller) });
});

// Reseller Catalog & Products (Accessible by any visitor or authenticated reseller)
app.get(['/api/reseller/products', '/api/reseller/catalog'], optionalReseller, (req: Request, res: Response) => {
  const data = dbInstance.getData();
  const catalog = data.products
    .filter(p => p.isPublished && p.showInReseller !== false && p.allowDropship !== false)
    .map(p => {
      const sPrice = p.shopPrice ?? (p.salePrice ?? p.regularPrice);
      const rPrice = p.resellerPrice ?? Math.round(sPrice * 0.78);
      return {
        id: p.id,
        slug: p.slug,
        sku: p.sku,
        name: p.name,
        category: p.category,
        description: p.description,
        mainImage: p.mainImage,
        images: p.images,
        stock: p.stock,
        shopPrice: sPrice,
        resellerPrice: rPrice,
        minSuggestedMargin: Math.max(0, sPrice - rPrice),
        variants: p.variants,
      };
    });

  res.json({ success: true, products: catalog });
});

// Reseller Submit Dropshipping Order
app.post(['/api/reseller/orders', '/api/reseller/orders/create'], requireReseller, (req: Request, res: Response) => {
  const reseller = (req as any).reseller as Reseller;
  if (reseller.status === 'rejected' || reseller.status === 'suspended') {
    return res.status(403).json({ error: 'আপনার রিসেলার অ্যাকাউন্টটি স্থগিত বা বাতিল করা হয়েছে। সহায়তার জন্য যোগাযোগ করুন।' });
  }

  const {
    customer,
    productId,
    quantity = 1,
    resellerSellingPrice,
    sellingPricePerUnit: altPrice,
    selectedVariants,
    deliveryZoneId,
    notes,
    deliveryPaymentMethod = 'wallet',
    deliveryPaymentTrxId,
    deliveryPaymentSenderPhone,
  } = req.body;

  if (!customer?.fullName?.trim() || !customer?.phone?.trim() || !customer?.fullAddress?.trim()) {
    return res.status(400).json({ error: 'কাস্টমারের সম্পূর্ণ নাম, ১১-ডিজিট মোবাইল ও ডেলিভারি ঠিকানা আবশ্যক।' });
  }

  const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length < 11) {
    return res.status(400).json({ error: 'সঠিক বাংলাদেশি ১১-ডিজিটের মোবাইল নম্বর দিন।' });
  }

  const data = dbInstance.getData();
  const prod = data.products.find(p => p.id === productId && p.isPublished && p.showInReseller !== false);
  if (!prod) {
    return res.status(400).json({ error: 'নির্বাচিত পণ্যটি পাওয়া যায়নি অথবা ড্রপশিপিংয়ের জন্য প্রযোজ্য নয়।' });
  }

  const qty = Math.max(1, parseInt(quantity, 10));
  if (prod.stock < qty) {
    return res.status(400).json({ error: `পর্যাপ্ত স্টক নেই। বর্তমান স্টক: ${prod.stock} টি।` });
  }

  const zoneId = deliveryZoneId || customer?.deliveryZoneId;
  const zone = data.deliveryZones.find(z => z.id === zoneId) || data.deliveryZones[0];
  const deliveryCharge = zone ? zone.rate : 60;

  // Advance delivery fee required from reseller per admin setting (default ৳100)
  const advanceDeliveryFee = Number(data.settings.resellerOrderDeliveryFee ?? 100);

  // Validate & process advance delivery fee payment
  if (deliveryPaymentMethod === 'wallet') {
    const currentWalletBal = reseller.availableBalance ?? 0;
    if (currentWalletBal < advanceDeliveryFee) {
      return res.status(400).json({
        error: `আপনার রিসেলার ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই (বর্তমান: ৳${currentWalletBal}, প্রয়োজন: ৳${advanceDeliveryFee})। অনুগ্রহ করে বিকাশ বা নগদ নির্বাচন করুন।`,
      });
    }
    // Deduct advance delivery fee directly from reseller's available balance
    reseller.availableBalance = currentWalletBal - advanceDeliveryFee;
  } else {
    // bKash / Nagad / Rocket
    if (!deliveryPaymentTrxId || !deliveryPaymentTrxId.trim()) {
      return res.status(400).json({
        error: `অগ্রিম ডেলিভারি চার্জ (৳${advanceDeliveryFee}) পরিশোধের Transaction ID (TrxID) প্রদান আবশ্যক।`,
      });
    }
  }

  const wholesaleUnitCost = prod.resellerPrice ?? Math.round((prod.shopPrice ?? prod.regularPrice) * 0.78);
  const wholesaleTotalCost = wholesaleUnitCost * qty;

  const sellingPricePerUnit = Number(resellerSellingPrice ?? altPrice);
  if (isNaN(sellingPricePerUnit) || sellingPricePerUnit < wholesaleUnitCost) {
    return res.status(400).json({
      error: `কাস্টমার বিক্রয় মূল্য অবশ্যই রিসেলার পাইকারি মূল্য (৳${wholesaleUnitCost}) এর বেশি বা সমান হতে হবে।`,
    });
  }

  const customerItemsTotal = sellingPricePerUnit * qty;
  const grandTotalCustomer = customerItemsTotal + deliveryCharge;

  // Transparent Estimated Profit = (Reseller Selling Price - Reseller Wholesale Cost)
  const estimatedProfit = customerItemsTotal - wholesaleTotalCost;

  const orderNum = `ZX-DRP-${Math.floor(100000 + Math.random() * 900000)}`;

  const finalTrxId = deliveryPaymentMethod === 'wallet'
    ? `WALLET-DED-${Date.now()}`
    : (deliveryPaymentTrxId?.trim() || '');

  const newOrder: Order = {
    id: `ord-${Date.now()}`,
    orderNumber: orderNum,
    customer: {
      fullName: customer.fullName.trim(),
      phone: cleanPhone,
      division: customer.division || 'ঢাকা',
      district: customer.district || 'ঢাকা',
      deliveryArea: zone.name,
      fullAddress: customer.fullAddress.trim(),
      notes: notes?.trim() || `রিসেলার: ${reseller.name} (${reseller.shopName || ''})`,
    },
    items: [
      {
        productId: prod.id,
        name: prod.name,
        sku: prod.sku,
        price: sellingPricePerUnit, // Customer pays this
        quantity: qty,
        image: prod.mainImage,
        selectedVariants: selectedVariants || {},
        total: customerItemsTotal,
      },
    ],
    subtotal: customerItemsTotal,
    deliveryCharge,
    discount: 0,
    totalAmount: grandTotalCustomer,
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    orderStatus: 'pending',
    deliveryZoneId: zone.id,
    deliveryZoneName: zone.name,
    isResellerOrder: true,
    resellerDetails: {
      isResellerOrder: true,
      resellerId: reseller.id,
      resellerName: reseller.name,
      resellerEmail: reseller.email,
      resellerPhone: reseller.phone,
      resellerShopName: reseller.shopName,
      resellerProductCost: wholesaleTotalCost,
      resellerSellingPrice: customerItemsTotal,
      estimatedProfit,
      profitPayoutStatus: 'pending',
      deliveryFeePaid: advanceDeliveryFee,
      deliveryPaymentMethod: deliveryPaymentMethod as any,
      deliveryPaymentTrxId: finalTrxId,
      deliveryPaymentSenderPhone: deliveryPaymentSenderPhone?.trim() || undefined,
    },
    statusHistory: [
      {
        status: 'pending',
        timestamp: new Date().toISOString(),
        note: `রিসেলার ড্রপশিপিং অর্ডার তৈরি হয়েছে। অগ্রিম ডেলিভারি ফি: ৳${advanceDeliveryFee} (${deliveryPaymentMethod === 'wallet' ? 'ওয়ালেট থেকে কর্তিত' : `${deliveryPaymentMethod} TrxID: ${finalTrxId}`})। আনুমানিক লাভ: ৳${estimatedProfit}`,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Deduct stock safely
  prod.stock -= qty;

  // Update reseller stats
  reseller.totalOrdersCount = (reseller.totalOrdersCount || 0) + 1;
  reseller.pendingEarnings = (reseller.pendingEarnings || 0) + estimatedProfit;
  reseller.updatedAt = new Date().toISOString();

  data.orders.unshift(newOrder);

  // Push Admin Alert Notification
  if (!data.adminNotifications) data.adminNotifications = [];
  data.adminNotifications.unshift({
    id: `notif-${Date.now()}`,
    type: 'reseller_order',
    title: 'নতুন রিসেলার ড্রপশিপিং অর্ডার এসেছে!',
    message: `রিসেলার ${reseller.name} (${reseller.shopName || 'রিসেলার'}) নতুন ড্রপশিপিং অর্ডার #${orderNum} দিয়েছেন। অগ্রিম ডেলিভারি চার্জ ৳${advanceDeliveryFee} (${deliveryPaymentMethod === 'wallet' ? 'ওয়ালেট থেকে কর্তিত' : `${deliveryPaymentMethod} TrxID: ${finalTrxId}`})। আনুমানিক লাভ: ৳${estimatedProfit}।`,
    orderId: newOrder.id,
    orderNumber: orderNum,
    resellerName: reseller.name,
    resellerPhone: reseller.phone,
    amount: advanceDeliveryFee,
    read: false,
    createdAt: new Date().toISOString(),
  });

  dbInstance.save();

  // Async email notification if configured
  sendOrderNotificationEmail(newOrder).catch(() => {});
  sendResellerOrderEmail(newOrder, reseller).catch(() => {});

  res.status(201).json({
    success: true,
    order: newOrder,
    estimatedProfit,
    availableBalance: reseller.availableBalance,
    pendingEarnings: reseller.pendingEarnings,
    message: `ড্রপশিপিং অর্ডার সফলভাবে সাবমিট হয়েছে! ডেলিভারি ফি ৳${advanceDeliveryFee} (${deliveryPaymentMethod === 'wallet' ? 'ওয়ালেট ব্যালেন্স থেকে কর্তিত' : 'বিকাশ/নগদ'}) সফল হয়েছে। পার্সেল ডেলিভারি সম্পন্ন হলে আপনার ৳${estimatedProfit} লাভ স্বয়ংক্রিয়ভাবে মূল ব্যালেন্সে যোগ হবে।`,
  });
});

// Reseller Orders List
app.get('/api/reseller/orders', requireReseller, (req: Request, res: Response) => {
  const reseller = (req as any).reseller as Reseller;
  const data = dbInstance.getData();
  const myOrders = data.orders.filter(o => o.resellerDetails?.resellerId === reseller.id);
  res.json({ success: true, orders: myOrders });
});

// Reseller Request Payout / Balance Withdrawal
app.post('/api/reseller/withdrawals/create', requireReseller, (req: Request, res: Response) => {
  const reseller = (req as any).reseller as Reseller;
  const { amount, paymentMethod, accountNumber } = req.body;
  const numAmount = parseInt(amount, 10);
  const data = dbInstance.getData();
  const minPayout = data.settings.resellerMinPayoutAmount ?? 500;

  if (isNaN(numAmount) || numAmount < minPayout) {
    return res.status(400).json({ error: `ন্যূনতম উত্তোলনের পরিমাণ ৳${minPayout} টাকা।` });
  }

  const currentAvailable = reseller.availableBalance ?? 0;
  if (numAmount > currentAvailable) {
    return res.status(400).json({ error: `আপনার অ্যাকাউন্টে পর্যাপ্ত উত্তোলনযোগ্য ব্যালেন্স নেই। বর্তমান ব্যালেন্স: ৳${currentAvailable}।` });
  }

  const cleanPhone = String(accountNumber || '').replace(/[^0-9]/g, '');
  if (cleanPhone.length < 11) {
    return res.status(400).json({ error: 'সঠিক ১১-ডিজিটের মোবাইল ব্যাংকিং নম্বর দিন।' });
  }

  const newWithdrawal = {
    id: `wdr-${Date.now()}`,
    resellerId: reseller.id,
    resellerName: reseller.name,
    resellerPhone: reseller.phone,
    resellerEmail: reseller.email,
    amount: numAmount,
    paymentMethod: paymentMethod || 'bKash',
    accountNumber: cleanPhone,
    status: 'pending',
    requestedAt: new Date().toISOString(),
  };

  // Deduct from available balance
  reseller.availableBalance = currentAvailable - numAmount;
  reseller.withdrawnEarnings = (reseller.withdrawnEarnings || 0) + numAmount;
  reseller.updatedAt = new Date().toISOString();

  if (!Array.isArray((data as any).resellerWithdrawals)) {
    (data as any).resellerWithdrawals = [];
  }
  (data as any).resellerWithdrawals.unshift(newWithdrawal);
  dbInstance.save();

  // Async email notification to admin Gmail
  sendResellerWithdrawalEmail(newWithdrawal, reseller).catch(() => {});

  res.status(201).json({
    success: true,
    withdrawal: newWithdrawal,
    availableBalance: reseller.availableBalance,
    message: 'টাকা উত্তোলনের অনুরোধ সফল হয়েছে! এডমিন পেমেন্ট সম্পন্ন করার পর মেসেজ পাবেন।',
  });
});

// Reseller Get Own Withdrawals List
app.get('/api/reseller/withdrawals', requireReseller, (req: Request, res: Response) => {
  const reseller = (req as any).reseller as Reseller;
  const data = dbInstance.getData();
  const list = ((data as any).resellerWithdrawals || []).filter((w: any) => w.resellerId === reseller.id);
  res.json({ success: true, withdrawals: list });
});

// Public Contact / Inquiry Message Endpoint (Sends Email to Admin Gmail)
app.post(['/api/contact', '/api/inquiry'], (req: Request, res: Response) => {
  const { name, phone, email, message, subject } = req.body;
  if (!name?.trim() || !phone?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'নাম, মোবাইল নম্বর ও বার্তা আবশ্যক।' });
  }

  const contactData = {
    name: name.trim(),
    phone: phone.trim(),
    email: email?.trim() || undefined,
    message: message.trim(),
    subject: subject?.trim() || 'ZX Shop সাধারণ অনুসন্ধান',
  };

  sendContactNotificationEmail(contactData).catch(() => {});

  res.json({ success: true, message: 'আপনার বার্তাটি সফলভাবে পাঠানো হয়েছে! আমরা শীঘ্রই যোগাযোগ করব।' });
});

// ==========================================
// ADMIN: RESELLER MANAGEMENT APIS
// ==========================================

// Get All Resellers for Admin Panel
app.get('/api/admin/resellers', requireAdmin, (req: Request, res: Response) => {
  const data = dbInstance.getData();
  res.json({ resellers: data.resellers || [] });
});

// Admin Approve / Reject Reseller Account
app.patch('/api/admin/resellers/:id/status', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, rejectionReason } = req.body as { status: ResellerStatus; rejectionReason?: string };
  const data = dbInstance.getData();
  if (!Array.isArray(data.resellers)) data.resellers = [];

  const reseller = data.resellers.find(r => r.id === id);
  if (!reseller) {
    return res.status(404).json({ error: 'রিসেলার অ্যাকাউন্ট পাওয়া যায়নি।' });
  }

  reseller.status = status;
  reseller.updatedAt = new Date().toISOString();
  if (status === 'approved') {
    reseller.approvedAt = new Date().toISOString();
    reseller.approvedBy = 'admin';
    reseller.registrationFeePaid = true;
  } else if (status === 'rejected') {
    reseller.rejectionReason = rejectionReason || 'ফি পেমেন্ট বা তথ্যে গরমিল।';
  }

  dbInstance.save();
  res.json({ success: true, reseller, message: `রিসেলার অ্যাকাউন্ট সফলভাবে ${status} করা হয়েছে।` });
});

// Admin Get All Reseller Withdrawals
app.get('/api/admin/reseller-withdrawals', requireAdmin, (req: Request, res: Response) => {
  const data = dbInstance.getData();
  res.json({ withdrawals: (data as any).resellerWithdrawals || [] });
});

// Admin Process Reseller Withdrawal (Complete or Reject with auto-refund)
app.patch('/api/admin/reseller-withdrawals/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, adminTrxId, rejectionReason } = req.body;
  const data = dbInstance.getData();
  const list = (data as any).resellerWithdrawals || [];
  const item = list.find((w: any) => w.id === id);
  if (!item) {
    return res.status(404).json({ error: 'উত্তোলন অনুরোধ পাওয়া যায়নি।' });
  }

  const prevStatus = item.status;
  item.status = status;
  item.processedAt = new Date().toISOString();
  if (adminTrxId) item.adminTrxId = adminTrxId.trim();
  if (rejectionReason) item.rejectionReason = rejectionReason.trim();

  // If rejected, refund balance to reseller
  if (status === 'rejected' && prevStatus === 'pending') {
    const reseller = (data.resellers || []).find(r => r.id === item.resellerId);
    if (reseller) {
      reseller.availableBalance = (reseller.availableBalance || 0) + item.amount;
      reseller.withdrawnEarnings = Math.max(0, (reseller.withdrawnEarnings || 0) - item.amount);
      reseller.updatedAt = new Date().toISOString();
    }
  }

  dbInstance.save();
  res.json({ success: true, withdrawal: item, message: `উত্তোলন অনুরোধের স্ট্যাটাস ${status} করা হয়েছে।` });
});

// ==========================================
// CSV IMPORT & EXPORT APIS (PRESERVE & EXTEND)
// ==========================================

// Helper to parse Variants from CSV string (e.g. "সাইজ: M, L, XL" or "সাইজ: M, L, XL; রং: কালো, নীল, সাদা")
const parseVariantsFromCsv = (raw: string) => {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return [];
  const entries = raw.split(/[;\r?\n]/).map(s => s.trim()).filter(Boolean);
  const variants: any[] = [];
  entries.forEach((entry, idx) => {
    const colonIdx = entry.indexOf(':');
    if (colonIdx !== -1) {
      const vName = entry.substring(0, colonIdx).trim();
      const optionsRaw = entry.substring(colonIdx + 1);
      const vOpts = optionsRaw.split(',').map(s => s.trim()).filter(Boolean);
      if (vName && vOpts.length) {
        variants.push({
          id: `v-${idx}-${Date.now()}`,
          name: vName,
          options: vOpts
        });
      }
    }
  });
  return variants;
};

// Helper to format variants for CSV export
const formatVariantsToCsv = (variants?: any[]) => {
  if (!variants || !Array.isArray(variants) || variants.length === 0) return '';
  return variants.map(v => `${v.name}: ${Array.isArray(v.options) ? v.options.join(', ') : ''}`).join('; ');
};

// CSV Export Products
app.get('/api/admin/products/export-csv', requireAdmin, (req: Request, res: Response) => {
  const data = dbInstance.getData();
  const headers = [
    'ID', 'SKU', 'Name', 'Category', 'Shop Price', 'Reseller Price',
    'Regular Price', 'Sale Price', 'Cost Price', 'Stock', 'Variants', 'Show in Shop',
    'Show in Reseller', 'Allow Dropship', 'Published', 'Image URL'
  ];

  const rows = data.products.map(p => [
    p.id,
    p.sku,
    `"${(p.name || '').replace(/"/g, '""')}"`,
    p.category,
    p.shopPrice ?? (p.salePrice ?? p.regularPrice),
    p.resellerPrice ?? Math.round((p.shopPrice ?? p.regularPrice) * 0.78),
    p.regularPrice,
    p.salePrice || '',
    p.costPrice || '',
    p.stock,
    `"${formatVariantsToCsv(p.variants).replace(/"/g, '""')}"`,
    p.showInShop !== false ? 'YES' : 'NO',
    p.showInReseller !== false ? 'YES' : 'NO',
    p.allowDropship !== false ? 'YES' : 'NO',
    p.isPublished ? 'YES' : 'NO',
    `"${p.mainImage || ''}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="zx_shop_products_${Date.now()}.csv"`);
  res.send(csvContent);
});

// RFC 4180 standard CSV parser that correctly preserves multiline quoted fields (e.g. descriptions)
const parseCsvRecords = (rawText: string): string[][] => {
  if (!rawText) return [];
  const text = rawText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          // Escaped quote ("") inside quotes becomes a literal quote
          currentField += '"';
          i++;
        } else {
          // Closing quote
          inQuotes = false;
        }
      } else {
        // Keep reading all characters (including \r or \n) into currentField
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        if (i + 1 < text.length && text[i + 1] === '\n') {
          i++;
        }
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.some(val => val !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.some(val => val !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }

  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(val => val !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
};

// CSV Import Products (Safe update or create, never overwriting existing prices with blank)
app.post('/api/admin/products/import-csv', requireAdmin, (req: Request, res: Response) => {
  const { csvText } = req.body;
  if (!csvText || typeof csvText !== 'string') {
    return res.status(400).json({ error: 'CSV ফাইলের ডেটা পাওয়া যায়নি।' });
  }

  try {
    const records = parseCsvRecords(csvText);
    if (records.length < 2) {
      return res.status(400).json({ error: 'CSV ফাইলে কোনো ডেটা সারি নেই।' });
    }

    const headers = records[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

    const data = dbInstance.getData();
    let importedCount = 0;
    let updatedCount = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 1; i < records.length; i++) {
      const rowValues = records[i];
      if (rowValues.length < 2 || !rowValues.some(v => v !== '')) continue;

      const rowMap: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowMap[h] = rowValues[idx] || '';
      });

      const id = rowMap['id'] || '';
      const sku = rowMap['sku'] || '';
      const name = rowMap['name'] || rowMap['title'] || '';

      if (!name && !id && !sku) {
        errors.push({ row: i + 1, error: 'পণ্যের নাম অথবা আইডি/SKU অনুপস্থিত।' });
        continue;
      }

      // Find existing product by ID or SKU
      const existingIdx = data.products.findIndex(p => (id && p.id === id) || (sku && p.sku.toLowerCase() === sku.toLowerCase()));

      const shopPriceRaw = rowMap['shopprice'] || rowMap['price'];
      const resellerPriceRaw = rowMap['resellerprice'];
      const regPriceRaw = rowMap['regularprice'];
      const stockRaw = rowMap['stock'];
      const variantsRaw = rowMap['variants'] || rowMap['variant'];

      if (existingIdx !== -1) {
        const existing = data.products[existingIdx];
        if (name) existing.name = name;
        if (rowMap['category']) existing.category = rowMap['category'];
        if (rowMap['description']) existing.description = rowMap['description'];
        if (stockRaw !== undefined && stockRaw !== '') existing.stock = Math.max(0, Number(stockRaw) || 0);

        // Never erase existing price if omitted
        if (shopPriceRaw && !isNaN(Number(shopPriceRaw))) {
          existing.shopPrice = Number(shopPriceRaw);
          existing.regularPrice = existing.shopPrice;
        }
        if (resellerPriceRaw && !isNaN(Number(resellerPriceRaw))) {
          existing.resellerPrice = Number(resellerPriceRaw);
        }
        if (rowMap['imageurl']) existing.mainImage = rowMap['imageurl'];
        
        // Update variants if provided in CSV
        if (variantsRaw !== undefined && variantsRaw.trim() !== '') {
          existing.variants = parseVariantsFromCsv(variantsRaw);
        }

        existing.updatedAt = new Date().toISOString();
        updatedCount++;
      } else {
        // Create new
        const determinedName = name || `আমদানিকৃত পণ্য ${sku}`;
        const determinedShopPrice = Number(shopPriceRaw || regPriceRaw || 1000);
        const determinedResellerPrice = Number(resellerPriceRaw || Math.round(determinedShopPrice * 0.78));

        const newP: Product = {
          id: id || `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          slug: determinedName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `prod-${Date.now()}`,
          sku: sku || `ZX-${Math.floor(1000 + Math.random() * 9000)}`,
          name: determinedName,
          category: rowMap['category'] || 'cat-1',
          description: rowMap['description'] || '',
          regularPrice: determinedShopPrice,
          salePrice: undefined,
          shopPrice: determinedShopPrice,
          resellerPrice: determinedResellerPrice,
          stock: Number(stockRaw) || 10,
          variants: variantsRaw ? parseVariantsFromCsv(variantsRaw) : [],
          images: rowMap['imageurl'] ? [rowMap['imageurl']] : ['/src/assets/images/hero_ecommerce_banner_1791605905466.jpg'],
          mainImage: rowMap['imageurl'] || '/src/assets/images/hero_ecommerce_banner_1791605905466.jpg',
          isFeatured: false,
          isPopular: false,
          isPublished: true,
          showInShop: true,
          showInReseller: true,
          allowDropship: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        data.products.push(newP);
        importedCount++;
      }
    }

    dbInstance.save();

    res.json({
      success: true,
      importedCount,
      updatedCount,
      errors,
      message: `CSV থেকে সফলভাবে ${importedCount} টি নতুন পণ্য তৈরি ও ${updatedCount} টি পণ্য আপডেট হয়েছে!`,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'CSV প্রক্রিয়াকরণে সমস্যা হয়েছে: ' + err?.message });
  }
});

// Full Store Data Export (One-Click JSON Backup)
app.get('/api/admin/export', requireAdmin, (req: Request, res: Response) => {
  const data = dbInstance.getData();
  const safeExport = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    storeName: data.settings.storeName,
    products: data.products,
    categories: data.categories,
    settings: {
      ...data.settings,
      smtpPass: data.settings.smtpPass ? '***MASKED***' : '',
    },
    deliveryZones: data.deliveryZones,
    coupons: data.coupons,
    orders: data.orders,
    resellers: data.resellers || [],
  };
  res.json({ success: true, data: safeExport });
});

// Full Store Data Restore / Cloud Sync
app.post('/api/admin/restore', requireAdmin, (req: Request, res: Response) => {
  try {
    const { data: restoreData } = req.body;
    if (!restoreData || !Array.isArray(restoreData.products)) {
      return res.status(400).json({ error: 'সঠিক ব্যাকআপ ডেটা ফরম্যাট পাওয়া যায়নি।' });
    }
    const ok = dbInstance.restoreFromData(restoreData);
    if (!ok) {
      return res.status(500).json({ error: 'ডেটাবেসে ব্যাকআপ রিস্টোর ব্যর্থ হয়েছে।' });
    }
    console.log(`[Admin Restore] Successfully restored ${restoreData.products.length} products to database`);
    res.json({ success: true, message: `${restoreData.products.length} টি পণ্য ও সেটিংস সফলভাবে রিস্টোর হয়েছে!` });
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ error: 'রিস্টোর প্রক্রিয়ায় ত্রুটি ঘটেছে।' });
  }
});

// ==========================================
// 3. VITE INTEGRATION FOR FULL-STACK
// ==========================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function startServer() {
  let vite: any = null;

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
  }

  // Handle dynamic OpenGraph & SEO metadata for /product/:slugOrId
  app.get('/product/:slugOrId', async (req: Request, res: Response, next: NextFunction) => {
    // Only intercept HTML navigation requests (or crawlers without accept header)
    const acceptHeader = req.headers.accept || '';
    if (!acceptHeader.includes('text/html') && !acceptHeader.includes('*/*') && req.path.includes('.')) {
      return next();
    }

    try {
      const data = dbInstance.getData();
      const { slugOrId } = req.params;
      const product = data.products.find(p => (p.id === slugOrId || p.slug === slugOrId) && p.isPublished);

      const indexPath = isProd
        ? path.resolve(process.cwd(), 'dist', 'index.html')
        : path.resolve(process.cwd(), 'index.html');

      if (!fs.existsSync(indexPath)) {
        return next();
      }

      let html = fs.readFileSync(indexPath, 'utf-8');

      if (product) {
        const currentPrice = product.salePrice ?? product.regularPrice;
        const pageTitle = `${product.name} (৳${currentPrice.toLocaleString('bn-BD')}) | ZX Shop`;
        const rawDesc = (product.description || '').replace(/\s+/g, ' ').trim();
        const pageDesc = rawDesc.slice(0, 155) + (rawDesc.length > 155 ? '...' : '');

        const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
        const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || `localhost:${PORT}`;
        const canonicalUrl = `${protocol}://${host}/product/${product.slug || product.id}`;

        let imageUrl = product.mainImage || (product.images && product.images[0]) || '';
        if (imageUrl && !imageUrl.startsWith('http')) {
          imageUrl = `${protocol}://${host}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
        }

        // Replace Title & Description in HTML
        html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);
        html = html.replace(
          /<meta name="description" content=".*?" \/>/i,
          `<meta name="description" content="${escapeHtml(pageDesc)}" />`
        );
        html = html.replace(
          /<meta property="og:title" content=".*?" \/>/i,
          `<meta property="og:title" content="${escapeHtml(pageTitle)}" />`
        );
        html = html.replace(
          /<meta property="og:description" content=".*?" \/>/i,
          `<meta property="og:description" content="${escapeHtml(pageDesc)}" />`
        );
        html = html.replace(
          /<meta name="twitter:title" content=".*?" \/>/i,
          `<meta name="twitter:title" content="${escapeHtml(pageTitle)}" />`
        );
        html = html.replace(
          /<meta name="twitter:description" content=".*?" \/>/i,
          `<meta name="twitter:description" content="${escapeHtml(pageDesc)}" />`
        );

        const injectedOgTags = `
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:alt" content="${escapeHtml(product.name)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    <meta property="product:price:amount" content="${currentPrice}" />
    <meta property="product:price:currency" content="BDT" />
        `;
        html = html.replace('</head>', `${injectedOgTags}\n  </head>`);
      }

      if (!isProd && vite) {
        html = await vite.transformIndexHtml(req.originalUrl, html);
      }

      // Always return 200 HTML so the client-side SPA router can gracefully display the product or not-found UI
      res.status(200).send(html);
    } catch (err) {
      next(err);
    }
  });

  if (!isProd && vite) {
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    const indexPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      throw new Error(`[Server Fatal Error] Production build not found at ${distPath}. Run "npm run build" before running "npm start".`);
    }
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(indexPath);
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`ZX Shop server running at http://${HOST}:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
