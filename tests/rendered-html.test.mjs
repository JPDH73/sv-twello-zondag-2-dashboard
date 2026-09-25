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
  assert.equal(data.totals.players, 24);
  assert.ok(Array.isArray(data.players));
  assert.equal(data.players.length, data.totals.players + data.totals.guests);
  assert.ok(Array.isArray(data.matches));
  assert.ok(data.matches.every((match) => typeof match.manOfTheMatch === "string"));
  assert.equal(data.matches.find((match) => match.id === "O000000001")?.goalEvents.length, 5);
});

test("wedstrijdkaarten koppelen clublogo's en hebben een mobiele maat", async () => {
  const source = await readFile(new URL("../app/components/TeamDashboard.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  for (const club of ["columbia 3", "davo 2", "tka 2", "tka 3", "voorwaarts t 5", "sportclub deventer 3", "epse 2", "heeten 5", "sc klarenbeek 3", "loenermark 3", "sallandia 2", "sv schalkhaar 5", "terwolde 2", "wsv 4"]) {
    assert.match(source, new RegExp(`"${club}"`));
  }
  assert.match(source, /function TeamLogo/);
  assert.match(source, /fixture-team-home/);
  assert.match(source, /fixture-team-away/);
  assert.match(source, /fixture-team fixture-team-home"><TeamLogo team=\{match\.home\}\/><strong>{match\.home/);
  assert.match(source, /fixture-team fixture-team-away"><strong>\{match\.away[\s\S]*?<TeamLogo team=\{match\.away\}\/><\/span>/);
  assert.match(source, /<small>SV TWELLO<\/small>/);
  assert.match(css, /\.fixture-team-logo-wrap \{[^}]*width: 54px;[^}]*height: 54px;/);
  assert.match(css, /\.fixture-team-logo-wrap \{ flex-basis: 42px; width: 42px; height: 42px; \}/);
});

test("wedstrijden kunnen op type worden gefilterd en dashboard linkt naar de stand", async () => {
  const source = await readFile(new URL("../app/components/TeamDashboard.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  for (const type of ["Alle wedstrijden", "Competitie", "Beker", "Oefenwedstrijd"]) assert.match(source, new RegExp(type));
  assert.match(source, /matches\.filter\(\(match\) => matchType\(match\.competition\) === typeFilter\)/);
  assert.match(source, /https:\/\/www\.voetbal\.nl\/team\/T1719192193\/stand/);
  assert.match(source, /https:\/\/apps\.sportlink\.com\/voetbalnl\/team_details\/T1719192193/);
  assert.match(source, /onClick=\{openVoetbalNlStandings\}/);
  assert.match(source, /Open SV Twello 2 in Voetbal\.nl/);
  assert.match(css, /\.standings-link/);
});

test("bardienst heeft een eigen menu, grote afbeelding en compleet rooster", async () => {
  const source = await readFile(new URL("../app/components/TeamDashboard.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  await access(new URL("../public/bardiensten-sv-twello.png", import.meta.url));
  assert.match(source, /\{ id: "bardienst", label: "Bardienst" \}/);
  assert.match(source, /activeView === "bardienst" && <BarDutyView\/>/);
  assert.match(source, /bardiensten-sv-twello\.png/);
  for (const duty of ["Jani & Dennis S", "Dennis W & Thijs", "Thomas & Bram", "Delano & Samwel", "Tom & Jesse", "Niels & Jervin"]) {
    assert.match(source, new RegExp(duty.replace("&", "\\&")));
  }
  assert.match(css, /\.bar-duty-hero img \{[^}]*width: 100%;[^}]*aspect-ratio: 3\/2;/);
  assert.match(css, /\.bar-duty-table-head \{ display: none; \}/);
});

test("toppers en losers gebruiken de zes aangeleverde clubemblemen", async () => {
  const source = await readFile(new URL("../app/components/TeamDashboard.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  await access(new URL("../public/sv-twello-awards.png", import.meta.url));
  for (const emblem of ["training", "goals", "assists", "ghost", "invisible", "late"]) {
    assert.match(css, new RegExp(`\\.award-emblem-${emblem}`));
  }
  assert.match(source, /function AwardEmblem/);
  assert.match(css, /background-image: url\("\/sv-twello-awards\.png"\)/);
  assert.match(css, /background-size: 300% 200%/);
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

test("trainingskaders tonen de weekdag en datum", async () => {
  const source = await readFile(new URL("../app/components/TeamDashboard.tsx", import.meta.url), "utf8");
  const formatter = source.slice(source.indexOf("function formatTrainingDate"), source.indexOf("function sortNames"));
  assert.match(formatter, /weekday: "long"/);
  assert.match(formatter, /`\$\{weekday\} \$\{date\.getDate\(\)\}-\$\{date\.getMonth\(\) \+ 1\}-\$\{date\.getFullYear\(\)\}`/);
  assert.match(source, /formatTrainingDate\(training\.date\)/);
});

test("trainingsranglijsten gebruiken alleen aangevinkte spelers en tonen maximaal vijf trainingsspoken", async () => {
  const source = await readFile(new URL("../app/components/TeamDashboard.tsx", import.meta.url), "utf8");
  assert.match(source, /selection\.filter\(\(player\) => player\.training\.rankingEligible\)/);
  assert.match(source, /leaders\(trainingRankingPlayers, "training"\)/);
  assert.match(source, /rankedPlayers\(trainingRankingPlayers, \(player\) => player\.training\.attended, "min"\)/);
  assert.match(source, /awardTitle="Trainingsspook"[\s\S]*inlineNames cardScore=\{leastTraining\.length \? leastTraining\[0\]\.training\.attended : undefined\}/);
  assert.match(source, /players\.map\(\(player\) => `\$\{displayName\(player\)\}\$\{inlineScores \? ` \(\$\{score\(player\)\}\)` : ""\}`\)\.join\(" · "\)/);
  assert.match(source, /cardScore !== undefined && <span className="leader-score">\{cardScore\}<\/span>/);
  assert.match(source, /score\(player\) === winningScore/);
});

test("onzichtbare man toont alle niet-gastspelers met exact de minste gespeelde wedstrijden", async () => {
  const source = await readFile(new URL("../app/components/TeamDashboard.tsx", import.meta.url), "utf8");
  assert.match(source, /sorted\.filter\(\(player\) => score\(player\) === winningScore\)\.slice\(0, limit\)/);
  assert.match(source, /const selection = data\.players\.filter\(\(player\) => !player\.guest\)/);
  assert.match(source, /rankedPlayers\(selection, \(player\) => player\.totals\.matches, "min"\)/);
  assert.match(source, /awardTitle="Onzichtbare man"[\s\S]*maxNames=\{5\}[\s\S]*inlineNames cardScore=\{leastPlayed\.length \? leastPlayed\[0\]\.totals\.matches : undefined\}/);
  assert.match(source, /selection\.filter\(\(player\) => player\.lateRankingEligible\)/);
  assert.match(source, /awardTitle="Uitslaper"[\s\S]*inlineNames cardScore=\{mostLate\.length \? mostLate\[0\]\.totals\.late : undefined\}/);
});
