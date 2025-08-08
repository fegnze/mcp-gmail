import { google } from 'googleapis';
import { AuthManager } from './auth';
import {
  EmailOptions,
  GoogleCredentials,
  GOOGLE_OAUTH_CONSTANTS,
} from './types';

export class GmailService {
  private authManager: AuthManager;

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
  }

  private createCredentials(options: EmailOptions): GoogleCredentials {
    return {
      client_id: options.client_id,
      client_secret: options.client_secret,
      redirect_uri:
        options.redirect_uri || GOOGLE_OAUTH_CONSTANTS.DEFAULT_REDIRECT_URI,
    };
  }

  private createEmailMessage(options: EmailOptions): string {
    const { to, subject, body, isHtml = false, cc } = options;

    const contentType = isHtml
      ? 'text/html; charset=utf-8'
      : 'text/plain; charset=utf-8';

    // 对主题进行RFC 2047编码以支持非ASCII字符
    const encodedSubject = this.encodeSubject(subject);

    const messageHeaders = [`To: ${to}`, `Subject: ${encodedSubject}`];

    // 如果有抄送地址，添加CC字段
    if (cc && cc.trim()) {
      messageHeaders.push(`Cc: ${cc}`);
    }

    messageHeaders.push(`Content-Type: ${contentType}`);

    const message = [...messageHeaders, '', body].join('\n');

    return Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private encodeSubject(subject: string): string {
    // 检查是否包含非ASCII字符
    if (/[\u0080-\uFFFF]/.test(subject)) {
      // 使用RFC 2047编码
      const encoded = Buffer.from(subject, 'utf-8').toString('base64');
      return `=?UTF-8?B?${encoded}?=`;
    }
    return subject;
  }

  async sendEmail(
    options: EmailOptions
  ): Promise<{
    success: boolean;
    messageId?: string | undefined;
    authUrl?: string;
  }> {
    try {
      const credentials = this.createCredentials(options);
      const authResult = await this.authManager.ensureValidToken(credentials);

      if (authResult.needsAuth) {
        return {
          success: false,
          authUrl: authResult.authUrl!,
        };
      }

      // 使用认证信息初始化Gmail客户端
      const auth = this.authManager.getOAuth2Client(
        credentials,
        authResult.token
      );
      const gmail = google.gmail({ version: 'v1', auth });

      const raw = this.createEmailMessage(options);

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: raw,
        },
      });

      return {
        success: true,
        messageId: response.data.id || undefined,
      };
    } catch (error: any) {
      if (error.code === 401 || error.message?.includes('invalid_grant')) {
        const credentials = this.createCredentials(options);
        const { authUrl } = await this.authManager.generateAuthUrl(credentials);
        return {
          success: false,
          authUrl,
        };
      }

      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async handleAuthCode(
    code: string,
    credentials: GoogleCredentials
  ): Promise<void> {
    await this.authManager.handleAuthCallback(code, credentials);
  }
}
