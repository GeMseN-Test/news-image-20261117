// World News - 17 November 2026.
// A small self-contained Node program that draws a news-summary image
// (1024 x 1024 PNG) pixel by pixel and writes it to entry.png.
//
// How it works, in plain terms:
//  - A canvas is just a big list of red/green/blue numbers, one per pixel.
//  - Text is drawn from a tiny built-in 5x7 dot font (each letter is a
//    5-wide, 7-tall grid of on/off dots), scaled up to the size we need.
//  - The PNG file itself is assembled by hand: header chunk, compressed
//    pixel data (zlib deflate), and a checksum (CRC32) per chunk.
//  - Only Node's standard library is used: fs, path, zlib. No network,
//    no clock, no randomness, so every run writes byte-identical output.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------
const W = 1024;
const H = 1024;
const BG = [14, 16, 19]; // #0e1013 dark background
const RED = [212, 61, 42]; // #d43d2a accent red
const GOLD = [232, 182, 76]; // #e8b64c kicker gold
const WHITE = [255, 255, 255];
const BODY = [201, 206, 214]; // light grey body text
const MUTED = [138, 145, 156]; // dim grey footer text
const DIVIDER = [42, 46, 53]; // hairline separators

const pixels = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  pixels[i * 3] = BG[0];
  pixels[i * 3 + 1] = BG[1];
  pixels[i * 3 + 2] = BG[2];
}

function setPixel(x, y, color) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  pixels[i] = color[0];
  pixels[i + 1] = color[1];
  pixels[i + 2] = color[2];
}

