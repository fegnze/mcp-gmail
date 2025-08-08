import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';

export class OAuth2CallbackServer {
  private server?: ReturnType<typeof createServer> | undefined;
  private port: number;
  private resolveCallback?: (code: string) => void;
  private rejectCallback?: (error: Error) => void;

  constructor(port = 8080) {
    this.port = port;
  }

  async startServer(): Promise<string> {
    // 尝试多个端口，从指定端口开始
    const maxAttempts = 10;
    let currentPort = this.port;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const callbackUrl = await this.tryStartServer(currentPort);
        this.port = currentPort; // 更新实际使用的端口
        return callbackUrl;
      } catch (error: any) {
        if (error.code === 'EADDRINUSE') {
          console.error(
            `Port ${currentPort} is in use, trying port ${currentPort + 1}...`
          );
          currentPort++;
          continue;
        }
        // 其他错误直接抛出
        throw error;
      }
    }

    throw new Error(
      `Failed to start server. Tried ports ${this.port} to ${currentPort - 1}, all are in use.`
    );
  }

  private async tryStartServer(port: number): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = createServer(
        (req: IncomingMessage, res: ServerResponse) => {
          this.handleRequest(req, res);
        }
      );

      this.server.listen(port, () => {
        console.error(`OAuth2 callback server listening on port ${port}`);
        console.error(`Callback URL: http://localhost:${port}/callback`);
        console.error(
          'Make sure this URL is configured in your Google Cloud Console OAuth2 settings'
        );
        resolve(`http://localhost:${port}/callback`);
      });

      this.server.on('error', (err: Error) => {
        reject(err);
      });
    });
  }

  async waitForCallback(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.resolveCallback = resolve;
      this.rejectCallback = reject;

      setTimeout(
        () => {
          reject(new Error('OAuth2 callback timeout'));
        },
        5 * 60 * 1000
      );
    });
  }

  stopServer(): void {
    if (this.server) {
      this.server.close();
      this.server = undefined;
    }
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url || '', `http://localhost:${this.port}`);

    console.error('[CALLBACK] Server received request:', req.url);
    console.error('[CALLBACK] Parsed URL path:', url.pathname);
    console.error(
      '[CALLBACK] Query parameters:',
      Object.fromEntries(url.searchParams)
    );

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      console.error('[CALLBACK] Processing OAuth callback...');
      console.error('[CALLBACK] Authorization code present:', !!code);
      console.error('[CALLBACK] Error present:', !!error);

      if (error) {
        const errorDescription = url.searchParams.get('error_description');
        console.error(
          '[CALLBACK] OAuth error received:',
          error,
          errorDescription
        );

        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body>
              <h1>Authentication Failed</h1>
              <p>Error: ${error}</p>
              <p>Description: ${errorDescription || 'No description provided'}</p>
              <p>You can close this window.</p>
            </body>
          </html>
        `);

        if (this.rejectCallback) {
          this.rejectCallback(
            new Error(`OAuth2 error: ${error} - ${errorDescription}`)
          );
        }
        return;
      }

      if (code) {
        console.error('[CALLBACK] Authorization code received successfully!');
        console.error('[CALLBACK] Code length:', code.length);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body>
              <h1>Authentication Successful!</h1>
              <p>Authorization code received. You can close this window.</p>
              <script>
                setTimeout(() => {
                  window.close();
                }, 3000);
              </script>
            </body>
          </html>
        `);

        console.error('[CALLBACK] Calling resolve callback with auth code...');
        if (this.resolveCallback) {
          this.resolveCallback(code);
        } else {
          console.error('[CALLBACK] No resolve callback available!');
        }

        console.error('[CALLBACK] Scheduling server shutdown in 5 seconds...');
        setTimeout(() => {
          console.error('[CALLBACK] Stopping callback server...');
          this.stopServer();
        }, 5000);
        return;
      }

      console.error(
        '[CALLBACK] No authorization code or error found in callback'
      );
    } else {
      console.error('[CALLBACK] Request to non-callback path:', url.pathname);
    }

    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body>
          <h1>OAuth2 Callback Server</h1>
          <p>Waiting for authentication callback...</p>
        </body>
      </html>
    `);
  }
}
