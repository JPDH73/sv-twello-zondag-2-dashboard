import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("https://teamdashboard.example/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server rendert het SV Twello-dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /SV Twello 2 \| Teamdashboard 2026-2027/i);
  assert.match(html, /Teamdashboard laden/i);
  assert.match(html, /https?:\/\/[^\"]+\/og\.png/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/i);
});

test("GitHub Pages-build bevat gegevens en sociale kaart", async () => {
  const [json] = await Promise.all([
    readFile(new URL("../github-pages/data/team.json", import.meta.url), "utf8"),
    access(new URL("../github-pages/index.html", import.meta.url)),
    access(new URL("../github-pages/og.png", import.meta.url)),
  ]);
  const data = JSON.parse(json);
  assert.equal(data.team, "SV Twello Zondag 2");
  assert.equal(data.totals.players, 25);
  assert.ok(Array.isArray(data.players));
  assert.equal(data.players.length, data.totals.players + data.totals.guests);
  assert.ok(Array.isArray(data.matches));
  assert.ok(data.matches.every((match) => typeof match.manOfTheMatch === "string"));
  assert.equal(data.matches.find((match) => match.id === "O000000001")?.goalEvents.length, 5);
});

test("selectie blijft per linie ingedeeld met gastspelers onderaan", async () => {
  const source = await readFile(new URL("../app/components/TeamDashboard.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  for (const title of ["Keepers", "Verdedigers", "Middenvelders", "Aanvallers", "Gastspelers"]) {
    assert.match(source, new RegExp(title));
  }
  assert.match(source, /players\.filter\(\(player\) => !player\.guest && player\.position === line\.position\)/);
  assert.match(source, /const guestPlayers = players\.filter\(\(player\) => player\.guest\)/);
  assert.match(source, /normalized\.includes\("keeper"\)\) return "KEE"/);
  assert.match(css, /\.selection-lines/);
});

test("trainingskaders tonen alleen de numerieke datum zonder weekdag", async () => {
  const source = await readFile(new URL("../app/components/TeamDashboard.tsx", import.meta.url), "utf8");
  const formatter = source.slice(source.indexOf("function formatTrainingDate"), source.indexOf("function sortNames"));
  assert.match(formatter, /day: "2-digit", month: "2-digit", year: "numeric"/);
  assert.doesNotMatch(formatter, /weekday/);
  assert.match(source, /formatTrainingDate\(training\.date\)/);
});
