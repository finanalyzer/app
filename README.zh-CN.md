# Finanalyzer App

> 开源版 OpenBB Workspace 前端应用 - 为个人用户打造的金融分析工作台

## 📖 项目简介

Finanalyzer App 是 Finanalyzer 项目的前端部分，是一个基于 React + TypeScript 构建的现代金融分析工作台。它完全兼容 OpenBB Workspace 的架构标准，为个人用户提供更自由、更开放的选择。

### 🎯 核心特性

- ✅ **完全开源** - 代码透明，自由定制
- ✅ **中文友好** - 内置中英文双语支持
- ✅ **功能自由** - HTML Widget 支持 JavaScript，解锁无限可能
- ✅ **Debug Widget** - 开发者友好，轻松检查数据
- ✅ **AI 整合** - 集成 Claude Code / OpenCode，让分析更智能
- ✅ **生态兼容** - 无缝对接 OpenBB 生态

## 🏗️ 技术架构

Finanalyzer 前端采用与 OpenBB ODP Desktop App 一致的技术栈：

- **React 18** + **TypeScript** - 稳定可靠
- **TanStack Router** (v1.131) - 现代化路由
- **@openbb/ui** - 与 OpenBB 一致的 UI 风格（开源版）
- **TailwindCSS** (v3.4) - 快速样式开发
- **React Markdown** - Markdown 渲染支持
- **Vite 7** - 极速构建
- **ESLint** + **TypeScript ESLint** - 代码质量保证

## 📦 安装指南

### 前置要求

- **Node.js**: 版本 18.0 或更高
- **npm** 或 **pnpm**: 最新稳定版（推荐 pnpm）
- **Git**: 版本 2.30 或更高
- **现代浏览器**: Chrome, Firefox, Edge, 或 Safari（最新版本）

验证环境：

```bash
node --version  # >= 18.0
npm --version
git --version
```

### 安装步骤

1. **克隆仓库**

```bash
git clone https://github.com/finanalyzer/app.git finanalyzer-app
cd finanalyzer-app
```

1. **安装依赖**

```bash
# 使用 npm
npm install

# 或使用 pnpm（推荐）
pnpm install
```

1. **配置环境变量**

创建 `.env` 文件：

```bash
cp .env.example .env  # 如果存在 .env.example
```

编辑 `.env` 文件：

```env
# 后端 API 基础 URL（连接远程后端时必需）
VITE_API_BASE_URL=https://your-backend.example.com

# 应用标题（可选）
VITE_APP_TITLE=Finanalyzer

# 代理配置（可选，用于开发）
VITE_PROXY_PATH=/api
VITE_PROXY_TARGET_URL=http://localhost:8001
```

**环境变量说明**：

| 变量                      | 必需  | 说明                                  |
| ----------------------- | --- | ----------------------------------- |
| `VITE_API_BASE_URL`     | 否\* | 后端 API 基础 URL。本地开发时留空使用 Vite 代理     |
| `VITE_APP_TITLE`        | 否   | 浏览器标签页显示的应用标题                       |
| `VITE_PROXY_PATH`       | 否   | 开发代理路径（如 `/api`）                    |
| `VITE_PROXY_TARGET_URL` | 否   | 代理目标 URL（如 `http://localhost:8001`） |

*\*连接远程后端时必需。本地开发时使用 Vite 代理处理路由。*

1. **验证安装**

```bash
npm list --depth=0
npm run lint
```

## 🚀 快速开始

### 启动开发服务器

```bash
npm run dev
```

输出示例：

```
  VITE v8.0.1  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### 访问应用

1. 打开浏览器访问 **<http://localhost:5173>**
2. 首次使用建议：
   - **配置语言**：点击右上角语言选择器切换中英文
   - **添加后端连接**：如使用远程后端，前往"连接"页面配置
   - **创建仪表板**：前往"仪表板"页面创建你的第一个投资仪表板

### 在线体验

👉 **GitHub Pages 演示**: <https://finanalyzer.github.io/app>

**注意**：静态页面构建时默认后端链接为 `http://localhost:8001/api`，需要在"连接"页面配置后端并在本地启动后端服务才能正常工作。

## 📚 使用指南

### 界面结构

#### 侧边栏导航（左侧）

- **仪表板**：查看和管理投资仪表板
- **连接**：配置后端连接
- **扩展**：安装和管理扩展
- **应用**：启动和配置应用
- **设置**：用户偏好和配置

**移动端**：侧边栏折叠为汉堡菜单，点击左上角图标展开。

