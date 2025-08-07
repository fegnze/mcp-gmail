import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs/promises';
import {
  GoogleCredentials,
  TokenData,
  AuthResult,
  GOOGLE_OAUTH_CONSTANTS,
} from './types';

export class AuthManager {
  private oauth2Client: OAuth2Client;
  private tokenPath: string;
  private credentialsPath: string;
  private credentials?: GoogleCredentials;

  constructor(
    credentialsPath = 'config/credentials.json',
    tokenPath = 'token.json'
  ) {
    this.credentialsPath = credentialsPath;
    this.tokenPath = tokenPath;
    this.oauth2Client = new google.auth.OAuth2();
  }

  async initialize(): Promise<void> {
    await this.loadCredentials();
    this.setupOAuth2Client();
  }

  private async loadCredentials(): Promise<void> {
    try {
      const credentialsData = await fs.readFile(this.credentialsPath, 'utf-8');
      const parsed = JSON.parse(credentialsData);

      if (parsed.web) {
        this.credentials = {
          client_id: parsed.web.client_id,
          client_secret: parsed.web.client_secret,
          redirect_uri:
            parsed.web.redirect_uris?.[0] ||
            GOOGLE_OAUTH_CONSTANTS.DEFAULT_REDIRECT_URI,
        };
      } else if (parsed.installed) {
        this.credentials = {
          client_id: parsed.installed.client_id,
          client_secret: parsed.installed.client_secret,
          redirect_uri:
            parsed.installed.redirect_uris?.[0] ||
            GOOGLE_OAUTH_CONSTANTS.DEFAULT_INSTALLED_REDIRECT_URI,
        };
      } else {
        throw new Error('Invalid credentials format');
      }
    } catch (error) {
      console.warn('Credentials file not found, using environment variables');
      this.credentials = {
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri:
          process.env.GOOGLE_REDIRECT_URI ||
          GOOGLE_OAUTH_CONSTANTS.DEFAULT_REDIRECT_URI,
      };

      if (!this.credentials.client_id || !this.credentials.client_secret) {
        throw new Error(
          'Google credentials not found in file or environment variables'
        );
      }
    }
  }

  private setupOAuth2Client(): void {
    if (!this.credentials) {
      throw new Error('Credentials not loaded');
    }

    this.oauth2Client = new google.auth.OAuth2(
      this.credentials.client_id,
      this.credentials.client_secret,
      this.credentials.redirect_uri
    );
  }

  generateAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: GOOGLE_OAUTH_CONSTANTS.ACCESS_TYPE,
      scope: [...GOOGLE_OAUTH_CONSTANTS.SCOPES],
      prompt: 'consent',
      response_type: GOOGLE_OAUTH_CONSTANTS.RESPONSE_TYPE,
    });
  }

  async handleAuthCallback(code: string): Promise<TokenData> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);

      const tokenData: TokenData = {
        access_token: tokens.access_token!,
        refresh_token: tokens.refresh_token || undefined,
        token_type: tokens.token_type || 'Bearer',
        expires_in: tokens.expiry_date
          ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
          : undefined,
        expires_at: tokens.expiry_date || undefined,
        scope: tokens.scope || undefined,
      };

      await this.saveToken(tokenData);
      this.oauth2Client.setCredentials(tokens);

      return tokenData;
    } catch (error) {
      throw new Error(`Failed to get access token: ${error}`);
    }
  }

  async loadToken(): Promise<TokenData | null> {
    try {
      const tokenData = await fs.readFile(this.tokenPath, 'utf-8');
      return JSON.parse(tokenData);
    } catch {
      return null;
    }
  }

  async saveToken(tokenData: TokenData): Promise<void> {
    await fs.writeFile(this.tokenPath, JSON.stringify(tokenData, null, 2));
  }

  async refreshToken(): Promise<TokenData> {
    const currentToken = await this.loadToken();
    if (!currentToken?.refresh_token) {
      throw new Error('No refresh token available');
    }

    this.oauth2Client.setCredentials({
      refresh_token: currentToken.refresh_token,
    });

    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      const tokenData: TokenData = {
        access_token: credentials.access_token!,
        refresh_token: credentials.refresh_token || currentToken.refresh_token,
        token_type: credentials.token_type || 'Bearer',
        expires_in: credentials.expiry_date
          ? Math.floor((credentials.expiry_date - Date.now()) / 1000)
          : undefined,
        expires_at: credentials.expiry_date || undefined,
        scope: credentials.scope || undefined,
      };

      await this.saveToken(tokenData);
      return tokenData;
    } catch (error) {
      throw new Error(`Failed to refresh token: ${error}`);
    }
  }

  isTokenExpired(token: TokenData): boolean {
    if (!token.expires_at) {
      return false;
    }
    return Date.now() >= token.expires_at - 60000; // 1 minute buffer
  }

  async ensureValidToken(): Promise<AuthResult> {
    const currentToken = await this.loadToken();

    if (!currentToken) {
      return {
        authUrl: this.generateAuthUrl(),
        needsAuth: true,
      };
    }

    if (this.isTokenExpired(currentToken)) {
      try {
        const refreshedToken = await this.refreshToken();
        this.oauth2Client.setCredentials({
          access_token: refreshedToken.access_token,
          refresh_token: refreshedToken.refresh_token || null,
        });

        return {
          token: refreshedToken,
          needsAuth: false,
        };
      } catch (error) {
        console.warn('Failed to refresh token, need re-authentication:', error);
        return {
          authUrl: this.generateAuthUrl(),
          needsAuth: true,
        };
      }
    }

    this.oauth2Client.setCredentials({
      access_token: currentToken.access_token,
      refresh_token: currentToken.refresh_token || null,
    });

    return {
      token: currentToken,
      needsAuth: false,
    };
  }

  getOAuth2Client(): OAuth2Client {
    return this.oauth2Client;
  }
}
