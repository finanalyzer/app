import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Icon } from "@openbb/ui";
import { mcpClient } from "../../services/mcp/mcpClient";
import { mcpToolRegistry } from "../../services/mcp/mcpToolRegistry";
import { companionBridge } from "../../services/mcp/companionBridge";
import type { McpServerConnection } from "../../services/mcp/mcpClient";
import McpServerModal from "./McpServerModal";

export function McpServerList() {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<McpServerConnection | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const getConnections = (): McpServerConnection[] => {
    return mcpClient.getConnections();
  };

  const handleAddServer = () => {
    setEditingConnection(null);
    setIsModalOpen(true);
  };

  const handleEditServer = (connection: McpServerConnection) => {
    setEditingConnection(connection);
    setIsModalOpen(true);
  };

  const handleDeleteServer = async (sessionId: string) => {
    await mcpClient.disconnect(sessionId);
    mcpToolRegistry.unregisterServer(sessionId);
    if (companionBridge.connected) {
      companionBridge.disconnect();
    }
  };

  const handleRefresh = async (connection: McpServerConnection) => {
    setRefreshingId(connection.sessionId);
    try {
      await mcpClient.disconnect(connection.sessionId);
      await mcpClient.connect(connection.serverUrl, connection.headers);
    } finally {
      setRefreshingId(null);
    }
  };

  const handleConnectionSaved = () => {
    setIsModalOpen(false);
    setEditingConnection(null);
  };

  const connections = getConnections();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            {t("mcp.servers")}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t("mcp.serversDescription")}
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleAddServer}
          className="text-sm"
        >
          <Icon name={"plus" as never} size={16} className="mr-1" />
          {t("mcp.addServer")}
        </Button>
      </div>

      {connections.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-gray-500 dark:text-gray-400 bg-white dark:bg-dark-900 rounded-lg border border-gray-200 dark:border-dark-700">
          <svg
            className="w-12 h-12 mb-3 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <p className="text-sm">{t("mcp.noServers")}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddServer}
            className="mt-3 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {t("mcp.addFirstServer")}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map((connection) => {
            const serverEntry = mcpToolRegistry.getServer(connection.sessionId);
            const toolCount = serverEntry?.tools.length || 0;

            return (
              <div
                key={connection.sessionId}
                className="bg-white dark:bg-dark-900 rounded-lg border border-gray-200 dark:border-dark-700 p-4 hover:border-gray-300 dark:hover:border-dark-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        connection.connected
                          ? "bg-green-500"
                          : refreshingId === connection.sessionId
                          ? "bg-yellow-500 animate-pulse"
                          : "bg-red-500"
                      }`}
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white text-sm">
                        {connection.serverUrl}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {t("mcp.toolsAvailable", { count: toolCount })} |{" "}
                        {t("mcp.lastConnected", {
                          time: connection.lastConnectedAt ? new Date(connection.lastConnectedAt).toLocaleString() : "-",
                        })}
                        {companionBridge.connected && (
                          <span className="ml-2 inline-flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1" />
                            Bridge connected
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon
                      onClick={() => handleEditServer(connection)}
                      title={t("common.edit")}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      <Icon name={"edit" as never} size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon
                      onClick={() => handleRefresh(connection)}
                      disabled={refreshingId === connection.sessionId}
                      title={t("common.refresh")}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      <Icon
                        name={"refresh-right" as never}
                        size={14}
                        className={refreshingId === connection.sessionId ? "animate-spin" : ""}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon
                      onClick={() => handleDeleteServer(connection.sessionId)}
                      title={t("common.delete")}
                      className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Icon name={"trash" as never} size={14} />
                    </Button>
                  </div>
                </div>

                {serverEntry?.tools.length && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-dark-700">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      {t("mcp.enabledTools")}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {serverEntry.tools.slice(0, 5).map((tool) => (
                        <span
                          key={tool.name}
                          className={`px-2 py-0.5 rounded text-xs ${
                            tool.enabled
                              ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-400"
                          }`}
                        >
                          {tool.name}
                        </span>
                      ))}
                      {serverEntry.tools.length > 5 && (
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500 dark:bg-dark-700 dark:text-gray-400">
                          +{serverEntry.tools.length - 5}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <McpServerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleConnectionSaved}
        editingConnection={editingConnection}
      />
    </div>
  );
}