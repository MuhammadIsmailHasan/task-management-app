/** Identity validation; mirrors backend/app/common/validation.py (V10, Property 42). */
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

/** "email" when the lower-cased value has an @ and the email shape, "username" when it has none and matches the format, else null. */
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

/** Every invalid field of the login or register form at once, in form order (FIX-04). An empty object means the form may be sent. */
export function validateAuth(mode: AuthMode, v: AuthValues): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  if (mode === "login") {
    // No request is sent for a value that is neither a Username nor an Email (Req 1.39, 1.40).
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

/** The form order of the fields, so focus goes to the first invalid one. */
export const AUTH_FIELD_ORDER = ["full_name", "identifier", "username", "email", "password"] as const;
