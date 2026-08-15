/**
 * fetch-etherscan-labels.ts
 *
 * Reads a JSON file of Ethereum addresses, fetches their Etherscan mainnet
 * labels (name tags) via the Etherscan API, then:
 *   1. Saves an enriched JSON file  → output/labeled-addresses.json
 *   2. Saves an Excel workbook      → output/labeled-addresses.xlsx
 *
 * Usage:
 *   npx ts-node fetch-etherscan-labels.ts [--input addresses.json] [--output output/]
 *
 * Environment variables (set in .env or export in shell):
 *   ETHERSCAN_API_KEY   – your Etherscan API key (required)
 *
 * Input JSON schema (array):
 *   [{ "address": "0x...", "note": "optional free-text" }, ...]
 *   OR simply: ["0x...", "0x..."]
 */

// Disable SSL verification for corporate proxies with self-signed certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import https from 'https';
import ExcelJS from 'exceljs';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '.env') });

// Shared HTTPS agent with SSL verification disabled
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// ─── Types ────────────────────────────────────────────────────────────────────

interface InputEntry {
  address: string;
  note?: string;
}

interface LabeledEntry {
  address: string;
  note: string;
  etherscanLabel: string;
  contractName: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: string;
  tokenType: string;
  website: string;
  twitter: string;
  isContract: boolean;
  fetchedAt: string;
  error?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ETHERSCAN_API_BASE = 'https://api.etherscan.io/api';
const RATE_LIMIT_MS = 250; // 4 req/s well within free-tier 5 req/s limit
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// ─── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs(): { inputFile: string; outputDir: string } {
  const args = process.argv.slice(2);
  let inputFile = path.resolve(__dirname, 'addresses.json');
  let outputDir = path.resolve(__dirname, 'output');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1])
      inputFile = path.resolve(args[i + 1]);
    if (args[i] === '--output' && args[i + 1])
      outputDir = path.resolve(args[i + 1]);
  }

  return { inputFile, outputDir };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAddress(raw: string): string {
  return raw.trim().toLowerCase();
}

function loadAddresses(filePath: string): InputEntry[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(raw)) throw new Error('Input JSON must be an array.');

  return raw.map((item: unknown) => {
    if (typeof item === 'string') return { address: item, note: '' };
    if (typeof item === 'object' && item !== null && 'address' in item) {
      return {
        address: (item as InputEntry).address,
        note: (item as InputEntry).note ?? '',
      };
    }
    throw new Error(`Invalid entry: ${JSON.stringify(item)}`);
  });
}

// ─── Etherscan API calls ──────────────────────────────────────────────────────

/**
 * Fetch contract ABI info – used to determine if address is a contract and
 * grab its verified source name.
 */
async function fetchContractInfo(
  address: string,
  apiKey: string,
): Promise<{ contractName: string; isContract: boolean }> {
  const url = `${ETHERSCAN_API_BASE}?module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;
  const res = await axios.get(url, { timeout: 10_000, httpsAgent });
  const data = res.data;

  if (
    data.status === '1' &&
    Array.isArray(data.result) &&
    data.result.length > 0
  ) {
    const info = data.result[0];
    const contractName: string = info.ContractName || '';
    const isContract =
      contractName !== '' || info.ABI !== 'Contract source code not verified';
    return { contractName, isContract };
  }
  return { contractName: '', isContract: false };
}

/**
 * Fetch ERC-20 token info (name, symbol, decimals, type).
 */
async function fetchTokenInfo(
  address: string,
  apiKey: string,
): Promise<{
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: string;
  tokenType: string;
}> {
  const url = `${ETHERSCAN_API_BASE}?module=token&action=tokeninfo&contractaddress=${address}&apikey=${apiKey}`;
  const res = await axios.get(url, { timeout: 10_000, httpsAgent });
  const data = res.data;

  if (
    data.status === '1' &&
    Array.isArray(data.result) &&
    data.result.length > 0
  ) {
    const t = data.result[0];
    return {
      tokenName: t.tokenName ?? '',
      tokenSymbol: t.symbol ?? '',
      tokenDecimals: t.divisor ?? '',
      tokenType: t.tokenType ?? '',
    };
  }
  return { tokenName: '', tokenSymbol: '', tokenDecimals: '', tokenType: '' };
}

/**
 * Fetch account label via the "account" module.
 * Etherscan does not expose a dedicated "label" endpoint on the free tier,
 * so we scrape the name tag from the address page HTML as a fallback,
 * and primarily rely on the account/txlist summary + token info.
 *
 * Strategy:
 *   1. Try token info (best for ERC-20 tokens)
 *   2. Try contract source code name
 *   3. Scrape HTML name-tag from the address page (no API key needed)
 */
async function scrapeNameTag(address: string): Promise<string> {
  try {
    const url = `https://etherscan.io/address/${address}`;
    const res = await axios.get(url, {
      timeout: 15_000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    const html: string = res.data;

    // Pattern 1: <span id="contractCopyAddress" ... data-original-title="...">
    const nameTagMatch =
      html.match(
        /Public Name Tag<\/span>\s*<\/dt>\s*<dd[^>]*>\s*<span[^>]*>([^<]+)<\/span>/,
      ) ||
      html.match(/data-original-title="([^"]+)".*?Public Name Tag/) ||
      html.match(/Public Name Tag.*?<span[^>]*title="([^"]+)"/) ||
      html.match(/<title>\s*([^|]+)\s*\|/) ||
      null;

    if (nameTagMatch) {
      const candidate = nameTagMatch[1].trim();
      // Filter out generic page titles
      if (
        !candidate.includes('Etherscan') &&
        !candidate.toLowerCase().includes('address') &&
        candidate.length > 0
      ) {
        return candidate;
      }
    }

    // Pattern 2: look for "spanNameTag" id
    const spanMatch = html.match(/id="spanNameTag"[^>]*>([^<]+)</);
    if (spanMatch) return spanMatch[1].trim();

    // Pattern 3: look for "Public Name Tag" followed by content
    const publicTagMatch = html.match(
      /Public Name Tag[\s\S]{0,200}?<span[^>]*>([\w\s\-\.]+)<\/span>/,
    );
    if (publicTagMatch) {
      const tag = publicTagMatch[1].trim();
      if (tag && tag.length < 100) return tag;
    }

    return '';
  } catch {
    return '';
  }
}

