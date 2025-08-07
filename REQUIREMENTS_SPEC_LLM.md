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
