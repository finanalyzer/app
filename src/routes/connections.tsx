import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Icon } from "@openbb/ui";
import AddConnectionModal from "../components/connections/AddConnectionModal";
import ConnectionsTable from "../components/connections/ConnectionsTable";
import DeleteConfirmationModal from "../components/connections/DeleteConfirmationModal";
import EditConnectionModal from "../components/connections/EditConnectionModal";
import SearchFilterBar from "../components/connections/SearchFilterBar";
import { connectionService } from "../services/connections/connectionService";
import type { Connection } from "../types/connections";

export const Route = createFileRoute("/connections")({
  component: RouteComponent,
});

function RouteComponent() {
  return <ConnectionsPage />;
}

function ConnectionsPage() {
  const { t } = useTranslation();
  const [connections, setConnections] = useState<Connection[]>(() =>
    connectionService.getConnections(),
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "All" | "connected" | "disconnected" | "testing" | "error"
  >("All");
  const [sortBy, setSortBy] = useState<"Name" | "Activity">("Name");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] =
    useState<Connection | null>(null);

  const loadConnections = () => {
    const loadedConnections = connectionService.getConnections();
    console.log(`[ConnectionsPage] loadConnections() called, ${loadedConnections.length} connections loaded`);
    setConnections(loadedConnections);
  };

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "finanalyzer_connections") {
        loadConnections();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const initAndLoad = async () => {
      try {
        await connectionService.initialize();
        if (isMounted) {
          console.log("[ConnectionsPage] Connection service initialized, loading connections");
          loadConnections();
        }
      } catch (error) {
        console.error("[ConnectionsPage] Failed to initialize connection service:", error);
      }
    };

    initAndLoad();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const handleStatusFilter = (
    status: "All" | "connected" | "disconnected" | "testing" | "error",
  ) => {
    setStatusFilter(status);
  };

  const handleSort = (sort: "Name" | "Activity") => {
    setSortBy(sort);
  };

  const handleAddConnection = () => {
    setIsAddModalOpen(true);
  };

  const handleConnectionAdded = () => {
    loadConnections();
    setIsAddModalOpen(false);
  };

  const handleEditConnection = (connection: Connection) => {
    setSelectedConnection(connection);
    setIsEditModalOpen(true);
  };

  const handleConnectionUpdated = () => {
    loadConnections();
    setIsEditModalOpen(false);
    setSelectedConnection(null);
  };

  const handleDeleteConnection = (connection: Connection) => {
    setSelectedConnection(connection);
    setIsDeleteModalOpen(true);
  };

  const handleConnectionDeleted = async () => {
    if (selectedConnection) {
      try {
        await connectionService.deleteConnectionAsync(selectedConnection.id);
        loadConnections();
        setIsDeleteModalOpen(false);
        setSelectedConnection(null);
      } catch (err) {
        console.error("Error deleting connection:", err);
      }
    }
  };

  const handleRefresh = () => {
    loadConnections();
  };

  const filteredConnections = connections
    .filter((connection) => {
      const matchesSearch = connection.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "All" || connection.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === "Name") {
        return a.name.localeCompare(b.name);
      } else {
        return (
          new Date(b.lastActivity).getTime() -
          new Date(a.lastActivity).getTime()
        );
      }
    });

  return (
    <div className="work-area">
      <div className="work-area-header flex justify-between items-start">
        <div>
          <h1 className="work-area-title">{t("connections.title")}</h1>
          <p className="work-area-subtitle">{t("connections.subtitle")}</p>
        </div>
        <Button variant="primary" onClick={handleAddConnection}>
          <Icon name={"plus" as never} size={16} />
          {t("connections.addConnection")}
        </Button>
      </div>

      <SearchFilterBar
        searchTerm={searchTerm}
        onSearch={handleSearch}
        statusFilter={statusFilter}
        onStatusFilter={handleStatusFilter}
        sortBy={sortBy}
        onSort={handleSort}
      />

      <div className="work-area-content">
        <ConnectionsTable
          connections={filteredConnections}
          onEdit={handleEditConnection}
          onDelete={handleDeleteConnection}
          onRefresh={handleRefresh}
        />
      </div>

      <AddConnectionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onConnectionAdded={handleConnectionAdded}
      />

      <EditConnectionModal
        isOpen={isEditModalOpen}
        connection={selectedConnection}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedConnection(null);
        }}
        onConnectionUpdated={handleConnectionUpdated}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        backendName={selectedConnection?.name || ""}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedConnection(null);
        }}
        onDelete={handleConnectionDeleted}
      />
    </div>
  );
}
