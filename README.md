# Finanalyzer App

> Open-Source OpenBB Workspace Frontend Application - A Financial Analysis Workbench Built for Individual Users

## 📖 Project Overview

Finanalyzer App is the frontend component of the Finanalyzer project, a modern financial analysis workbench built with React + TypeScript. It fully complies with OpenBB Workspace architecture standards, providing individual users with a more flexible and open alternative.

### 🎯 Core Features

- ✅ **Fully Open Source** - Transparent code, free customization
- ✅ **Chinese-Friendly** - Built-in bilingual support (Chinese/English)
- ✅ **Unrestricted Functionality** - HTML Widget supports JavaScript, unlocking unlimited possibilities
- ✅ **Debug Widget** - Developer-friendly, easy data inspection
- ✅ **AI Integration** - Integrated Claude Code / OpenCode for intelligent analysis
- ✅ **Ecosystem Compatible** - Seamless integration with OpenBB ecosystem

## 🏗️ Technical Architecture

Finanalyzer frontend adopts the same technology stack as OpenBB ODP Desktop App:

- **React 18** + **TypeScript** - Stable and reliable
- **TanStack Router** (v1.131) - Modern routing
- **@openbb/ui** - OpenBB-consistent UI styles (open-source version)
- **TailwindCSS** (v3.4) - Rapid styling
- **React Markdown** - Markdown rendering support
- **Vite 7** - Lightning-fast build
- **ESLint** + **TypeScript ESLint** - Code quality assurance

## 📦 Installation Guide

### Prerequisites

- **Node.js**: Version 18.0 or higher
- **npm** or **pnpm**: Latest stable version (pnpm recommended)
- **Git**: Version 2.30 or higher
- **Modern Browser**: Chrome, Firefox, Edge, or Safari (latest versions)

Verify your environment:

```bash
node --version  # >= 18.0
npm --version
git --version
```

### Installation Steps

1. **Clone the Repository**

```bash
git clone https://github.com/finanalyzer/app.git finanalyzer-app
cd finanalyzer-app
```

1. **Install Dependencies**

```bash
# Using npm
npm install

# Or using pnpm (recommended)
pnpm install
```

1. **Configure Environment Variables**

Create a `.env` file:

```bash
cp .env.example .env  # If .env.example exists
```

Edit the `.env` file:

```env
# Backend API base URL (required when connecting to remote backend)
VITE_API_BASE_URL=https://your-backend.example.com

# Application title (optional)
VITE_APP_TITLE=Finanalyzer

# Proxy configuration (optional, for development)
VITE_PROXY_PATH=/api
VITE_PROXY_TARGET_URL=http://localhost:8001
```

**Environment Variables**:

| Variable                | Required | Description                                                     |
| ----------------------- | -------- | --------------------------------------------------------------- |
| `VITE_API_BASE_URL`     | No\*     | Backend API base URL. Leave empty for local dev with Vite proxy |
| `VITE_APP_TITLE`        | No       | Application title displayed in browser tab                      |
| `VITE_PROXY_PATH`       | No       | Development proxy path (e.g., `/api`)                           |
| `VITE_PROXY_TARGET_URL` | No       | Proxy target URL (e.g., `http://localhost:8001`)                |

*\*Required when connecting to a remote backend. For local development, Vite proxy handles routing.*

1. **Verify Installation**

```bash
npm list --depth=0
npm run lint
```

## 🚀 Quick Start

### Start Development Server

```bash
npm run dev
```

Expected output:

```
  VITE v8.0.1  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### Access the Application

1. Open your browser and navigate to **<http://localhost:5173>**
2. First-time setup recommendations:
   - **Configure Language**: Click the language selector (top-right) to switch between Chinese and English
   - **Add Backend Connection**: If using a remote backend, navigate to the "Connections" page to configure
   - **Create Dashboard**: Go to the "Dashboard" page to create your first investment dashboard

### Online Demo

👉 **GitHub Pages Demo**: <https://finanalyzer.github.io/app>

**Note**: The static build uses a default backend URL of `http://localhost:8001/api`. You need to configure the backend on the "Connections" page and start the backend service locally for proper functionality.

## 📚 User Guide

### Interface Structure

#### Sidebar Navigation (Left)

- **Dashboard**: View and manage investment dashboards
- **Connections**: Configure backend connections
- **Extensions**: Install and manage extensions
- **Apps**: Launch and configure applications
- **Settings**: User preferences and configuration

**Mobile**: Sidebar collapses into a hamburger menu. Tap the icon (top-left) to expand.

#### Main Content Area (Center)

