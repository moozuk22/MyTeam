// Preserve the existing artwork, fitting it onto opaque square canvases.
const sharp = require("sharp");
const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const publicDir = path.resolve(__dirname, "../public");
  const output = path.join(publicDir, "icons");
  await fs.mkdir(output, { recursive: true });
  for (const [name, size, ratio] of [
    ["icon-192.png", 192, 0.9],
    ["icon-512.png", 512, 0.9],
    // A centered 56% square stays inside the maskable 80%-diameter safe circle.
    ["icon-maskable-512.png", 512, 0.56],
    ["apple-touch-icon.png", 180, 0.9],
  ]) {
    const artwork = await sharp(path.join(publicDir, "myteam-logo.webp"))
      .resize(Math.round(size * ratio), Math.round(size * ratio), { fit: "inside" })
      .png().toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: "#000000" } })
      .composite([{ input: artwork, gravity: "centre" }])
      .png().toFile(path.join(output, name));
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
