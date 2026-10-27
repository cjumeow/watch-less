// The toolbar popup (docs/prototypes/popup.html): picks the language a digest is written in, the model that writes it
// and where it is saved, and saves each choice in chrome.storage.local as soon as it is made. The next request uses it.

import { DESTINATIONS, isLanguageId, LANGUAGES, PROVIDERS, providerOf, type ProviderId } from "@yt-digest/shared";
import { notionPageIdFrom, savedSettings, STORAGE_KEYS } from "./saved-settings.js";

/** Where each provider's models run, which the footer says. */
const RUNS_WITH: Record<ProviderId, string> = {
  claude: "Claude Code and your Claude subscription",
  openai: "Codex CLI and your ChatGPT plan",
};

/** How long `Saved` stays, in milliseconds. */
const SAVED_MS = 1200;

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`popup.html has no #${id}`);
  return found;
}

const languageSelect = element("language") as HTMLSelectElement;
const providers = element("providers");
const models = element("models");
const footer = element("footer");
const saved = element("saved");
const destinations = element("destinations");
const heptabaseHint = element("heptabase-hint");
const notion = element("notion");
const notionPage = element("notion-page") as HTMLInputElement;
const notionHint = element("notion-hint");

const FOLDER_HINT = notionHint.textContent;
const NOT_A_PAGE_HINT = "That is not a Notion page link. Copy it with Share → Copy link.";

const settings = savedSettings(await chrome.storage.local.get([...STORAGE_KEYS]).catch(() => ({})));
let provider: ProviderId = providerOf(settings.model);

let hideSaved: ReturnType<typeof setTimeout> | undefined;
async function save() {
  try {
    await chrome.storage.local.set({
      language: settings.language,
      model: settings.model,
      destination: settings.destination,
      notionFolderPage: settings.notionFolderPage ?? "",
    });
  } catch {
    saved.textContent = "Not saved";
    return;
  }
  saved.textContent = "Saved";
  clearTimeout(hideSaved);
  hideSaved = setTimeout(() => {
    saved.textContent = "";
  }, SAVED_MS);
}

function renderLanguages() {
  languageSelect.replaceChildren(
    ...LANGUAGES.map((language) => new Option(language.name, language.id, false, language.id === settings.language)),
  );
  languageSelect.addEventListener("change", () => {
    if (!isLanguageId(languageSelect.value)) return;
    settings.language = languageSelect.value;
    void save();
  });
}

function renderDestinations() {
  destinations.replaceChildren(
    ...DESTINATIONS.map((entry) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "destination";
      input.value = entry.id;
      input.checked = entry.id === settings.destination;
      input.addEventListener("change", () => {
        settings.destination = entry.id;
        renderFolder();
        void save();
      });
      label.append(input, entry.name);
      return label;
    }),
  );
  notionPage.value = settings.notionFolderPage ?? "";
  notionPage.addEventListener("change", () => {
    const id = notionPageIdFrom(notionPage.value);
    notionPage.setAttribute("aria-invalid", String(id === undefined));
    notionHint.textContent = id === undefined ? NOT_A_PAGE_HINT : FOLDER_HINT;
    if (id === undefined) return;
    if (id === "") delete settings.notionFolderPage;
    else settings.notionFolderPage = id;
    // Shown as the ID that is kept, so a pasted link visibly becomes what is sent.
    notionPage.value = id;
    void save();
  });
  renderFolder();
}

function renderFolder() {
  const isNotion = settings.destination === "notion";
  heptabaseHint.hidden = isNotion;
  notion.hidden = !isNotion;
}

function renderProviders() {
  providers.replaceChildren(
    ...PROVIDERS.map((entry) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "provider";
      input.value = entry.id;
      input.checked = entry.id === provider;
      input.addEventListener("change", () => {
        provider = entry.id;
        renderModels();
      });
      label.append(input, entry.name);
      return label;
    }),
  );
}

function renderModels() {
  const entry = PROVIDERS.find((candidate) => candidate.id === provider) ?? PROVIDERS[0];
  models.replaceChildren(
    ...entry.models.map((model) => {
      const row = document.createElement("label");
      row.className = "model";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "model";
      input.value = model.id;
      input.checked = model.id === settings.model;
      input.addEventListener("change", () => {
        settings.model = model.id;
        void save();
      });
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = model.name;
      if (model.id === entry.defaultModel) {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = "Default";
        name.append(tag);
      }
      const about = document.createElement("span");
      about.className = "about";
      about.textContent = model.description;
      row.append(input, name, about);
      return row;
    }),
  );
  footer.textContent = `Runs on this Mac with ${RUNS_WITH[entry.id]}. No API key. Applies to the next digest you request.`;
}

renderLanguages();
renderDestinations();
renderProviders();
renderModels();
