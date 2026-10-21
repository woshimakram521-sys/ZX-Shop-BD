import fs from 'fs';
import path from 'path';
import jpeg from 'jpeg-js';
import { GoogleGenAI } from '@google/genai';
import { Product, Category } from '../src/types/ecommerce';

interface ImageFingerprint {
  hash: string; // 64-bit dHash string
  colors: {
    dark: number;
    blue: number;
    warmGold: number;
    bright: number;
    red: number;
    green: number;
  };
}

// In-memory cache for product image fingerprints
const productFingerprintCache = new Map<string, ImageFingerprint>();

// Helper to decode JPEG or extract basic luma grid from buffer
function computeBufferFingerprint(buffer: Buffer): ImageFingerprint | null {
  try {
    let width: number, height: number, data: Uint8Array | Buffer;
    
    // Check if buffer is JPEG
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      const decoded = jpeg.decode(buffer, { useTArray: true });
      width = decoded.width;
      height = decoded.height;
      data = decoded.data;
    } else {
      // If PNG or other format, try jpeg decode or fallback to byte sampling
      try {
        const decoded = jpeg.decode(buffer, { useTArray: true });
        width = decoded.width;
        height = decoded.height;
        data = decoded.data;
      } catch {
        return null;
      }
    }

    if (!width || !height || !data || data.length < 64) return null;

    // 1. Calculate 64-bit dHash on 9x8 grid
    const grid: number[][] = [];
    for (let gy = 0; gy < 8; gy++) {
      const row: number[] = [];
      for (let gx = 0; gx < 9; gx++) {
        const startX = Math.floor((gx * width) / 9);
        const endX = Math.floor(((gx + 1) * width) / 9);
        const startY = Math.floor((gy * height) / 8);
        const endY = Math.floor(((gy + 1) * height) / 8);
        let sumLuma = 0;
        let count = 0;
        for (let y = startY; y < endY; y += 4) {
          for (let x = startX; x < endX; x += 4) {
            const idx = (y * width + x) * 4;
            if (idx + 2 < data.length) {
              sumLuma += (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
              count++;
            }
          }
        }
        row.push(count > 0 ? sumLuma / count : 0);
      }
      grid.push(row);
    }

    let hash = '';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        hash += grid[y][x] > grid[y][x + 1] ? '1' : '0';
      }
    }

    // 2. Color distribution buckets
    let dark = 0, blue = 0, warmGold = 0, bright = 0, red = 0, green = 0, total = 0;
    const step = Math.max(4, Math.floor(data.length / 4000) * 4);
    for (let i = 0; i < data.length - 3; i += step) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luma < 45) dark++;
      else if (b > r + 20 && b > g + 10) blue++;
      else if (r > b + 25 && g > b) warmGold++;
      else if (r > g + 30 && r > b + 30) red++;
      else if (g > r + 20 && g > b + 20) green++;
      else if (luma > 200) bright++;
      total++;
    }

    const t = Math.max(1, total);
    return {
      hash,
      colors: {
        dark: dark / t,
        blue: blue / t,
        warmGold: warmGold / t,
        bright: bright / t,
        red: red / t,
        green: green / t,
      },
    };
  } catch (err) {
    console.error('[VisualSearch] Error computing fingerprint:', err);
    return null;
  }
}

// Fingerprint a product's main image from local disk or cache
function getProductFingerprint(product: Product): ImageFingerprint | null {
  if (productFingerprintCache.has(product.id)) {
    return productFingerprintCache.get(product.id)!;
  }

  const rawPath = product.mainImage || (product.images && product.images[0]) || '';
  if (!rawPath) return null;

  // Resolve possible file paths
  const clean = rawPath.replace(/^\//, '');
  const candidates = [
    clean,
    path.join('public', clean),
    path.join(process.cwd(), clean),
    path.join(process.cwd(), 'public', clean),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const buf = fs.readFileSync(p);
        const fp = computeBufferFingerprint(buf);
        if (fp) {
          productFingerprintCache.set(product.id, fp);
          return fp;
        }
      } catch {
        // continue
      }
    }
  }

  return null;
}

