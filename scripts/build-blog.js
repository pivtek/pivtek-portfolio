/**
 * PIVTEK — Blog build script
 * Reads .md files from src/blog/, applies template, outputs to dist/blog/<slug>/index.html
 * Also builds dist/blog/index.html (listing page)
 *
 * Usage: node scripts/build-blog.js
 * Called automatically by: npm run build
 *
 * To add a new article:
 *   1. Create src/blog/<slug>.md with the YAML frontmatter defined below
 *   2. Run npm run build
 *   Done — the page is generated at dist/blog/<slug>/index.html
 *
 * Frontmatter fields:
 *   slug            — URL path: /blog/<slug>
 *   title           — H1 of the article
 *   metaTitle       — <title> tag (includes "| PIVTEK")
 *   metaDescription — <meta name="description">
 *   category        — CSS modifier: artisan | local | ia | conseil | dev
 *   categoryLabel   — Badge text shown on card and article header
 *   date            — ISO date: YYYY-MM-DD
 *   readTime        — e.g. "6 min de lecture"
 *   excerpt         — Short text for listing card
 *   featured        — true for the first featured card (full-width)
 *   disclaimer      — true to show "Cas illustratif" notice on article
 */

const fs   = require('fs');
const path = require('path');

// ── Paths ──────────────────────────────────────────────────────────────────
const ROOT      = path.join(__dirname, '..');
const BLOG_SRC  = path.join(ROOT, 'src', 'blog');
const TMPL_DIR  = path.join(ROOT, 'src', 'templates');
const DIST_BLOG = path.join(ROOT, 'dist', 'blog');

