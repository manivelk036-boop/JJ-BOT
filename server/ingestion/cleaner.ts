import * as cheerio from 'cheerio';

export function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8217;/g, '’')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'");
}

export function cleanHtmlToText(html: string): string {
  if (!html) return '';
  const $ = cheerio.load(html);

  // Remove completely useless non-content nodes
  $(
    'script, style, noscript, svg, path, link, meta, iframe, .cookie-notice, ' +
    '#wpadminbar, .elementor-location-header, .site-header, .elementor-location-footer, ' +
    '.main-menu, nav, .dialog-widget, .elementor-nav-menu, .sub-menu, ' +
    '.e-con-inner > .newsletter, .archive-section, .post-password-form, ' +
    '.social-icons, .vamtam-icon'
  ).remove();

  // Convert tables to clean formatted text before removing structure
  $('table').each((_, el) => {
    const tableEl = $(el);
    const rows: string[] = [];
    tableEl.find('tr').each((_, tr) => {
      const cells: string[] = [];
      $(tr).find('th, td').each((_, td) => {
        let cellText = $(td).text().trim().replace(/\s+/g, ' ');
        // Generically clean unwanted row/index prefix if concatenated with experience or value
        cellText = cellText.replace(/^(\s*(?:(?:s\.?\s*no\.?|sl\.?\s*no\.?|row|no\.?|#)\s*\d+[\s\.\)\-:]*|\d+\.\s+|\d+\s*[\)\-:]|\[\d+\])\s*[-–:]*\s*)(?=\d)/i, '');
        cells.push(cellText);
      });
      if (cells.length > 0) {
        rows.push(cells.join(' | '));
      }
    });
    if (rows.length > 0) {
      tableEl.replaceWith('\n\n[TABLE]\n' + rows.join('\n') + '\n[/TABLE]\n\n');
    }
  });

  // Convert headings to clear readable blocks
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const h = $(el);
    const text = h.text().trim();
    if (text) {
      h.replaceWith(`\n\n### ${text}\n`);
    }
  });

  // Convert list items
  $('li').each((_, el) => {
    const li = $(el);
    const text = li.text().trim();
    if (text) {
      li.replaceWith(`\n• ${text}`);
    }
  });

  // Convert paragraphs
  $('p').each((_, el) => {
    const p = $(el);
    const text = p.text().trim();
    if (text) {
      p.replaceWith(`\n\n${text}\n`);
    }
  });

  let text = $.text();
  text = decodeHtmlEntities(text);

  // Clean lines and duplicate whitespace
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // Remove repeated consecutive duplicate lines
  const deduped: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (i === 0 || lines[i] !== lines[i - 1]) {
      deduped.push(lines[i]);
    }
  }

  return deduped.join('\n\n');
}
