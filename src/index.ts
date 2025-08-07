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
import { EmailOptions } from './types.js';

// 定义工具参数结构
const SendEmailArgsSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject cannot be empty'),
  body: z.string().min(1, 'Body cannot be empty'),
  isHtml: z.boolean().optional().default(false),
});

const AuthCallbackArgsSchema = z.object({
  code: z.string().min(1, 'Authorization code cannot be empty'),
});

const GetAuthUrlArgsSchema = z.object({});

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
              'Send an email via Gmail. If authentication is required, returns auth URL.',
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
              },
              required: ['to', 'subject', 'body'],
            },
          } as Tool,
          {
            name: 'get_auth_url',
            description: 'Get Google OAuth2 authentication URL',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          } as Tool,
          {
            name: 'auth_callback',
            description: 'Handle OAuth2 callback with authorization code',
            inputSchema: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'OAuth2 authorization code from callback',
                },
              },
              required: ['code'],
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
            GetAuthUrlArgsSchema.parse(args);
            return await this.handleGetAuthUrl();
          }

          case 'auth_callback': {
            const validatedArgs = AuthCallbackArgsSchema.parse(args);
            return await this.handleAuthCallback(validatedArgs);
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
              text: `Authentication required. Please visit this URL to authenticate:\\n${result.authUrl}\\n\\nAfter authentication, use the 'auth_callback' tool with the authorization code.`,
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

  private async handleGetAuthUrl() {
    try {
      const authUrl = this.authManager.generateAuthUrl();
      return {
        content: [
          {
            type: 'text',
            text: `Please visit this URL to authenticate:\\n${authUrl}\\n\\nAfter authentication, use the 'auth_callback' tool with the authorization code.`,
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

  private async handleAuthCallback(args: { code: string }) {
    try {
      await this.gmailService.handleAuthCode(args.code);
      return {
        content: [
          {
            type: 'text',
            text: 'Authentication successful! You can now send emails.',
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Authentication failed: ${error instanceof Error ? error.message : String(error)}`,
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
