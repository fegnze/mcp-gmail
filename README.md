# Gmail MCP Server

A Model Context Protocol (MCP) server for sending emails through Gmail API with OAuth2 authentication and local callback server support.

## Repository

- **GitHub**: [fegnze/mcp-gmail](https://github.com/fegnze/mcp-gmail)
- **Clone**: `git clone git@github.com:fegnze/mcp-gmail.git`

## Features

- 🔐 **Complete OAuth2 Flow**: Automated authentication with local callback server
- 📧 **Gmail Integration**: Send HTML/plain text emails with CC support
- 🔄 **Token Management**: Automatic refresh and expiration handling
- 🌍 **Internationalization**: Chinese subject encoding support (RFC 2047)
- 🛠️ **MCP Protocol**: Standard MCP server implementation
- 🔑 **Dynamic Credentials**: OAuth2 credentials passed as tool parameters (no static config)
- 🐳 **Multi-Runtime**: Node.js, Bun, and Docker support
- ✨ **Code Quality**: ESLint, Prettier, TypeScript strict mode, 100% type-safe (no `any` types)

## Prerequisites

1. **Google Cloud Project Setup**:
   - Create a project in [Google Cloud Console](https://console.cloud.google.com/)
   - Enable Gmail API
   - Create OAuth2 credentials (Web application type)
   - Add authorized redirect URIs:
     - For local development: `http://localhost:8080/callback`
     - For production: your actual callback URL

2. **Node.js/Bun**: Version 18+ required

## Installation

1. **Clone and install dependencies**:
   ```bash
   git clone git@github.com:fegnze/mcp-gmail.git
   cd mcp-gmail
   bun install
   ```

2. **Build the project**:
   ```bash
   bun run build
   ```

**Note**: No credential configuration is needed! OAuth2 credentials are now passed as parameters to MCP tools at runtime.

## Breaking Changes (v2.0)

🚨 **Important**: This version introduces breaking changes from previous versions.

### What Changed
- **OAuth2 credentials** are now **required parameters** for all tools instead of environment variables
- **No more static configuration** of credentials in config files or environment variables  
- **Simplified deployment** - no credential management in MCP server configuration

### Migration Guide
**Before (v1.x)**:
```json
// MCP Config had env variables
{
  "env": {
    "GOOGLE_CLIENT_ID": "your_client_id",
    "GOOGLE_CLIENT_SECRET": "your_client_secret" 
  }
}

// Tool calls were simple
{
  "name": "send_email",
  "arguments": {
    "to": "user@example.com",
    "subject": "Test",
    "body": "Hello"
  }
}
```

**Now (v2.0)**:
```json
// MCP Config is simplified - no env needed
{
  "command": "node",
  "args": ["dist/index.js"],
  "cwd": "/path/to/mcp-gmail" 
}

// Tool calls include credentials
{
  "name": "send_email", 
  "arguments": {
    "to": "user@example.com",
    "subject": "Test", 
    "body": "Hello",
    "client_id": "your_google_client_id",
    "client_secret": "your_google_client_secret"
  }
}
```

## MCP Configuration

### Configuration Files

The project includes pre-configured MCP server configuration files for different runtimes in the `config/` directory:

1. **config/mcp-config.json** - Node.js runtime configuration
2. **config/mcp-config-bun.json** - Bun runtime configuration (runs TypeScript directly: `bun src/index.ts`)
3. **config/mcp-config-docker.json** - Docker container configuration
4. **config/claude-desktop-config.json** - Claude Desktop integration

### Using with Claude Desktop

1. Copy the contents of `config/claude-desktop-config.json` to your Claude Desktop MCP settings file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\\Claude\\claude_desktop_config.json`

2. Update the configuration with your actual path:
   ```json
   {
     "mcpServers": {
       "gmail": {
         "command": "node",
         "args": ["dist/index.js"],
         "cwd": "/path/to/mcp-gmail"
       }
     }
   }
   ```

3. Restart Claude Desktop to load the new MCP server.

### Configuration Examples

#### For Production Deployment
```json
{
  "mcpServers": {
    "gmail": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-v", "${PWD}/tokens:/app/tokens",
        "gmail-mcp-server"
      ]
    }
  }
}
```

#### For Development with Bun
```json
{
  "mcpServers": {
    "gmail": {
      "command": "bun",
      "args": ["src/index.ts"],
      "cwd": "/path/to/mcp-gmail"
    }
  }
}
```

## Usage

### Development Mode
```bash
bun run dev
```

### Production Mode

**With Node.js:**
```bash
bun run start
```

**With Bun (TypeScript native):**
```bash
bun run start:bun
# or directly: bun src/index.ts
```

### Docker
```bash
# Build and run with Docker Compose
docker-compose up --build

