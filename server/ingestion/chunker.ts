import { ChunkMetadata, DocumentChunk } from '../types.js';

export function chunkCleanText(
  cleanText: string,
  metadata: ChunkMetadata
): DocumentChunk[] {
  if (!cleanText || cleanText.trim().length === 0) return [];

  // Split by markdown headings or double newlines
  const sections = cleanText.split(/(?=\n###\s+)/g);
  const chunks: DocumentChunk[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const trimmed = section.trim();
    if (trimmed.length < 30) continue;

    // Detect section heading if present
    let sectionHeading = metadata.heading;
    const headingMatch = trimmed.match(/^###\s+([^\n]+)/);
    if (headingMatch) {
      sectionHeading = headingMatch[1].trim();
    }

    // If section is reasonably sized (< 1500 chars), keep as one chunk
    if (trimmed.length <= 1500) {
      const chunkId = `chk-${metadata.pageTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${chunkIndex++}`;
      chunks.push({
        id: chunkId,
        content: trimmed,
        cleanText: trimmed.replace(/###\s+/g, '').replace(/\[TABLE\]|\[\/TABLE\]/g, ''),
        metadata: {
          ...metadata,
          heading: sectionHeading,
        },
        keywords: extractKeywords(trimmed),
      });
    } else {
      // Split large sections by paragraphs
      const paragraphs = trimmed.split(/\n\n+/);
      let currentBlock = '';

      for (const para of paragraphs) {
        if ((currentBlock + '\n\n' + para).length > 1200 && currentBlock.length > 200) {
          const chunkId = `chk-${metadata.pageTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${chunkIndex++}`;
          chunks.push({
            id: chunkId,
            content: currentBlock.trim(),
            cleanText: currentBlock.trim().replace(/###\s+/g, '').replace(/\[TABLE\]|\[\/TABLE\]/g, ''),
            metadata: {
              ...metadata,
              heading: sectionHeading,
            },
            keywords: extractKeywords(currentBlock),
          });
          currentBlock = (sectionHeading ? `### ${sectionHeading}\n\n` : '') + para;
        } else {
          currentBlock = currentBlock ? currentBlock + '\n\n' + para : para;
        }
      }

      if (currentBlock.trim().length > 30) {
        const chunkId = `chk-${metadata.pageTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${chunkIndex++}`;
        chunks.push({
          id: chunkId,
          content: currentBlock.trim(),
          cleanText: currentBlock.trim().replace(/###\s+/g, '').replace(/\[TABLE\]|\[\/TABLE\]/g, ''),
          metadata: {
            ...metadata,
            heading: sectionHeading,
          },
          keywords: extractKeywords(currentBlock),
        });
      }
    }
  }

  return chunks;
}

export function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in',
    'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will', 'with',
    'this', 'then', 'they', 'our', 'we', 'you', 'your', 'about', 'all', 'also'
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  return Array.from(new Set(words));
}
