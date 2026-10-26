import nodemailer from 'nodemailer';
import type { Order } from '../src/types/ecommerce.ts';
import { dbInstance } from './db.ts';

// In-memory set to prevent duplicate emails for the same order
const sentEmailOrderNumbers = new Set<string>();

/**
 * Retrieves the effective SMTP configuration by checking server environment variables
 * first, and falling back to saved store settings from the database.
 */
export function getEffectiveSmtpConfig() {
  let settings: any = {};
  try {
    settings = dbInstance.getData()?.settings || {};
  } catch {
    // fallback
  }

  const rawDbUser = (settings.smtpUser || '').trim();
  const rawDbPass = (settings.smtpPass || '').trim();
  const isDbConfigured = Boolean(rawDbUser && rawDbPass);

  const user = isDbConfigured ? rawDbUser : (process.env.SMTP_USER || process.env.GMAIL_USER || rawDbUser || '').trim();
  const rawPass = isDbConfigured ? rawDbPass : (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || rawDbPass || '').trim();
  const pass = rawPass.replace(/\s+/g, '');
  const host = (settings.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(settings.smtpPort?.toString() || process.env.SMTP_PORT || '465', 10);
  const adminEmail = (settings.adminNotificationEmail || process.env.ADMIN_EMAIL || 'mdmohammad.644633815@gmail.com').trim();

  return {
    host,
    port,
    user,
    pass,
    adminEmail,
    isConfigured: Boolean(user && pass),
    source: isDbConfigured ? 'admin_settings' : ((process.env.SMTP_USER || process.env.GMAIL_USER) ? 'environment_variable' : (user ? 'admin_settings' : 'none')),
  };
}

/**
 * Checks whether SMTP credentials are fully provided (via ENV or store settings).
 */
export function isEmailConfigured(): boolean {
  return getEffectiveSmtpConfig().isConfigured;
}

/**
 * Returns current email service diagnostic status (without exposing secrets).
 */
export function getEmailServiceStatus() {
  const cfg = getEffectiveSmtpConfig();
  return {
    configured: cfg.isConfigured,
    adminEmail: cfg.adminEmail,
    smtpHost: cfg.host,
    smtpPort: cfg.port,
    smtpUserProvided: Boolean(cfg.user),
    smtpPassProvided: Boolean(cfg.pass),
    smtpUserMasked: cfg.user ? cfg.user.replace(/(.{2})(.*)(@.*)/, '$1***$3') : null,
    source: cfg.source,
  };
}

/**
 * Creates an optimized Nodemailer transporter, prioritizing Gmail service configuration
 * for reliable TLS negotiation, port handling, and authentication.
 */
export function createNodemailerTransporter(cfg: { host: string; port: number; user: string; pass: string }) {
  const isGmail = (cfg.host && cfg.host.includes('gmail')) || (cfg.user && cfg.user.toLowerCase().includes('@gmail.com'));
  if (isGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: cfg.user,
        pass: cfg.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }

  const isSecurePort = cfg.port === 465;
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: isSecurePort,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
}

/**
 * Translates low-level SMTP errors (especially Google BadCredentials 535) into clear Bengali guidance.
 */
export function formatSmtpError(error: any): string {
  const rawMsg = error?.message || 'অজানা SMTP ত্রুটি';
  if (rawMsg.includes('535') || rawMsg.includes('BadCredentials') || rawMsg.includes('Username and Password not accepted') || rawMsg.includes('Invalid login')) {
    return 'Google App Password মেলেনি (Invalid login: BadCredentials)। অনুগ্রহ করে আপনার Gmail অ্যাকাউন্টে 2-Step Verification চালু করে myaccount.google.com/apppasswords থেকে ১৬-অক্ষরের নতুন "App Password" তৈরি করে সেটি অ্যাডমিন প্যানেলে দিন। সাধারণ অ্যাকাউন্টের পাসওয়ার্ড দিয়ে চলবে না।';
  }
  if (rawMsg.includes('ETIMEDOUT') || rawMsg.includes('ECONNREFUSED') || rawMsg.includes('ENOTFOUND')) {
    return `SMTP সার্ভারে সংযোগ স্থাপন করা সম্ভব হয়নি (${rawMsg})। সার্ভারের ইন্টারনেট বা হোস্ট/পোর্ট সেটিংস যাচাই করুন।`;
  }
  return rawMsg;
}

/**
 * Formats date into readable Bengali/Bangla string
 */
function formatBengaliDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleString('bn-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Dhaka',
    });
  } catch {
    return isoDate;
  }
}

