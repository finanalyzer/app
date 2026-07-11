import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { connectionService } from "../../services/connections/connectionService";
import type { Connection } from "../../types/connections";
import ConnectionForm from "./ConnectionForm";

interface EditConnectionModalProps {
  isOpen: boolean;
  connection: Connection | null;
  onClose: () => void;
  onConnectionUpdated: () => void;
}

function EditConnectionModal({
  isOpen,
  connection,
  onClose,
  onConnectionUpdated,
}: EditConnectionModalProps): JSX.Element | null {
  const { t } = useTranslation();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    { connected: boolean; message?: string } | undefined
  >();

  const modalRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const isDark = document.documentElement.classList.contains("dark");
    if (modalRootRef.current) {
      if (isDark) {
        modalRootRef.current.classList.add("dark");
      } else {
        modalRootRef.current.classList.remove("dark");
      }
    }
  }, [isOpen]);

  if (!isOpen || !connection) {
    return null;
  }

  const handleTest = async (
    values: Omit<
      Connection,
      "id" | "createdAt" | "updatedAt" | "status" | "metrics" | "lastActivity"
    >,
  ) => {
    setIsTesting(true);
    setTestResult(undefined);

    try {
      const result = await connectionService.testConnectionWithDetails({
        url: values.url,
        authType: values.authType,
        authentication: values.authentication,
        validateWidgets: values.validateWidgets,
      });
      setTestResult(result);
      return result;
    } catch (error) {
      const errorResult = {
        connected: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
      setTestResult(errorResult);
      return errorResult;
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (
    values: Omit<
      Connection,
      "id" | "createdAt" | "updatedAt" | "status" | "metrics" | "lastActivity"
    >,
  ) => {
    connectionService.updateConnection(connection.id, values);
    
    // Automatically test the connection after update
    await connectionService.testConnection(connection.id);
    
    onConnectionUpdated();
    onClose();
  };

  return (
    <div ref={modalRootRef} className="modal-overlay">
      <div className="modal-content w-full max-w-md p-6">
        <div className="modal-header">
          <h2 className="modal-title">{t("connections.editConnection")}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            title={t("common.close")}
          >
            ×
          </button>
        </div>
        <ConnectionForm
          initialValues={connection}
          onSubmit={handleSubmit}
          onTest={handleTest}
          isTesting={isTesting}
          testResult={testResult}
        />
      </div>
    </div>
  );
}

export default EditConnectionModal;
