import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Icon } from "@openbb/ui";
import { mcpClient } from "../../services/mcp/mcpClient";
import { mcpToolRegistry } from "../../services/mcp/mcpToolRegistry";
import { companionBridge } from "../../services/mcp/companionBridge";
import type { McpServerConnection } from "../../services/mcp/mcpClient";

interface McpServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingConnection: McpServerConnection | null;
}

interface HeaderItem {
  key: string;
  value: string;
}

export function McpServerModal({
  isOpen,
  onClose,
  onSave,
  editingConnection,
}: McpServerModalProps): JSX.Element | null {
  const { t } = useTranslation();
  const [serverUrl, setServerUrl] = useState("");
  const [headers, setHeaders] = useState<HeaderItem[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    message: string;
    toolCount?: number;
  } | null>(null);

  const modalRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setServerUrl("");
      setHeaders([]);
      setConnectionResult(null);
      return;
    }

    const isDark = document.documentElement.classList.contains("dark");
    if (modalRootRef.current) {
      if (isDark) {
        modalRootRef.current.classList.add("dark");
      } else {
        modalRootRef.current.classList.remove("dark");
      }
    }

    if (editingConnection) {
      setServerUrl(editingConnection.serverUrl);
      setHeaders(
        Object.entries(editingConnection.headers).map(([key, value]) => ({ key, value })),
      );
    }
  }, [isOpen, editingConnection]);

  const handleAddHeader = () => {
    setHeaders([...headers, { key: "", value: "" }]);
  };

  const handleRemoveHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const handleHeaderChange = (index: number, field: "key" | "value", value: string) => {
    const newHeaders = [...headers];
    newHeaders[index] = { ...newHeaders[index], [field]: value };
    setHeaders(newHeaders);
  };

  const handleTestConnection = async () => {
    if (!serverUrl) return;

    setIsConnecting(true);
    setConnectionResult(null);

    try {
      const headersObj: Record<string, string> = {};
      headers.forEach((h) => {
        if (h.key && h.value) {
          headersObj[h.key] = h.value;
        }
      });

      // Step 1: Connect MCP client (discovers tools from /mcp endpoint)
      const connection = await mcpClient.connect(serverUrl, headersObj);
      const tools = await mcpClient.discoverTools(connection.sessionId);

      mcpToolRegistry.registerServer(connection, tools);

      // Step 2: Establish bridge session (POST /bridge/session/start + WebSocket)
      try {
        await companionBridge.connect(serverUrl);
      } catch (bridgeError) {
        // Bridge is optional — the MCP tools will work once the user
        // connects OpenBB Workspace via MCP Companion.
      }

      setConnectionResult({
        success: true,
        message: t("mcp.connectionSuccess"),
        toolCount: tools.length,
      });
    } catch (error) {
      setConnectionResult({
        success: false,
        message: error instanceof Error ? error.message : t("mcp.connectionFailed"),
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSave = async () => {
    if (!serverUrl) return;

    const headersObj: Record<string, string> = {};
    headers.forEach((h) => {
      if (h.key && h.value) {
        headersObj[h.key] = h.value;
      }
    });

    if (editingConnection) {
      await mcpClient.disconnect(editingConnection.sessionId);
      mcpToolRegistry.unregisterServer(editingConnection.sessionId);
    }

    // Disconnect any existing bridge session
    if (companionBridge.connected) {
      companionBridge.disconnect();
    }

    if (connectionResult?.success) {
      onSave();
      return;
    }

    const connection = await mcpClient.connect(serverUrl, headersObj);
    const tools = await mcpClient.discoverTools(connection.sessionId);
    mcpToolRegistry.registerServer(connection, tools);

    // Establish bridge session
    try {
      await companionBridge.connect(serverUrl);
    } catch {
      // Bridge is optional
    }

    onSave();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div ref={modalRootRef} className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-dark-900 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editingConnection ? t("mcp.editServer") : t("mcp.addServer")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-dark-800 rounded transition-colors"
          >
            <Icon name={"x" as never} size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t("mcp.serverUrl")}
            </label>
            <Input
              type="url"
              value={serverUrl}
              onChange={(value) => {
                setServerUrl(String(value));
                setConnectionResult(null);
              }}
              placeholder="http://localhost:8787"
              className="w-full"
              disabled={isConnecting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t("mcp.customHeaders")}
            </label>
            <div className="space-y-2">
              {headers.map((header, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input
                    type="text"
                    value={header.key}
                    onChange={(value) => handleHeaderChange(index, "key", String(value))}
                    placeholder={t("mcp.headerKey")}
                    className="flex-1"
                    disabled={isConnecting}
                  />
                  <Input
                    type="text"
                    value={header.value}
                    onChange={(value) => handleHeaderChange(index, "value", String(value))}
                    placeholder={t("mcp.headerValue")}
                    className="flex-1"
                    disabled={isConnecting}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon
                    onClick={() => handleRemoveHeader(index)}
                    disabled={isConnecting}
                    className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <Icon name={"trash" as never} size={14} />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddHeader}
                disabled={isConnecting}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <Icon name={"plus" as never} size={14} className="mr-1" />
                {t("mcp.addHeader")}
              </Button>
            </div>
          </div>

          {connectionResult && (
            <div
              className={`p-3 rounded-lg text-sm ${
                connectionResult.success
                  ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              <div className="flex items-center space-x-2">
                <Icon
                  name={connectionResult.success ? "check" as never : "alert-circle" as never}
                  size={16}
                />
                <span>
                  {connectionResult.message}
                  {connectionResult.toolCount !== undefined && (
                    <span className="ml-1">
                      ({t("mcp.discoveredTools", { count: connectionResult.toolCount })})
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-800">
          <Button variant="ghost" onClick={onClose} disabled={isConnecting}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="secondary"
            onClick={handleTestConnection}
            disabled={!serverUrl || isConnecting}
          >
            {isConnecting ? (
              <Icon name={"loader" as never} size={16} className="animate-spin mr-1" />
            ) : (
              <Icon name={"check" as never} size={16} className="mr-1" />
            )}
            {t("mcp.testConnection")}
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!serverUrl || isConnecting}
          >
            {editingConnection ? t("common.save") : t("common.add")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default McpServerModal;