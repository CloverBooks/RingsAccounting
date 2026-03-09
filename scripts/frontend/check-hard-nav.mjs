import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const customerSrcRoot = path.resolve(repoRoot, "apps/customer/src");

const FILE_ALLOWLIST = [
  /apps[\\/]customer[\\/]src[\\/]auth[\\/]CloverBooksAuthPages\.tsx$/,
  /apps[\\/]customer[\\/]src[\\/]bank-feed\.tsx$/,
  /apps[\\/]customer[\\/]src[\\/]dashboard[\\/]dashboard-entry\.tsx$/,
  /apps[\\/]customer[\\/]src[\\/]pages[\\/]BusinessSkipLandingPage\.tsx$/,
  /apps[\\/]customer[\\/]src[\\/]sidebar[\\/]Sidebar\.tsx$/,
];

const LINE_ALLOWLIST = [
  /backendUrl\(/,
  /googleLoginUrl/,
  /window\.location\.assign\("\/login"\)/,
  /window\.location\.assign\(href\)/,
  /window\.location\.assign\(targetUrl\)/,
  /newAccountUrl/,
];

const HARD_NAV_PATTERN = /window\.location\.(?:href|assign)|<a\s+[^>]*href=/;
const SPA_LITERAL_PATTERNS = [
  /\/(?:dashboard|login|welcome|signup|onboarding)\/?(?:[?#"'`\s)]|$)/,
  /\/companion(?:\/(?:overview|issues|proposals|tax(?:\/(?:catalog|product-rules|settings))?)?)?\/?(?:[?#"'`\s)]|$)/,
  /\/ai-companion(?:\/(?:overview|issues|proposals|tax(?:\/(?:catalog|product-rules|settings))?)?)?\/?(?:[?#"'`\s)]|$)/,
  /\/(?:invoices(?:\/list)?|expenses|receipts|customers|suppliers|products|categories|inventory)\/?(?:[?#"'`\s)]|$)/,
  /\/(?:banking(?:\/setup)?|reconciliation(?:\/report)?|reports\/(?:pl(?:-shadow)?|cashflow(?:\/print)?)|accounts|chart-of-accounts|journal|transactions|settings(?:\/(?:account|roles|team))?|bank-review|books-review|help)\/?(?:[?#"'`\s)]|$)/,
];
const DYNAMIC_SPA_PATTERNS = [
  /window\.location\.(?:href|assign)\s*=\s*urls\?\./,
  /window\.location\.(?:href|assign)\s*=\s*i\.target_url/,
  /window\.location\.(?:href|assign)\s*=\s*proposal\.target_url/,
  /window\.location\.(?:href|assign)\s*=\s*b\.url/,
  /href=\{safeUrl\(/,
];

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
      continue;
    }
    if (entry.isFile() && (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx"))) {
      yield fullPath;
    }
  }
}

function shouldSkipFile(filePath) {
  return FILE_ALLOWLIST.some((pattern) => pattern.test(filePath));
}

function shouldSkipLine(line) {
  return LINE_ALLOWLIST.some((pattern) => pattern.test(line));
}

function isSpaHardNavigation(line) {
  if (!HARD_NAV_PATTERN.test(line)) {
    return false;
  }
  if (shouldSkipLine(line)) {
    return false;
  }
  return (
    SPA_LITERAL_PATTERNS.some((pattern) => pattern.test(line)) ||
    DYNAMIC_SPA_PATTERNS.some((pattern) => pattern.test(line))
  );
}

const findings = [];

for await (const filePath of walk(customerSrcRoot)) {
  if (shouldSkipFile(filePath)) {
    continue;
  }

  const content = await fs.readFile(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (!isSpaHardNavigation(line)) {
      continue;
    }
    findings.push({
      filePath,
      lineNumber: index + 1,
      line: line.trim(),
    });
  }
}

if (findings.length > 0) {
  console.error("Hard navigation to a customer SPA route was found:");
  for (const finding of findings) {
    const relative = path.relative(repoRoot, finding.filePath);
    console.error(`- ${relative}:${finding.lineNumber} ${finding.line}`);
  }
  process.exit(1);
}

console.log("Customer SPA hard-navigation check passed.");
