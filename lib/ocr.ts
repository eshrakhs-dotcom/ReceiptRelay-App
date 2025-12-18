import Tesseract from 'tesseract.js';

export async function runOcr(buffer: Buffer) {
  try {
    const { data } = await Tesseract.recognize(buffer, 'eng', { logger: () => {} });
    return data.text;
  } catch (err) {
    console.error('OCR failed', err);
    return '';
  }
}
