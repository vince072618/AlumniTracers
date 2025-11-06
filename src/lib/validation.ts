// Lightweight email validation and typo suggestions for common providers

export type EmailValidationResult = {
  valid: boolean;
  reason?: string;
  suggestion?: string; // suggested corrected email (full address)
};

const COMMON_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'aol.com',
  'msn.com',
  'proton.me',
  'yahoo.com.ph',
  'gmail.com.ph',
];

// Simple, practical email regex (not RFC-perfect, but strict enough for UI)
const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

function levenshtein(a: string, b: string, maxDistance = 2): number {
  // Early exits
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > maxDistance) return maxDistance + 1;

  const dp = new Array(lb + 1).fill(0);
  for (let j = 0; j <= lb; j++) dp[j] = j;
  for (let i = 1; i <= la; i++) {
    let prev = i - 1;
    dp[0] = i;
    let minInRow = dp[0];
    for (let j = 1; j <= lb; j++) {
      const temp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1, // deletion
        dp[j - 1] + 1, // insertion
        prev + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
      );
      prev = temp;
      if (dp[j] < minInRow) minInRow = dp[j];
    }
    if (minInRow > maxDistance) return maxDistance + 1; // prune
  }
  return dp[lb];
}

function sanitize(email: string): string {
  return email.trim();
}

function hasReasonableDomain(domain: string): boolean {
  // must contain at least one dot, no leading/trailing dot or hyphen, no consecutive dots
  if (!domain.includes('.')) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  if (domain.startsWith('-') || domain.endsWith('-')) return false;
  if (domain.includes('..')) return false;
  const parts = domain.split('.');
  const tld = parts[parts.length - 1];
  // TLD must be alphabetic and length 2..24 (practical)
  if (!/^[A-Za-z]{2,24}$/.test(tld)) return false;
  // Each label must be non-empty, start/end with alnum, and can contain hyphens
  for (const label of parts) {
    if (!label) return false;
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label)) return false;
  }
  return true;
}

function suggestDomain(domain: string): string | undefined {
  const lower = domain.toLowerCase();
  let best: { d: string; dist: number } | null = null;
  for (const candidate of COMMON_DOMAINS) {
    const dist = levenshtein(lower, candidate, 2);
    if (dist <= 2 && (!best || dist < best.dist)) {
      best = { d: candidate, dist };
      if (dist === 0) break;
    }
  }

  // Special-case very common TLD typos
  if (!best) {
    if (/gmail\.(co|con|vom|c0m)$/i.test(lower)) return 'gmail.com';
    if (/yahoo\.(co|con)$/i.test(lower)) return 'yahoo.com';
    if (/outlook\.(co|con)$/i.test(lower)) return 'outlook.com';
    if (/hotmail\.(co|con)$/i.test(lower)) return 'hotmail.com';
  }

  return best?.d;
}

export function validateEmail(emailInput: string): EmailValidationResult {
  const email = sanitize(emailInput);
  if (!email) return { valid: false, reason: 'Email is required' };

  if (!BASIC_EMAIL_REGEX.test(email)) {
    return { valid: false, reason: 'Please enter a valid email address' };
  }

  const atIndex = email.lastIndexOf('@');
  if (atIndex < 1 || atIndex === email.length - 1) {
    return { valid: false, reason: 'Email must include a valid domain' };
  }

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  // local part simple sanity (no spaces, no consecutive dots)
  if (/\s/.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    return { valid: false, reason: 'Local part of email is invalid' };
  }

  if (!hasReasonableDomain(domain)) {
    const suggestionDomain = suggestDomain(domain);
    return {
      valid: false,
      reason: 'Email domain looks incorrect',
      suggestion: suggestionDomain ? `${local}@${suggestionDomain}` : undefined,
    };
  }

  // Even if domain is structurally fine, offer typo suggestions for common providers
  const suggested = suggestDomain(domain);
  if (suggested && suggested !== domain.toLowerCase()) {
    return { valid: true, suggestion: `${local}@${suggested}` };
  }

  return { valid: true };
}
