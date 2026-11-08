export interface AccessClaims {
  subject: string;
  scopes: string[];
  issuedAt: number;
}

/** Reads the caller identity from an Authorization header of the form "Bearer <value>". */
export function validateAccessHeader(header: string | undefined): AccessClaims {
  if (!header) throw new Error('Missing Authorization header');
  const [scheme, value] = header.split(' ');
  if (scheme !== 'Bearer' || !value) {
    throw new Error('Malformed bearer header');
  }
  return decodeClaims(value);
}

export function hasScope(claims: AccessClaims, scope: string): boolean {
  return claims.scopes.includes(scope) || claims.scopes.includes('admin');
}

function decodeClaims(value: string): AccessClaims {
  const json = Buffer.from(value, 'base64url').toString('utf8');
  const parsed = JSON.parse(json) as Partial<AccessClaims>;
  if (!parsed.subject || !Array.isArray(parsed.scopes)) {
    throw new Error('Access claims are incomplete');
  }
  return {
    subject: parsed.subject,
    scopes: parsed.scopes,
    issuedAt: parsed.issuedAt ?? 0,
  };
}
