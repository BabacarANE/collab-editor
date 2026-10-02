// Erreurs métier : les services les lèvent, la couche HTTP les traduit en
// statut (un nouveau cas d'erreur n'impose aucune modification des routes)
export class AppError extends Error {
  constructor(readonly statusCode: number, message: string) {
    super(message)
    this.name = new.target.name
  }
}

export class ValidationError extends AppError {
  constructor(message: string) { super(400, message) }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Non authentifié') { super(401, message) }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Accès refusé') { super(403, message) }
}

export class NotFoundError extends AppError {
  constructor(message = 'Ressource non trouvée') { super(404, message) }
}

export class ConflictError extends AppError {
  constructor(message: string) { super(409, message) }
}
