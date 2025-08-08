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
  private tokenPath: string;
  private callbackServer?: OAuth2CallbackServer | undefined;
  private currentCallbackUrl?: string | undefined; // 跟踪当前使用的回调URL

  constructor(tokenPath = 'token.json') {
    // 使用项目根目录作为基础路径，而不是process.cwd()
    const projectRoot = path.dirname(__dirname); // 从dist目录回到项目根目录

    this.tokenPath = path.isAbsolute(tokenPath)
      ? tokenPath
      : path.resolve(projectRoot, tokenPath);

    console.error('Auth paths initialized:');
    console.error('Token:', this.tokenPath);
    console.error('Current working directory:', process.cwd());
  }

  async initialize(): Promise<void> {
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

  private createOAuth2Client(credentials: GoogleCredentials): OAuth2Client {
    return new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      credentials.redirect_uri
    );
  }

  async generateAuthUrl(credentials: GoogleCredentials): Promise<{
    authUrl: string;
    callbackUrl: string;
  }> {
    // 使用默认redirect_uri如果没有提供
    const finalCredentials: GoogleCredentials = {
      ...credentials,
      redirect_uri:
        credentials.redirect_uri || GOOGLE_OAUTH_CONSTANTS.DEFAULT_REDIRECT_URI,
    };

    this.callbackServer = new OAuth2CallbackServer(
      GOOGLE_OAUTH_CONSTANTS.CALLBACK_PORT
    );
    const callbackUrl = await this.callbackServer.startServer();

    // 保存当前回调URL供token交换时使用
    this.currentCallbackUrl = callbackUrl;

    // 创建专门用于回调的OAuth2Client
    const tempOAuth2Client = this.createOAuth2Client({
      ...finalCredentials,
      redirect_uri: callbackUrl, // 使用临时的回调URL
    });

    const authUrl = tempOAuth2Client.generateAuthUrl({
      access_type: GOOGLE_OAUTH_CONSTANTS.ACCESS_TYPE,
      scope: [...GOOGLE_OAUTH_CONSTANTS.SCOPES],
      prompt: 'consent',
      response_type: GOOGLE_OAUTH_CONSTANTS.RESPONSE_TYPE,
    });

    console.error('[AUTH] Auth URL generated with callback:', callbackUrl);

    // 启动后台任务等待回调并自动处理认证
    this.startBackgroundAuthHandler(finalCredentials);

    return { authUrl, callbackUrl };
  }

  private startBackgroundAuthHandler(credentials: GoogleCredentials): void {
    setTimeout(async () => {
      try {
        console.error(
          '[AUTH] Background auth handler started, waiting for callback...'
        );
        const authCode = await this.waitForCallback();
        console.error('[AUTH] Received auth code, processing token...');
        await this.handleAuthCallback(authCode, credentials);
        console.error(
          '[AUTH] Background authentication completed successfully'
        );
        console.error('[AUTH] Token saved, you can now use the Gmail service');
      } catch (error) {
        console.error('[AUTH] Background authentication failed:', error);
        console.error(
          '[AUTH] You may need to manually retry the authentication'
        );
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

  async handleAuthCallback(
    code: string,
    credentials: GoogleCredentials
  ): Promise<TokenData> {
    try {
      console.error('[AUTH] Processing authorization code...');
      console.error('[AUTH] Code length:', code.length);
      console.error('[AUTH] Code preview:', code.substring(0, 20) + '...');

      // 创建专门用于token交换的OAuth2Client，使用正确的回调URL
      const tokenOAuth2Client = this.createOAuth2Client({
        ...credentials,
        redirect_uri:
          this.currentCallbackUrl ||
          credentials.redirect_uri ||
          GOOGLE_OAUTH_CONSTANTS.DEFAULT_REDIRECT_URI,
      });

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

  async refreshToken(credentials: GoogleCredentials): Promise<TokenData> {
    const currentToken = await this.loadToken();
    if (!currentToken?.refresh_token) {
      throw new Error('No refresh token available');
    }

    const oauth2Client = this.createOAuth2Client(credentials);
    oauth2Client.setCredentials({
      refresh_token: currentToken.refresh_token,
    });

    try {
      const { credentials: newCredentials } =
        await oauth2Client.refreshAccessToken();

      const tokenData: TokenData = {
        access_token: newCredentials.access_token!,
        refresh_token:
          newCredentials.refresh_token || currentToken.refresh_token,
        token_type: newCredentials.token_type || 'Bearer',
        expires_in: newCredentials.expiry_date
          ? Math.floor((newCredentials.expiry_date - Date.now()) / 1000)
          : undefined,
        expires_at: newCredentials.expiry_date || undefined,
        scope: newCredentials.scope || undefined,
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

  async ensureValidToken(credentials: GoogleCredentials): Promise<AuthResult> {
    const currentToken = await this.loadToken();

    if (!currentToken) {
      const { authUrl } = await this.generateAuthUrl(credentials);
      return {
        authUrl,
        needsAuth: true,
      };
    }

    if (this.isTokenExpired(currentToken)) {
      try {
        const refreshedToken = await this.refreshToken(credentials);
        return {
          token: refreshedToken,
          needsAuth: false,
        };
      } catch (error) {
        console.warn('Failed to refresh token, need re-authentication:', error);
        const { authUrl } = await this.generateAuthUrl(credentials);
        return {
          authUrl,
          needsAuth: true,
        };
      }
    }

    return {
      token: currentToken,
      needsAuth: false,
    };
  }

  getOAuth2Client(
    credentials: GoogleCredentials,
    token?: TokenData
  ): OAuth2Client {
    const oauth2Client = this.createOAuth2Client(credentials);

    if (token) {
      oauth2Client.setCredentials({
        access_token: token.access_token,
        refresh_token: token.refresh_token || null,
      });
    }

    return oauth2Client;
  }
}
