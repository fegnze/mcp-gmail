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
  - 将 config/credentials.json 中的实际参数值同步到所有 MCP 配置文件：
    - client_id: `YOUR_CLIENT_ID_HERE`
    - client_secret: `YOUR_CLIENT_SECRET_HERE`
    - redirect_uri: `https://developers.google.com/oauthplayground`
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