export interface ImageSearchResultItem extends Product {
  matchScore: number; // 0 - 100
  isExact: boolean;
  matchReason: string;
}

export interface ImageSearchResponse {
  success: boolean;
  detectedVisualQuery: string;
  count: number;
  products: ImageSearchResultItem[];
  message: string;
}

export async function searchProductsByImage(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  allProducts: Product[],
  categories: Category[],
  context: 'shop' | 'reseller' = 'shop',
  clientFeatures?: { dHash?: string; colors?: Record<string, number> }
): Promise<ImageSearchResponse> {
  const publishedProducts = allProducts.filter(p => p.isPublished !== false);
  if (publishedProducts.length === 0) {
    return {
      success: true,
      detectedVisualQuery: '',
      count: 0,
      products: [],
      message: 'দুঃখিত, আপনার ছবির সঙ্গে মিলে এমন পণ্য পাওয়া যায়নি।',
    };
  }

  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const imgBuffer = Buffer.from(cleanBase64, 'base64');

  // STEP 1: Attempt Gemini 3.8 Flash Multimodal Semantic Match
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI();
      const catalogSummary = publishedProducts.map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: categories.find(c => c.id === p.category || c.slug === p.category)?.banglaName || p.category,
        description: p.description?.slice(0, 140) || '',
      }));

      const prompt = `You are an AI visual search engine for "ZX Shop", a Bangladeshi e-commerce and dropshipping platform.
A customer or reseller has uploaded a photo to search products.

Examine the image carefully:
1. Identify the product, garment, gadget, or item shown in the image (its type, color, pattern, style, shape).
2. Compare it with the real inventory products in this store:
${JSON.stringify(catalogSummary)}

Rules:
- If our store has the EXACT same product or highly identical item, set score to 90-100 and isExact: true.
- If not exact, find the CLOSEST visually or functionally matching products (same category/style/color) with score 45-89 and isExact: false.
- If the image shows something completely unrelated to any products in our store (e.g. food, animals, landscapes, cars, random faces), set hasMatch: false and matches: [].
- detectedVisualQuery MUST be in Bengali (e.g. "ম্যাট ব্ল্যাক স্মার্টওয়াচ", "রয়্যাল নেভি ব্লু পাঞ্জাবি", "ন্যাচারাল রেডিয়েন্স সিরাম", "ওয়্যারলেস ইয়ারবাডস").
- For each matched product, reason MUST be in Bengali (e.g. "ডিজাইন ও রং ১০০% হুবহু মিলেছে", "একই ক্যাটাগরির ব্লুটুথ স্মার্টওয়াচ").

Return JSON strictly matching this schema:
{
  "detectedVisualQuery": "string in Bengali",
  "hasMatch": boolean,
  "matches": [
    {
      "productId": "string matching catalog id",
      "score": number,
      "isExact": boolean,
      "reason": "string in Bengali"
    }
  ]
}`;

      const geminiPromise = ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          { inlineData: { data: cleanBase64, mimeType: mimeType || 'image/jpeg' } },
          prompt,
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API timeout after 5000ms')), 5000)
      );

      const geminiRes: any = await Promise.race([geminiPromise, timeoutPromise]);

      if (geminiRes && geminiRes.text) {
        const parsed = JSON.parse(geminiRes.text);
        if (parsed.hasMatch && Array.isArray(parsed.matches) && parsed.matches.length > 0) {
          const matchedItems: ImageSearchResultItem[] = [];

          for (const m of parsed.matches) {
            const prod = publishedProducts.find(p => p.id === m.productId);
            if (prod) {
              matchedItems.push({
                ...prod,
                matchScore: Math.min(100, Math.max(10, Math.round(Number(m.score) || 80))),
                isExact: Boolean(m.isExact),
                matchReason: m.reason || (m.isExact ? 'হুবহু পণ্য মিলেছে' : 'কাছাকাছি ডিজাইনের পণ্য'),
              });
            }
          }

          if (matchedItems.length > 0) {
            matchedItems.sort((a, b) => b.matchScore - a.matchScore);
            return {
              success: true,
              detectedVisualQuery: parsed.detectedVisualQuery || 'আপনার আপলোড করা ছবি',
              count: matchedItems.length,
              products: matchedItems.slice(0, 8),
              message: `আপনার ছবির সাথে মিলে এমন ${matchedItems.length} টি পণ্য পাওয়া গেছে।`,
            };
          }
        } else if (parsed.hasMatch === false) {
          // Explicitly determined no match
          return {
            success: true,
            detectedVisualQuery: parsed.detectedVisualQuery || '',
            count: 0,
            products: [],
            message: 'দুঃখিত, আপনার ছবির সঙ্গে মিলে এমন পণ্য পাওয়া যায়নি।',
          };
        }
      }
    } catch (err: any) {
      console.warn('[VisualSearch] Gemini API unavailable or high demand (falling back to visual perceptual matcher):', err?.status || err?.message);
    }
  }

  // STEP 2: High-Precision Local Perceptual Visual Matcher (Offline / Fallback)
  let queryFp = computeBufferFingerprint(imgBuffer);
  if (!queryFp && clientFeatures?.dHash) {
    queryFp = {
      hash: clientFeatures.dHash,
      colors: {
        dark: clientFeatures.colors?.dark || 0,
        blue: clientFeatures.colors?.blue || 0,
        warmGold: clientFeatures.colors?.warmGold || 0,
        bright: clientFeatures.colors?.bright || 0,
        red: clientFeatures.colors?.red || 0,
        green: clientFeatures.colors?.green || 0,
      },
    };
  }

  if (!queryFp) {
    return {
      success: true,
      detectedVisualQuery: '',
      count: 0,
      products: [],
      message: 'দুঃখিত, আপনার ছবির সঙ্গে মিলে এমন পণ্য পাওয়া যায়নি।',
    };
  }

  // Compute visual similarity against all published products
  const scoredProducts: ImageSearchResultItem[] = [];

  for (const prod of publishedProducts) {
    const prodFp = getProductFingerprint(prod);
    if (!prodFp) continue;

    // 1. Hamming distance on 64-bit dHash
    let hashMatches = 0;
    const len = Math.min(queryFp.hash.length, prodFp.hash.length);
    for (let i = 0; i < len; i++) {
      if (queryFp.hash[i] === prodFp.hash[i]) hashMatches++;
    }
    const hashScore = len > 0 ? (hashMatches / len) * 100 : 50;

    // 2. Color similarity
    const c1 = queryFp.colors;
    const c2 = prodFp.colors;
    const colorDist =
      Math.abs(c1.dark - c2.dark) +
      Math.abs(c1.blue - c2.blue) +
      Math.abs(c1.warmGold - c2.warmGold) +
      Math.abs(c1.bright - c2.bright) +
      Math.abs(c1.red - c2.red) +
      Math.abs(c1.green - c2.green);
    const colorScore = Math.max(0, 100 - colorDist * 40);

    const totalScore = Math.round(hashScore * 0.65 + colorScore * 0.35);

    // Only consider as candidate if totalScore >= 58
    if (totalScore >= 58) {
      const isExact = totalScore >= 82;
      scoredProducts.push({
        ...prod,
        matchScore: Math.min(100, totalScore),
        isExact,
        matchReason: isExact ? 'হুবহু ডিজাইন ও রং মিলেছে' : 'কাছাকাছি রঙের ও ধরনের পণ্য',
      });
    }
  }

  scoredProducts.sort((a, b) => b.matchScore - a.matchScore);

  if (scoredProducts.length === 0 || scoredProducts[0].matchScore < 60) {
    return {
      success: true,
      detectedVisualQuery: '',
      count: 0,
      products: [],
      message: 'দুঃখিত, আপনার ছবির সঙ্গে মিলে এমন পণ্য পাওয়া যায়নি।',
    };
  }

  // Infer short Bengali visual query label based on top matched product
  const topProduct = scoredProducts[0];
  const detectedLabel = topProduct.name.split('(')[0].trim();

  return {
    success: true,
    detectedVisualQuery: detectedLabel,
    count: scoredProducts.length,
    products: scoredProducts.slice(0, 6),
    message: `আপনার ছবির সাথে মিলে এমন ${scoredProducts.length} টি পণ্য পাওয়া গেছে।`,
  };
}
