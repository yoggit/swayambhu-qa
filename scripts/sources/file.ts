/**
 * file.ts — Local file source adapter
 *
 * Reads a local requirement file and normalises it into the same QARequirement
 * shape used by all IMS adapters, so the rest of the pipeline is completely
 * unaware of the input source.
 *
 * Supported natively:   .md  .txt  .text
 * Supported (opt-in):   .docx  (npm install mammoth)
 *                       .doc   (npm install word-extractor)
 *                       .pdf   (npm install pdf-parse@1.1.1)
 *
 * Usage (via fetch-issue.ts) — always quote the path:
 *   npx ts-node scripts/fetch-issue.ts --id "./story.md"
 *   npx ts-node scripts/fetch-issue.ts --id "Petstore — Browse and Manage Pets (UI + API).txt"
 *   npx ts-node scripts/fetch-issue.ts --id "requirements/login-feature.docx"
 *   npx ts-node scripts/fetch-issue.ts --id "specs/user-story.pdf"
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  QARequirement,
  parseAcceptanceCriteria,
  parseTestUrls,
  parseCredentials,
  parseApiEndpoints,
  parsePriority,
  parseSummary,
} from './types';

const TEXT_FORMATS  = ['.md', '.txt', '.text'];
const BINARY_FORMATS: Record<string, { pkg: string; install: string }> = {
  '.docx': { pkg: 'mammoth',        install: 'npm install mammoth' },
  '.doc':  { pkg: 'word-extractor', install: 'npm install word-extractor' },
  '.pdf':  { pkg: 'pdf-parse',      install: 'npm install pdf-parse@1.1.1' },
};

const SUPPORTED_FORMATS = [...TEXT_FORMATS, ...Object.keys(BINARY_FORMATS)];

async function extractText(resolved: string, ext: string): Promise<string> {
  if (TEXT_FORMATS.includes(ext)) {
    return fs.readFileSync(resolved, 'utf-8');
  }

  const info = BINARY_FORMATS[ext];
  if (!info) {
    throw new Error(
      `Unsupported file format "${ext}". Supported formats: ${SUPPORTED_FORMATS.join(', ')}`
    );
  }

  // Try to load the optional dependency
  let lib: any;
  try {
    lib = require(info.pkg);
  } catch {
    throw new Error(
      `Reading ${ext} files requires "${info.pkg}". Install it and retry:\n  ${info.install}`
    );
  }

  if (ext === '.docx') {
    const result = await lib.extractRawText({ path: resolved });
    return result.value;
  }

  if (ext === '.doc') {
    const extractor = new lib();
    const doc = await extractor.extract(resolved);
    return doc.getBody();
  }

  if (ext === '.pdf') {
    const buffer = fs.readFileSync(resolved);
    const pdfParse = typeof lib === 'function' ? lib
      : typeof lib.default === 'function' ? lib.default
      : null;
    if (!pdfParse) throw new Error(
      'pdf-parse export is not callable. Run: npm install pdf-parse@1.1.1'
    );
    const data = await pdfParse(buffer);
    return data.text;
  }

  return fs.readFileSync(resolved, 'utf-8');
}

export async function fetchFromFile(filePath: string): Promise<QARequirement> {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }

  const ext = path.extname(resolved).toLowerCase();
  const rawBody = await extractText(resolved, ext);
  const filename = path.basename(resolved, ext);
  const issueId = filename
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Title: first non-empty, non-comment line (strip leading #)
  const title =
    rawBody
      .split('\n')
      .find((l) => l.trim() && !l.startsWith('<!--'))
      ?.replace(/^#+\s*/, '')
      .trim() || filename;

  return {
    source: 'file',
    issueId,
    title,
    issueLink: resolved,
    summary: parseSummary(rawBody),
    acceptanceCriteria: parseAcceptanceCriteria(rawBody),
    testUrls: parseTestUrls(rawBody),
    credentials: parseCredentials(rawBody),
    apiEndpoints: parseApiEndpoints(rawBody),
    priority: parsePriority(rawBody),
    rawBody,
  };
}
