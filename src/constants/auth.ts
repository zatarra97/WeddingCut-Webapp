// Gruppi Cognito
export const COGNITO_GROUPS = {
  ADMIN: 'Admin',
  USER: 'User',
} as const;

// Ruoli utente mappati
export const USER_ROLES = {
  ADMIN: 'Admin',
  USER: 'User',
} as const;

// Array di tutti i gruppi validi per controlli
export const VALID_COGNITO_GROUPS = Object.values(COGNITO_GROUPS);

// Mapping da gruppo Cognito a ruolo utente
export const GROUP_TO_ROLE_MAP: Record<string, string> = {
  [COGNITO_GROUPS.ADMIN]: USER_ROLES.ADMIN,
  [COGNITO_GROUPS.USER]: USER_ROLES.USER,
};

// Route di default per ruolo
export const DEFAULT_ROUTE_BY_ROLE: Record<string, string> = {
  [USER_ROLES.ADMIN]: '/admin',
  [USER_ROLES.USER]: '/dashboard',
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