function fillRect(x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPixel(xx, yy, color);
  }
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font. Each glyph is 7 rows of 5 dots ("1" = ink, "0" = empty).
// Covers printable ASCII so every character in our copy exists here.
// ---------------------------------------------------------------------------
const FONT = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  '"': ["01010", "01010", "01010", "00000", "00000", "00000", "00000"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "*": ["00000", "10101", "01110", "11111", "01110", "10101", "00000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  ",": ["00000", "00000", "00000", "00000", "00100", "00100", "01000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  3: ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  6: ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "<": ["00010", "00100", "01000", "10000", "01000", "00100", "00010"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  ">": ["01000", "00100", "00010", "00001", "00010", "00100", "01000"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "@": ["01110", "10001", "10111", "10101", "10110", "10000", "01110"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "[": ["01110", "01000", "01000", "01000", "01000", "01000", "01110"],
  "\\": ["10000", "01000", "01000", "00100", "00010", "00010", "00001"],
  "]": ["01110", "00010", "00010", "00010", "00010", "00010", "01110"],
  "^": ["00100", "01010", "10001", "00000", "00000", "00000", "00000"],
  _: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  "`": ["00100", "00100", "00010", "00000", "00000", "00000", "00000"],
  a: ["00000", "00000", "01110", "00001", "01111", "10001", "01111"],
  b: ["10000", "10000", "11110", "10001", "10001", "10001", "11110"],
  c: ["00000", "00000", "01110", "10000", "10000", "10001", "01110"],
  d: ["00001", "00001", "01111", "10001", "10001", "10001", "01111"],
  e: ["00000", "00000", "01110", "10001", "11111", "10000", "01110"],
  f: ["00110", "01001", "01000", "11110", "01000", "01000", "01000"],
  g: ["00000", "01111", "10001", "10001", "01111", "00001", "01110"],
  h: ["10000", "10000", "11110", "10001", "10001", "10001", "10001"],
  i: ["00100", "00000", "01100", "00100", "00100", "00100", "01110"],
  j: ["00010", "00000", "00110", "00010", "00010", "10010", "01100"],
  k: ["10000", "10000", "10010", "10100", "11000", "10100", "10010"],
  l: ["00100", "00100", "00100", "00100", "00100", "00100", "01110"],
  m: ["00000", "00000", "11010", "10101", "10101", "10101", "10101"],
  n: ["00000", "00000", "11110", "10001", "10001", "10001", "10001"],
  o: ["00000", "00000", "01110", "10001", "10001", "10001", "01110"],
  p: ["00000", "00000", "11110", "10001", "11110", "10000", "10000"],
  q: ["00000", "00000", "01111", "10001", "01111", "00001", "00001"],
  r: ["00000", "00000", "10110", "11001", "10000", "10000", "10000"],
  s: ["00000", "00000", "01111", "10000", "01110", "00001", "11110"],
  t: ["01000", "01000", "11100", "01000", "01000", "01001", "00110"],
  u: ["00000", "00000", "10001", "10001", "10001", "10011", "01101"],
  v: ["00000", "00000", "10001", "10001", "10001", "01010", "00100"],
  w: ["00000", "00000", "10001", "10101", "10101", "10101", "01010"],
  x: ["00000", "00000", "10001", "01010", "00100", "01010", "10001"],
  y: ["00000", "00000", "10001", "10001", "01111", "00001", "01110"],
  z: ["00000", "00000", "11111", "00010", "00100", "01000", "11111"],
  "{": ["00010", "00100", "00100", "01100", "00100", "00100", "00010"],
  "|": ["00100", "00100", "00100", "00100", "00100", "00100", "00100"],
  "}": ["01000", "00100", "00100", "00110", "00100", "00100", "01000"],
  "~": ["00000", "00000", "01101", "10110", "00000", "00000", "00000"],
};

const BLANK = FONT[" "];

// One glyph cell is 6 units wide (5 dots + 1 gap), 7 tall.
function textWidth(text, scale, tracking) {
  return text.length * (6 * scale + (tracking || 0)) - (tracking || 0);
}

function drawText(text, x, y, scale, color, tracking) {
  const step = 6 * scale + (tracking || 0);
  for (let ci = 0; ci < text.length; ci++) {
    const glyph = FONT[text[ci]] || BLANK;
    const ox = x + ci * step;
    for (let row = 0; row < 7; row++) {
      const bits = glyph[row];
      for (let col = 0; col < 5; col++) {
        if (bits[col] === "1") {
          fillRect(ox + col * scale, y + row * scale, scale, scale, color);
        }
      }
    }
  }
  return x + textWidth(text, scale, tracking);
}

// Greedy word wrap: returns lines that fit inside maxWidth pixels.
function wrapText(text, scale, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const trial = line === "" ? word : line + " " + word;
    if (textWidth(trial, scale, 0) <= maxWidth || line === "") {
      line = trial;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== "") lines.push(line);
  return lines;
}

// ---------------------------------------------------------------------------
// Content: the news of 17 November 2026 (fixed facts, embedded in code).
// ---------------------------------------------------------------------------
const STORIES = [
  {
    headline: "Xi, Trump & Putin to meet face-to-face",
    desc: "China confirms the first-ever trilateral summit, set for Thursday in Shenzhen on the APEC sidelines.",
  },
  {
    headline: "US-Iran war escalates at sea",
    desc: "A fourth tanker is hit by a mine in the Strait of Hormuz; Iran launches a drone strike on a US facility in Bahrain.",
  },
  {
    headline: "Kyiv hit, Kerch bridge damaged",
    desc: "A Russian ballistic missile attack disrupts heating and water in Kyiv; a Ukrainian strike damages the Crimea bridge.",
  },
  {
    headline: "West urges Israel to open Gaza crossings",
    desc: "The UK, Australia, Canada and Italy call for rapid aid access; Britain sanctions eight Israeli firms over settlements.",
  },
  {
    headline: "Japan scrambles jets over Russian planes",
    desc: "Tokyo launches fighter jets and protests after two suspected Russian aircraft violate its airspace.",
  },
  {
    headline: "Houthis advance in Yemen",
    desc: "Government forces retreat from the Red Sea coast to defend Aden as the Houthi insurgency pushes forward.",
  },
];

const ALSO =
  "Also: Depardieu pleads guilty to sexual assault - Mongolia's president resigns in a corruption scandal - COP31 draft deal calls for a faster fossil-fuel phase-out and $120bn in climate finance.";
const SOURCES = "SOURCES: AL JAZEERA - AFP - DAWN - NPR - LINKEDIN DAILY BUZZ";

// ---------------------------------------------------------------------------
// Layout: 1024 x 1024, 64 px side margins, text column ends at x = 960.
// ---------------------------------------------------------------------------
const MARGIN = 64;
const RIGHT = W - MARGIN; // 960
const HEAD_X = 140; // headline / description column
const DESC_W = RIGHT - HEAD_X; // 820

// Kicker
drawText("THE WORLD IN ONE DAY", MARGIN, 46, 3, GOLD, 4);

// Title, two big lines
drawText("World News", MARGIN, 84, 9, WHITE, 0);
drawText("17 November 2026", MARGIN, 156, 9, WHITE, 0);

// Subtitle
drawText("TUESDAY - TOP STORIES FROM AROUND THE GLOBE", MARGIN, 234, 2, BODY, 0);

// Red rule under the title block
fillRect(MARGIN, 262, RIGHT - MARGIN, 5, RED);

// Six numbered stories
let storyY = 292;
const PITCH = 90;
for (let i = 0; i < STORIES.length; i++) {
  const s = STORIES[i];
  drawText(String(i + 1), MARGIN, storyY, 6, RED, 0);
  drawText(s.headline, HEAD_X, storyY + 4, 3, WHITE, 0);
  const lines = wrapText(s.desc, 2, DESC_W);
  for (let li = 0; li < lines.length; li++) {
    drawText(lines[li], HEAD_X, storyY + 34 + li * 19, 2, BODY, 0);
  }
  if (i < STORIES.length - 1) {
    fillRect(MARGIN, storyY + 76, RIGHT - MARGIN, 1, DIVIDER);
  }
  storyY += PITCH;
}

// "Also" block: separator, wrapped lines, gold "Also:" overprint.
const alsoY = storyY + 8; // 840
fillRect(MARGIN, alsoY - 14, RIGHT - MARGIN, 1, DIVIDER);
const alsoLines = wrapText(ALSO, 2, RIGHT - MARGIN);
for (let li = 0; li < alsoLines.length; li++) {
  drawText(alsoLines[li], MARGIN, alsoY + li * 19, 2, BODY, 0);
}
drawText("Also:", MARGIN, alsoY, 2, GOLD, 0);

// Sources footer
drawText(SOURCES, MARGIN, alsoY + alsoLines.length * 19 + 22, 2, MUTED, 0);

// Thin red bar near the very bottom, echoing the rule under the title.
fillRect(MARGIN, H - 60, RIGHT - MARGIN, 5, RED);

// ---------------------------------------------------------------------------
// PNG encoding (pure stdlib): CRC32 + IHDR / IDAT / IEND chunks.
// ---------------------------------------------------------------------------
const CRC_TABLE = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePNG() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = truecolour RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace: none

  // Raw scanlines: one filter byte (0 = none) + RGB bytes per row.
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    pixels.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Write it out. Output dir comes from the environment, default /output.
// ---------------------------------------------------------------------------
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "entry.png");
fs.writeFileSync(outPath, encodePNG());
console.log("Wrote " + outPath);
