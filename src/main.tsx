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

// Initialize theme from localStorage
const savedTheme = localStorage.getItem("theme") || "dark";
document.documentElement.classList.toggle("dark", savedTheme === "dark");

console.log("=== MAIN.TSX FILE LOADED ===");

// Import i18n initialization
import i18n from "./i18n";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

Icon.defaultUrl = "/spritemap.svg";

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
