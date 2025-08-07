export interface GoogleCredentials {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}

export interface TokenData {
  access_token: string;
  refresh_token?: string | undefined;
  token_type: string;
  expires_in?: number | undefined;
  expires_at?: number | undefined;
  scope?: string | undefined;
}

export interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
}

export interface AuthResult {
  authUrl?: string;
  token?: TokenData;
  needsAuth: boolean;
}

// Google OAuth2 constants
export const GOOGLE_OAUTH_CONSTANTS = {
  AUTH_URI: 'https://accounts.google.com/o/oauth2/auth',
  TOKEN_URI: 'https://oauth2.googleapis.com/token',
  DEFAULT_REDIRECT_URI: 'https://developers.google.com/oauthplayground',
  DEFAULT_INSTALLED_REDIRECT_URI: 'urn:ietf:wg:oauth:2.0:oob',
  SCOPES: [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
  ],
  RESPONSE_TYPE: 'code',
  ACCESS_TYPE: 'offline',
} as const;
