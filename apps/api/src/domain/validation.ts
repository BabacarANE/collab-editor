import { ValidationError } from './errors'

export const LIMITS = {
  title: 255,
  comment: 5000,
  passwordMin: 8,
  passwordMax: 128
} as const

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function requireString(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new ValidationError(message)
  return value
}

// Titre facultatif : chaîne de longueur bornée, « Sans titre » si vide
export function normalizeTitle(value: unknown, { required = false } = {}): string {
  if (value === undefined && !required) return 'Sans titre'
  if (typeof value !== 'string' || value.length > LIMITS.title) throw new ValidationError('Titre invalide')
  return value.trim() || 'Sans titre'
}

export function normalizeEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!EMAIL_RE.test(email)) throw new ValidationError('Email invalide')
  return email
}

export function validatePassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < LIMITS.passwordMin || value.length > LIMITS.passwordMax) {
    throw new ValidationError(`Le mot de passe doit contenir entre ${LIMITS.passwordMin} et ${LIMITS.passwordMax} caractères`)
  }
  return value
}
