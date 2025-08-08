### 需求迭代记录：

#### 1、初始需求：

* 实现一个 MCP Server，调用 google API 发送 Gamil 邮件
* 功能需求：
  * 自动获取认证地址并跳转认证；
  * 认证完成自动获取 access token；
  * 发送邮件，如果未认证，自动获取认证地址并跳转认证；
  * 发送邮件，如果认证过期，自动刷新 access token；
  * 发送邮件，如果刷新失败，自动重新获取认证地址并跳转认证；
  * 发送邮件，如果刷新成功，自动发送邮件；
* 技术要求：
  * 使用 bun 、ts 开发；
  * 使用 MCP 官方 sdk 开发；
  * 可使用 docker 容器化部署；
* 质量要求：
  * 代码质量：
    * 使用 eslint 、prettier 等工具进行代码质量检查和格式化；
    * 符合 typescript 规范；
    * 符合 mcp 官方 sdk 规范；
    * 符合 google api 规范；
    * 符合 docker 规范；
    * 代码结构清晰，注释详细；
  * 安全性：
    * 身份认证：使用 OAuth2 认证；

#### 2、需求迭代 1：

- 生成 mcp server 连接配置，json 格式；

#### 3、需求迭代 2：

- 项目文件结构优化：
  - 删除 generate-config.js 文件，不需要动态生成配置；
  - 创建 config 目录统一管理配置文件；
  - 将所有 mcp-config*.json 文件移动到 config 目录；
  - 将 credentials.json 文件移动到 config 目录；
  - 更新代码和文档中的相关路径引用；

#### 4、需求迭代 3：

- 增加版本控制：
  - 初始化 Git 仓库；
  - 添加远程仓库地址：git@github.com:fegnze/mcp-gmail.git；
  - 创建初始提交并推送到远程仓库；
  - 项目现已托管在 GitHub 上，支持协作开发和版本管理；

#### 5、需求迭代 4：

- 标准化默认参数配置：
  - 基于 config/credentials.example.json 文件中的标准配置更新项目；
  - 添加 Google OAuth2 常量定义，统一管理标准 URI 和默认值；
  - 更新代码中的默认参数使用常量引用；
  - 增强文档中的配置示例和安全性说明；
  - 确保所有配置文件使用一致的默认值（redirect_uri、auth_uri、token_uri）；

#### 6、需求修复 1：

- 修复配置同步问题：
  - 将所有 MCP 配置文件中的具体路径改为通用路径 `/path/to/mcp-gmail`；
  - 将 config/credentials.json 中的实际参数值同步到所有 MCP 配置文件；
  - 更新代码中的默认 redirect_uri 常量为实际使用值；
  - 优化代码语法细节和格式；
  - 确保配置文件的可移植性和实际可用性；

#### 7、需求修复 2：

- 修复 Bun 配置问题：
  - 修复 `mcp-config-bun.json` 中的 "Script not found 'start'" 错误；
  - 修复 "Module not found dist/index.js" 问题；
  - 利用 Bun 的 TypeScript 原生支持，直接运行 `bun src/index.ts`；
  - 更新 `start:bun` npm 脚本直接运行 TypeScript 源文件；
  - 更新文档说明 Bun 的 TypeScript 原生运行优势；

#### 8、安全修复：

- 修复 GitHub 安全检测问题：
  - 将配置文件中的真实 Google OAuth2 凭据替换为占位符；
  - 确保敏感信息不会被提交到公共仓库；
  - 维护配置文件的实用性同时保护隐私安全；

#### 9、OAuth2 回调服务器实现：

- 创建本地 OAuth2 回调处理服务器 (`src/oauth-callback-server.ts`)：
  - 实现 HTTP 服务器监听 OAuth2 回调请求；
  - 提供用户友好的 HTML 响应界面；
  - 支持成功和错误状态的处理；
  - 包含自动超时和服务器清理机制；
  - 集成到 AuthManager 中提供无缝认证流程；
- 更新 OAuth2 常量默认 redirect_uri 为 `http://localhost:8080/callback`；
- 在 MCP Server 中添加新的 `get_auth_url_with_callback` 工具；
- 支持本地回调和 Google OAuth Playground 两种认证方式；
- 更新 Google OAuth2 配置添加本地回调 URL 支持；

#### 10、简化认证流程：

- 移除传统的手动认证方式：
  - 删除原有的 `get_auth_url` 和 `auth_callback` 工具分离设计；
  - 将 `get_auth_url` 工具重构为自动化本地回调认证；
  - 移除手动输入授权码的步骤；
  - 简化用户交互，只需访问认证URL即可完成整个流程；
