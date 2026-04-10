/**
 * Generate PWA icons from the SVG logo using sharp.
 * Run with: node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const svgSrc = fs.readFileSync(path.join(root, "public", "logo-icon.svg"));

const outDir = path.join(root, "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

const sizes = [16, 32, 48, 96, 192, 512];

for (const size of sizes) {
  const out = path.join(outDir, `icon-${size}.png`);
  await sharp(svgSrc).resize(size, size).png().toFile(out);
  console.log(`✓ icon-${size}.png`);
}

// Apple touch icon (180×180, no rounded corners — iOS clips it itself)
const appleOut = path.join(root, "public", "icons", "apple-touch-icon.png");
await sharp(svgSrc).resize(180, 180).png().toFile(appleOut);
console.log("✓ apple-touch-icon.png");

// Maskable icon (512×512 with extra padding so the coin isn't clipped)
// For maskable, extend the background to fill a larger safe zone
const maskedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#1e3a8a"/>
      <stop offset="100%" stop-color="#0f766e"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <image href="data:image/svg+xml;base64,${svgSrc.toString("base64")}" x="64" y="64" width="384" height="384"/>
</svg>`;

await sharp(Buffer.from(maskedSvg)).resize(512, 512).png().toFile(
  path.join(outDir, "icon-maskable-512.png")
);
console.log("✓ icon-maskable-512.png");

console.log("\nAll icons generated in public/icons/");