// ─── Core fetch with retry ────────────────────────────────────────────────────

async function fetchLabelWithRetry(
  entry: InputEntry,
  apiKey: string,
  index: number,
  total: number,
): Promise<LabeledEntry> {
  const address = normalizeAddress(entry.address);
  const fetchedAt = new Date().toISOString();

  console.log(`[${index + 1}/${total}] Processing ${address}…`);

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      // Run contract info + token info in parallel
      const [contractInfo, tokenInfo] = await Promise.all([
        fetchContractInfo(address, apiKey),
        fetchTokenInfo(address, apiKey),
      ]);

      await sleep(RATE_LIMIT_MS);

      // Build best available label
      let etherscanLabel =
        tokenInfo.tokenName || contractInfo.contractName || '';

      // If still no label, try HTML scrape
      if (!etherscanLabel) {
        etherscanLabel = await scrapeNameTag(address);
        await sleep(RATE_LIMIT_MS);
      }

      const result: LabeledEntry = {
        address,
        note: entry.note ?? '',
        etherscanLabel,
        contractName: contractInfo.contractName,
        tokenName: tokenInfo.tokenName,
        tokenSymbol: tokenInfo.tokenSymbol,
        tokenDecimals: tokenInfo.tokenDecimals,
        tokenType: tokenInfo.tokenType,
        website: '',
        twitter: '',
        isContract: contractInfo.isContract,
        fetchedAt,
      };

      const status = etherscanLabel
        ? `✓ "${etherscanLabel}"`
        : '⚠ No label found';
      console.log(`    ${status}`);

      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `    Attempt ${attempt}/${RETRY_ATTEMPTS} failed: ${message}`,
      );
      if (attempt < RETRY_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
      else {
        return {
          address,
          note: entry.note ?? '',
          etherscanLabel: '',
          contractName: '',
          tokenName: '',
          tokenSymbol: '',
          tokenDecimals: '',
          tokenType: '',
          website: '',
          twitter: '',
          isContract: false,
          fetchedAt,
          error: message,
        };
      }
    }
  }

  // Unreachable but TS needs it
  throw new Error('Unexpected exit from retry loop');
}

// ─── Output writers ───────────────────────────────────────────────────────────

function saveJson(entries: LabeledEntry[], outputDir: string): void {
  const filePath = path.join(outputDir, 'labeled-addresses.json');
  fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf8');
  console.log(`\n📄 JSON saved → ${filePath}`);
}