# Or build and run manually
docker build -t gmail-mcp-server .
docker run -p 8080:8080 -v $(pwd)/auth:/app/auth gmail-mcp-server
```

## MCP Tools

The server provides these MCP tools:

### `send_email`
Send an email via Gmail with automatic authentication flow.

**Parameters**:
- `to` (string, required): Recipient email address
- `subject` (string, required): Email subject (supports Chinese characters)
- `body` (string, required): Email body content
- `isHtml` (boolean, optional): Whether body is HTML format (default: false)
- `cc` (string, optional): Carbon copy email addresses (comma-separated for multiple)
- `client_id` (string, required): Google OAuth2 Client ID from Google Cloud Console
- `client_secret` (string, required): Google OAuth2 Client Secret from Google Cloud Console
- `redirect_uri` (string, optional): OAuth2 redirect URI (defaults to http://localhost:8080/callback)

**Example**:
```json
{
  "name": "send_email",
  "arguments": {
    "to": "user@example.com",
    "subject": "Hello World",
    "body": "This is a test email",
    "client_id": "your_google_client_id.apps.googleusercontent.com",
    "client_secret": "your_google_client_secret"
  }
}
```

### `get_auth_url`
Manually trigger OAuth2 authentication with local callback server. The authentication process is fully automated once you visit the URL.

**Parameters**:
- `client_id` (string, required): Google OAuth2 Client ID from Google Cloud Console
- `client_secret` (string, required): Google OAuth2 Client Secret from Google Cloud Console  
- `redirect_uri` (string, optional): OAuth2 redirect URI (defaults to http://localhost:8080/callback)

**Example**:
```json
{
  "name": "get_auth_url", 
  "arguments": {
    "client_id": "your_google_client_id.apps.googleusercontent.com",
    "client_secret": "your_google_client_secret"
  }
}
```

## Authentication Flow

The authentication process is streamlined with a local callback server:

1. Call `send_email` (authentication happens automatically if needed) or `get_auth_url` 
2. Visit the returned authentication URL in your browser
3. Complete Google OAuth2 consent flow
4. The local callback server automatically handles the response
5. Tokens are stored and emails can now be sent immediately

**No manual code entry required** - the entire flow is automated!

## File Structure

```
src/
├── index.ts                    # MCP server main entry point
├── auth.ts                     # OAuth2 authentication manager with callback server
├── gmail.ts                    # Gmail API service with Chinese encoding support
├── oauth-callback-server.ts    # Local HTTP server for OAuth2 callbacks
└── types.ts                    # TypeScript type definitions

config/
├── credentials.example.json    # Template for OAuth2 credentials (optional reference)
├── mcp-config.json            # Node.js runtime MCP config
├── mcp-config-bun.json        # Bun runtime MCP config  
├── mcp-config-docker.json     # Docker runtime MCP config
└── claude-desktop-config.json # Claude Desktop integration config

token.json                     # Stored access/refresh tokens (auto-generated)
```

## Security Notes

- 🔐 **Credentials Security**: OAuth2 credentials are passed as tool parameters, not stored in config files
- 🔒 **Token Storage**: Tokens are stored locally in `token.json` 
- 🚫 **No Static Secrets**: No credentials committed to version control or stored in environment variables
- 🔄 **Token Management**: Automatic token refresh and rotation handled securely
- 🌐 **Callback URI**: Default redirect URI is `http://localhost:8080/callback` for local development
- 📋 **Production Setup**: For production, add your callback URL to Google Cloud Console authorized redirect URIs
- 🤖 **AI-Driven**: Credentials provided dynamically by AI models at runtime, enhancing security

## Scripts

- `bun run build` - Build TypeScript to JavaScript
- `bun run dev` - Run in development mode with watch
- `bun run start` - Run built server with Node.js
- `bun run start:bun` - Run server directly with Bun (TypeScript native)
- `bun run lint` - Run ESLint
- `bun run format` - Format code with Prettier
- `bun run type-check` - TypeScript type checking

## License

MIT