const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const sizes = [192, 512];
const svg = fs.readFileSync(path.join(__dirname, "..", "public", "icons", "pwa-icon.svg"), "utf8");

async function main() {
  for (const size of sizes) {
    const out = path.join(__dirname, "..", "public", "icons", `icon-${size}x${size}.png`);
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
    console.log(`Generated ${out}`);
    const outMaskable = path.join(__dirname, "..", "public", "icons", `icon-${size}x${size}-maskable.png`);
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(outMaskable);
    console.log(`Generated ${outMaskable}`);
  }
}

main().catch(console.error);
