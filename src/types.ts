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
