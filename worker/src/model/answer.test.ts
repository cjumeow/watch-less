import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { readModelAnswer } from "./answer.js";

async function fixture(name: string): Promise<string> {
  return readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

test("reads a successful CLI result as the digest's four sections", async () => {
  const answer = readModelAnswer(await fixture("written.json"), 0);
  expect(answer).toMatchObject({ outcome: "written", model: "opus" });
  if (answer.outcome !== "written") throw new Error("Expected a written digest");
  expect(answer.sections).toBe(
    "## 結論\n\n這是一段虛構的摘要。\n\n## 主要論點\n\n- 講者比較兩個虛構方案。\n\n## 參考資料\n\n影片未提到任何參考資料。\n\n## 評估\n\n- 尚無證據判斷優劣。（未經查證）",
  );
});

test("fails an answer with a missing section heading", async () => {
  const output = await fixture("incomplete.json");
  expect(() => readModelAnswer(output, 0)).toThrow("The digest was incomplete");
});

test("fails an answer that still uses the old sources heading", async () => {
  const output = (await fixture("written.json")).replace("## 參考資料", "## 影片的來源");
  expect(() => readModelAnswer(output, 0)).toThrow("The digest was incomplete");
});

test("postpones only a known usage-limit error from the CLI", async () => {
  expect(readModelAnswer(await fixture("usage-limit.json"), 1)).toEqual({ outcome: "postponed" });
});

test("rejects a nonzero exit even when stdout looks like a complete digest", async () => {
  const output = await fixture("written.json");
  expect(() => readModelAnswer(output, 1)).toThrow("The model failed to write a digest");
});

test("turns malformed output into a model failure with the parse error preserved", () => {
  expect(() => readModelAnswer("not JSON", 0)).toThrow("The model failed to write a digest");
});

test("fails an unknown CLI error instead of guessing that it is a usage limit", async () => {
  const output = await fixture("unknown-error.json");
  expect(() => readModelAnswer(output, 1)).toThrow("The model failed to write a digest");
});

test("recognizes the observed plain-text limit even when the CLI exits zero", async () => {
  const output = await fixture("usage-limit.txt");
  expect(readModelAnswer(output, 1)).toEqual({ outcome: "postponed" });
  expect(readModelAnswer(output, 0)).toEqual({ outcome: "postponed" });
});

test("does not treat a digest quoting the limit message as a postponed request", async () => {
  const output = JSON.parse(await fixture("written.json")) as { result: string };
  output.result += "\n\nYou've hit your session limit · resets 3:50pm (Asia/Taipei)";
  expect(readModelAnswer(JSON.stringify(output), 0)).toMatchObject({ outcome: "written" });
});
