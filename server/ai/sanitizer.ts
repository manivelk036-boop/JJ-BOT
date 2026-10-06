export function sanitizeText(text: string): string {
  if (!text) return '';

  return text
    // Remove raw SVG markup (both self-closing and full tags)
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<svg[^>]*\/>/gi, '')
    .replace(/<svg[^>]*>/gi, '')
    .replace(/<\/svg>/gi, '')
    .replace(/\[\/?svg\]?/gi, '')
    // Remove markdown-wrapped or tokenized SVG leaks: **svg**, *svg*, ***svg***, svgVerified, etc.
    .replace(/\*{1,4}\s*svg(?:Verified|Suggested|[a-zA-Z0-9_]*)\s*\*{1,4}/gi, '')
    .replace(/_{1,4}\s*svg(?:Verified|Suggested|[a-zA-Z0-9_]*)\s*_{1,4}/gi, '')
    .replace(/(?:^|\s)\*{1,4}\s*svg\s*\*{1,4}(?:\s|$)/gim, ' ')
    .replace(/\*{2,}svg\*{2,}/gi, '')
    .replace(/\b(?:svgVerified|svgSuggested)\b/gi, '')
    .replace(/\bsvg[a-zA-Z0-9_]*\b/gi, '')          // standalone svg, svg_123, svgtag, svgVerified
    .replace(/\bsvg\b/gi, '')
    .replace(/(?<=[a-zA-Z0-9])\s*svg\b/gi, '')      // e.g. Detailssvg -> Details, Cellsvg -> Cell
    .replace(/\bchunk_[a-zA-Z0-9_-]+\b/gi, '')
    .replace(/\bchk-[a-zA-Z0-9_-]+\b/gi, '')
    .replace(/\bscore:\s*\d+(\.\d+)?\b/gi, '')
    .replace(/\[\/?TABLE\]/gi, '')
    // Clean trailing empty lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function sanitizeSourceTitle(title: string): string {
  if (!title) return '';

  return title
    // Strip SVG tags and SVG metadata globally
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<svg[^>]*\/>/gi, '')
    .replace(/<svg[^>]*>/gi, '')
    .replace(/<\/svg>/gi, '')
    .replace(/^\[?svg\s*/i, '')
    .replace(/\[\/?svg\]?/gi, '')
    .replace(/\*{1,4}\s*svg(?:Verified|Suggested|[a-zA-Z0-9_]*)\s*\*{1,4}/gi, '')
    .replace(/_{1,4}\s*svg(?:Verified|Suggested|[a-zA-Z0-9_]*)\s*_{1,4}/gi, '')
    .replace(/(?:^|\s)\*{1,4}\s*svg\s*\*{1,4}(?:\s|$)/gim, ' ')
    .replace(/\*{2,}svg\*{2,}/gi, '')
    .replace(/\b(?:svgVerified|svgSuggested)\b/gi, '')
    .replace(/\bsvg[a-zA-Z0-9_]*\b/gi, '')
    .replace(/\bsvg\b/gi, '')
    .replace(/(?<=[a-zA-Z0-9])\s*svg\b/gi, '')        // Detailssvg -> Details, Cellsvg -> Cell
    .replace(/\bchunk_[a-zA-Z0-9_-]+\b/gi, '')
    .replace(/\bchk-[a-zA-Z0-9_-]+\b/gi, '')
    .replace(/\bscore:\s*\d+(\.\d+)?\b/gi, '')
    .replace(/\[\/?TABLE\]/gi, '')
    // Clean leading brackets or trailing artifacts
    .replace(/^[\[\(\{\s]+|[\]\)\}\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