/**
 * Generates responsive, mobile-friendly HTML email template for new orders
 */
export function generateOrderEmailHtml(order: Order): string {
  const paymentMethodLabel = 
    order.paymentMethod === 'cod' ? 'ক্যাশ অন ডেলিভারি (Cash on Delivery)' :
    order.paymentMethod === 'bkash' ? 'বিকাশ (bKash Send Money)' :
    order.paymentMethod === 'nagad' ? 'নগদ (Nagad Send Money)' : order.paymentMethod;

  const paymentStatusLabel =
    order.paymentStatus === 'verified' ? 'যাচাইকৃত (Paid / Verified)' :
    order.paymentStatus === 'pending' ? 'অপেক্ষমান (Pending Verification)' :
    order.paymentStatus === 'failed' ? 'ব্যর্থ (Failed)' : order.paymentStatus;

  const orderStatusLabel =
    order.orderStatus === 'pending' ? 'অর্ডার গ্রহণ করা হয়েছে (Pending)' :
    order.orderStatus === 'confirmed' ? 'নিশ্চিত করা হয়েছে (Confirmed)' :
    order.orderStatus === 'processing' ? 'প্যাকেজিং ও প্রসেসিং (Processing)' :
    order.orderStatus === 'shipped' ? 'কুরিয়ারে পাঠানো হয়েছে (Shipped)' :
    order.orderStatus === 'delivered' ? 'ডেলিভারি সম্পন্ন (Delivered)' : order.orderStatus;

  const formattedDate = formatBengaliDate(order.createdAt);

  const itemsHtml = order.items.map((item, idx) => {
    const variantDetails = item.selectedVariants && Object.keys(item.selectedVariants).length > 0
      ? `<br/><span style="font-size: 11px; color: #64748b;">${Object.entries(item.selectedVariants).map(([k, v]) => `${k}: ${v}`).join(', ')}</span>`
      : '';

    return `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 8px; font-size: 13px; color: #1e293b; vertical-align: top;">
          <strong>${idx + 1}. ${item.name}</strong>
          ${variantDetails}
        </td>
        <td style="padding: 12px 8px; font-size: 12px; color: #475569; font-family: monospace; vertical-align: top; text-align: center;">
          ${item.sku || item.productId}
        </td>
        <td style="padding: 12px 8px; font-size: 13px; color: #1e293b; vertical-align: top; text-align: center; font-weight: bold;">
          ${item.quantity}
        </td>
        <td style="padding: 12px 8px; font-size: 13px; color: #1e293b; vertical-align: top; text-align: right;">
          ৳${item.price.toLocaleString('bn-BD')}
        </td>
        <td style="padding: 12px 8px; font-size: 13px; color: #e11d48; font-weight: bold; vertical-align: top; text-align: right;">
          ৳${item.total.toLocaleString('bn-BD')}
        </td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>নতুন অর্ডার বিজ্ঞপ্তি #${order.orderNumber}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Hind Siliguri', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 20px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" max-width="640" style="max-width: 640px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); padding: 24px 24px; text-align: center; color: #ffffff;">
              <table role="presentation" width="100%">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; background-color: #ffffff; color: #e11d48; font-size: 20px; font-weight: 900; border-radius: 12px; margin-bottom: 8px;">
                      ZX
                    </div>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.5px;">ZX Shop</h1>
                    <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.95; font-weight: 500;">আপনার পছন্দের অনলাইন শপ · নতুন অর্ডারের নোটিফিকেশন</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Order Highlight Bar -->
          <tr>
            <td style="background-color: #fff1f2; padding: 16px 24px; border-bottom: 2px dashed #fecdd3;">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <span style="font-size: 12px; font-weight: bold; color: #9f1239; text-transform: uppercase;">অর্ডার নম্বর:</span><br/>
                    <span style="font-size: 20px; font-weight: 900; color: #e11d48; font-family: monospace;">#${order.orderNumber}</span>
                  </td>
                  <td style="text-align: right;">
                    <span style="font-size: 11px; font-weight: bold; color: #64748b;">অর্ডারের সময়:</span><br/>
                    <span style="font-size: 12px; font-weight: 600; color: #334155;">${formattedDate}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content Area -->
          <tr>
            <td style="padding: 24px;">

              <!-- Customer Details Section -->
              <table role="presentation" width="100%" style="background-color: #f8fafc; border-radius: 12px; padding: 16px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
                <tr>
                  <td colspan="2" style="padding-bottom: 10px; border-bottom: 1px solid #e2e8f0;">
                    <h3 style="margin: 0; font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
                      👤 গ্রাহকের তথ্য ও ডেলিভারি ঠিকানা
                    </h3>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 10px; width: 40%; font-size: 12px; color: #64748b;">নাম:</td>
                  <td style="padding-top: 10px; font-size: 13px; font-weight: 700; color: #1e293b;">${order.customer.fullName}</td>
                </tr>
                <tr>
                  <td style="padding-top: 6px; font-size: 12px; color: #64748b;">ফোন নম্বর:</td>
                  <td style="padding-top: 6px; font-size: 13px; font-weight: 700; color: #0284c7;">
                    <a href="tel:${order.customer.phone}" style="color: #0284c7; text-decoration: none;">${order.customer.phone}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 6px; font-size: 12px; color: #64748b;">ডেলিভারি এরিয়া:</td>
                  <td style="padding-top: 6px; font-size: 13px; font-weight: 600; color: #334155;">${order.customer.deliveryArea || order.deliveryZoneName}</td>
                </tr>
                <tr>
                  <td style="padding-top: 6px; font-size: 12px; color: #64748b;">বিভাগ ও জেলা:</td>
                  <td style="padding-top: 6px; font-size: 13px; color: #334155;">${order.customer.division || '—'}, ${order.customer.district || '—'}</td>
                </tr>
                <tr>
                  <td style="padding-top: 6px; font-size: 12px; color: #64748b; vertical-align: top;">পূর্ণ ঠিকানা:</td>
                  <td style="padding-top: 6px; font-size: 13px; color: #0f172a; line-height: 1.4; font-weight: 500;">${order.customer.fullAddress}</td>
                </tr>
                ${order.customer.notes ? `
                <tr>
                  <td style="padding-top: 6px; font-size: 12px; color: #b45309; vertical-align: top;">গ্রাহকের নোট:</td>
                  <td style="padding-top: 6px; font-size: 12px; color: #92400e; font-style: italic;">"${order.customer.notes}"</td>
                </tr>
                ` : ''}
              </table>

              <!-- Ordered Products Table -->
              <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
                📦 অর্ডারকৃত পণ্যের তালিকা (${order.items.length} টি)
              </h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f1f5f9; text-align: left;">
                    <th style="padding: 10px 8px; font-size: 12px; font-weight: 700; color: #475569;">পণ্য</th>
                    <th style="padding: 10px 8px; font-size: 12px; font-weight: 700; color: #475569; text-align: center;">আইডি / SKU</th>
                    <th style="padding: 10px 8px; font-size: 12px; font-weight: 700; color: #475569; text-align: center;">পরিমাণ</th>
                    <th style="padding: 10px 8px; font-size: 12px; font-weight: 700; color: #475569; text-align: right;">একক মূল্য</th>
                    <th style="padding: 10px 8px; font-size: 12px; font-weight: 700; color: #475569; text-align: right;">মোট</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <!-- Financial Breakdown -->
              <table role="presentation" width="100%" style="background-color: #fafaf9; border-radius: 12px; padding: 14px 18px; margin-bottom: 24px; border: 1px solid #e7e5e4;">
                <tr>
                  <td style="font-size: 13px; color: #57534e; padding-bottom: 6px;">পণ্যের মোট মূল্য (Subtotal):</td>
                  <td style="font-size: 13px; color: #1c1917; font-weight: bold; text-align: right; padding-bottom: 6px;">
                    ৳${order.subtotal.toLocaleString('bn-BD')}
                  </td>
                </tr>
                ${order.discount > 0 ? `
                <tr>
                  <td style="font-size: 13px; color: #15803d; padding-bottom: 6px;">কুপন ছাড় ${order.couponCode ? `(${order.couponCode})` : ''}:</td>
                  <td style="font-size: 13px; color: #15803d; font-weight: bold; text-align: right; padding-bottom: 6px;">
                    -৳${order.discount.toLocaleString('bn-BD')}
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="font-size: 13px; color: #57534e; padding-bottom: 8px;">ডেলিভারি চার্জ (${order.deliveryZoneName}):</td>
                  <td style="font-size: 13px; color: #1c1917; font-weight: bold; text-align: right; padding-bottom: 8px;">
                    ৳${order.deliveryCharge.toLocaleString('bn-BD')}
                  </td>
                </tr>
                <tr style="border-top: 2px solid #e2e8f0;">
                  <td style="font-size: 15px; font-weight: 900; color: #0f172a; padding-top: 10px;">সর্বমোট প্রদেয় টাকা (Grand Total):</td>
                  <td style="font-size: 18px; font-weight: 900; color: #e11d48; text-align: right; padding-top: 10px;">
                    ৳${order.totalAmount.toLocaleString('bn-BD')}
                  </td>
                </tr>
              </table>

              <!-- Payment & Order Status Grid -->
              <table role="presentation" width="100%" style="background-color: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
                <tr>
                  <td colspan="2" style="padding-bottom: 8px; border-bottom: 1px solid #e2e8f0;">
                    <h3 style="margin: 0; font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
                      💳 পেমেন্ট ও অর্ডারের স্ট্যাটাস
                    </h3>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 8px; width: 45%; font-size: 12px; color: #64748b;">পেমেন্ট মেথড:</td>
                  <td style="padding-top: 8px; font-size: 13px; font-weight: 700; color: #1e293b;">${paymentMethodLabel}</td>
                </tr>
                <tr>
                  <td style="padding-top: 6px; font-size: 12px; color: #64748b;">পেমেন্ট স্ট্যাটাস:</td>
                  <td style="padding-top: 6px; font-size: 13px; font-weight: 700; color: ${order.paymentStatus === 'verified' ? '#15803d' : '#b45309'};">
                    ${paymentStatusLabel}
                  </td>
                </tr>
                ${order.transactionId ? `
                <tr>
                  <td style="padding-top: 6px; font-size: 12px; color: #64748b;">ট্রানজ্যাকশন আইডি (TrxID):</td>
                  <td style="padding-top: 6px; font-size: 13px; font-weight: 900; color: #e11d48; font-family: monospace;">
                    ${order.transactionId}
                  </td>
                </tr>
                ` : ''}
                ${order.senderPhone ? `
                <tr>
                  <td style="padding-top: 6px; font-size: 12px; color: #64748b;">প্রেরকের বিকাশ/নগদ নম্বর:</td>
                  <td style="padding-top: 6px; font-size: 13px; font-weight: 600; color: #1e293b;">
                    ${order.senderPhone}
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding-top: 6px; font-size: 12px; color: #64748b;">অর্ডারের বর্তমান অবস্থা:</td>
                  <td style="padding-top: 6px; font-size: 13px; font-weight: 800; color: #0f172a;">
                    ${orderStatusLabel}
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
              <p style="margin: 0 0 4px 0;">এই ইমেইলটি ZX Shop স্বয়ংক্রিয় অর্ডার সিস্টেম থেকে পাঠানো হয়েছে।</p>
              <p style="margin: 0; font-weight: 600; color: #64748b;">ZX Shop · আপনার পছন্দের অনলাইন শপ</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Sends order notification email to Admin Gmail via SMTP.
 * Never throws an unhandled error so placing an order is never aborted.
 */
export async function sendOrderNotificationEmail(order: Order): Promise<{
  success: boolean;
  error?: string;
  skipped?: boolean;
}> {
  // Prevent duplicate notification emails
  if (sentEmailOrderNumbers.has(order.orderNumber) || order.emailNotificationStatus === 'sent') {
    console.log(`[EmailService] Notification for order #${order.orderNumber} already sent. Skipping duplicate.`);
    return { success: true, skipped: true };
  }

  const cfg = getEffectiveSmtpConfig();

  // Check if SMTP configuration is present
  if (!cfg.isConfigured) {
    const reason = 'SMTP credentials not configured (SMTP_USER / SMTP_PASS required). Configure these in .env or Admin Settings to receive Gmail notifications.';
    console.warn(`[EmailService WARNING] Order #${order.orderNumber} received, but ${reason}`);
    return {
      success: false,
      error: reason,
    };
  }

  try {
    const transporter = createNodemailerTransporter(cfg);

    const htmlContent = generateOrderEmailHtml(order);

    const mailOptions = {
      from: `"ZX Shop Orders" <${cfg.user}>`,
      to: cfg.adminEmail,
      subject: `🛒 [নতুন অর্ডার #${order.orderNumber}] ${order.customer.fullName} – ৳${order.totalAmount.toLocaleString('bn-BD')}`,
      text: `নতুন অর্ডার প্রাপ্তি!\nঅর্ডার নম্বর: #${order.orderNumber}\nগ্রাহক: ${order.customer.fullName} (${order.customer.phone})\nমোট মূল্য: ৳${order.totalAmount}\nঠিকানা: ${order.customer.fullAddress}, ${order.customer.deliveryArea}\nপেমেন্ট: ${order.paymentMethod}`,
      html: htmlContent,
    };

    console.log(`[EmailService] Attempting to send order #${order.orderNumber} email to ${cfg.adminEmail} via ${cfg.host}:${cfg.port}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService SUCCESS] Order #${order.orderNumber} email successfully sent! Message ID: ${info.messageId}`);

    sentEmailOrderNumbers.add(order.orderNumber);
    return { success: true };
  } catch (error: any) {
    const errorMsg = formatSmtpError(error);
    console.error(`[EmailService ERROR] Failed to send email for order #${order.orderNumber} to ${cfg.adminEmail}:`, errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Sends a live test email to verify Gmail SMTP configuration from Admin Panel.
 */
export async function sendTestNotificationEmail(recipientOverride?: string): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
  recipient: string;
}> {
  const cfg = getEffectiveSmtpConfig();
  const targetRecipient = recipientOverride?.trim() || cfg.adminEmail;

  if (!cfg.isConfigured) {
    return {
      success: false,
      error: 'SMTP কনফিগারেশন অসম্পূর্ণ। অনুগ্রহ করে Gmail আইডি (SMTP_USER) ও ১৬-ডিজিটের Google অ্যাপ পাসওয়ার্ড (SMTP_PASS) প্রদান করুন।',
      recipient: targetRecipient,
    };
  }

  try {
    const transporter = createNodemailerTransporter(cfg);

    // Verify SMTP connection handshake first
    await transporter.verify();

    const sampleOrder: Order = {
      id: `test-ord-${Date.now()}`,
      orderNumber: `ZX-TEST-${Date.now().toString().slice(-4)}`,
      customer: {
        fullName: 'মোহাম্মদ আব্দুল্লাহ (টেস্ট গ্রাহক)',
        phone: '01712345678',
        division: 'ঢাকা',
        district: 'ঢাকা',
        deliveryArea: 'ঢাকা সিটির ভিতরে',
        fullAddress: 'বাড়ি #১২, রোড #০৫, ধানমন্ডি, ঢাকা',
        notes: 'এটি একটি সফল Gmail SMTP টেস্ট নোটিফিকেশন।',
      },
      items: [
        {
          productId: 'prod-test-1',
          name: 'ম্যাট ব্ল্যাক প্রিমিয়াম স্মার্টওয়াচ আল্ট্রা (টেস্ট)',
          sku: 'ZX-SW-01',
          price: 2190,
          quantity: 1,
          image: '/src/assets/images/product_smartwatch_black_1791605919110.jpg',
          total: 2190,
        },
      ],
      subtotal: 2190,
      discount: 0,
      deliveryCharge: 60,
      deliveryZoneName: 'ঢাকা সিটির ভিতরে',
      totalAmount: 2250,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      orderStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statusHistory: [
        {
          status: 'pending',
          timestamp: new Date().toISOString(),
          note: 'সিস্টেম টেস্ট অর্ডার তৈরি হয়েছে।',
        },
      ],
    };

    const htmlContent = generateOrderEmailHtml(sampleOrder);

    const mailOptions = {
      from: `"ZX Shop Test System" <${cfg.user}>`,
      to: targetRecipient,
      subject: `🧪 [টেস্ট নোটিফিকেশন] ZX Shop – Gmail SMTP কানেকশন সফল! (#${sampleOrder.orderNumber})`,
      text: `অভিনন্দন! আপনার ZX Shop Gmail SMTP নোটিফিকেশন সফলভাবে কাজ করছে। টেস্ট প্রাপক: ${targetRecipient}`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService TEST SUCCESS] Test email sent to ${targetRecipient}! Message ID: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
      recipient: targetRecipient,
    };
  } catch (error: any) {
    const errorMsg = formatSmtpError(error);
    console.error(`[EmailService TEST ERROR] Failed to send test email to ${targetRecipient}:`, errorMsg);
    return {
      success: false,
      error: errorMsg,
      recipient: targetRecipient,
    };
  }
}

/**
 * Sends Reseller Registration Notification Email to Admin Gmail
 */
export async function sendResellerRegistrationEmail(reseller: any, referrer?: any): Promise<{ success: boolean; error?: string }> {
  const cfg = getEffectiveSmtpConfig();
  if (!cfg.isConfigured) {
    console.warn(`[EmailService] Reseller registered (${reseller.name}), but SMTP is not configured.`);
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    const transporter = createNodemailerTransporter(cfg);

    const promoNotice = reseller.referredByPromoCode
      ? `<div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px; margin: 15px 0;">
          <p style="margin: 0; color: #065f46; font-size: 13px; font-weight: bold;">
            🎁 প্রমো কোড ব্যবহৃত: <code>${reseller.referredByPromoCode}</code>
          </p>
          <p style="margin: 4px 0 0; color: #047857; font-size: 12px;">
            রেজিস্ট্রেশন ফি ছাড়: ৳${reseller.registrationFeeAmount} (মূল ফি ৳১,০০০ থেকে ছাড়)
            ${referrer ? `<br/>রেফারার: <strong>${referrer.name}</strong> (${referrer.phone}) — ৳১০০ বোনাস ব্যালেন্সে যুক্ত হয়েছে!` : ''}
          </p>
        </div>`
      : `<p style="font-size: 13px; color: #64748b; margin: 10px 0;">কোনো প্রমো কোড ব্যবহার করা হয়নি (সম্পূর্ণ ফি প্রযোজ্য)।</p>`;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #e11d48, #be123c); padding: 24px; color: #ffffff; text-align: center;">
          <h2 style="margin: 0; font-size: 22px;">নতুন রিসেলার রেজিস্ট্রেশন আবেদন</h2>
          <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">ZX Shop Dropshipping & Reseller Network</p>
        </div>
        <div style="padding: 24px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; width: 140px;">রিসেলারের নাম:</td>
              <td style="padding: 10px 0; color: #0f172a; font-weight: bold;">${reseller.name}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b;">মোবাইল নম্বর:</td>
              <td style="padding: 10px 0; color: #0f172a; font-weight: bold;">${reseller.phone}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b;">ইমেইল এড্রেস:</td>
              <td style="padding: 10px 0; color: #0f172a;">${reseller.email}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b;">শপের নাম:</td>
              <td style="padding: 10px 0; color: #0f172a;">${reseller.shopName || 'ব্যক্তিগত রিসেলার'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b;">স্বয়ংক্রিয় প্রমো কোড:</td>
              <td style="padding: 10px 0; color: #be123c; font-weight: bold; font-family: monospace;">${reseller.promoCode || 'N/A'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b;">পেমেন্ট মেথড:</td>
              <td style="padding: 10px 0; color: #0f172a;">${reseller.registrationPaymentMethod || 'bKash'} (ফি: ৳${reseller.registrationFeeAmount})</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b;">Transaction ID:</td>
              <td style="padding: 10px 0; color: #be123c; font-weight: bold; font-family: monospace;">${reseller.registrationFeeTrxId || 'N/A'}</td>
            </tr>
          </table>

          ${promoNotice}

          <div style="margin-top: 20px; text-align: center;">
            <p style="font-size: 13px; color: #64748b;">এডমিন প্যানেলে লগইন করে TrxID যাচাই করে অ্যাকাউন্ট ভেরিফাই করুন।</p>
          </div>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"ZX Shop Reseller Alerts" <${cfg.user}>`,
      to: cfg.adminEmail,
      subject: `👥 [নতুন রিসেলার নিবন্ধন] ${reseller.name} (${reseller.phone}) – ফি: ৳${reseller.registrationFeeAmount}`,
      text: `নতুন রিসেলার নিবন্ধন এসেছে!\nনাম: ${reseller.name}\nফোন: ${reseller.phone}\nইমেইল: ${reseller.email}\nTrxID: ${reseller.registrationFeeTrxId}\nফি: ৳${reseller.registrationFeeAmount}\nপ্রমো কোড: ${reseller.promoCode || 'N/A'}`,
      html: htmlContent,
    });
    console.log(`[EmailService] Reseller registration email sent for ${reseller.name}`);
    return { success: true };
  } catch (error: any) {
    const errorMsg = formatSmtpError(error);
    console.error('[EmailService ERROR] Failed to send reseller registration email:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Sends Reseller Dropshipping Order Notification to Admin Gmail
 */
export async function sendResellerOrderEmail(order: any, reseller: any): Promise<{ success: boolean; error?: string }> {
  const cfg = getEffectiveSmtpConfig();
  if (!cfg.isConfigured) {
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    const transporter = createNodemailerTransporter(cfg);

    const item = order.items?.[0] || {};
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #059669, #047857); padding: 24px; color: #ffffff; text-align: center;">
          <h2 style="margin: 0; font-size: 22px;">নতুন ড্রপশিপিং অর্ডার (#${order.orderNumber})</h2>
          <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">রিসেলার: ${reseller?.name || 'রিসেলার'} (${reseller?.phone || ''})</p>
        </div>
        <div style="padding: 24px;">
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
            <h4 style="margin: 0 0 8px; color: #0f172a; font-size: 14px;">📦 পণ্যের বিবরণ ও প্রফিট হিসাব</h4>
            <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>পণ্য:</strong> ${item.name} (${item.quantity} টি)</p>
            <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>পাইকারি খরচ:</strong> ৳${order.resellerOrderDetails?.resellerProductCost || item.price}</p>
            <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>কাস্টমার বিক্রয় মূল্য:</strong> ৳${order.resellerOrderDetails?.resellerSellingPrice || order.subtotal}</p>
            <p style="margin: 4px 0; font-size: 14px; color: #059669; font-weight: bold;"><strong>রিসেলারের সম্ভাব্য প্রফিট:</strong> ৳${order.resellerOrderDetails?.estimatedProfit || 0}</p>
          </div>

          <h4 style="margin: 16px 0 8px; color: #0f172a; font-size: 14px;">👤 গ্রাহকের ডেলিভারি ঠিকানা (End Customer)</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">গ্রাহক নাম:</td>
              <td style="padding: 8px 0; color: #0f172a; font-weight: bold;">${order.customer?.fullName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">গ্রাহক মোবাইল:</td>
              <td style="padding: 8px 0; color: #0f172a; font-weight: bold;">${order.customer?.phone}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">পূর্ণ ঠিকানা:</td>
              <td style="padding: 8px 0; color: #0f172a;">${order.customer?.fullAddress}, ${order.customer?.deliveryArea || ''}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">সর্বমোট কালেকশন (COD):</td>
              <td style="padding: 8px 0; color: #be123c; font-weight: bold;">৳${order.totalAmount}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">অগ্রিম ডেলিভারি চার্জ:</td>
              <td style="padding: 8px 0; color: #047857; font-weight: bold;">
                ৳${order.resellerDetails?.deliveryFeePaid || order.deliveryCharge || 100}
                (${order.resellerDetails?.deliveryPaymentMethod === 'wallet' ? 'রিসেলার ওয়ালেট থেকে পরিশোধিত' : `${order.resellerDetails?.deliveryPaymentMethod || 'bKash'} TrxID: ${order.resellerDetails?.deliveryPaymentTrxId || 'N/A'}${order.resellerDetails?.deliveryPaymentSenderPhone ? ` (প্রেরক: ${order.resellerDetails.deliveryPaymentSenderPhone})` : ''}`})
              </td>
            </tr>
          </table>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"ZX Shop Dropship" <${cfg.user}>`,
      to: cfg.adminEmail,
      subject: `📦 [রিসেলার ড্রপশিপ অর্ডার #${order.orderNumber}] ${reseller?.name} – কালেকশন: ৳${order.totalAmount}`,
      text: `রিসেলার ড্রপশিপ অর্ডার #${order.orderNumber}\nরিসেলার: ${reseller?.name} (${reseller?.phone})\nগ্রাহক: ${order.customer?.fullName} (${order.customer?.phone})\nঠিকানা: ${order.customer?.fullAddress}\nকালেকশন: ৳${order.totalAmount}\nপ্রফিট: ৳${order.resellerOrderDetails?.estimatedProfit || 0}`,
      html: htmlContent,
    });
    return { success: true };
  } catch (error: any) {
    const errorMsg = formatSmtpError(error);
    console.error('[EmailService ERROR] Failed to send reseller order email:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Sends Reseller Payout/Withdrawal Request Email to Admin Gmail
 */
export async function sendResellerWithdrawalEmail(withdrawal: any, reseller: any): Promise<{ success: boolean; error?: string }> {
  const cfg = getEffectiveSmtpConfig();
  if (!cfg.isConfigured) return { success: false, error: 'SMTP not configured' };

  try {
    const transporter = createNodemailerTransporter(cfg);

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 24px; color: #ffffff; text-align: center;">
          <h2 style="margin: 0; font-size: 22px;">টাকা উত্তোলনের অনুরোধ (Payout Request)</h2>
          <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">রিসেলার ব্যালেন্স ক্যাশ আউট</p>
        </div>
        <div style="padding: 24px;">
          <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 20px;">
            <span style="font-size: 12px; color: #6b21a8; text-transform: uppercase; font-weight: bold;">উত্তোলনযোগ্য পরিমাণ</span>
            <h1 style="margin: 6px 0; color: #581c87; font-size: 32px;">৳${withdrawal.amount.toLocaleString('bn-BD')}</h1>
            <p style="margin: 0; font-size: 13px; color: #7e22ce;">মেথড: <strong>${withdrawal.paymentMethod} Personal</strong> (${withdrawal.accountNumber})</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">রিসেলারের নাম:</td>
              <td style="padding: 8px 0; color: #0f172a; font-weight: bold;">${reseller?.name}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">মোবাইল নম্বর:</td>
              <td style="padding: 8px 0; color: #0f172a;">${reseller?.phone}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">শপের নাম:</td>
              <td style="padding: 8px 0; color: #0f172a;">${reseller?.shopName || 'ব্যক্তিগত'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">অনুরোধের সময়:</td>
              <td style="padding: 8px 0; color: #0f172a;">${new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' })}</td>
            </tr>
          </table>

          <div style="margin-top: 24px; text-align: center;">
            <p style="font-size: 13px; color: #64748b;">এডমিন প্যানেলে 'উত্তোলন অনুরোধ' ট্যাবে গিয়ে টাকা পাঠিয়ে TrxID প্রদান করুন।</p>
          </div>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"ZX Shop Payouts" <${cfg.user}>`,
      to: cfg.adminEmail,
      subject: `💸 [উত্তোলন অনুরোধ ৳${withdrawal.amount}] ${reseller?.name} (${withdrawal.paymentMethod}: ${withdrawal.accountNumber})`,
      text: `রিসেলার ব্যালেন্স উত্তোলনের অনুরোধ:\nরিসেলার: ${reseller?.name} (${reseller?.phone})\nপরিমাণ: ৳${withdrawal.amount}\nমেথড: ${withdrawal.paymentMethod} (${withdrawal.accountNumber})`,
      html: htmlContent,
    });
    return { success: true };
  } catch (error: any) {
    const errorMsg = formatSmtpError(error);
    console.error('[EmailService ERROR] Failed to send reseller withdrawal email:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Sends Customer Contact / Inquiry Email to Admin Gmail
 */
export async function sendContactNotificationEmail(contactData: { name: string; phone: string; email?: string; message: string; subject?: string }): Promise<{ success: boolean; error?: string }> {
  const cfg = getEffectiveSmtpConfig();
  if (!cfg.isConfigured) return { success: false, error: 'SMTP not configured' };

  try {
    const transporter = createNodemailerTransporter(cfg);

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 24px; color: #ffffff; text-align: center;">
          <h2 style="margin: 0; font-size: 22px;">নতুন গ্রাহক বার্তা / ইনকোয়ারি</h2>
          <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">ZX Shop যোগাযোগ ফর্ম</p>
        </div>
        <div style="padding: 24px;">
          <p style="font-size: 14px; color: #334155; margin: 0 0 10px;"><strong>নাম:</strong> ${contactData.name}</p>
          <p style="font-size: 14px; color: #334155; margin: 0 0 10px;"><strong>মোবাইল:</strong> ${contactData.phone}</p>
          ${contactData.email ? `<p style="font-size: 14px; color: #334155; margin: 0 0 10px;"><strong>ইমেইল:</strong> ${contactData.email}</p>` : ''}
          ${contactData.subject ? `<p style="font-size: 14px; color: #334155; margin: 0 0 10px;"><strong>বিষয়:</strong> ${contactData.subject}</p>` : ''}
          <div style="margin-top: 16px; padding: 14px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #0284c7;">
            <p style="margin: 0; font-size: 14px; color: #1e293b; white-space: pre-wrap;">${contactData.message}</p>
          </div>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"ZX Shop Contact" <${cfg.user}>`,
      to: cfg.adminEmail,
      subject: `📬 [গ্রাহক বার্তা] ${contactData.name} (${contactData.phone})`,
      text: `নতুন বার্তা প্রাপ্তি:\nনাম: ${contactData.name}\nফোন: ${contactData.phone}\nবার্তা: ${contactData.message}`,
      html: htmlContent,
    });
    return { success: true };
  } catch (error: any) {
    const errorMsg = formatSmtpError(error);
    console.error('[EmailService ERROR] Failed to send contact message email:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