- 统一认证接口，所有认证都通过本地回调服务器自动完成；
- 优化代码结构，修复TypeScript类型和ESLint格式问题；

#### 11、MCP协议和用户体验修复：

- **修复MCP协议JSON解析错误**：
  - 发现控制台日志输出到stdout导致MCP JSON通信失败；
  - 将所有`console.log`改为`console.error`，确保日志输出到stderr；
  - 解决了"Unexpected token"错误，MCP服务器现在正常工作；
- **修复Token文件路径问题**：
  - Token文件之前保存在用户主目录(`/Users/ghost/token.json`)；
  - 修改路径逻辑使用项目根目录而不是`process.cwd()`；
  - Token文件现在正确保存在MCP服务器工作目录中；
- **修复中文邮件主题乱码**：
  - 添加RFC 2047编码支持，解决非ASCII字符显示问题；
  - 中文邮件主题现在能够正确显示；
  - 使用`=?UTF-8?B?base64编码?=`格式对包含中文的主题进行编码；

#### 12、OAuth2认证流程完善：

- **修复OAuth2参数缺失**：
  - 在OAuth2认证URL生成中添加缺失的`response_type`参数；
  - 确保`response_type: 'code'`符合OAuth2标准规范；
  - 修复了Google OAuth2服务器的400错误响应；
- **OAuth2认证流程稳定性提升**：
  - 完善了本地回调服务器的错误处理机制；
  - 优化了token交换和存储流程的可靠性；
  - 改进了认证失败时的用户提示和错误恢复；

#### 13、架构重构 - 参数化认证系统：

- **重大架构变更**：
  - 将OAuth2认证凭据从静态配置移动到MCP工具参数；
  - 实现动态认证参数传递，提升安全性和灵活性；
  - 完全移除对环境变量和配置文件中静态凭据的依赖；

- **MCP工具参数化改造**：
  - `send_email`工具新增必需参数：`client_id`、`client_secret`、`redirect_uri`（可选）；
  - `get_auth_url`工具新增必需参数：`client_id`、`client_secret`、`redirect_uri`（可选）；
  - 参数验证使用Zod schema确保类型安全；
  - 支持动态redirect_uri，默认使用`http://localhost:8080/callback`；

- **AuthManager重构**：
  - 移除文件和环境变量凭据加载逻辑；
  - 实现动态凭据接受和OAuth2Client创建；
  - 修改所有认证方法支持运行时传入的GoogleCredentials；
  - 保持token存储和刷新逻辑不变；

- **GmailService适配**：
  - 从工具参数中提取GoogleCredentials；
  - 动态创建OAuth2Client和Gmail API客户端；
  - 移除静态认证客户端依赖；

- **配置文件简化**：
  - 移除所有MCP配置文件中的`env`环境变量部分；
  - 配置文件仅保留command、args、cwd等运行时配置；
  - Docker配置简化，移除凭据挂载和环境变量；

- **安全性提升**：
  - 凭据不再存储在配置文件或环境变量中；
  - 由AI模型在运行时动态提供认证参数；
  - 降低了凭据泄露风险；
  - 支持不同操作使用不同凭据；

- **向后兼容性**：
  - **Breaking Change**：v2.0版本不向后兼容v1.x；
  - 需要更新所有工具调用以包含认证参数；
  - 提供详细迁移指南和示例；

#### 14、文档和用户体验优化：

- **README.md全面重写**：
  - 添加Breaking Changes (v2.0)部分说明重大变更；
  - 更新安装说明移除凭据配置步骤；
  - 提供v1.x到v2.0的详细迁移指南；
  - 增加工具使用示例包含认证参数；
  - 更新安全特性说明强调AI驱动凭据管理；

- **配置示例更新**：
  - 简化Claude Desktop配置示例；
  - 更新Docker和Bun运行配置；
  - 移除所有环境变量配置示例；

- **用户体验改进**：
  - 部署更简单：无需管理凭据文件；
  - 使用更灵活：每次调用可用不同凭据；
  - 安全性更高：无静态凭据存储；

#### 15、项目清理和优化：

- **测试和调试文件清理**：
  - 删除所有test-*.ts调试文件；
  - 删除debug-*.ts和diagnose-*.ts文件；
  - 删除check-*.ts状态检查文件；
  - 移除*.log日志文件；
  - 清理构建输出dist/目录；

- **配置文件优化**：
  - 删除冗余的mcp-config-bun-alt.json配置；
  - 统一配置文件格式和内容；
  - 保持配置文件最小化和清晰性；

- **代码质量提升**：
  - 修复所有TypeScript类型错误；
  - 通过ESLint和Prettier代码规范检查；
  - 优化函数签名和返回类型定义；
  - 改进错误处理和日志记录；

