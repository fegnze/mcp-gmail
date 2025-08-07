import { google } from 'googleapis';
import { AuthManager } from './auth';
import { EmailOptions } from './types';

export class GmailService {
  private authManager: AuthManager;
  private gmail: any;

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
  }

  private async initializeGmailClient(): Promise<void> {
    const auth = this.authManager.getOAuth2Client();
    this.gmail = google.gmail({ version: 'v1', auth });
  }

  private createEmailMessage(options: EmailOptions): string {
    const { to, subject, body, isHtml = false } = options;

    const contentType = isHtml
      ? 'text/html; charset=utf-8'
      : 'text/plain; charset=utf-8';

    const message = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: ${contentType}`,
      '',
      body,
    ].join('\n');

    return Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  async sendEmail(
    options: EmailOptions
  ): Promise<{ success: boolean; messageId?: string; authUrl?: string }> {
    try {
      const authResult = await this.authManager.ensureValidToken();

      if (authResult.needsAuth) {
        return {
          success: false,
          authUrl: authResult.authUrl!,
        };
      }

      await this.initializeGmailClient();

      const raw = this.createEmailMessage(options);

      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: raw,
        },
      });

      return {
        success: true,
        messageId: response.data.id,
      };
    } catch (error: any) {
      if (error.code === 401 || error.message?.includes('invalid_grant')) {
        const authUrl = this.authManager.generateAuthUrl();
        return {
          success: false,
          authUrl,
        };
      }

      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async handleAuthCode(code: string): Promise<void> {
    await this.authManager.handleAuthCallback(code);
  }
}
