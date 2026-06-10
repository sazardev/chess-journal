#!/usr/bin/env node
// Generate the NSIS installer sidebar (164x314, 24-bit BMP) from the bishop icon.
// Pure Node (zlib only) — no native deps. Run: node scripts/make-installer-bmp.mjs

import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { inflateSync } from "node:zlib"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function decodePng(path) {
  const buf = readFileSync(path)
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG")
  let off = 8
  let width = 0, height = 0, bitDepth = 0, colorType = 0
  const idat = []
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString("ascii", off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === "IHDR") {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
    } else if (type === "IDAT") {
      idat.push(data)
    } else if (type === "IEND") break
    off += 12 + len
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(`unsupported PNG (bitDepth ${bitDepth}, colorType ${colorType})`)
  }
  const channels = colorType === 6 ? 4 : 3
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const out = Buffer.alloc(width * height * 4)
  let prev = Buffer.alloc(stride)
  let p = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[p++]
    const line = Buffer.from(raw.subarray(p, p + stride))
    p += stride
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0
      const b = prev[x]
      const c = x >= channels ? prev[x - channels] : 0
      let v = line[x]
      if (filter === 1) v = (v + a) & 255
      else if (filter === 2) v = (v + b) & 255
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 255
      else if (filter === 4) {
        const pp = a + b - c
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c)
        const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
        v = (v + pred) & 255
      }
      line[x] = v
    }
    prev = line
    for (let x = 0; x < width; x++) {
      const si = x * channels, di = (y * width + x) * 4
      out[di] = line[si]
      out[di + 1] = line[si + 1]
      out[di + 2] = line[si + 2]
      out[di + 3] = channels === 4 ? line[si + 3] : 255
    }
  }
  return { width, height, rgba: out }
}

function makeBmp24(W, H, rgb) {
  const rowSize = Math.floor((24 * W + 31) / 32) * 4
  const imgSize = rowSize * H
  const fileSize = 54 + imgSize
  const bmp = Buffer.alloc(fileSize)
  bmp.write("BM", 0)
  bmp.writeUInt32LE(fileSize, 2)
  bmp.writeUInt32LE(54, 10)
  bmp.writeUInt32LE(40, 14)
  bmp.writeInt32LE(W, 18)
  bmp.writeInt32LE(H, 22)
  bmp.writeUInt16LE(1, 26)
  bmp.writeUInt16LE(24, 28)
  bmp.writeUInt32LE(0, 30)
  bmp.writeUInt32LE(imgSize, 34)
  bmp.writeInt32LE(2835, 38)
  bmp.writeInt32LE(2835, 42)
  for (let y = 0; y < H; y++) {
    const srcY = H - 1 - y // BMP is bottom-up
    let rp = 54 + y * rowSize
    for (let x = 0; x < W; x++) {
      const si = (srcY * W + x) * 3
      bmp[rp++] = rgb[si + 2] // B
      bmp[rp++] = rgb[si + 1] // G
      bmp[rp++] = rgb[si] // R
    }
  }
  return bmp
}

const bishop = decodePng(join(root, "src-tauri", "icons", "128x128.png"))
const W = 164, H = 314
const rgb = Buffer.alloc(W * H * 3) // black background (zeros)
const ox = Math.floor((W - bishop.width) / 2)
const oy = 78
for (let y = 0; y < bishop.height; y++) {
  for (let x = 0; x < bishop.width; x++) {
    const s = (y * bishop.width + x) * 4
    const a = bishop.rgba[s + 3] / 255
    if (a <= 0) continue
    const dx = ox + x, dy = oy + y
    if (dx < 0 || dy < 0 || dx >= W || dy >= H) continue
    const di = (dy * W + dx) * 3
    rgb[di] = Math.round(bishop.rgba[s] * a) // over black
    rgb[di + 1] = Math.round(bishop.rgba[s + 1] * a)
    rgb[di + 2] = Math.round(bishop.rgba[s + 2] * a)
  }
}

mkdirSync(join(root, "src-tauri", "installer"), { recursive: true })
const outPath = join(root, "src-tauri", "installer", "sidebar.bmp")
writeFileSync(outPath, makeBmp24(W, H, rgb))
console.log(`Wrote ${outPath} (${W}x${H}, 24-bit)`)
