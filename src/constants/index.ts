// Esporta tutte le costanti di autenticazione
export * from './auth';

// Esporta tutte le costanti delle entità
export * from './entities';

// Tipi TypeScript derivati dalle costanti (opzionale ma utile)
export type CognitoGroup = typeof import('./auth').COGNITO_GROUPS[keyof typeof import('./auth').COGNITO_GROUPS];
export type UserRole = typeof import('./auth').USER_ROLES[keyof typeof import('./auth').USER_ROLES];
export type EntityName = typeof import('./entities').ENTITIES[keyof typeof import('./entities').ENTITIES];