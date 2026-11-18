# World News - 17 November 2026

Entry for the make.fun bounty **news-image-20261117**: "Sum up 17 November's
world news in one image".

## What it does

`main.ts` is a small, self-contained Node program that **draws** a
1024 x 1024 news-summary image pixel by pixel and writes it out as a PNG.
There are no image assets and no downloaded fonts: the picture is built at
runtime from a tiny built-in 5x7 dot font, and the PNG file itself is
assembled by hand (header, compressed pixel data, checksums).

The image sums up the world news of Tuesday, 17 November 2026:

1. Xi, Trump & Putin to meet face-to-face
2. US-Iran war escalates at sea
3. Kyiv hit, Kerch bridge damaged
4. West urges Israel to open Gaza crossings
5. Japan scrambles jets over Russian planes
6. Houthis advance in Yemen

...plus a short "Also" line (Depardieu, Mongolia, COP31) and a sources
footer (Al Jazeera, AFP, Dawn, NPR, LinkedIn Daily Buzz).

## How to run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/entry.png` (1024 x 1024, well under 1 MiB).

## Notes

- Only Node's standard library is used (`node:fs`, `node:path`, `node:zlib`).
  No packages to install, no network, no browser.
- The output is fully deterministic: no clock, no randomness, no
  timestamps in the file, so running it twice produces byte-identical PNGs.