async function saveExcel(
  entries: LabeledEntry[],
  outputDir: string,
): Promise<void> {
  const filePath = path.join(outputDir, 'labeled-addresses.xlsx');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'fetch-etherscan-labels';
  wb.created = new Date();

  const ws = wb.addWorksheet('Etherscan Labels');

  // ── Column definitions ──
  ws.columns = [
    { header: 'Address', key: 'address', width: 45 },
    { header: 'Etherscan Label', key: 'etherscanLabel', width: 35 },
    { header: 'Token Name', key: 'tokenName', width: 25 },
    { header: 'Token Symbol', key: 'tokenSymbol', width: 15 },
    { header: 'Token Decimals', key: 'tokenDecimals', width: 16 },
    { header: 'Token Type', key: 'tokenType', width: 12 },
    { header: 'Contract Name', key: 'contractName', width: 30 },
    { header: 'Is Contract', key: 'isContract', width: 13 },
    { header: 'Note', key: 'note', width: 30 },
    { header: 'Error', key: 'error', width: 40 },
    { header: 'Fetched At', key: 'fetchedAt', width: 25 },
  ];

  // ── Header style ──
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A5F' },
    };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF4A90D9' } },
    };
  });
  headerRow.height = 22;

  // ── Data rows ──
  entries.forEach((entry, idx) => {
    const row = ws.addRow({
      address: entry.address,
      etherscanLabel: entry.etherscanLabel,
      tokenName: entry.tokenName,
      tokenSymbol: entry.tokenSymbol,
      tokenDecimals: entry.tokenDecimals,
      tokenType: entry.tokenType,
      contractName: entry.contractName,
      isContract: entry.isContract ? 'Yes' : 'No',
      note: entry.note,
      error: entry.error ?? '',
      fetchedAt: entry.fetchedAt,
    });

    const isEven = idx % 2 === 0;
    const bgColor = isEven ? 'FFF0F4FA' : 'FFFFFFFF';

    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor },
      };
      cell.alignment = { vertical: 'middle', wrapText: false };
      cell.font = { size: 10 };
    });

    // Highlight rows with errors
    if (entry.error) {
      row.getCell('error').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFCE4E4' },
      };
      row.getCell('error').font = { color: { argb: 'FFCC0000' }, size: 10 };
    }

    // Highlight rows with a found label
    if (entry.etherscanLabel) {
      row.getCell('etherscanLabel').font = {
        bold: true,
        color: { argb: 'FF0A5C36' },
        size: 10,
      };
    }

    row.height = 18;
  });

  // ── Auto-filter ──
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: ws.columns.length },
  };

  // ── Freeze top row ──
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // ── Summary sheet ──
  const summary = wb.addWorksheet('Summary');
  summary.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
  ];

  const total = entries.length;
  const labeled = entries.filter((e) => e.etherscanLabel).length;
  const contracts = entries.filter((e) => e.isContract).length;
  const tokens = entries.filter((e) => e.tokenName).length;
  const errors = entries.filter((e) => e.error).length;

  const summaryData = [
    { metric: 'Total Addresses', value: total },
    { metric: 'Labels Found', value: labeled },
    { metric: 'Labels Not Found', value: total - labeled },
    { metric: 'Contracts Identified', value: contracts },
    { metric: 'Tokens Identified', value: tokens },
    { metric: 'Errors', value: errors },
    { metric: 'Coverage %', value: `${((labeled / total) * 100).toFixed(1)}%` },
    { metric: 'Generated At', value: new Date().toISOString() },
  ];

  // Summary header style
  const sumHeader = summary.getRow(1);
  summary.addRows(summaryData);
  sumHeader.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A5F' },
    };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
  });
  summary.getRows(2, summaryData.length + 1)?.forEach((row, i) => {
    row.getCell('metric').font = { bold: true };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: i % 2 === 0 ? 'FFF0F4FA' : 'FFFFFFFF' },
    };
  });

  await wb.xlsx.writeFile(filePath);
  console.log(`📊 Excel saved → ${filePath}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { inputFile, outputDir } = parseArgs();

  // Validate API key
  const apiKey = process.env.ETHERSCAN_API_KEY ?? '';
  if (!apiKey) {
    console.error(
      '❌  ETHERSCAN_API_KEY is not set.\n' +
        '    Set it in scripts/.env or export ETHERSCAN_API_KEY=<your_key>',
    );
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log('  Etherscan Mainnet Label Fetcher');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Input  : ${inputFile}`);
  console.log(`  Output : ${outputDir}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Load addresses
  const addresses = loadAddresses(inputFile);
  console.log(`Loaded ${addresses.length} addresses.\n`);

  // Ensure output directory
  fs.mkdirSync(outputDir, { recursive: true });

  // Fetch labels sequentially to respect rate limits
  const results: LabeledEntry[] = [];
  for (let i = 0; i < addresses.length; i++) {
    const result = await fetchLabelWithRetry(
      addresses[i],
      apiKey,
      i,
      addresses.length,
    );
    results.push(result);
    if (i < addresses.length - 1) await sleep(RATE_LIMIT_MS);
  }

  // Save outputs
  console.log('\n─── Saving outputs ───────────────────────────────────');
  saveJson(results, outputDir);
  await saveExcel(results, outputDir);

  // Print summary table
  const labeled = results.filter((r) => r.etherscanLabel).length;
  const errors = results.filter((r) => r.error).length;

  console.log('\n─── Summary ──────────────────────────────────────────');
  console.log(`  Total addresses  : ${results.length}`);
  console.log(`  Labels found     : ${labeled}`);
  console.log(`  Labels not found : ${results.length - labeled - errors}`);
  console.log(`  Errors           : ${errors}`);
  console.log(
    `  Coverage         : ${((labeled / results.length) * 100).toFixed(1)}%`,
  );
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
