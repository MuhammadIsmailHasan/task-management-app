const USERNAME_RE = /^[a-z0-9_.]{3,30}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;
export const EMAIL_MAX = 255;

export function isUsername(value: string): boolean {
  return USERNAME_RE.test(value);
}

export function isEmail(value: string): boolean {
  return value.length <= EMAIL_MAX && EMAIL_RE.test(value);
}

export type IdentifierKind = "email" | "username";

export function classifyIdentifier(raw: string): { kind: IdentifierKind; value: string } | null {
  const value = raw.trim().toLowerCase();
  if (value.includes("@")) return isEmail(value) ? { kind: "email", value } : null;
  return isUsername(value) ? { kind: "username", value } : null;
}

export const PASSWORD_MIN = 8;

export type AuthMode = "login" | "register";
export interface AuthValues {
  full_name: string;
  identifier: string;
  username: string;
  email: string;
  password: string;
}

export function validateAuth(mode: AuthMode, v: AuthValues): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  if (mode === "login") {
    if (!classifyIdentifier(v.identifier)) {
      errors.identifier = [v.identifier.includes("@") ? "Enter a valid email address." : "Enter a valid username or email."];
    }
    if (!v.password) errors.password = ["password is required"];
    return errors;
  }
  if (!v.full_name.trim()) errors.full_name = ["Full name is required."];
  if (!isUsername(v.username.trim().toLowerCase())) errors.username = ["Use 3 to 30 letters, numbers, dots or underscores."];
  if (!isEmail(v.email.trim().toLowerCase())) errors.email = ["Enter a valid email address."];
  if (v.password.length < PASSWORD_MIN) errors.password = [`Use at least ${PASSWORD_MIN} characters.`];
  return errors;
}

export const AUTH_FIELD_ORDER = ["full_name", "identifier", "username", "email", "password"] as const;
