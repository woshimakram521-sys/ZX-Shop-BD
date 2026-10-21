# ZX Shop — Bangladeshi Bengali-First E-Commerce & Dropshipping Platform

ZX Shop একটি পূর্ণাঙ্গ, আধুনিক ও দ্রুতগতির বাংলাদেশি ই-কমার্স ও রিসেলার/ড্রপশিপিং প্ল্যাটফর্ম। এতে রয়েছে কাস্টমার স্টোরফ্রন্ট, ফুল ফিচারড অ্যাডমিন কন্ট্রোল প্যানেল, ড্রপশিপিং/রিসেলার পোর্টাল, ডাবল প্রাইসিং (Shop Price ও Reseller Price), CSV ইমপোর্ট/এক্সপোর্ট, এবং ক্যাশ অন ডেলিভারি, বিকাশ ও নগদ পেমেন্ট গেটওয়ে।

---

## 🚀 সরাসরি লাইভ ওয়েবসাইট লিংক (Live URLs)

গুগল এআই স্টুডিও ক্লাউড রান সরাসরি উচ্চগতির সার্ভার লিংক:

- **লাইভ প্রিভিউ ও কাস্টমার শপ লিংক**: [https://ais-pre-aty7nq7y7ilpimkgoxbnjx-32140813970.asia-southeast1.run.app](https://ais-pre-aty7nq7y7ilpimkgoxbnjx-32140813970.asia-southeast1.run.app)
- **ডেভেলপমেন্ট লিংক**: [https://ais-dev-aty7nq7y7ilpimkgoxbnjx-32140813970.asia-southeast1.run.app](https://ais-dev-aty7nq7y7ilpimkgoxbnjx-32140813970.asia-southeast1.run.app)
- **অ্যাডমিন প্যানেল**: [https://ais-pre-aty7nq7y7ilpimkgoxbnjx-32140813970.asia-southeast1.run.app/admin](https://ais-pre-aty7nq7y7ilpimkgoxbnjx-32140813970.asia-southeast1.run.app/admin)
- **রিসেলার ড্যাশবোর্ড**: [https://ais-pre-aty7nq7y7ilpimkgoxbnjx-32140813970.asia-southeast1.run.app/reseller](https://ais-pre-aty7nq7y7ilpimkgoxbnjx-32140813970.asia-southeast1.run.app/reseller)

> 💡 **নোট (DNS NXDOMAIN সতর্কতা)**: ব্রাউজারে `zx-shop.ai.studio` টাইপ করলে `DNS_PROBE_FINISHED_NXDOMAIN` আসবে, কারণ `.ai.studio` কোনো সরাসরি পাবলিক ডোমেন নয়। সর্বদা উপরের অফিসিয়াল ক্লাউড রান লিংক ব্যবহার করুন অথবা নিচের গাইড অনুযায়ী ফ্রি ডোমেন যুক্ত করুন।

---

## 💻 GitHub থেকে প্রজেক্ট রান করার নিয়ম (How to Run)

### পূর্বশর্ত:
- [Node.js](https://nodejs.org/) সংস্করণ ২০ বা তদূর্ধ্ব (Node.js 20+ or 22+ recommended)
- Git ইনস্টল করা থাকতে হবে

### ধাপসমূহ:

1. **রিপোজিটরি ক্লোন করুন**:
   ```bash
   git clone <your-github-repo-url>
   cd zx-shop
   ```

2. **ডিপেন্ডেন্সি ইনস্টল করুন**:
   ```bash
   npm install
   ```

3. **ডেভেলপমেন্ট মোডে রান করুন**:
   ```bash
   npm run dev
   ```
   এরপর ব্রাউজারে [http://localhost:3000](http://localhost:3000) এ প্রবেশ করলেই সাথে সাথে সম্পূর্ণ ওয়েবসাইট ওপেন হয়ে যাবে।

4. **প্রোডাকশন বিল্ড ও সার্ভার চালু**:
   ```bash
   npm run build
   npm start
   ```

---

## 🌐 কিভাবে সম্পূর্ণ ফ্রিতে লাইভ ডোমেন ও হোস্টিং পাবেন (Free Domain & Hosting)

ZX Shop যেহেতু Node.js Express ও React দিয়ে তৈরি একটি ফুল-স্ট্যাক অ্যাপ, তাই এটি GitHub-এর সাথে যুক্ত করে যেকোনো ফ্রি প্ল্যাটফর্মে খুব সহজেই ১ ক্লিকে ডিপ্লয় করা যায়:

### পদ্ধতি ১: Render.com (১০০% ফ্রি হোস্টিং + ফ্রি ডোমেন)
1. [Render.com](https://render.com)-এ একটি ফ্রি অ্যাকাউন্ট খুলুন।
2. **New +** > **Web Service** সিলেক্ট করুন।
3. আপনার GitHub রিপোজিটরিটি কানেক্ট করুন।
4. সেটিংস দিন:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. **Create Web Service** এ ক্লিক করলেই কয়েক মিনিটের মধ্যে আপনার সাইট লাইভ হয়ে যাবে এবং আপনি পাবেন একটি ফ্রি ডোমেন লিংক (যেমন: `zx-shop.onrender.com`), যাতে ক্লিক করলেই সরাসরি ওপেন হবে।

### পদ্ধতি ২: Railway.app বা Koyeb
- GitHub রিপোজিটরি কানেক্ট করে ডিপ্লয় করলে ইনস্ট্যান্ট ফ্রি URL পাওয়া যায় (যেমন: `zx-shop.koyeb.app`)।

### পদ্ধতি ৩: নিজস্ব ফ্রি কাস্টম ডোমেন যুক্ত করা
- আপনি চাইলে Cloudflare, Freenom, বা DuckDNS থেকে ফ্রি ডোমেন নিয়ে Render/Cloud Run-এ Custom Domain হিসেবে অ্যাড করতে পারেন।

---

## 🔐 অ্যাডমিন ও সিকিউরিটি তথ্য

- **অ্যাডমিন প্যানেল URL**: `/admin`
- **ডিফল্ট ইউজারনেম**: `admin`
- **ডিফল্ট পাসওয়ার্ড**: `zxshop2026`
- অ্যাডমিন প্যানেল থেকে পাসওয়ার্ড ও ইমেইল নোটিফিকেশন যেকোনো সময় পরিবর্তন করা যায়।
- সমস্ত ডাটা পারসিস্টেন্ট স্টোরেজ এবং স্বয়ংক্রিয় ব্যাকআপ ট্র্যাকিং দ্বারা সুরক্ষিত।
