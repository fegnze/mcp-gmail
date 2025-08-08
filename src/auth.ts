import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs/promises';
import path from 'path';
import {
  GoogleCredentials,
  TokenData,
  AuthResult,
  GOOGLE_OAUTH_CONSTANTS,
} from './types';
import { OAuth2CallbackServer } from './oauth-callback-server';

export class AuthManager {
  private oauth2Client: OAuth2Client;
  private tokenPath: string;
  private credentialsPath: string;
  private credentials?: GoogleCredentials;
  private callbackServer?: OAuth2CallbackServer | undefined;
  private currentCallbackUrl?: string | undefined; // 跟踪当前使用的回调URL

  constructor(
    credentialsPath = 'config/credentials.json',
    tokenPath = 'token.json'
  ) {
    // 使用项目根目录作为基础路径，而不是process.cwd()
    const projectRoot = path.dirname(__dirname); // 从dist目录回到项目根目录
    
    this.credentialsPath = path.isAbsolute(credentialsPath)
      ? credentialsPath
      : path.resolve(projectRoot, credentialsPath);
    this.tokenPath = path.isAbsolute(tokenPath)
      ? tokenPath
      : path.resolve(projectRoot, tokenPath);

    console.error('Auth paths initialized:');
    console.error('Credentials:', this.credentialsPath);
    console.error('Token:', this.tokenPath);
    console.error('Current working directory:', process.cwd());

    this.oauth2Client = new google.auth.OAuth2();
  }

  async initialize(): Promise<void> {
    await this.loadCredentials();
    this.setupOAuth2Client();

    // 检查是否已有有效token
    const existingToken = await this.loadToken();
    if (existingToken) {
      console.error('[AUTH] Found existing token, checking validity...');
      if (!this.isTokenExpired(existingToken)) {
        console.error('[AUTH] Existing token is valid');
      } else {
        console.error('[AUTH] Existing token is expired');
      }
    } else {
      console.error('[AUTH] No existing token found');
    }
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

  async generateAuthUrl(): Promise<{
    authUrl: string;
    callbackUrl: string;
  }> {
    this.callbackServer = new OAuth2CallbackServer(
      GOOGLE_OAUTH_CONSTANTS.CALLBACK_PORT
    );
    const callbackUrl = await this.callbackServer.startServer();

    // 保存当前回调URL供token交换时使用
    this.currentCallbackUrl = callbackUrl;

    // 创建专门用于回调的OAuth2Client
    const tempOAuth2Client = new google.auth.OAuth2(
      this.credentials!.client_id,
      this.credentials!.client_secret,
      callbackUrl // 使用临时的回调URL
    );

    const authUrl = tempOAuth2Client.generateAuthUrl({
      access_type: GOOGLE_OAUTH_CONSTANTS.ACCESS_TYPE,
      scope: [...GOOGLE_OAUTH_CONSTANTS.SCOPES],
      prompt: 'consent',
      response_type: GOOGLE_OAUTH_CONSTANTS.RESPONSE_TYPE,
    });

    console.error('[AUTH] Auth URL generated with callback:', callbackUrl);

    // 启动后台任务等待回调并自动处理认证
    this.startBackgroundAuthHandler();

    return { authUrl, callbackUrl };
  }

  private startBackgroundAuthHandler(): void {
    setTimeout(async () => {
      try {
        console.error('[AUTH] Background auth handler started, waiting for callback...');
        const authCode = await this.waitForCallback();
        console.error('[AUTH] Received auth code, processing token...');
        await this.handleAuthCallback(authCode);
        console.error('[AUTH] Background authentication completed successfully');
        console.error('[AUTH] Token saved, you can now use the Gmail service');
      } catch (error) {
        console.error('[AUTH] Background authentication failed:', error);
        console.error('[AUTH] You may need to manually retry the authentication');
      }
    }, 0);
  }

  async waitForCallback(): Promise<string> {
    if (!this.callbackServer) {
      throw new Error('Callback server not started');
    }

    try {
      const authCode = await this.callbackServer.waitForCallback();
      return authCode;
    } finally {
      this.callbackServer.stopServer();
      this.callbackServer = undefined;
    }
  }

  async handleAuthCallback(code: string): Promise<TokenData> {
    try {
      console.error('[AUTH] Processing authorization code...');
      console.error('[AUTH] Code length:', code.length);
      console.error('[AUTH] Code preview:', code.substring(0, 20) + '...');

      // 创建专门用于token交换的OAuth2Client，使用正确的回调URL
      const tokenOAuth2Client = new google.auth.OAuth2(
        this.credentials!.client_id,
        this.credentials!.client_secret,
        this.currentCallbackUrl || GOOGLE_OAUTH_CONSTANTS.DEFAULT_REDIRECT_URI
      );

      console.error(
        '[AUTH] Using redirect URI for token exchange:',
        this.currentCallbackUrl
      );

      const { tokens } = await tokenOAuth2Client.getToken(code);
      console.error('[AUTH] Successfully exchanged code for tokens');
      console.error('[AUTH] Token info:', {
        access_token: tokens.access_token ? 'present' : 'missing',
        refresh_token: tokens.refresh_token ? 'present' : 'missing',
        expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date) : 'none',
      });

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

      console.error('[AUTH] Preparing to save token data...');
      await this.saveToken(tokenData);
      console.error('[AUTH] Setting credentials in OAuth client...');
      this.oauth2Client.setCredentials(tokens);

      console.error('[AUTH] Token processing completed successfully');

      // 清理回调URL
      this.currentCallbackUrl = undefined;

      return tokenData;
    } catch (error) {
      console.error('[AUTH] Token processing failed:', error);
      throw new Error(`Failed to get access token: ${error}`);
    }
  }

  async loadToken(): Promise<TokenData | null> {
    try {
      console.error('[AUTH] Loading token from:', this.tokenPath);
      const tokenData = await fs.readFile(this.tokenPath, 'utf-8');
      console.error('[AUTH] Token loaded successfully');
      return JSON.parse(tokenData);
    } catch (error: any) {
      console.error('[AUTH] Token load failed:', error.message);
      return null;
    }
  }

  async saveToken(tokenData: TokenData): Promise<void> {
    try {
      console.error('[AUTH] Saving token to:', this.tokenPath);

      // 确保目录存在
      const tokenDir = path.dirname(this.tokenPath);
      await fs.mkdir(tokenDir, { recursive: true });

      await fs.writeFile(this.tokenPath, JSON.stringify(tokenData, null, 2));
      console.error('[AUTH] Token saved successfully');

      // 验证文件是否真的被创建
      const exists = await fs
        .access(this.tokenPath)
        .then(() => true)
        .catch(() => false);
      console.error('[AUTH] Token file exists after save:', exists);
    } catch (error) {
      console.error('[AUTH] Token save failed:', error);
      throw error;
    }
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
      const { authUrl } = await this.generateAuthUrl();
      return {
        authUrl,
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
        const { authUrl } = await this.generateAuthUrl();
        return {
          authUrl,
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