Displays the active page: Dashboard, Connections, Extensions, Apps, or Settings.

#### Header (Top)

- **Application Title**: "Finanalyzer" (or custom title)
- **Language Selector**: Switch between Chinese and English
- **User Menu**: User profile and settings (if authenticated)

### Dashboard Functionality

The dashboard is the core of Finanalyzer, used for creating and managing investment dashboards.

#### Widget Types

1. **Chart Widget**: Visualize data (line, bar, pie charts)
2. **Table Widget**: Display tabular data (supports sorting, filtering, pagination)
3. **Metric Widget**: Display key metrics (large numbers, trend indicators)
4. **Markdown Widget**: Add custom notes and analysis
5. **HTML Widget**: Custom HTML content (supports JavaScript)
6. **Debug Widget**: Developer debugging tool

#### Adding Widgets

1. Click the **"Add Widget"** button (top-right of dashboard)
2. Select widget type from the modal
3. Configure widget parameters (title, data source, other settings)
4. Click **"Add"** to place the widget
5. Drag the widget to desired position
6. Drag corners to resize

### Connection Management

Manage backend connections for remote deployments.

#### Adding a Connection

1. Click the **"Add Connection"** button
2. Enter connection details:
   - **Name**: Connection display name
   - **URL**: Backend API base URL (e.g., `https://api.example.com`)
   - **Authentication**: Select authentication method
     - **Header**: Add authentication header (e.g., `Authorization: Bearer token`)
     - **Query**: Add query parameter (e.g., `access_token=xxx`)
3. Click **"Test Connection"** to verify
4. Click **"Save"** to save the connection

#### Cloudflare Access Authentication

For backends protected by Cloudflare Access:

1. Visit the backend URL and complete Cloudflare Access authentication
2. Open browser DevTools → Application → Cookies
3. Copy the `CF_Authorization` cookie value
4. When adding a connection in Finanalyzer, select Header authentication
5. Add authentication header:
   - **Key**: `CF-Authorization`
   - **Value**: \[paste token]

### Internationalization

#### Switching Languages

1. Click the language selector (top-right corner)
2. Select language:
   - **English**: Switch to English
   - **中文**: Switch to Chinese
3. All UI text updates immediately
4. Preference is saved to browser local storage

## 🔧 Dashboard API Service

The `src/services/dashboardApi.ts` service handles all dashboard-related API calls with automatic authentication:

### Features

- **Connection-based Authentication**: Automatically retrieves authentication headers from `connectionService` based on `VITE_API_BASE_URL`
- **URL Encoding**: Properly handles widget IDs containing slashes
- **Query Parameter Support**: Supports authentication via query parameters in addition to headers

### Usage Examples

```typescript
import { getDashboards, deleteWidget } from './services/dashboardApi';

// Get all dashboards (authentication handled automatically)
const dashboards = await getDashboards();

// Delete a widget (widget ID is URL-encoded automatically)
await deleteWidget(dashboardId, 'equity/screener-123');
```

### Authentication Flow

1. Service reads `VITE_API_BASE_URL` from environment variables
2. Matches connection configured in `connectionService`
3. Extracts authentication headers/query parameters from matching connection
4. All API requests automatically include authentication information

## 🛠️ Development Commands

```bash
# Development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Fix lint issues
npm run lint:fix

# Run tests (watch mode)
npm run test

# Run tests with coverage
npm run test:coverage

# Run single test file
npx vitest run tests/example.test.ts

# Run single test
npx vitest run tests/example.test.ts -t "test name"
```

## 🌐 Deployment

### GitHub Pages

The project includes a GitHub Actions workflow that automatically builds and deploys to GitHub Pages:

1. Push to `main` branch triggers build
2. Static files are built
3. Deployed to `https://finanalyzer.github.io/app`

### Custom Deployment

Build for production:

```bash
npm run build
```

Build artifacts are located in the `dist/` directory and can be deployed to any static file server.

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Submit a Pull Request

### Code Style

- Follow ESLint + TypeScript strict mode
- Use `npm run lint:fix` to auto-fix formatting issues
- Follow [Conventional Commits](https://www.conventionalcommits.org/) specification

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- **Finanalyzer API (Backend)**: <https://github.com/finanalyzer/api>
- **OpenBB Platform**: <https://github.com/OpenBB-finance/OpenBB>

## 💬 Support

- **Issue Tracker**: [GitHub Issues](https://github.com/finanalyzer/app/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/finanalyzer/app/discussions)

***

> Investment involves risks, analysis should be done carefully. This tool is for research and learning purposes only.

