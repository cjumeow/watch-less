// The languages a digest can be written in, the ones the extension's popup offers. The worker gives the model the
// language's name and its three section headings, and checks that the answer has those headings.

export const LANGUAGES = {
  en: { name: "English", headings: ["## Conclusion", "## Main arguments", "## References"] },
  "zh-Hant": { name: "繁體中文 (Traditional Chinese)", headings: ["## 結論", "## 主要論點", "## 參考資料"] },
  "zh-Hans": { name: "简体中文 (Simplified Chinese)", headings: ["## 结论", "## 主要论点", "## 参考资料"] },
  ja: { name: "日本語 (Japanese)", headings: ["## 結論", "## 主な論点", "## 参考資料"] },
  ko: { name: "한국어 (Korean)", headings: ["## 결론", "## 주요 논점", "## 참고 자료"] },
  es: { name: "Español (Spanish)", headings: ["## Conclusión", "## Argumentos principales", "## Referencias"] },
} as const satisfies Record<string, { name: string; headings: readonly [string, string, string] }>;

export type Language = keyof typeof LANGUAGES;

/**
 * What every digest uses until the request carries the developer's choice from the popup: set in this one place, and
 * the model is recorded in each digest's header.
 */
export const DEFAULT_SETTINGS: { language: Language; model: string } = { language: "en", model: "claude-haiku-5-5" };
