export type PasswordChecks = { length: boolean; upper: boolean; lower: boolean; number: boolean; symbol: boolean };

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function getPasswordChecks(password: string): PasswordChecks {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
}

export function isStrongPassword(password: string) {
  return Object.values(getPasswordChecks(password)).every(Boolean);
}
