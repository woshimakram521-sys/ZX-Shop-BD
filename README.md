# ZX Shop — Bangladeshi Bengali-First E-Commerce & Dropshipping Platform

ZX Shop একটি পূর্ণাঙ্গ, আধুনিক ও উচ্চগতির বাংলাদেশি ই-কমার্স ও রিসেলার/ড্রপশিপিং প্ল্যাটফর্ম। এতে রয়েছে কাস্টমার স্টোরফ্রন্ট, ফুল ফিচারড অ্যাডমিন কন্ট্রোল প্যানেল, ড্রপশিপিং/রিসেলার পোর্টাল, ডাবল প্রাইসিং (Shop Price, Reseller Price ও Reseller Max Price Limit), CSV ইমপোর্ট/এক্সপোর্ট, এবং ক্যাশ অন ডেলিভারি, বিকাশ ও নগদ পেমেন্ট গেটওয়ে।

---

## 🚀 সরাসরি লাইভ ওয়েবসাইট লিংক (Live Official URLs)

গুগল এআই স্টুডিও ক্লাউড রান সরাসরি উচ্চগতির সার্ভার লিংক:

- **লাইভ শপ (কাস্টমার স্টোরফ্রন্ট)**: [https://ais-pre-aty7nq7y7ilpimkgoxbnjx-32140813970.asia-southeast1.run.app](https://ais-pre-aty7nq7y7ilpimkgoxbnjx-32140813970.asia-southeast1.run.app)
- **অ্যাডমিন প্যানেল**: [https://ais-pre-aty7nq7y7ilpimkgoxbnjx-32140813970.asia-southeast1.run.app/admin](https://ais-pre-aty7nq7y7ilpimkgoxbnjx-32140813970.asia-southeast1.run.app/admin)
- **রিসেলার ও ড্রপশিপিং পোর্টাল**: [https://ais-pre-aty7nq7y7ilpimkgoxbnjx-32140813970.asia-southeast1.run.app/reseller](https://ais-pre-aty7nq7y7ilpimkgoxbnjx-32140813970.asia-southeast1.run.app/reseller)
- **অর্ডার ট্র্যাকিং পেজ**: [https://ais-pre-aty7nq7y7ilpimkgoxbnjx-32140813970.asia-southeast1.run.app/track](https://ais-pre-aty7nq7y7ilpimkgoxbnjx-32140813970.asia-southeast1.run.app/track)

> 💡 **নোট (ডোমেন সতর্কতা)**: ব্রাউজারে `zx-shop.ai.studio` টাইপ করলে `DNS_PROBE_FINISHED_NXDOMAIN` আসবে, কারণ `.ai.studio` কোনো সরাসরি পাবলিক ডোমেন নয়। সর্বদা উপরের অফিসিয়াল ক্লাউড রান লিংক ব্যবহার করুন অথবা নিচের গাইড অনুযায়ী ফ্রি ডোমেন যুক্ত করুন।

---

## 💻 GitHub থেকে প্রজেক্ট ক্লোন করে রান করার নিয়ম (Complete Run Guide)

### ১. পূর্বশর্ত (Prerequisites):
- [Node.js](https://nodejs.org/) সংস্করণ ২০ বা তদূর্ধ্ব (Node.js 20+ or 22+ recommended)
- Git ইনস্টল করা থাকতে হবে
- আপনার কম্পিউটারের টার্মিনালে `node -v` লিখে চেক করুন, ভার্সন `v20.x` বা `v22.x` হওয়া বাঞ্ছনীয়।

### ২. ধাপসমূহ (Step-by-Step Commands):

#### ধাপ ১: রিপোজিটরি ক্লোন করুন
```bash
git clone <your-github-repo-url>
cd zx-shop
```

#### ধাপ ২: ডিপেন্ডেন্সি ইনস্টল করুন
```bash
npm install
```
*(অথবা আপনি চাইলে `bun install` ও ব্যবহার করতে পারেন)*

#### ধাপ ৩: এনভায়রনমেন্ট কনফিগারেশন (ঐচ্ছিক)
```bash
# লিনাক্স বা ম্যাক:
cp .env.example .env

# উইন্ডোজ (CMD বা PowerShell):
copy .env.example .env
```
*(যদি আপনি জিমেইল নোটিফিকেশন বা পোর্ট পরিবর্তন করতে চান, তবে `.env` ফাইলে আপনার তথ্য দিতে পারেন)*

#### ধাপ ৪: ডেভেলপমেন্ট মোডে রান করুন (Dev Mode)
```bash
npm run dev
```
এরপর ব্রাউজারে প্রবেশ করুন:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 📦 প্রোডাকশন বিল্ড ও সার্ভার চালু (Production Deployment)

আপনার লোকাল পিসি, ভিপিএস (VPS) বা সার্ভারে সরাসরি প্রোডাকশন মোডে চালানোর জন্য:

```bash
# ক্লায়েন্ট ও সার্ভার উভয় বিল্ড সম্পন্ন হবে
npm run build

# সার্ভার শুরু করুন
npm start
```
ব্রাউজারে **[http://localhost:3000](http://localhost:3000)** ওপেন করুন।

---

## 🛠️ সাধারণ সমস্যা ও তার তাৎক্ষণিক সমাধান (Troubleshooting FAQ)

### ১. সমস্যা: `Port 3000 is already in use` (EADDRINUSE)
- **কারণ**: আপনার কম্পিউটারে পূর্বের কোনো অ্যাপ বা সার্ভার ৩০০০ পোর্ট দখল করে রেখেছে।
- **সমাধান**: আপনি খুব সহজে অন্য একটি পোর্ট দিয়ে রান করতে পারবেন:
  ```bash
  npm run dev -- --port 3001
  ```
  অথবা `.env` ফাইলে `PORT=3001` লিখে সেভ করে নিন।

### ২. সমস্যা: উইন্ডোজ PowerShell-এ `npm run dev` চালাতে গিয়ে স্ক্রিপ্ট সিকিউরিটি এরর (`ExecutionPolicy`)
- **কারণ**: উইন্ডোজের ডিফল্ট স্ক্রিপ্ট এক্সিকিউশন রেস্ট্রিকশন।
- **সমাধান**: 
  1. সাধারণ **Command Prompt (CMD)** ব্যবহার করুন (এতে কোনো রেস্ট্রিকশন নেই)।
  2. অথবা PowerShell অ্যাডমিনিস্ট্রেটর হিসেবে খুলে চালান:
     ```powershell
     Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
     ```

### ৩. সমস্যা: সাব-পেজ যেমন `/admin` বা `/checkout`-এ সরাসরি রিফ্রেশ দিলে 404 বা `Cannot GET` আসা
- **সমাধান**: এই সমস্যাটি ইতিমধ্যে সার্ভারে SPA Catch-All ওয়াইল্ডকার্ড রাউটার যুক্ত করে সম্পূর্ণভাবে সমাধান করা হয়েছে। এখন যেকোনো পেজে সরাসরি প্রবেশ করলে বা রিলোড দিলে স্বয়ংক্রিয়ভাবে সঠিক পেজ লোড হবে।

### ৪. সমস্যা: GitHub Pages-এ ডিপ্লয় করলে ব্যাকএন্ড/API কাজ না করা
- **কারণ**: **GitHub Pages শুধুমাত্র স্ট্যাটিক HTML/CSS/JS হোস্ট করতে পারে**, এটি কোনো ব্যাকএন্ড সার্ভার (Node.js/Express) চালাতে পারে না। ZX Shop একটি ফুল-স্ট্যাক অ্যাপ যাতে ডায়নামিক ডাটাবেস, অর্ডার সংরক্ষণ ও এডমিন প্যানেল রয়েছে।
- **সমাধান**: GitHub Pages-এর বদলে নিচের ফ্রি ক্লাউড প্ল্যাটফর্মগুলোতে ১ ক্লিকে ডিপ্লয় করুন (যা ১০০% ব্যাকএন্ড সহ কাজ করে):

---

## 🌐 কিভাবে সম্পূর্ণ ফ্রিতে লাইভ ডোমেন ও হোস্টিং পাবেন (Free Full-Stack Hosting)

### পদ্ধতি ১: Render.com (১০০% ফ্রি হোস্টিং + লাইভ ডোমেন)
1. [Render.com](https://render.com)-এ ফ্রি অ্যাকাউন্ট খুলুন।
2. **New +** > **Web Service** চাপুন।
3. আপনার GitHub রিপোজিটরিটি সিলেক্ট করুন।
4. নিচের সেটিংসগুলো দিন:
   - **Language / Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. **Create Web Service** বাটনে ক্লিক করুন। ২ মিনিটের মধ্যে আপনার পুরো ওয়েবসাইট লাইভ হয়ে যাবে এবং একটি ফ্রি ডোমেন লিংক (যেমন: `zx-shop.onrender.com`) পেয়ে যাবেন।

### পদ্ধতি ২: Railway.app বা Koyeb
- GitHub রিপোজিটরি কানেক্ট করে ডিপ্লয় করলে ইনস্ট্যান্ট ফ্রি URL পাওয়া যায় (যেমন: `zx-shop.koyeb.app`)।

---

## 🔐 অ্যাডমিন ও সিকিউরিটি লগইন তথ্য

- **অ্যাডমিন প্যানেল URL**: `/admin`
- **ডিফল্ট অ্যাডমিন ইউজারনেম**: `admin`
- **ডিফল্ট অ্যাডমিন পাসওয়ার্ড**: `zxshop2026`
- **ডেমো ভেরিফাইড রিসেলার ফোন**: `01711000000` | পাসওয়ার্ড: `reseller123`
- অ্যাডমিন ড্যাশবোর্ড থেকে পাসওয়ার্ড, ড্রপশিপিং চার্জ, এবং সর্বোচ্চ রিসেলার বিক্রয়মূল্য লিমিট (Reseller Price Limit) সহজে পরিবর্তন করা যায়।
