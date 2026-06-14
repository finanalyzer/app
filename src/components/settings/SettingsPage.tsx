import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

export function SettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("general");
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    }
  }, []);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
    localStorage.setItem("theme", newTheme);
  };

  return (
    <div className="min-h-screen bg-light-50 dark:bg-black">
      <div className="bg-white dark:bg-dark-900 border-b border-light-200 dark:border-dark-500">
        <div className="text-base pt-6 px-6 font-bold mb-4">{t("settings.title")}</div>
        <div
          role="tablist"
          aria-orientation="horizontal"
          className="flex pl-6 gap-4 text-sm"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "general"}
            className={`pb-2 border-b-2 border-transparent ${activeTab === "general" ? "border-brand-main text-brand-main dark:border-brand-lighter dark:text-brand-lighter" : "text-light-600 hover:text-light-900 dark:text-light-400 dark:hover:text-light-200"}`}
            onClick={() => setActiveTab("general")}
          >
            {t("settings.general")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "advanced"}
            className={`pb-2 border-b-2 border-transparent ${activeTab === "advanced" ? "border-brand-main text-brand-main dark:border-brand-lighter dark:text-brand-lighter" : "text-light-600 hover:text-light-900 dark:text-light-400 dark:hover:text-light-200"}`}
            onClick={() => setActiveTab("advanced")}
          >
            {t("settings.advanced")}
          </button>
        </div>
      </div>

      <div className="px-6 py-5">
        {activeTab === "general" && (
          <div className="mt-5 mb-5">
            <form className="flex gap-4 flex-col">
              <div className="flex flex-col gap-2.5 py-5 dark:bg-dark-900 bg-white rounded-md p-4">
                <p className="body-sm-medium">{t("settings.theme")}</p>
                <div
                  role="radiogroup"
                  aria-required="false"
                  className="flex items-center gap-10 overflow-x-auto"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={theme === "dark"}
                      className={`peer aspect-square h-4 w-4 rounded-full border border-general-label text-general-label ring-offset-background flex items-center justify-center transition hover:border-general-label-hover ${theme === "dark" ? "border-brand-main" : "bg-general-bg-primary border-general-border-primary"}`}
                      onClick={() => handleThemeChange("dark")}
                    >
                      {theme === "dark" && (
                        <span className="flex items-center justify-center">
                          <svg className="h-2 w-2 fill-current text-link-color" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" />
                          </svg>
                        </span>
                      )}
                    </button>
                    <label className="body-xs-regular cursor-pointer max-w-[calc(100%-1rem-0.5rem)]">
                      <span className="inline-flex items-center gap-3 whitespace-nowrap">
                        {t("settings.darkMode")}
                        <img
                          src="https://pro.openbb.co/assets/images/settings/theme_dark.svg"
                          alt="Dark mode preview"
                          className="w-[62px] h-auto rounded-none"
                        />
                      </span>
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={theme === "light"}
                      className={`peer aspect-square h-4 w-4 rounded-full border border-general-label text-general-label ring-offset-background flex items-center justify-center transition hover:border-general-label-hover ${theme === "light" ? "border-brand-main" : "bg-general-bg-primary border-general-border-primary"}`}
                      onClick={() => handleThemeChange("light")}
                    >
                      {theme === "light" && (
                        <span className="flex items-center justify-center">
                          <svg className="h-2 w-2 fill-current text-link-color" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" />
                          </svg>
                        </span>
                      )}
                    </button>
                    <label className="body-xs-regular cursor-pointer max-w-[calc(100%-1rem-0.5rem)]">
                      <span className="inline-flex items-center gap-3 whitespace-nowrap">
                        {t("settings.lightMode")}
                        <img
                          src="https://pro.openbb.co/assets/images/settings/theme_light.svg"
                          alt="Light mode preview"
                          className="w-[62px] h-auto rounded-none"
                        />
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}

        {activeTab === "advanced" && (
          <div className="mt-5 mb-5 space-y-4">
            <div className="dark:bg-dark-900 bg-white rounded-md p-4">
              <div className="flex flex-col items-center justify-center py-8">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("settings.advancedEmpty")}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
