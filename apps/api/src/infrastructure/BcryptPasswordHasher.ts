import bcrypt from 'bcrypt'
import type { PasswordHasher } from '../services/ports'

export class BcryptPasswordHasher implements PasswordHasher {
  // Hash factice : la comparaison s'exécute même si l'email est inconnu
  private readonly dummyHash: string

  constructor(private readonly rounds = 12) {
    this.dummyHash = bcrypt.hashSync('timing-attack-protection', rounds)
  }

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.rounds)
  }

  compare(password: string, hash: string | null): Promise<boolean> {
    return bcrypt.compare(password, hash ?? this.dummyHash).then(ok => ok && hash !== null)
  }
}
