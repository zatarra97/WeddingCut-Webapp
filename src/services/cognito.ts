import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  ISignUpResult
} from 'amazon-cognito-identity-js';
import { LOCAL_STORAGE_KEYS } from '../constants';

const poolData = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID
};

const userPool = new CognitoUserPool(poolData);

export interface SignUpParams {
  email: string;
  password: string;
  /** Nome completo (attributo Cognito: name) */
  nomeCompleto: string;
  /** Telefono in formato E.164 (es. +393331234567) */
  telefono: string;
}

export interface SignInParams {
  email: string;
  password: string;
}

class CognitoService {
  async signUp({ email, password, nomeCompleto, telefono }: SignUpParams): Promise<ISignUpResult> {
    const attributeList = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
      new CognitoUserAttribute({ Name: 'name', Value: nomeCompleto }),
      new CognitoUserAttribute({ Name: 'phone_number', Value: telefono })
    ];

    return new Promise((resolve, reject) => {
      userPool.signUp(email, password, attributeList, [], (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result!);
      });
    });
  }

  /** Conferma la registrazione con il codice inviato per email. */
  async confirmSignUp(username: string, code: string): Promise<void> {
    const userData = { Username: username, Pool: userPool };
    const cognitoUser = new CognitoUser(userData);
    return new Promise((resolve, reject) => {
      cognitoUser.confirmRegistration(code, true, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async signIn({ email, password }: SignInParams): Promise<CognitoUser> {
    const authenticationDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    const userData = {
      Username: email,
      Pool: userPool
    };

    const cognitoUser = new CognitoUser(userData);

    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: () => {
          resolve(cognitoUser);
        },
        onFailure: (err) => {
          reject(err);
        }
      });
    });
  }

  async signOut(): Promise<void> {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
      // Pulisci anche i token dal localStorage
      localStorage.removeItem(LOCAL_STORAGE_KEYS.JWT_TOKEN);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.ID_TOKEN);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.USER_ROLE);
    }
  }

  getCurrentUser(): CognitoUser | null {
    return userPool.getCurrentUser();
  }

  async getSession(): Promise<any> {
    const cognitoUser = userPool.getCurrentUser();

    return new Promise((resolve, reject) => {
      if (!cognitoUser) {
        reject(new Error('No user found'));
        return;
      }

      cognitoUser.getSession((err: any, session: any) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(session);
      });
    });
  }

  // Nuovo metodo per verificare se l'utente è autenticato
  async isAuthenticated(): Promise<boolean> {
    try {
      const session = await this.getSession();
      return session.isValid();
    } catch {
      return false;
    }
  }

  // Metodo per ottenere i token dalla sessione corrente
  async getTokens(): Promise<{ idToken: string; accessToken: string; refreshToken: string } | null> {
    try {
      const session = await this.getSession();
      if (session.isValid()) {
        return {
          idToken: session.getIdToken().getJwtToken(),
          accessToken: session.getAccessToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken()
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  // Metodo per decodificare il payload del token ID
  getTokenPayload(token: string): any {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }
  }


}

export const cognitoService = new CognitoService(); 