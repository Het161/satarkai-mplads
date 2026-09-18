import { setLocale } from "@/app/actions/locale";
import { getLocale, t } from "@/lib/i18n";

/**
 * Language toggle.
 *
 * A form rather than a link, so switching works with JavaScript disabled — a
 * government platform should not need a working bundle to be readable in the
 * reader's own language. The button is labelled in the language it switches
 * *to*, which is the only labelling that helps someone who cannot read the
 * current one.
 */
export function LocaleSwitcher() {
  const locale = getLocale();
  const dict = t();
  const next = locale === "en" ? "hi" : "en";

  return (
    <form action={setLocale}>
      <input type="hidden" name="locale" value={next} />
      <button
        type="submit"
        lang={next === "hi" ? "hi-IN" : "en-IN"}
        className="whitespace-nowrap rounded border border-line px-2.5 py-1 text-2xs font-medium text-slate hover:bg-paper hover:text-ink"
      >
        {dict.locale.switchTo}
      </button>
    </form>
  );
}
