// Gruppi Cognito
export const COGNITO_GROUPS = {
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer'
} as const;

// Ruoli utente mappati
export const USER_ROLES = {
  ADMIN: 'Admin',
  EDITOR: 'Editor',
  VIEWER: 'Viewer'
} as const;

// Array di tutti i gruppi validi per controlli
export const VALID_COGNITO_GROUPS = Object.values(COGNITO_GROUPS);

// Mapping da gruppo Cognito a ruolo utente
export const GROUP_TO_ROLE_MAP = {
  [COGNITO_GROUPS.ADMIN]: USER_ROLES.ADMIN,
  [COGNITO_GROUPS.EDITOR]: USER_ROLES.EDITOR,
  [COGNITO_GROUPS.VIEWER]: USER_ROLES.VIEWER
} as const;

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