#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { AuthManager } from './auth.js';
import { GmailService } from './gmail.js';
import {
  EmailOptions,
  AuthUrlOptions,
  GOOGLE_OAUTH_CONSTANTS,
} from './types.js';

// 定义工具参数结构
const SendEmailArgsSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject cannot be empty'),
  body: z.string().min(1, 'Body cannot be empty'),
  isHtml: z.boolean().optional().default(false),
  cc: z.string().optional(), // 抄送地址，可选
  // Google OAuth2 credentials - required for authentication
  client_id: z.string().min(1, 'Google Client ID is required'),
  client_secret: z.string().min(1, 'Google Client Secret is required'),
  redirect_uri: z.string().optional(), // Optional, will use default if not provided
});

const GetAuthUrlArgsSchema = z.object({
  // Google OAuth2 credentials - required for authentication
  client_id: z.string().min(1, 'Google Client ID is required'),
  client_secret: z.string().min(1, 'Google Client Secret is required'),
  redirect_uri: z.string().optional(), // Optional, will use default if not provided
});

class GmailMCPServer {
  private server: Server;
  private authManager: AuthManager;
  private gmailService: GmailService;

  constructor() {
    this.server = new Server(
      {
        name: 'gmail-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.authManager = new AuthManager();
    this.gmailService = new GmailService(this.authManager);
    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'send_email',
            description:
              'Send an email via Gmail with optional CC support. If authentication is required, returns auth URL.',
            inputSchema: {
              type: 'object',
              properties: {
                to: {
                  type: 'string',
                  format: 'email',
                  description: 'Recipient email address',
                },
                subject: {
                  type: 'string',
                  description: 'Email subject',
                },
                body: {
                  type: 'string',
                  description: 'Email body content',
                },
                isHtml: {
                  type: 'boolean',
                  description:
                    'Whether the body is HTML format (default: false)',
                  default: false,
                },
                cc: {
                  type: 'string',
                  description:
                    'Carbon copy (CC) email addresses, comma-separated for multiple recipients',
                },
                client_id: {
                  type: 'string',
                  description:
                    'Google OAuth2 Client ID from Google Cloud Console',
                },
                client_secret: {
                  type: 'string',
                  description:
                    'Google OAuth2 Client Secret from Google Cloud Console',
                },
                redirect_uri: {
                  type: 'string',
                  description:
                    'OAuth2 redirect URI (optional, defaults to http://localhost:8080/callback)',
                },
              },
              required: ['to', 'subject', 'body', 'client_id', 'client_secret'],
            },
          } as Tool,
          {
            name: 'get_auth_url',
            description:
              'Get Google OAuth2 authentication URL with local callback server',
            inputSchema: {
              type: 'object',
              properties: {
                client_id: {
                  type: 'string',
                  description:
                    'Google OAuth2 Client ID from Google Cloud Console',
                },
                client_secret: {
                  type: 'string',
                  description:
                    'Google OAuth2 Client Secret from Google Cloud Console',
                },
                redirect_uri: {
                  type: 'string',
                  description:
                    'OAuth2 redirect URI (optional, defaults to http://localhost:8080/callback)',
                },
              },
              required: ['client_id', 'client_secret'],
            },
          } as Tool,
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'send_email': {
            const validatedArgs = SendEmailArgsSchema.parse(args);
            return await this.handleSendEmail(validatedArgs);
          }

          case 'get_auth_url': {
            const validatedArgs = GetAuthUrlArgsSchema.parse(args);
            return await this.handleGetAuthUrl(validatedArgs);
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          return {
            content: [
              {
                type: 'text',
                text: `Validation error: ${error.errors.map(e => e.message).join(', ')}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleSendEmail(args: EmailOptions) {
    try {
      const result = await this.gmailService.sendEmail(args);

      if (!result.success && result.authUrl) {
        return {
          content: [
            {
              type: 'text',
              text: `Authentication required. Local callback server started. Please visit this URL to authenticate:\\n${result.authUrl}\\n\\nThe authorization will be handled automatically. After authentication, you can retry sending the email.`,
            },
          ],
        };
      }

      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Email sent successfully! Message ID: ${result.messageId}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: 'Failed to send email for unknown reason',
          },
        ],
        isError: true,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error sending email: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleGetAuthUrl(args: AuthUrlOptions) {
    try {
      const credentials = {
        client_id: args.client_id,
        client_secret: args.client_secret,
        redirect_uri:
          args.redirect_uri || GOOGLE_OAUTH_CONSTANTS.DEFAULT_REDIRECT_URI,
      };

      const { authUrl } = await this.authManager.generateAuthUrl(credentials);

      setTimeout(async () => {
        try {
          const authCode = await this.authManager.waitForCallback();
          await this.gmailService.handleAuthCode(authCode, credentials);
          console.error('Authentication completed successfully');
        } catch (error) {
          console.error('Authentication failed:', error);
        }
      }, 0);

      return {
        content: [
          {
            type: 'text',
            text: `Local callback server started. Please visit this URL to authenticate:\\n${authUrl}\\n\\nThe authorization will be handled automatically. Authentication process initiated in background.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error generating auth URL: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  private setupErrorHandling(): void {
    this.server.onerror = error => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async start(): Promise<void> {
    await this.authManager.initialize();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('Gmail MCP Server started');
  }
}

async function main(): Promise<void> {
  const server = new GmailMCPServer();
  await server.start();
}

if (require.main === module) {
  main().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
