// Abstractions dont dépendent les services (implémentations dans infrastructure/)

export interface TokenService {
  signAccess(userId: string): string
  signRefresh(userId: string): string
  verify(token: string): { userId: string; type?: string }
}

export interface PasswordHasher {
  hash(password: string): Promise<string>
  // Doit prendre un temps comparable que le hash soit fourni ou non
  compare(password: string, hash: string | null): Promise<boolean>
}

export interface PdfRenderer {
  render(html: string): Promise<Buffer>
}
