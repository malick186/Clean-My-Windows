import sharp from 'sharp'

const SIZE = 256
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0071e3"/>
      <stop offset="100%" stop-color="#5e5ce6"/>
    </linearGradient>
    <linearGradient id="shine" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.3)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" rx="48" fill="url(#bg)"/>
  <rect width="${SIZE}" height="${SIZE}" rx="48" fill="url(#shine)"/>
  <!-- W shape -->
  <g transform="translate(${SIZE/2}, ${SIZE/2})" fill="none" stroke="white" stroke-width="16" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="-60,40 -42,-30 -24,10 -6,-40 12,10 30,-30 48,40"/>
  </g>
  <!-- Sparkle -->
  <circle cx="${SIZE-56}" cy="56" r="8" fill="white" opacity="0.6"/>
</svg>`

sharp(Buffer.from(svg))
  .resize(SIZE, SIZE)
  .png()
  .toFile('public/icon.png')
  .then(() => console.log('Icon generated: public/icon.png'))
  .catch(e => console.error(e))
