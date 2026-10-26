// What the worker gives the model for each language the extension's popup offers, keyed by the shared language IDs:
// the three section headings, which the worker also checks the answer has.

import type { LanguageId } from "@yt-digest/shared";

export const HEADINGS = {
  en: ["## Conclusion", "## Main arguments", "## References"],
  "zh-Hant": ["## 結論", "## 主要論點", "## 參考資料"],
  "zh-Hans": ["## 结论", "## 主要论点", "## 参考资料"],
  ja: ["## 結論", "## 主な論点", "## 参考資料"],
  ko: ["## 결론", "## 주요 논점", "## 참고 자료"],
  es: ["## Conclusión", "## Argumentos principales", "## Referencias"],
} as const satisfies Record<LanguageId, readonly [string, string, string]>;
