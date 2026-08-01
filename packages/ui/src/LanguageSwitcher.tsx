import { LOCALES, useI18n } from "./i18n";

/** Toolbar control to switch the editor UI language (persisted per browser). */
export function LanguageSwitcher(): JSX.Element {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="cbe-toolbar-group" role="group" aria-label={t("lang.label")}>
      {LOCALES.map((l) => (
        <button
          key={l}
          className={`cbe-btn cbe-btn-small ${locale === l ? "cbe-btn-active" : ""}`}
          aria-pressed={locale === l}
          title={t(l === "en" ? "lang.en" : "lang.vi")}
          onClick={() => setLocale(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