#### 主内容区域（中央）

显示当前活动页面：仪表板、连接、扩展、应用或设置页面。

#### 顶部栏

- **应用标题**："Finanalyzer"（或自定义标题）
- **语言选择器**：切换中英文
- **用户菜单**：用户资料和设置（如已认证）

### 仪表板功能

仪表板是 Finanalyzer 的核心，用于创建和管理投资仪表板。

#### Widget 类型

1. **Chart Widget**：可视化数据（折线图、柱状图、饼图）
2. **Table Widget**：显示表格数据（支持排序、筛选、分页）
3. **Metric Widget**：显示关键指标（大数字、趋势指示器）
4. **Markdown Widget**：添加自定义笔记和分析
5. **HTML Widget**：自定义 HTML 内容（支持 JavaScript）
6. **Debug Widget**：开发者调试工具

#### 添加 Widget

1. 点击仪表板右上角的 **"Add Widget"** 按钮
2. 从弹窗中选择 Widget 类型
3. 配置 Widget 参数（标题、数据源、其他设置）
4. 点击 **"Add"** 放置 Widget
5. 拖动 Widget 到所需位置
6. 拖动角落调整大小

### 连接管理

管理远程部署的后端连接。

#### 添加连接

1. 点击 **"Add Connection"** 按钮
2. 输入连接详情：
   - **Name**：连接显示名称
   - **URL**：后端 API 基础 URL（如 `https://api.example.com`）
   - **Authentication**：选择认证方式
     - **Header**：添加认证头（如 `Authorization: Bearer token`）
     - **Query**：添加查询参数（如 `access_token=xxx`）
3. 点击 **"Test Connection"** 验证
4. 点击 **"Save"** 保存连接

### 国际化

#### 切换语言

1. 点击右上角语言选择器
2. 选择语言：
   - **English**：切换到英文
   - **中文**：切换到中文
3. 所有 UI 文本立即更新
4. 偏好保存到浏览器本地存储

## 🔧 Dashboard API Service

`src/services/dashboardApi.ts` 服务处理所有仪表板相关的 API 调用，支持自动认证：

### 特性

- **基于连接的认证**：根据 `VITE_API_BASE_URL` 自动从 `connectionService` 获取认证头
- **URL 编码**：正确处理包含斜杠的 Widget ID
- **查询参数支持**：除头部外，还支持通过查询参数认证

### 使用示例

```typescript
import { getDashboards, deleteWidget } from './services/dashboardApi';

// 获取所有仪表板（自动处理认证）
const dashboards = await getDashboards();

// 删除 Widget（Widget ID 自动 URL 编码）
await deleteWidget(dashboardId, 'equity/screener-123');
```

### 认证流程

1. 服务从环境变量读取 `VITE_API_BASE_URL`
2. 匹配 `connectionService` 中配置的连接
3. 从匹配的连接中提取认证头/查询参数
4. 所有 API 请求自动包含认证信息

## 🛠️ 开发命令

```bash
# 开发服务器
npm run dev

# 构建生产版本
npm run build

# 运行 linter
npm run lint

# 修复 lint 问题
npm run lint:fix

# 运行测试（监视模式）
npm run test

# 运行测试并生成覆盖率
npm run test:coverage

# 运行单个测试文件
npx vitest run tests/example.test.ts

# 运行单个测试
npx vitest run tests/example.test.ts -t "test name"
```

## 🌐 部署

### GitHub Pages

项目包含 GitHub Actions 工作流，自动构建并部署到 GitHub Pages：

1. 推送到 `main` 分支触发构建
2. 构建静态文件
3. 部署到 `https://finanalyzer.github.io/app`

### 自定义部署

构建生产版本：

```bash
npm run build
```

构建产物位于 `dist/` 目录，可部署到任何静态文件服务器。

## 🤝 贡献

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'feat: add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

### 代码风格

- 遵循 ESLint + TypeScript strict 模式
- 使用 `npm run lint:fix` 自动修复格式问题
- 遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 🔗 相关项目

- **Finanalyzer API (后端)**: <https://github.com/finanalyzer/api>
- **OpenBB Platform**: <https://github.com/OpenBB-finance/OpenBB>

## 💬 支持

- **问题反馈**: [GitHub Issues](https://github.com/finanalyzer/app/issues)
- **功能建议**: [GitHub Discussions](https://github.com/finanalyzer/app/discussions)

***

> 投资有风险，分析需谨慎。本工具仅供研究学习使用。

