/**
 * PIVTEK — Build script
 * Copies HTML files from src/ to dist/, injecting the compiled CSS link.
 * Run after: npx tailwindcss -i ./src/css/input.css -o ./dist/styles.css --minify
 */
const fs   = require('fs');
const path = require('path');

const SRC  = path.join(__dirname, '..', 'src');
const DIST = path.join(__dirname, '..', 'dist');

// Pages to process
const pages = ['index.html', 'cgv.html', 'mentions-legales.html', 'politique-confidentialite.html'];

// Cookie banner partial
const cookieBannerPath = path.join(SRC, 'partials', 'cookie-banner.html');
const cookieBanner = fs.existsSync(cookieBannerPath)
  ? fs.readFileSync(cookieBannerPath, 'utf8')
  : '';

// Ensure dist exists
if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

let built = 0;
for (const page of pages) {
  const src  = path.join(SRC, page);
  const dest = path.join(DIST, page);
  if (!fs.existsSync(src)) { console.warn(`⚠  Skipping ${page} (not found in src/)`); continue; }
  let html = fs.readFileSync(src, 'utf8');
  // Replace <!-- STYLES --> placeholder with compiled CSS link
  html = html.replace('<!-- STYLES -->', '<link rel="stylesheet" href="/styles.css">');
  // Inject cookie banner before </body>
  if (cookieBanner) {
    html = html.replace('</body>', cookieBanner + '\n</body>');
  }
  fs.writeFileSync(dest, html, 'utf8');
  console.log(`✓  ${page} → dist/${page}`);
  built++;
}
console.log(`\nBuild complete — ${built} page(s) compiled to dist/`);
