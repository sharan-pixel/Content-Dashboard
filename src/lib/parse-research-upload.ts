import { extractTextFromPDF } from './pdf-extract';

interface ParsedResearch {
  combinedText: string;
  fileName: string | null;
  totalPages: number | null;
}

export async function parseResearchUpload(formData: FormData): Promise<ParsedResearch> {
  const researchText = (formData.get('research') as string) || '';
  const file = formData.get('file') as File | null;
  const startPage = formData.get('startPage') ? parseInt(formData.get('startPage') as string) : undefined;
  const endPage = formData.get('endPage') ? parseInt(formData.get('endPage') as string) : undefined;

  let fileText = '';
  let fileName: string | null = null;
  let totalPages: number | null = null;

  if (file && file.size > 0) {
    fileName = file.name;

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await extractTextFromPDF(buffer, { startPage, endPage });
      fileText = result.text;
      totalPages = result.totalPages;
    } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      fileText = await file.text();
    } else {
      throw new Error('Only PDF and text files are supported.');
    }
  }

  const combinedText = [researchText, fileText].filter(Boolean).join('\n\n---\n\n');
  return { combinedText, fileName, totalPages };
}
