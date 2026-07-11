import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input, Select, Button, Icon, Label } from "@openbb/ui";
import type { Connection, ConnectionAuthType } from "../../types/connections";

interface AuthenticationField {
  key: string;
  value: string;
  description?: string;
  location: "header" | "query";
  id: string;
}

interface ConnectionFormProps {
  initialValues?: Partial<Connection>;
  onSubmit: (
    values: Omit<
      Connection,
      "id" | "createdAt" | "updatedAt" | "status" | "metrics" | "lastActivity"
    >,
  ) => void;
  onTest: (
    values: Omit<
      Connection,
      "id" | "createdAt" | "updatedAt" | "status" | "metrics" | "lastActivity"
    >,
  ) => Promise<{ connected: boolean; message?: string }>;
  isTesting: boolean;
  testResult?: { connected: boolean; message?: string };
}

function ConnectionForm({
  initialValues,
  onSubmit,
  onTest,
  isTesting,
  testResult,
}: ConnectionFormProps): JSX.Element {
  const { t } = useTranslation();
  const [name, setName] = useState(initialValues?.name || "");
  const [url, setUrl] = useState(initialValues?.url || "");
  const [validateWidgets, setValidateWidgets] = useState(
    initialValues?.validateWidgets ? "Yes" : "No",
  );
  const [authType, setAuthType] = useState<ConnectionAuthType>(
    initialValues?.authType || "none",
  );
  const [authentication, setAuthentication] = useState<AuthenticationField[]>(
    initialValues?.authentication?.map((auth, index) => ({
      ...auth,
      id: `auth-${index}`,
    })) || [],
  );

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const addAuthenticationField = () => {
    setAuthentication([
      ...authentication,
      {
        key: "",
        value: "",
        location: "header",
        id: `auth-${Date.now()}`,
      },
    ]);
  };

  const removeAuthenticationField = (id: string) => {
    setAuthentication(authentication.filter((field) => field.id !== id));
  };

  const updateAuthenticationField = (
    id: string,
    field: keyof AuthenticationField,
    value: string,
  ) => {
    setAuthentication(
      authentication.map((auth) =>
        auth.id === id ? { ...auth, [field]: value } : auth,
      ),
    );
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!name || name.length < 3 || name.length > 50) {
      newErrors.name = t("connections.validation.name");
    }

    try {
      new URL(url);
    } catch {
      newErrors.url = t("connections.validation.url");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const removeIdFromAuth = (auth: AuthenticationField) => {
    return Object.fromEntries(
      Object.entries(auth).filter(([key]) => key !== "id"),
    ) as Omit<AuthenticationField, "id">;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit({
        name,
        url,
        apiKey: "",
        validateWidgets: validateWidgets === "Yes",
        authType,
        authentication: authentication.map(removeIdFromAuth),
      });
    }
  };

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      await onTest({
        name,
        url,
        apiKey: "",
        validateWidgets: validateWidgets === "Yes",
        authType,
        authentication: authentication.map(removeIdFromAuth),
      });
    }
  };

  const showAuthenticationFields = authType === "custom";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>{t("connections.name")}</Label>
        <Input
          type="text"
          value={name}
          onChange={(value) => setName(String(value))}
          placeholder="my-backend-01"
        />
        {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label>{t("connections.url")}</Label>
        <Input
          type="text"
          value={url}
          onChange={(value) => setUrl(String(value))}
          placeholder="https://api.example.com"
        />
        {errors.url && <p className="text-sm text-red-600">{errors.url}</p>}
      </div>

      <div className="space-y-2">
        <Label>{t("connections.validateWidgets")}</Label>
        <Select
          value={validateWidgets}
          onChange={setValidateWidgets}
          options={[
            { value: "No", label: t("common.no") },
            { value: "Yes", label: t("common.yes") },
          ]}
          className="text-gray-900"
        />
      </div>

      <div className="space-y-2">
        <Label>{t("connections.authType")}</Label>
        <Select
          value={authType}
          onChange={(value) => setAuthType(value as ConnectionAuthType)}
          options={[
            { value: "none", label: t("connections.authTypeNone") },
            { value: "custom", label: t("connections.authTypeCustom") },
            { value: "passxyz-jwt", label: t("connections.authTypePassxyz") },
          ]}
          className="text-gray-900"
        />
      </div>

      {showAuthenticationFields && (
        <>
          {authentication.map((auth) => (
            <div key={auth.id} className="flex space-x-2 items-end">
              <div className="flex-1 space-y-2">
                <Label>{t("connections.key")}</Label>
                <Input
                  type="text"
                  value={auth.key}
                  onChange={(value) =>
                    updateAuthenticationField(auth.id, "key", String(value))
                  }
                  placeholder={t("connections.key")}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label>{t("connections.value")}</Label>
                <Input
                  type="text"
                  value={auth.value}
                  onChange={(value) =>
                    updateAuthenticationField(auth.id, "value", String(value))
                  }
                  placeholder={t("connections.value")}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label>{t("connections.location")}</Label>
                <Select
                  value={auth.location}
                  onChange={(value) =>
                    updateAuthenticationField(
                      auth.id,
                      "location",
                      value as "header" | "query",
                    )
                  }
                  options={[
                    { value: "header", label: t("connections.header") },
                    { value: "query", label: t("connections.query") },
                  ]}
                  className="text-gray-900"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeAuthenticationField(auth.id)}
                className="text-red-500"
              >
                ×
              </Button>
            </div>
          ))}

          <Button variant="link" type="button" onClick={addAuthenticationField}>
            <Icon name={"plus" as never} size={16} />
            {t("connections.addAuthentication")}
          </Button>
        </>
      )}

      {testResult && (
        <div
          className={`p-4 rounded-md ${testResult.connected ? "bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-300"}`}
        >
          {testResult.connected
            ? t("connections.connectionSuccess")
            : `${t("connections.connectionFailed")}: ${testResult.message}`}
        </div>
      )}

      <div className="flex justify-end space-x-2 pt-4">
        <Button
          variant="secondary"
          onClick={handleTest}
          disabled={isTesting}
        >
          {isTesting
            ? t("connections.testing")
            : t("connections.testConnection")}
        </Button>
        <Button
          variant="primary"
          type="submit"
          disabled={isTesting}
        >
          {initialValues ? t("common.save") : t("common.add")}
        </Button>
      </div>
    </form>
  );
}

export default ConnectionForm;