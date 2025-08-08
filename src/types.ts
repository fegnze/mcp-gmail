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
  cc?: string | undefined; // 抄送地址，支持单个邮箱或逗号分隔的多个邮箱
  // Google OAuth2 credentials - required for authentication
  client_id: string;
  client_secret: string;
  redirect_uri?: string | undefined; // Optional, will use default if not provided
}

export interface AuthUrlOptions {
  // Google OAuth2 credentials - required for authentication
  client_id: string;
  client_secret: string;
  redirect_uri?: string | undefined; // Optional, will use default if not provided
}

export interface AuthResult {
  authUrl?: string;
  token?: TokenData;
  needsAuth: boolean;
}

// Google OAuth2 constants
export const GOOGLE_OAUTH_CONSTANTS = {
  AUTH_URI: 'https://accounts.google.com/o/oauth2/v2/auth',
  TOKEN_URI: 'https://oauth2.googleapis.com/token',
  DEFAULT_REDIRECT_URI: 'http://localhost:8080/callback',
  SCOPES: [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
  ],
  RESPONSE_TYPE: 'code',
  ACCESS_TYPE: 'offline',
  CALLBACK_PORT: 8080,
} as const;
