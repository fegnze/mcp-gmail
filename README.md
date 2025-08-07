# Gmail MCP Server

A Model Context Protocol (MCP) server for sending emails through Gmail API with OAuth2 authentication.

## Repository

- **GitHub**: [fegnze/mcp-gmail](https://github.com/fegnze/mcp-gmail)
- **Clone**: `git clone git@github.com:fegnze/mcp-gmail.git`

## Features

- 🔐 OAuth2 authentication with automatic token refresh
- 📧 Send emails through Gmail API
- 🔄 Automatic re-authentication when tokens expire
- 🐳 Docker containerization support
- 📝 TypeScript with full type safety
- ✨ Code quality tools (ESLint, Prettier)

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

2. **Configure credentials**:
   ```bash
   # Copy example files
   cp config/credentials.example.json config/credentials.json
   cp .env.example .env
   
   # Edit config/credentials.json with your Google OAuth2 credentials
   # The file should contain:
   # {
   #   "web": {
   #     "client_id": "your_actual_client_id",
   #     "client_secret": "your_actual_client_secret", 
   #     "redirect_uris": ["http://localhost:8080/callback"],
   #     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
   #     "token_uri": "https://oauth2.googleapis.com/token"
   #   }
   # }
   
   # Edit .env with your environment variables if needed
   ```

3. **Build the project**:
   ```bash
   bun run build
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

2. Update the configuration with your actual paths and credentials:
   ```json
   {
     "mcpServers": {
       "gmail": {
         "command": "node",
         "args": ["dist/index.js"],
         "cwd": "/path/to/mcp-gmail",
         "env": {
           "GOOGLE_CLIENT_ID": "your_actual_client_id",
           "GOOGLE_CLIENT_SECRET": "your_actual_client_secret",
           "GOOGLE_REDIRECT_URI": "http://localhost:8080/callback"
         }
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
        "-v", "${PWD}/auth:/app/auth",
        "-v", "${PWD}/credentials.json:/app/credentials.json:ro",
        "-e", "GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}",
        "-e", "GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}",
        "gmail-mcp-server"
      ]
    }
  }
}
```

#### For Development
```json
{
  "mcpServers": {
    "gmail": {
      "command": "bun",
      "args": ["run", "dev"],
      "cwd": "/path/to/mcp-gmail",
      "env": {
        "GOOGLE_CLIENT_ID": "your_client_id",
        "GOOGLE_CLIENT_SECRET": "your_client_secret"
      }
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
Send an email via Gmail. Returns authentication URL if not authenticated.

**Parameters**:
- `to` (string, required): Recipient email address
- `subject` (string, required): Email subject
- `body` (string, required): Email body content
- `isHtml` (boolean, optional): Whether body is HTML format (default: false)

### `get_auth_url`
Get Google OAuth2 authentication URL.

### `auth_callback`
Handle OAuth2 callback with authorization code.

**Parameters**:
- `code` (string, required): OAuth2 authorization code

## Authentication Flow

1. Call `send_email` or `get_auth_url`
2. Visit the returned authentication URL
3. Complete Google OAuth2 consent flow
4. Use `auth_callback` with the received authorization code
5. Server stores tokens and can now send emails

## File Structure

```
src/
├── index.ts          # MCP server main entry point
├── auth.ts           # OAuth2 authentication manager
├── gmail.ts          # Gmail API service
└── types.ts          # TypeScript type definitions

config/
├── credentials.json       # Google OAuth2 credentials
├── mcp-config.json       # Node.js runtime MCP config
├── mcp-config-bun.json   # Bun runtime MCP config
├── mcp-config-docker.json # Docker runtime MCP config
└── claude-desktop-config.json # Claude Desktop integration config

token.json           # Stored access/refresh tokens (auto-generated)
```

## Security Notes

- Tokens are stored locally in `token.json`
- Credentials should never be committed to version control
- Use environment variables in production
- Regular token rotation is handled automatically
- Default redirect URI is `http://localhost:8080/callback` for local development
- For production deployment, update redirect URIs in both Google Cloud Console and configuration

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