import { Button } from "@openbb/ui";
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { companionBridge, type BridgeConnectionStatus } from "../../services/mcp/companionBridge";

interface McpCompanionDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function McpCompanionDialog({ isOpen, onClose }: McpCompanionDialogProps) {
  const { t } = useTranslation();
  const [sidecarUrl, setSidecarUrl] = useState("http://127.0.0.1:8787");
  const [connectionStatus, setConnectionStatus] = useState<BridgeConnectionStatus>("disconnected");
  const [testPassed, setTestPassed] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedSidecarUrl = localStorage.getItem("sidecarUrl");
    if (savedSidecarUrl) {
      setSidecarUrl(savedSidecarUrl);
    }
  }, [isOpen]);

  useEffect(() => {
    const unsubscribe = companionBridge.subscribe((event) => {
      if (event.type === "connected") {
        setConnectionStatus("connected");
      } else if (event.type === "disconnected") {
        setConnectionStatus("disconnected");
        setTestPassed(false);
      } else if (event.type === "connecting") {
        setConnectionStatus("connecting");
      } else if (event.type === "error") {
        setConnectionStatus("error");
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSidecarUrlChange = (url: string) => {
    setSidecarUrl(url);
    localStorage.setItem("sidecarUrl", url);
    setTestPassed(false);
    setTestMessage("");
  };

  const handleTest = useCallback(async () => {
    setIsLoading(true);
    setTestMessage("");
    try {
      const response = await fetch(`${sidecarUrl.replace(/\/+$/, "")}/bridge/session/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: "finanalyzer-app" }),
      });
      if (response.ok) {
        setTestPassed(true);
        setTestMessage(t("mcp.testSuccess"));
      } else {
        setTestPassed(false);
        setTestMessage(t("mcp.testFailed"));
      }
    } catch {
      setTestPassed(false);
      setTestMessage(t("mcp.testFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [sidecarUrl, t]);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      await companionBridge.connect(sidecarUrl);
    } catch (error) {
      console.error("Connection failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    companionBridge.disconnect();
  };

  const handleCopyEndpoint = () => {
    const endpoint = `${sidecarUrl.replace(/\/+$/, "")}/bridge/session/start`;
    navigator.clipboard.writeText(endpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setTestPassed(false);
    setTestMessage("");
    onClose();
  };

  const isConnected = connectionStatus === "connected";
  const isDisabled = !testPassed || isLoading;

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[40] bg-black/50 animate-in fade-in duration-200"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-labelledby="mcp-companion-title"
        aria-describedby="mcp-companion-description"
        className="fixed top-[50%] left-[50%] z-[40] translate-x-[-50%] translate-y-[-50%] w-[calc(100%-1rem*2)] max-w-[400px] rounded-md bg-white dark:bg-dark-900 p-4 shadow-lg text-gray-900 dark:text-gray-100 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex flex-col space-y-2.5">
          <h2 id="mcp-companion-title" className="text-sm font-bold text-gray-900 dark:text-gray-100 pr-6">
            {t("mcp.companionTitle")}
          </h2>
          <p id="mcp-companion-description" className="text-xs text-gray-500 dark:text-gray-400">
            {t("mcp.companionDescription")}
          </p>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-4 py-2">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Sidecar URL
            </label>
            <div className="flex items-center rounded border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800">
              <input
                type="text"
                value={sidecarUrl}
                onChange={(e) => handleSidecarUrlChange(e.target.value)}
                disabled={isConnected}
                placeholder="http://127.0.0.1:8787"
                className="flex-1 bg-transparent px-2 py-1.5 text-xs font-mono text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none disabled:text-gray-400 dark:disabled:text-gray-500"
              />
              {sidecarUrl && !isConnected && (
                <button
                  type="button"
                  onClick={() => handleSidecarUrlChange("")}
                  className="px-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label="Clear"
                >
                  <svg id="x" className="size-4">
                    <use href="/assets/icons/sprite.svg?v=v5.2.0#x" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTest}
            disabled={isConnected || isLoading}
          >
            {t("mcp.testConnection")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={isConnected ? handleDisconnect : handleConnect}
            disabled={!isConnected && isDisabled}
          >
            {isConnected ? t("mcp.disconnect") : t("mcp.connect")}
          </Button>
        </div>

        {/* Test Message */}
        {testMessage && (
          <p className={`text-xs mt-2 ${testPassed ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {testMessage}
          </p>
        )}

        {/* Connected State */}
        {isConnected && companionBridge.session && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
            <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">
              {t("mcp.connectedSuccessfully")}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-gray-100 dark:bg-dark-800 px-2 py-1 rounded overflow-x-auto font-mono">
                {sidecarUrl.replace(/\/+$/, "")}/bridge/session/start
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyEndpoint}
                className="shrink-0"
              >
                <svg className="size-4">
                  <use href={copied ? "/assets/icons/sprite.svg?v=v5.2.0#check" : "/assets/icons/sprite.svg?v=v5.2.0#copy"} />
                </svg>
              </Button>
            </div>
          </div>
        )}

        {/* Close Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 h-5 w-5"
          aria-label="Close"
        >
          <svg className="h-4 w-4">
            <use href="/assets/icons/sprite.svg?v=v5.2.0#x" />
          </svg>
        </Button>
      </div>
    </>
  );
}

export default McpCompanionDialog;
