export interface Variant {
  id: string;
  name: string; // e.g., 'সাইজ' or 'রং'
  options: string[]; // e.g., ['M', 'L', 'XL'] or ['কালো', 'নীল']
}

export interface Product {
  id: string;
  slug: string;
  sku: string;
  name: string;
  banglaTitle?: string;
  category: string; // category id or slug
  description: string;
  regularPrice: number;
  salePrice?: number;
  // Independent Pricing for Shop & Reseller
  shopPrice?: number; // Price for normal customers (defaults to salePrice ?? regularPrice)
  resellerPrice?: number; // Wholesale/Base price for resellers
  maxResellerPrice?: number; // Maximum allowed selling price limit for resellers
  costPrice?: number; // Cost/Base cost of product
  // Channel Visibility Controls
  showInShop?: boolean; // Visible in public shop (default: true)
  showInReseller?: boolean; // Visible in reseller catalog (default: true)
  allowDropship?: boolean; // Eligible for dropshipping (default: true)
  stock: number;
  images: string[];
  mainImage: string;
  variants?: Variant[];
  isFeatured: boolean;
  isPopular: boolean;
  isPublished: boolean;
  rating?: number;
  reviewCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type ResellerStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface Reseller {
  id: string;
  name: string;
  email: string;
  phone: string;
  shopName?: string;
  address?: string;
  status: ResellerStatus;
  registrationFeePaid: boolean;
  registrationFeeTrxId?: string;
  registrationPaymentMethod?: string;
  registrationFeeAmount: number;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  totalOrdersCount: number;
  totalEarnings: number; // Completed profit
  pendingEarnings: number; // Profit in processing orders
  createdAt: string;
  updatedAt: string;
  passwordHash?: string;
  salt?: string;
  notes?: string;
  promoCode?: string; // Unique referral promo code, e.g. "ZX-RES-8821"
  referredByResellerId?: string;
  referredByPromoCode?: string;
  referralCount?: number; // How many resellers registered using this code
  referralEarnings?: number; // Total bonus earned from referrals
  availableBalance?: number; // Balance available for withdrawal
  withdrawnEarnings?: number; // Total withdrawn
}

export interface ResellerWithdrawal {
  id: string;
  resellerId: string;
  resellerName: string;
  resellerPhone: string;
  resellerEmail?: string;
  amount: number;
  paymentMethod: 'bKash' | 'Nagad' | 'Rocket';
  accountNumber: string;
  status: 'pending' | 'completed' | 'rejected';
  requestedAt: string;
  processedAt?: string;
  adminTrxId?: string;
  rejectionReason?: string;
}

export interface ResellerOrderDetails {
  isResellerOrder: boolean;
  resellerId?: string;
  resellerName?: string;
  resellerEmail?: string;
  resellerPhone?: string;
  resellerShopName?: string;
  resellerProductCost: number; // Snapshotted wholesale price
  resellerSellingPrice: number; // Price reseller charged end customer
  estimatedProfit: number; // (Selling Price - Wholesale Price)
  profitPayoutStatus: 'pending' | 'approved' | 'paid' | 'cancelled' | 'completed';
  payoutDate?: string;
  profitCreditedAt?: string;
  deliveryFeePaid?: number; // Advance delivery fee paid by reseller
  deliveryPaymentMethod?: 'wallet' | 'bKash' | 'Nagad' | 'Rocket';
  deliveryPaymentTrxId?: string;
  deliveryPaymentSenderPhone?: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  banglaName: string;
  icon?: string;
  image?: string;
  description?: string;
  isPublished: boolean;
  order: number;
}

export interface DeliveryZone {
  id: string;
  name: string;
  rate: number;
  estimatedDays: string;
  isActive: boolean;
}

export interface Coupon {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  isActive: boolean;
  expiresAt?: string;
}

export type OrderStatus = 
  | 'pending'    // অর্ডার গ্রহণ করা হয়েছে
  | 'confirmed'  // নিশ্চিত করা হয়েছে
  | 'processing' // প্যাকেজিং বা প্রসেসিং
  | 'shipped'    // পাঠানো হয়েছে
  | 'delivered'  // ডেলিভারি সম্পন্ন
  | 'cancelled'; // বাতিল

export type PaymentMethod = 'cod' | 'bkash' | 'nagad' | 'rocket';
export type PaymentStatus = 'pending' | 'verified' | 'failed' | 'refunded';

export interface OrderItemSnapshot {
  productId: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  image: string;
  selectedVariants?: Record<string, string>;
  total: number;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. ZX-202610-843
  customer: {
    fullName: string;
    phone: string;
    division: string;
    district: string;
    deliveryArea: string;
    fullAddress: string;
    notes?: string;
  };
  items: OrderItemSnapshot[];
  subtotal: number;
  discount: number;
  couponCode?: string;
  deliveryCharge: number;
  deliveryZoneId?: string;
  deliveryZoneName: string;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  transactionId?: string;
  senderPhone?: string;
  orderStatus: OrderStatus;
  createdAt: string;
  updatedAt: string;
  statusHistory: {
    status: OrderStatus;
    timestamp: string;
    note?: string;
  }[];
  emailNotificationStatus?: 'pending' | 'sent' | 'failed' | 'not_configured';
  emailNotificationError?: string;
  emailSentAt?: string;
  // Reseller / Dropshipping order metadata
  isResellerOrder?: boolean;
  resellerDetails?: ResellerOrderDetails;
}

export interface StoreSettings {
  storeName: string;
  storeTagline: string;
  logoUrl?: string;
  contactPhone: string;
  whatsappNumber: string;
  email: string;
  address: string;
  bkashNumber: string;
  bkashType: 'Personal' | 'Merchant';
  nagadNumber: string;
  nagadType: 'Personal' | 'Merchant';
  rocketNumber?: string;
  rocketType?: 'Personal' | 'Merchant';
  freeDeliveryThreshold?: number;
  announcementNotice?: string;
  bannerTitle: string;
  bannerSubtitle: string;
  bannerImage: string;
  facebookUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  aboutStory: string;
  privacyPolicy: string;
  termsConditions: string;
  returnPolicy: string;
  metaTitle: string;
  metaDescription: string;
  // Gmail SMTP & Order Notification Settings
  smtpUser?: string;
  smtpPass?: string;
  smtpHost?: string;
  smtpPort?: number;
  adminNotificationEmail?: string;
  hasSmtpPass?: boolean;
  // Reseller / Dropshipping System Settings
  resellerRegistrationEnabled?: boolean; // Enable/disable new registrations
  resellerRegistrationFee?: number; // Legacy/Fallback
  resellerRegistrationRegularFee?: number; // Regular fee shown (e.g. ৳1000)
  resellerRegistrationDiscountedFee?: number; // Discounted fee with promo code (e.g. ৳300)
  resellerReferralBonus?: number; // Bonus rewarded to referrer on registration (e.g. ৳100)
  resellerMinPayoutAmount?: number; // Minimum balance to request payout (e.g. ৳500)
  resellerOrderDeliveryFee?: number; // Advance delivery charge paid by reseller per order (e.g. ৳100 or ৳50)
  resellerNotice?: string; // Notice shown in reseller dashboard
}

export interface Review {
  id: string;
  productId: string;
  productName: string;
  customerName: string;
  rating: number;
  comment: string;
  isApproved: boolean;
  createdAt: string;
}

export interface AdminNotification {
  id: string;
  type: 'reseller_order' | 'reseller_reg' | 'withdrawal_request' | 'regular_order';
  title: string;
  message: string;
  orderId?: string;
  orderNumber?: string;
  resellerName?: string;
  resellerPhone?: string;
  amount?: number;
  read: boolean;
  createdAt: string;
}

export interface DatabaseSchema {
  products: Product[];
  categories: Category[];
  orders: Order[];
  deliveryZones: DeliveryZone[];
  coupons: Coupon[];
  reviews: Review[];
  settings: StoreSettings;
  resellers?: Reseller[];
  resellerWithdrawals?: ResellerWithdrawal[];
  adminNotifications?: AdminNotification[];
  adminCredentials: {
    username: string;
    passwordHash: string; // SHA-256 with salt or simple hashed
    salt: string;
    lastLogin?: string;
  };
  adminSessions?: string[];
  resellerSessions?: Record<string, string>; // token -> resellerId
}
