const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(width, height, drawPixelFn) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }
  
  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }
  
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  
  // Row data: each row has 1 filter byte (0) + width * 4 bytes (RGBA)
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // None filter
    for (let x = 0; x < width; x++) {
      const pOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawPixelFn(x, y, width, height);
      rawData[pOffset] = r;
      rawData[pOffset + 1] = g;
      rawData[pOffset + 2] = b;
      rawData[pOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// Drawing function for ZX Shop icon
function drawZXIcon(x, y, w, h, isMaskable = false) {
  const nx = x / w; // 0 to 1
  const ny = y / h; // 0 to 1
  
  // Center distance
  const cx = nx - 0.5;
  const cy = ny - 0.5;
  const dist = Math.sqrt(cx * cx + cy * cy);
  
  // Corner radius for non-maskable icons
  if (!isMaskable) {
    const cornerR = 0.22;
    const dx = Math.max(0, Math.abs(cx) - (0.5 - cornerR));
    const dy = Math.max(0, Math.abs(cy) - (0.5 - cornerR));
    if (Math.sqrt(dx * dx + dy * dy) > cornerR) {
      return [0, 0, 0, 0]; // Transparent outside squircle
    }
  }
  
  // Gradient background from rich dark slate (#0f172a) to deep crimson rose (#881337)
  const grad = (nx + ny) / 2;
  let bgR = Math.round(15 * (1 - grad) + 225 * grad * 0.7);
  let bgG = Math.round(23 * (1 - grad) + 29 * grad * 0.4);
  let bgB = Math.round(42 * (1 - grad) + 72 * grad * 0.5);

  // Subtle inner glowing border ring
  if (!isMaskable && dist > 0.44 && dist < 0.48) {
    bgR = Math.min(255, bgR + 100);
    bgG = Math.min(255, bgG + 40);
    bgB = Math.min(255, bgB + 70);
  }

  // Draw central "Z" and "X" badge / shopping emblem
  // Scale content based on maskable safe zone (maskable needs 15% margin)
  const scale = isMaskable ? 0.68 : 0.82;
  const sx = (cx / scale) + 0.5;
  const sy = (cy / scale) + 0.5;

  // Check if inside bag or symbol
  let isForeground = false;

  // Bag handle
  if (sy >= 0.22 && sy <= 0.36 && Math.abs(sx - 0.5) <= 0.16) {
    const hDist = Math.abs(Math.sqrt(Math.pow((sx - 0.5) / 0.16, 2) + Math.pow((sy - 0.36) / 0.14, 2)) - 1);
    if (hDist < 0.22 && sy <= 0.36) {
      isForeground = true;
    }
  }

  // Bag Body: rounded rect from sx [0.22, 0.78], sy [0.35, 0.78]
  if (sx >= 0.24 && sx <= 0.76 && sy >= 0.35 && sy <= 0.77) {
    // Fill bag body with high-contrast gradient
    const bagGrad = (sx + sy) / 2;
    bgR = Math.round(225 * (1 - bagGrad * 0.3));
    bgG = Math.round(29 * (1 - bagGrad * 0.2));
    bgB = Math.round(72 * (1 + bagGrad * 0.2));

    // Draw white 'ZX' lettering inside bag
    // "Z" on left: sx in [0.32, 0.46], sy in [0.46, 0.66]
    const zx = (sx - 0.32) / 0.14; // 0 to 1
    const zy = (sy - 0.46) / 0.20; // 0 to 1
    if (zx >= 0 && zx <= 1 && zy >= 0 && zy <= 1) {
      // Top bar
      if (zy <= 0.22) isForeground = true;
      // Bottom bar
      else if (zy >= 0.78) isForeground = true;
      // Diagonal
      else if (Math.abs((1 - zx) - zy) < 0.20) isForeground = true;
    }

    // "X" on right: sx in [0.54, 0.68], sy in [0.46, 0.66]
    const xx = (sx - 0.54) / 0.14; // 0 to 1
    const xy = (sy - 0.46) / 0.20; // 0 to 1
    if (xx >= 0 && xx <= 1 && xy >= 0 && xy <= 1) {
      if (Math.abs(xx - xy) < 0.18 || Math.abs((1 - xx) - xy) < 0.18) {
        isForeground = true;
      }
    }
  }

  if (isForeground) {
    return [255, 255, 255, 255]; // Crisp white
  }

  return [bgR, bgG, bgB, 255];
}

const publicDir = path.resolve(__dirname, '../public');

// 1. Generate pwa-192x192.png
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, (x, y, w, h) => drawZXIcon(x, y, w, h, false)));
console.log('Generated pwa-192x192.png');

// 2. Generate pwa-512x512.png
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, (x, y, w, h) => drawZXIcon(x, y, w, h, false)));
console.log('Generated pwa-512x512.png');

// 3. Generate pwa-maskable-512x512.png
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, (x, y, w, h) => drawZXIcon(x, y, w, h, true)));
console.log('Generated pwa-maskable-512x512.png');

// 4. Generate apple-touch-icon.png (180x180)
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, (x, y, w, h) => drawZXIcon(x, y, w, h, false)));
console.log('Generated apple-touch-icon.png');

// 5. Generate favicon.ico (as 48x48 PNG format favicon)
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPng(48, 48, (x, y, w, h) => drawZXIcon(x, y, w, h, false)));
console.log('Generated favicon.ico');
