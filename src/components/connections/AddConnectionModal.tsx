import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { connectionService } from "../../services/connections/connectionService";
import type { Connection } from "../../types/connections";
import ConnectionForm from "./ConnectionForm";

interface AddConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionAdded: () => void;
}

function AddConnectionModal({
  isOpen,
  onClose,
  onConnectionAdded,
}: AddConnectionModalProps): JSX.Element | null {
  const { t } = useTranslation();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    { connected: boolean; message?: string } | undefined
  >();

  // Ref for modal root
  const modalRootRef = useRef<HTMLDivElement>(null);

  // Ensure dark mode class is applied to modal root if global theme is dark
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

  if (!isOpen) {
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
    const newConnection = connectionService.createConnection(values);
    
    // Automatically test the connection after creation
    if (newConnection) {
      await connectionService.testConnection(newConnection.id);
    }
    
    onConnectionAdded();
    onClose();
  };

  return (
    <div ref={modalRootRef} className="modal-overlay">
      <div className="modal-content w-full max-w-md p-6">
        <div className="modal-header">
          <h2 className="modal-title">{t("connections.addConnection")}</h2>
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
          onSubmit={handleSubmit}
          onTest={handleTest}
          isTesting={isTesting}
          testResult={testResult}
        />
      </div>
    </div>
  );
}

export default AddConnectionModal;
