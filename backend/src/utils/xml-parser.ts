import { XMLParser } from 'fast-xml-parser';

export interface ParsedProduct {
  internalRef: string;
  barcode: string | null;
  name: string | null;
  price: number;
}

export interface ParseResult {
  products: ParsedProduct[];
  errors: string[];
  stats: {
    total: number;
    withBarcode: number;
    withoutBarcode: number;
  };
}

const BARCODE_REGEX = /^\d{8,13}$/;

function decodeHtmlEntities(str: string): string {
  return str.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

function normalizePrice(str: string): number {
  const cleaned = str.replace(/\s/g, '').replace(',', '.');
  const value = parseFloat(cleaned);
  return isNaN(value) ? NaN : value;
}

export function parseXml(xmlBuffer: Buffer): ParseResult {
  const xmlString = xmlBuffer.toString('latin1');

  const parser = new XMLParser({
    ignoreAttributes: true,
    isArray: (name) => name === 'TEXT',
  });

  const parsed = parser.parse(xmlString);

  if (!parsed.DOCUMENT?.TEXT) {
    throw new Error('Unsupported format. XML must have a <DOCUMENT> root with <TEXT> elements.');
  }

  const textNodes: string[] = parsed.DOCUMENT.TEXT.map((node: string | number | { '#text': string }) =>
    typeof node === 'string' ? node
      : typeof node === 'number' ? String(node)
      : node?.['#text'] ?? ''
  );

  const decoded = textNodes.map((n) => decodeHtmlEntities(n?.trim() || ''));

  const prixIndices: number[] = [];
  for (let idx = 0; idx < decoded.length; idx++) {
    if (decoded[idx].toLowerCase() === 'prix') {
      prixIndices.push(idx);
    }
  }

  if (prixIndices.length === 0) {
    throw new Error('Unsupported format. Could not find "Prix" header in XML.');
  }

  const products: ParsedProduct[] = [];
  const errors: string[] = [];
  let withBarcode = 0;
  let withoutBarcode = 0;

  for (const prixIdx of prixIndices) {
    const start = prixIdx + 1;

    for (let i = start; i < decoded.length - 2; i += 3) {
      const ref = decoded[i];
      const middle = decoded[i + 1];
      const priceRaw = decoded[i + 2];

      const isPriceHeader = priceRaw.toLowerCase() === 'prix';
      const isAnyHeader =
        isPriceHeader ||
        ref.toLowerCase() === 'référence' || ref.toLowerCase() === 'reference' ||
        ref.toLowerCase() === 'désignation' || ref.toLowerCase() === 'designation' ||
        middle.toLowerCase() === 'référence' || middle.toLowerCase() === 'reference' ||
        middle.toLowerCase() === 'désignation' || middle.toLowerCase() === 'designation' ||
        priceRaw.toLowerCase() === 'référence' || priceRaw.toLowerCase() === 'reference' ||
        priceRaw.toLowerCase() === 'désignation' || priceRaw.toLowerCase() === 'designation';

      if (isAnyHeader) {
        break;
      }

      if (!ref || ref.length < 2) {
        continue;
      }

      const price = normalizePrice(priceRaw);
      if (isNaN(price) || price < 0) {
        errors.push(`Row ${i}: Invalid price "${priceRaw}" for ref "${ref}"`);
        continue;
      }

      const isBarcode = BARCODE_REGEX.test(middle);

      if (isBarcode) {
        products.push({ internalRef: ref, barcode: middle, name: null, price });
        withBarcode++;
      } else {
        products.push({ internalRef: ref, barcode: null, name: middle || null, price });
        withoutBarcode++;
      }
    }
  }

  return {
    products,
    errors,
    stats: {
      total: products.length,
      withBarcode,
      withoutBarcode,
    },
  };
}
