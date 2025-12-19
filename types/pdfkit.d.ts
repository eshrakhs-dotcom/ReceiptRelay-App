declare module 'pdfkit' {
  import { Readable } from 'stream';
  class PDFDocument extends Readable {
    constructor(options?: any);
    pipe<T extends NodeJS.WritableStream>(dest: T): T;
  }
  export default PDFDocument;
}
