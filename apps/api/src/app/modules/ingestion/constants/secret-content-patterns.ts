// Every quantifier is bounded or anchored on a literal prefix, so scanning stays linear on hostile input.
export const SECRET_CONTENT_PATTERNS: readonly RegExp[] = [
  /-----BEGIN (?:[A-Z]{2,10} ){0,3}PRIVATE KEY(?: BLOCK)?-----/,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  /\baws_secret_access_key\b\s{0,5}[:=]\s{0,5}["']?[A-Za-z0-9/+=]{40}/i,
  /\bgh[pousr]_[A-Za-z0-9]{36,255}/,
  /\bgithub_pat_[A-Za-z0-9_]{22,255}/,
  /\bglpat-[0-9A-Za-z_-]{20,255}/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,255}/,
  /\bAIza[0-9A-Za-z_-]{35}/,
  /\b[sr]k_live_[0-9A-Za-z]{16,255}/,
  /\beyJ[A-Za-z0-9_-]{8,2048}\.eyJ[A-Za-z0-9_-]{8,2048}\.[A-Za-z0-9_-]{8,2048}/,
  // Credentials embedded in a URL: scheme://user:password@host
  /\b[a-z][a-z0-9+.-]{1,20}:\/\/[^\s:@/'"]{1,64}:[^\s@/'"]{3,64}@/i,
  // A secret-like name assigned a quoted literal of at least 8 characters
  /(?:password|passwd|pwd|secret|token|api[_-]?key|private[_-]?key|access[_-]?key)[\w.-]{0,30}["']?\s{0,5}[:=]>?\s{0,5}["'`][^"'`\s]{8,}["'`]/i,
  // Unquoted shell, Dockerfile or Makefile style: [export|ENV|ARG] SOME_TOKEN=value; the value must look like a token, not a $variable or an expression
  /^[ \t]*(?:(?:export|ENV|ARG)[ \t]+)?[A-Z0-9_]{0,41}(?:PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|ACCESS_KEY)[A-Z0-9_]{0,20}[ \t]*=[ \t]*(?=[A-Za-z0-9+/=_-]{0,100}[A-Za-z])[A-Za-z0-9+/=_-]{8,}/m,
];
