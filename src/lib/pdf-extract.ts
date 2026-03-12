// Import the core parser directly to avoid pdf-parse's index.js debug mode
// which tries to read a test PDF file at module load time
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse/lib/pdf-parse');

interface PDFExtractOptions {
  startPage?: number; // 1-indexed
  endPage?: number;   // 1-indexed, inclusive
}

export async function extractTextFromPDF(
  buffer: Buffer,
  options?: PDFExtractOptions
): Promise<{ text: string; totalPages: number }> {
  let currentPage = 0;
  const start = options?.startPage ?? 1;
  const end = options?.endPage ?? Infinity;

  const data = await pdfParse(buffer, {
    // Custom page renderer that skips pages outside the desired range
    pagerender(pageData: { getTextContent: (opts: Record<string, boolean>) => Promise<{ items: Array<{ str: string; transform: number[] }> }> }) {
      currentPage++;
      if (currentPage < start || currentPage > end) {
        return Promise.resolve('');
      }
      return pageData
        .getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
        .then((textContent: { items: Array<{ str: string; transform: number[] }> }) => {
          let lastY: number | undefined;
          let text = '';
          for (const item of textContent.items) {
            if (lastY === item.transform[5] || lastY === undefined) {
              text += item.str;
            } else {
              text += '\n' + item.str;
            }
            lastY = item.transform[5];
          }
          return text;
        });
    },
  });

  return {
    text: (data.text || '').trim(),
    totalPages: data.numpages || 0,
  };
}
