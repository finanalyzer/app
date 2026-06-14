import { Icon } from "@openbb/ui";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createDashboard,
  deleteDashboard,
  getDashboards as fetchDashboards,
  updateDashboard,
} from "../../services/dashboardApi";
import { setActiveDashboardId } from "../../services/dashboardSession";
import { McpCompanionDialog } from "../settings/McpCompanionDialog";
import { generateUUID } from "../../utils/uuid";
import "./Sidebar.css";

interface NavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
}

interface DashboardItem {
  id: string;
  name: string;
}

interface SidebarProps {
  isMobile?: boolean;
  onClose?: () => void;
}

const mainNavItems: NavItem[] = [
  { id: "apps", label: "sidebar.main.apps", icon: "grid", href: "/" },
  {
    id: "connections",
    label: "sidebar.main.connections",
    icon: "terminal",
    href: "/connections",
  },
];

const libraryItems: NavItem[] = [
  {
    id: "widgets",
    label: "sidebar.library.widgets",
    icon: "layout",
    href: "/widgets",
  },
  {
    id: "extensions",
    label: "sidebar.library.extensions",
    icon: "box",
    href: "/extensions",
  },
];

export function Sidebar({ isMobile = false, onClose }: SidebarProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [libraryExpanded, setLibraryExpanded] = useState(true);
  const [dashboardsExpanded, setDashboardsExpanded] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [companionDialogOpen, setCompanionDialogOpen] = useState(false);
  const [dashboards, setDashboards] = useState<DashboardItem[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDashboards()
      .then((list) =>
        setDashboards(list.map((d) => ({ id: d.id, name: d.name }))),
      )
      .catch(() => setDashboards([]));
  }, []);

  const handleDeleteDashboard = async (id: string) => {
    try {
      await deleteDashboard(id);
      setDashboards(dashboards.filter((dashboard) => dashboard.id !== id));
    } catch {
      // Silently fail
    }
    setOpenMenuId(null);
  };

  const handleRenameDashboard = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      await updateDashboard(id, { name: newName.trim() });
      setDashboards(
        dashboards.map((dashboard) =>
          dashboard.id === id ? { ...dashboard, name: newName.trim() } : dashboard,
        ),
      );
    } catch {
      // Silently fail
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const handleAddDashboard = async () => {
    const id = generateUUID();
    const name = t("sidebar.dashboards.newDashboard", {
      count: dashboards.length + 1,
    });
    try {
      await createDashboard({ id, name, widgets: [] });
      setDashboards([...dashboards, { id, name }]);
      setActiveDashboardId(id);
      navigate({ to: "/app/$id", params: { id } });
    } catch {
      // Silently fail
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && !isMobile) {
        setCollapsed(true);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) {
      requestAnimationFrame(() => {
        setCollapsed(false);
      });
    }
  }, [isMobile]);

  useEffect(() => {
    const savedLanguage = localStorage.getItem("language");
    if (savedLanguage) {
      i18n.changeLanguage(savedLanguage);
    }
  }, [i18n]);

  useEffect(() => {
    localStorage.setItem("language", i18n.language);
  }, [i18n.language]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setOpenMenuId(null);
        setSettingsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMenuToggle = (
    e: React.MouseEvent | React.KeyboardEvent,
    dashboardId: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenMenuId(openMenuId === dashboardId ? null : dashboardId);
  };

  const startRenaming = (dashboardId: string, currentName: string) => {
    setRenamingId(dashboardId);
    setRenameValue(currentName);
    setOpenMenuId(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, dashboardId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameDashboard(dashboardId, renameValue);
    } else if (e.key === "Escape") {
      setRenamingId(null);
      setRenameValue("");
    }
  };

  const isActive = (href: string) => {
    if (href === "/") {
      return location.pathname === "/" || location.pathname === "/app";
    }
    return location.pathname.startsWith(href);
  };

  const handleNavClick = () => {
    if (isMobile && onClose) {
      onClose();
    }
    setSettingsOpen(false);
  };

  const handleSettingsToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSettingsOpen(!settingsOpen);
  };

  const handleCompanionClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSettingsOpen(false);
    setCompanionDialogOpen(true);
  };

  return (
    <div
      ref={sidebarRef}
      id="sidebar"
      data-testid="sidebar"
      className={`sidebar-container ${isMobile ? "mobile" : ""}`}
      data-collapsed={collapsed}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="sidebar-header">
        <Link to="/" className="sidebar-logo" onClick={handleNavClick}>
          <Icon
            name={"activity" as never}
            className="text-brand-main dark:text-brand-lighter"
          />
          <span className="sidebar-logo-text">{t("sidebar.logo")}</span>
        </Link>
        {!isMobile && (
          <div className="sidebar-header-actions">
            <button
              type="button"
              title={t("sidebar.settings")}
              onClick={handleSettingsToggle}
              className="sidebar-settings-btn"
            >
              <Icon name={"menu" as never} />
            </button>
            {settingsOpen && (
              <div className="settings-menu">
                <div className="settings-menu-item">
                  <Icon name={"user" as never} />
                  <span>{t("sidebar.profile")}</span>
                </div>
                <Link to="/app/settings" className="settings-menu-item" onClick={handleNavClick}>
                  <Icon name={"settings" as never} />
                  <span>{t("sidebar.settings")}</span>
                </Link>
                <button
                  type="button"
                  className="settings-menu-item"
                  onClick={handleCompanionClick}
                  data-testid="mcp-companion"
                >
                  <svg id="mcp" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>{t("mcp.companion")}</span>
                </button>
              </div>
            )}
          </div>
        )}
        {isMobile && onClose && (
          <button
            type="button"
            title="Close menu"
            onClick={onClose}
            className="sidebar-close-btn"
          >
            <Icon name={"x" as never} />
          </button>
        )}
      </div>

      <div className="sidebar-search">
        <button
          type="button"
          title={t("sidebar.search")}
          className="sidebar-search-btn"
        >
          <Icon name={"search" as never} />
          <span className="sidebar-search-text">{t("sidebar.search")}</span>
        </button>
      </div>

      <div className="sidebar-nav-main">
        {mainNavItems.map((item) => (
          <Link
            key={item.id}
            to={item.href}
            onClick={handleNavClick}
            className={`sidebar-nav-item ${isActive(item.href) ? "active" : ""}`}
            aria-current={isActive(item.href) ? "page" : undefined}
          >
            <Icon name={item.icon as never} />
            <span className="sidebar-nav-text">{t(item.label)}</span>
          </Link>
        ))}
      </div>

      <div className="sidebar-section">
        <button
          type="button"
          title={t("sidebar.library.toggle")}
          onClick={() => setLibraryExpanded(!libraryExpanded)}
          className="sidebar-section-header"
          aria-expanded={libraryExpanded}
          aria-controls="library-section"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setLibraryExpanded(!libraryExpanded);
            }
          }}
        >
          <Icon
            name={"chevron-right" as never}
            className={`sidebar-section-chevron ${libraryExpanded ? "expanded" : ""}`}
          />
          <span className="sidebar-section-title">
            {t("sidebar.library.title")}
          </span>
        </button>
        {libraryExpanded && (
          <div id="library-section" className="sidebar-section-content">
            {libraryItems.map((item) => (
              <Link
                key={item.id}
                to={item.href}
                onClick={handleNavClick}
                className={`sidebar-nav-item ${isActive(item.href) ? "active" : ""}`}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                <Icon name={item.icon as never} />
                <span className="sidebar-nav-text">{t(item.label)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="sidebar-section sidebar-dashboards">
        <div className="sidebar-section-header">
          <button
            type="button"
            title={t("sidebar.dashboards.toggle")}
            onClick={() => setDashboardsExpanded(!dashboardsExpanded)}
            className="sidebar-section-toggle"
            aria-expanded={dashboardsExpanded}
            aria-controls="dashboards-section"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setDashboardsExpanded(!dashboardsExpanded);
              }
            }}
          >
            <Icon
              name={"chevron-right" as never}
              className={`sidebar-section-chevron ${dashboardsExpanded ? "expanded" : ""}`}
            />
            <span className="sidebar-section-title">
              {t("sidebar.dashboards.title")}
            </span>
          </button>
          <button
            type="button"
            title={t("sidebar.dashboards.add")}
            className="sidebar-add-btn"
            aria-label="Add new dashboard"
            tabIndex={0}
            onClick={handleAddDashboard}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleAddDashboard();
              }
            }}
          >
            <Icon name={"plus" as never} />
          </button>
        </div>
        {dashboardsExpanded && (
          <div
            id="dashboards-section"
            className="sidebar-section-content sidebar-dashboards-list"
          >
            {dashboards.map((dashboard) => (
              <div
                key={dashboard.id}
                className="sidebar-dashboard-item group relative"
              >
                {renamingId === dashboard.id ? (
                  <div className="flex items-center gap-0.5 w-full overflow-hidden pl-1">
                    <Icon
                      name={"file-04" as never}
                      className="w-4 h-4 min-w-[16px] flex-shrink-0 text-brand-main dark:text-brand-lighter"
                    />
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() =>
                        handleRenameDashboard(dashboard.id, renameValue)
                      }
                      onKeyDown={(e) => handleRenameKeyDown(e, dashboard.id)}
                      className="sidebar-rename-input"
                      placeholder={t("sidebar.dashboards.renamePlaceholder")}
                      autoFocus
                    />
                  </div>
                ) : (
                  <Link
                    to="/app/$id"
                    params={{ id: dashboard.id }}
                    title={t("sidebar.dashboards.open", {
                      name: dashboard.name,
                    })}
                    className="flex items-center gap-0.5 w-full overflow-hidden cursor-pointer"
                    role="button"
                    tabIndex={0}
                    aria-label={`Dashboard: ${dashboard.name}`}
                  >
                    <Icon
                      name={"file-04" as never}
                      className="w-4 h-4 min-w-[16px] flex-shrink-0 text-brand-main dark:text-brand-lighter"
                    />
                    <span className="@max-[100px]:hidden flex flex-col gap-0.5 pl-1 overflow-hidden w-full">
                      <span className="truncate text-light-700 dark:text-light-300 select-none @min-[100px]:mr-4 w-full max-w-[calc(100%-10px)] group-hover:max-w-[calc(100%-36px)]">
                        {dashboard.name}
                      </span>
                    </span>
                    <span className="@max-[100px]:hidden flex items-center justify-center flex-shrink-0"></span>
                  </Link>
                )}
                {renamingId !== dashboard.id && (
                  <span className="@max-[100px]:invisible @max-[100px]:pointer-events-none absolute right-1 flex gap-1 z-50">
                    <button
                      type="button"
                      title={t("sidebar.dashboards.menu")}
                      className="transition-opacity duration-200 group-hover:opacity-100 cursor-pointer opacity-0"
                      onClick={(e) => handleMenuToggle(e, dashboard.id)}
                      tabIndex={0}
                      aria-label="Dashboard menu"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleMenuToggle(e, dashboard.id);
                        }
                      }}
                    >
                      <Icon
                        name={"dots-horizontal" as never}
                        className="h-4 w-4 text-light-600! dark:text-white!"
                      />
                    </button>
                  </span>
                )}
                {openMenuId === dashboard.id && (
                  <div className="dashboard-context-menu">
                    <button
                      type="button"
                      className="dashboard-context-menu-item"
                      onClick={() =>
                        startRenaming(dashboard.id, dashboard.name)
                      }
                    >
                      <Icon name={"edit-03" as never} className="h-4 w-4" />
                      <span>{t("sidebar.dashboards.rename")}</span>
                    </button>
                    <button
                      type="button"
                      className="dashboard-context-menu-item opacity-50 cursor-not-allowed"
                      disabled
                    >
                      <Icon name={"folder-tree" as never} className="h-4 w-4" />
                      <span>{t("sidebar.dashboards.moveTo")}</span>
                    </button>
                    <button
                      type="button"
                      className="dashboard-context-menu-item text-red-500!"
                      onClick={() => handleDeleteDashboard(dashboard.id)}
                    >
                      <Icon name={"trash-04" as never} className="h-4 w-4" />
                      <span>{t("sidebar.dashboards.delete")}</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sidebar-section sidebar-language">
        <div className="sidebar-section-header">
          <span className="sidebar-section-title">
            {t("sidebar.language.title")}
          </span>
        </div>
        <div className="sidebar-section-content">
          <button
            type="button"
            onClick={() => i18n.changeLanguage("en")}
            className={`sidebar-language-item ${i18n.language === "en" ? "active" : ""}`}
          >
            {t("sidebar.language.english")}
          </button>
          <button
            type="button"
            onClick={() => i18n.changeLanguage("zh")}
            className={`sidebar-language-item ${i18n.language === "zh" ? "active" : ""}`}
          >
            {t("sidebar.language.chinese")}
          </button>
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-version">{t("sidebar.version")}</div>
      </div>

      <McpCompanionDialog
        isOpen={companionDialogOpen}
        onClose={() => setCompanionDialogOpen(false)}
      />
    </div>
  );
}