// ── Tiny markdown-to-HTML converter (no external dependency) ───────────────
function mdToHtml(md) {
  const lines   = md.split('\n');
  const output  = [];
  let inList    = false;
  let inCode    = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Fenced code blocks
    if (line.startsWith('```')) {
      if (!inCode) { output.push('<pre><code>'); inCode = true; }
      else          { output.push('</code></pre>'); inCode = false; }
      continue;
    }
    if (inCode) { output.push(escHtml(line)); continue; }

    // Close open list before anything else
    if (inList && !line.startsWith('- ') && !line.startsWith('* ')) {
      output.push('</ul>'); inList = false;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) { output.push('<hr class="pv-blog-article-hr">'); continue; }

    // Headings
    if (line.startsWith('### ')) { output.push(`<h3>${inline(line.slice(4))}</h3>`); continue; }
    if (line.startsWith('## '))  { output.push(`<h2>${inline(line.slice(3))}</h2>`); continue; }
    if (line.startsWith('# '))   { output.push(`<h1>${inline(line.slice(2))}</h1>`); continue; }

    // Unordered lists
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) { output.push('<ul>'); inList = true; }
      output.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }

    // Numbered lists
    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      // Simple: wrap each in its own <ol> — good enough for our articles
      output.push(`<ol start="${numMatch[1]}"><li>${inline(numMatch[2])}</li></ol>`);
      continue;
    }

    // Block quote
    if (line.startsWith('> ')) {
      output.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
      continue;
    }

    // Blank line → paragraph break
    if (line.trim() === '') {
      output.push('');
      continue;
    }

    // Normal paragraph line — group consecutive non-empty lines
    const para = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#') &&
           !lines[i].startsWith('- ') && !lines[i].startsWith('* ') &&
           !lines[i].startsWith('> ') && !lines[i].startsWith('```') &&
           !/^---+$/.test(lines[i].trim()) && !lines[i].match(/^\d+\.\s/)) {
      para.push(inline(lines[i]));
      i++;
    }
    i--; // Back one so the outer loop re-reads the stopping line
    if (para.length) output.push(`<p>${para.join(' ')}</p>`);
  }

  if (inList)  output.push('</ul>');
  if (inCode)  output.push('</code></pre>');

  // Merge consecutive <ol> with same start (numbered list items become one <ol>)
  return output.join('\n')
    .replace(/<\/ol>\n?<ol[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function inline(s) {
  return s
    // Bold + italic combined
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Inline code
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Links: [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
      const ext = href.startsWith('http') ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${href}"${ext}>${text}</a>`;
    });
}

// ── Parse YAML frontmatter ─────────────────────────────────────────────────
function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('Missing or malformed frontmatter');

  const meta    = {};
  const yamlStr = match[1];
  const body    = match[2];

  yamlStr.split('\n').forEach(line => {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) return;
    const [, key, val] = kv;
    const trimmed = val.trim().replace(/^["']|["']$/g, '');
    if (trimmed === 'true')  { meta[key] = true;  return; }
    if (trimmed === 'false') { meta[key] = false; return; }
    meta[key] = trimmed;
  });

  return { meta, body: body.trim() };
}

// ── Format date (French) ───────────────────────────────────────────────────
function formatDate(isoDate) {
  const months = ['janv.','févr.','mars','avr.','mai','juin',
                  'juil.','août','sept.','oct.','nov.','déc.'];
  const d = new Date(isoDate + 'T00:00:00');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Arrow icon ─────────────────────────────────────────────────────────────
const ARROW = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6h7M6.5 3.5L9 6l-2.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ── Build card HTML ────────────────────────────────────────────────────────
function buildCard(meta, featured = false) {
  if (featured) {
    return `
      <a class="pv-blog-card pv-blog-card--featured" href="/blog/${meta.slug}">
        <div class="pv-blog-visual">
          <svg width="72" height="72" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="38" r="18" stroke="#5B8DEF" stroke-width="1.5" opacity=".4"/>
            <path d="M40 20c-5 4-8 11-8 18s3 14 8 18" stroke="#7B6FD6" stroke-width="1.5" opacity=".5" stroke-linecap="round"/>
            <path d="M40 20c5 4 8 11 8 18s-3 14-8 18" stroke="#5B8DEF" stroke-width="1.5" opacity=".4" stroke-linecap="round"/>
            <line x1="22" y1="38" x2="58" y2="38" stroke="#7B6FD6" stroke-width="1" opacity=".3"/>
            <line x1="24" y1="30" x2="56" y2="30" stroke="#5B8DEF" stroke-width="1" opacity=".25"/>
            <line x1="24" y1="46" x2="56" y2="46" stroke="#5B8DEF" stroke-width="1" opacity=".25"/>
            <circle cx="56" cy="56" r="10" fill="#0c0e14" stroke="#66bb8a" stroke-width="1.5" opacity=".9"/>
            <path d="M52 56l2.5 2.5 4.5-4.5" stroke="#66bb8a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="pv-blog-body">
          <span class="pv-blog-cat pv-blog-cat--${meta.category}">${meta.categoryLabel}</span>
          <div class="pv-blog-title">${meta.title}</div>
          <div class="pv-blog-excerpt">${meta.excerpt}</div>
          <div class="pv-blog-meta">
            <span>${formatDate(meta.date)} · ${meta.readTime}</span>
            <span class="pv-blog-read">Lire l'article ${ARROW}</span>
          </div>
        </div>
      </a>`;
  }

  return `
      <a class="pv-blog-card" href="/blog/${meta.slug}">
        <span class="pv-blog-cat pv-blog-cat--${meta.category}">${meta.categoryLabel}</span>
        <div class="pv-blog-title">${meta.title}</div>
        <div class="pv-blog-excerpt">${meta.excerpt}</div>
        <div class="pv-blog-meta">
          <span>${formatDate(meta.date)} · ${meta.readTime}</span>
          <span class="pv-blog-read">Lire ${ARROW}</span>
        </div>
      </a>`;
}

// ── Main build ─────────────────────────────────────────────────────────────
function build() {
  // Load templates
  const articleTmpl = fs.readFileSync(path.join(TMPL_DIR, 'blog-article.html'), 'utf8');
  const indexTmpl   = fs.readFileSync(path.join(TMPL_DIR, 'blog-index.html'),   'utf8');

  // Ensure dist/blog exists
  if (!fs.existsSync(DIST_BLOG)) fs.mkdirSync(DIST_BLOG, { recursive: true });

  // Read and parse all .md files
  const mdFiles = fs.readdirSync(BLOG_SRC).filter(f => f.endsWith('.md'));
  if (!mdFiles.length) { console.warn('⚠  No .md files found in src/blog/'); return; }

  const articles = [];

  for (const file of mdFiles) {
    const raw = fs.readFileSync(path.join(BLOG_SRC, file), 'utf8');
    const { meta, body } = parseFrontmatter(raw);

    if (!meta.slug) { console.warn(`⚠  ${file}: missing slug, skipping`); continue; }

    const htmlContent = mdToHtml(body);
    const year        = new Date().getFullYear();
    const dateFormatted = formatDate(meta.date);

    // Disclaimer block
    const disclaimerBlock = meta.disclaimer
      ? `<div class="pv-blog-article-disclaimer">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M7 5v3M7 9.5v.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          Cas illustratif basé sur des situations réelles rencontrées par PIVTEK. Les noms ont été modifiés.
        </div>`
      : '';

    // Fill article template
    let page = articleTmpl
      .replace(/<!-- STYLES -->/g, '<link rel="stylesheet" href="/styles.css">')
      .replace(/\{\{slug\}\}/g,          meta.slug)
      .replace(/\{\{title\}\}/g,         meta.title)
      .replace(/\{\{metaTitle\}\}/g,     meta.metaTitle)
      .replace(/\{\{metaDescription\}\}/g, meta.metaDescription)
      .replace(/\{\{category\}\}/g,      meta.category)
      .replace(/\{\{categoryLabel\}\}/g, meta.categoryLabel)
      .replace(/\{\{date\}\}/g,          meta.date)
      .replace(/\{\{dateFormatted\}\}/g, dateFormatted)
      .replace(/\{\{readTime\}\}/g,      meta.readTime)
      .replace(/\{\{content\}\}/g,       htmlContent)
      .replace(/\{\{year\}\}/g,          year)
      .replace(/\{\{#disclaimer\}\}[\s\S]*?\{\{\/disclaimer\}\}/g, disclaimerBlock);

    // Output to dist/blog/<slug>/index.html
    const outDir = path.join(DIST_BLOG, meta.slug);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), page, 'utf8');
    console.log(`✓  /blog/${meta.slug}/index.html`);

    articles.push(meta);
  }

  // Sort: featured first, then by date desc
  articles.sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return new Date(b.date) - new Date(a.date);
  });

  // Build index cards
  const cardsHtml = articles.map((meta, i) =>
    buildCard(meta, i === 0 && meta.featured === true || meta.featured === 'true')
  ).join('\n');

  // Fill index template
  const indexPage = indexTmpl
    .replace(/<!-- STYLES -->/g, '<link rel="stylesheet" href="/styles.css">')
    .replace(/\{\{articles\}\}/g, cardsHtml)
    .replace(/\{\{year\}\}/g, new Date().getFullYear());

  fs.writeFileSync(path.join(DIST_BLOG, 'index.html'), indexPage, 'utf8');
  console.log(`✓  /blog/index.html`);

  console.log(`\n✅  Blog build complete — ${articles.length} article(s) + index`);
}

build();
