// Gruppi Cognito
export const COGNITO_GROUPS = {
  ADMIN: 'Admin',
} as const;

// Ruoli utente
export const USER_ROLES = {
  ADMIN: 'Admin',
  USER: 'User',
} as const;

// Determina il ruolo dai gruppi Cognito del JWT.
// Nessun gruppo (utente normale) → User. Gruppo Admin → Admin.
export function resolveRole(groups: string[]): string {
  return groups.includes(COGNITO_GROUPS.ADMIN) ? USER_ROLES.ADMIN : USER_ROLES.USER;
}

// Route di default per ruolo
export const DEFAULT_ROUTE_BY_ROLE: Record<string, string> = {
  [USER_ROLES.ADMIN]: '/admin',
  [USER_ROLES.USER]: '/user/dashboard',
};

// Chiavi per localStorage
export const LOCAL_STORAGE_KEYS = {
  JWT_TOKEN: 'jwtToken',
  ID_TOKEN: 'idToken',
  ACCESS_TOKEN: 'accessToken',
  USER_ROLE: 'userRole',
  SIDEBAR_EXPANDED: 'sidebarExpanded',
  DEMO_MODE: 'demoMode',
  USER_EMAIL: 'userEmail',
  RETURN_URL: 'returnUrl'
} as const;
