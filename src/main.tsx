import { DesignSystemProvider, Icon } from "@openbb/ui";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { createHashHistory } from "@tanstack/history";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from 'react-i18next';
import "./index.css";

// Import widget factory to register built-in widget types
import "./services/widgets/widgetFactory";

// Import connection service for initialization
import { connectionService } from "./services/connections/connectionService";

// Initialize theme from localStorage
const savedTheme = localStorage.getItem("theme") || "dark";
document.documentElement.classList.toggle("dark", savedTheme === "dark");

console.log("=== MAIN.TSX FILE LOADED ===");

// Import i18n initialization
import i18n from "./i18n";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

Icon.defaultUrl = `${import.meta.env.BASE_URL}spritemap.svg`;

console.log("=== ROUTE TREE:", routeTree);

// Create hash-based history for static deployment
const hashHistory = createHashHistory();

// Create a new router instance with hash-based routing
const router = createRouter({ 
  routeTree,
  history: hashHistory,
});

console.log("=== ROUTER CREATED ===");

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

console.log("=== QUERY CLIENT CREATED ===");

async function bootstrap() {
  console.log("=== BOOTSTRAP: Initializing connection service ===");
  
  try {
    await connectionService.initialize();
    console.log("=== BOOTSTRAP: Connection service initialized ===");
    
    const connections = connectionService.getConnections();
    const storageType = connectionService.getStorageType();
    console.log(`=== BOOTSTRAP: Storage Type: ${storageType} ===`);
    console.log(`=== BOOTSTRAP: Number of connections: ${connections.length} ===`);
    connections.forEach((conn, index) => {
      console.log(`=== BOOTSTRAP: Connection [${index + 1}]: id=${conn.id}, name=${conn.name}, url=${conn.url}, status=${conn.status}, authType=${conn.authType} ===`);
    });
    
    const token = localStorage.getItem('passxyz-token');
    console.log(`=== BOOTSTRAP: passxyz-token present: ${!!token} ===`);
  } catch (error) {
    console.error("=== BOOTSTRAP: Failed to initialize connection service:", error);
  }

  const rootElement = document.getElementById("root")!;
  if (!rootElement.innerHTML) {
    console.log("=== ROOT ELEMENT FOUND, RENDERING APP ===");
    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={i18n}>
            <DesignSystemProvider value={{ tailwind: {} }}>
              <RouterProvider router={router} />
            </DesignSystemProvider>
          </I18nextProvider>
        </QueryClientProvider>
      </StrictMode>,
    );
  }
}

bootstrap();
