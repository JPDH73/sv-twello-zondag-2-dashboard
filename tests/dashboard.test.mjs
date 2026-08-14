import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const data = JSON.parse(fs.readFileSync("public/data/team.json", "utf8"));

test("dashboard bevat de verwachte teamgegevens", () => {
  assert.equal(data.team, "SV Twello Zondag 2");
  assert.equal(data.players.length, 27);
  assert.equal(data.staff.length, 6);
  assert.ok(data.matches.length > 0);
});

test("openbare data bevat geen leeftijd of geboortedatum", () => {
  const json = JSON.stringify(data).toLowerCase();
  for (const privateField of ["geboortedatum", "birthdate", "leeftijd", "age"]) {
    assert.equal(json.includes(`\"${privateField}\"`), false);
  }
});

test("website is gebouwd met het gegevensbestand", () => {
  assert.ok(fs.existsSync("dist/index.html"));
  assert.ok(fs.existsSync("dist/data/team.json"));
});

test("nieuwe Excel-wijzigingen zijn verwerkt", () => {
  assert.ok(data.players.some((player) => player.name === "Sergio Alkema"));
  assert.equal(data.players.some((player) => player.name === "Tommy Nijdeken"), false);
  assert.equal(data.players.find((player) => player.name === "Rodi Gerritsen")?.training.sessions.includes("2026-08-09"), true);
  assert.equal(data.players.find((player) => player.name === "Denzel Boscher")?.guest, true);
  assert.equal(data.players.find((player) => player.name === "Stan Martens")?.guest, true);
  assert.equal(data.players.find((player) => player.name === "Robbert Teelen")?.captain, true);
  assert.equal(data.totals.players, 25);
  assert.equal(data.totals.guests, 2);
  assert.equal(data.totals.trainings, 3);
  assert.equal(data.trainings.some((training) => training.date === "2026-08-09"), true);
  const davo = data.matches.find((match) => match.id === "O000000001");
  assert.equal(davo?.home, "SV Twello 2");
  assert.equal(davo?.away, "DAVO 2");
  assert.equal(davo?.date, "2026-08-20");
  assert.equal(davo?.time, "20:00");
  assert.equal(data.matches[0]?.id, "O000000001");
  assert.equal(data.matches.find((match) => match.id === "M623608225")?.result, "");
  assert.equal(data.totals.matchesPlayed, 0);
  assert.equal(data.staff.find((member) => member.name === "Jeffrey Karrenbeld")?.role, "Trainer / assistent-coach");
});

test("dashboard gebruikt de nieuwe header en tabnavigatie", () => {
  const source = fs.readFileSync("app/components/TeamDashboard.tsx", "utf8");
  assert.ok(source.includes("sv-twello-logo.png"));
  assert.ok(source.includes("One Town, One Team, One Twello"));
  for (const field of ["Te laat", "Gevlagd", "Gekeept", "Aanvoerder"]) assert.ok(source.includes(field));
  for (const section of ["Toppers", "Losers", "Spelersranglijst"]) assert.ok(source.includes(section));
  assert.equal(source.includes("Teamdashboard 26–27"), false);
  assert.equal(source.includes("Wedstrijdacties"), false);
  assert.equal(source.includes("captain-callout"), false);
  assert.ok(source.includes("players.filter((player) => score(player) === highest)"));
  assert.ok(source.includes('parts[0]?.includes("-")'));
  for (const tab of ["Dashboard", "Staf", "Team", "Wedstrijden", "Trainingen", "Statistieken"]) assert.ok(source.includes(`label: "${tab}"`));
  assert.ok(source.includes('label: "Speler van het jaar"'));
  assert.ok(source.includes("Polo vergeten"));
  assert.ok(source.includes("menu-toggle"));
  assert.ok(source.includes("matchAttendance.percentage"));
  assert.ok(source.includes("Meest afwezig op wedstrijddag"));
  assert.ok(source.includes("return sorted.slice(0, limit)"));
  assert.ok(source.includes("matchesScheduled} / ${data.totals.matchesPlayed"));
  assert.equal(source.includes("met ingevulde aanwezigheid"), false);
  assert.equal(source.includes("gastspelers apart"), false);
  assert.equal(source.includes("Wie deed wat?"), false);
  assert.equal(source.includes("progress-track"), false);
  assert.equal(source.includes("De begeleiding van SV Twello Zondag 2."), false);
  assert.equal(source.includes("Kies een speler voor trainingen en wedstrijdacties."), false);
  assert.equal(source.includes("data.sourceFile"), false);
  assert.equal(source.includes("Selectie, programma, trainingen en beslissende acties rechtstreeks vanuit het gedeelde Excel-bestand."), false);
});

test("polo wordt uit Excel doorgegeven", () => {
  assert.equal(data.players.every((player) => Number.isInteger(player.totals.polo)), true);
});

test("wedstrijdstatussen en speler-van-het-jaarhistorie komen uit Excel", () => {
  assert.equal(data.players.every((player) => player.matchAttendance.total === 0), true);
  assert.deepEqual(data.playerOfYear.map(({ year, name }) => ({ year, name })), [
    { year: 2026, name: "Rodi Gerritsen" },
    { year: 2025, name: "Jesse van Brink" },
    { year: 2024, name: "Marc Albers" },
    { year: 2023, name: "Dennis Schreurs" },
    { year: 2022, name: "Casper van Kooten" },
  ]);
  assert.equal(data.playerOfYear.every((entry) => typeof entry.motivation === "string"), true);
  for (const field of ["absent", "notPlayed", "partial", "full"]) assert.equal(data.players.every((player) => Number.isInteger(player.totals[field])), true);
});

test("stafstatussen worden uit Excel doorgegeven", () => {
  for (const member of data.staff) {
    assert.deepEqual(member.totals, { present: 0, partial: 0, absent: 0 });
    assert.deepEqual(member.matches, []);
  }
  const source = fs.readFileSync("app/components/TeamDashboard.tsx", "utf8");
  for (const removed of [
    "Het volledige programma en alle geregistreerde uitslagen.",
    "De aanwezige spelers per trainingsmoment.",
    "Alle prestaties, aanwezigheid en teamtaken per speler.",
  ]) assert.equal(source.includes(removed), false);
  for (const label of ["Aanwezig", "Deels aanwezig", "Afwezig", "Nog geen wedstrijdgegevens voor dit staflid"]) assert.ok(source.includes(label));
});

test("nieuwe statussen, top-vijfvolgorde en klasse worden gebruikt", () => {
  const source = fs.readFileSync("app/components/TeamDashboard.tsx", "utf8");
  for (const label of ["Deels gespeeld", "Volgespeeld", "Seizoenoverzicht (6e klasse-15)"]) assert.ok(source.includes(label));
  assert.ok(source.includes("return sorted.slice(0, limit)"));
  assert.ok(source.includes("const hasPlayedMatches = data.totals.matchesPlayed > 0"));
  assert.ok(source.indexOf('<Leader title="Trainingen"') < source.indexOf('<Leader title="Doelpunten"'));
  assert.ok(source.indexOf('<Loser label="Minste trainingen"') < source.indexOf('<Loser label="Meest afwezig op wedstrijddag"'));
  assert.ok(source.indexOf('<Loser label="Meest afwezig op wedstrijddag"') < source.indexOf('<Loser label="Meest te laat op wedstrijddag"'));
});

test("statistieken herhalen de dashboardtoppers niet en trainingsnamen staan alfabetisch", () => {
  const source = fs.readFileSync("app/components/TeamDashboard.tsx", "utf8");
  const statisticsSource = source.slice(source.indexOf("function StatisticsView"), source.indexOf("function HistoryView"));
  assert.equal(statisticsSource.includes("<Leader"), false);
  assert.equal(statisticsSource.includes("stats-leaders"), false);
  assert.ok(source.includes('sortNames(training.attendees).join(" · ")'));
  assert.ok(source.includes('localeCompare(b, "nl", { sensitivity: "base" })'));
});

test("staf heeft een aanklikbare wedstrijdhistorie en vernieuwde veldillustratie", () => {
  const source = fs.readFileSync("app/components/TeamDashboard.tsx", "utf8");
  const css = fs.readFileSync("app/globals.css", "utf8");
  for (const text of ["StaffDrawer", "Bekijk wedstrijdhistorie", "Wedstrijdhistorie van", "staff-match-row"]) assert.ok(source.includes(text));
  assert.ok(source.includes('className="full-pitch"'));
  assert.ok(source.includes('className="pitch-halfway"'));
  assert.ok(source.includes('className="pitch-center"'));
  assert.ok(source.includes('pitch-area-left'));
  assert.ok(source.includes('pitch-area-right'));
  assert.equal(source.includes('className="pitch-box"'), false);
  assert.ok(css.includes(".staff-status.deels-aanwezig"));
  assert.ok(css.includes("transform: rotate(12deg)"));
});

test("spelersranglijst kan op iedere statistiek worden gesorteerd", () => {
  const source = fs.readFileSync("app/components/TeamDashboard.tsx", "utf8");
  const css = fs.readFileSync("app/globals.css", "utf8");
  for (const text of ["rankingSort", "rankingDirection", "changeSort", "Sorteer op", "Hoog → laag", "Laag → hoog"]) assert.ok(source.includes(text));
  assert.ok(source.includes('onClick={() => changeSort(key)}'));
  assert.ok(css.includes(".ranking-sort.active"));
  assert.ok(css.includes(".ranking-controls"));
});

test("statistieken eindigen met de volledige teamhistorie", () => {
  const source = fs.readFileSync("app/components/TeamDashboard.tsx", "utf8");
  const css = fs.readFileSync("app/globals.css", "utf8");
  for (const text of ["Historie", "Teamhistorie", "Seizoen", "Klasse", "Eindpositie", "2025/2026", "2018/2019", "1e van 10 (kampioen)", "12e van 12 (laatste)", "SV Twello 3"]) assert.ok(source.includes(text));
  assert.ok(source.indexOf('title="Spelersranglijst"') < source.indexOf('className="team-history"'));
  assert.ok(css.includes(".team-history-table"));
  assert.ok(css.includes(".team-history-row .champion"));
});

test("bovenbeeld volgt de aangeleverde bannercompositie", () => {
  const css = fs.readFileSync("app/globals.css", "utf8");
  const source = fs.readFileSync("app/components/TeamDashboard.tsx", "utf8");
  assert.ok(css.includes("width: 39%; height: 42%"));
  assert.ok(css.includes("font-size: clamp(64px,8.1vw,105px)"));
  assert.ok(css.includes("border-radius: 0 0 82px 0"));
  assert.ok(css.includes("letter-spacing: .16em"));
  assert.ok(source.includes("One Town, One Team, One Twello"));
  assert.equal(source.includes("One Town, One Team, One Trello"), false);
});

test("banner staat alleen op dashboard en het koplogo keert terug naar home", () => {
  const source = fs.readFileSync("app/components/TeamDashboard.tsx", "utf8");
  assert.ok(source.includes('activeView === "dashboard" && <section className="hero"'));
  assert.equal((source.match(/className="hero"/g) || []).length, 1);
  assert.ok(source.includes('className="header-title" type="button"'));
  assert.ok(source.includes('aria-label="Ga naar dashboard"'));
  assert.ok(source.includes('setActiveView("dashboard")'));
  for (const label of ["Aantal selectiespelers", "Aantal keer getraind", "Wedstrijden / gespeeld"]) assert.ok(source.includes(label));
});

test("dashboard toont de twee volgende wedstrijden, kleedkamerprijzen en EA-achtige spelerskaarten", () => {
  const source = fs.readFileSync("app/components/TeamDashboard.tsx", "utf8");
  const css = fs.readFileSync("app/globals.css", "utf8");
  assert.ok(source.includes("upcomingMatches(data.matches)"));
  assert.ok(source.includes("slice(0, limit)"));
  assert.ok(source.includes('title="Eerstvolgende wedstrijden"'));
  assert.ok(source.includes("showResult={false}"));
  assert.ok(source.includes('className="fixture-separator"'));
  assert.equal(source.includes('title="Programma & uitslagen"'), false);
  for (const title of ["Trainingsbeest", "Scherpschutter", "Assistkoning", "Trainingsspook", "Onzichtbare man", "Uitslaper"]) assert.ok(source.includes(title));
  for (const className of ["player-pitch", "player-rating", "player-portrait", "club-badge", "club-badge-mark", "player-key-stats", "player-open"]) assert.ok(source.includes(className));
  assert.ok(source.includes("./sv-twello-mark-transparent.png"));
  assert.ok(source.includes('className="club-badge-name"'));
  assert.ok(fs.existsSync("public/sv-twello-mark-transparent.png"));
  assert.ok(source.includes("Bekijk alle statistieken"));
  assert.ok(css.includes("clip-path: polygon(8% 0,92% 0"));
  assert.ok(css.includes(".player-card-name"));
  assert.ok(css.includes("grid-template-columns: minmax(0,1fr) auto minmax(0,1fr)"));
  assert.ok(css.includes("background: white"));
  assert.ok(css.includes("width: 132px; height: 132px"));
  assert.ok(css.includes("background: transparent"));
  assert.ok(css.includes(".club-badge-name"));
  assert.ok(css.includes("top: -28px; right: -28px"));
});

test("staf heeft een eigen menu en grijze EA-kaarten", () => {
  const source = fs.readFileSync("app/components/TeamDashboard.tsx", "utf8");
  const css = fs.readFileSync("app/globals.css", "utf8");
  assert.ok(source.indexOf('{ id: "dashboard"') < source.indexOf('{ id: "staf"'));
  assert.ok(source.indexOf('{ id: "staf"') < source.indexOf('{ id: "team"'));
  for (const text of ["StaffView", "staff-ea-card", "staff-key-stats", "Aanwezig", "Deels", "Afwezig", "Bekijk wedstrijdhistorie"]) assert.ok(source.includes(text));
  assert.equal(source.includes('<SectionHeading title="Staf"'), false);
  assert.ok(css.includes(".staff-ea-card"));
  assert.ok(css.includes("linear-gradient(145deg,#fffef0,#fffda5 54%,#e8df72)"));
  assert.ok(css.includes(".staff-ea-card .player-key-stats > span + span"));
  assert.ok(css.includes("@media (max-width: 800px)"));
  const requestedOrder = ["Andrew Hietbrink", "Jeffrey Karrenbeld", "Sander Bouwmeester", "Jan Berkenbosch", "Christiaan Grootgens", "Jean-Paul de Haas"];
  for (let index = 1; index < requestedOrder.length; index += 1) {
    assert.ok(source.indexOf(`"${requestedOrder[index - 1]}"`) < source.indexOf(`"${requestedOrder[index]}"`));
  }
  assert.ok(source.includes("orderedStaff.map"));
  assert.ok(source.includes('normalized.includes("coach")'));
  assert.ok(source.includes('return "COACH"'));
  assert.ok(source.includes('normalized.includes("trainer")'));
  assert.ok(source.includes('return "TRAINER"'));
  assert.ok(source.indexOf('normalized.includes("trainer")') < source.indexOf('normalized.includes("coach")'));
});

test("speler van het jaar toont een interactieve beker en motivatie uit Excel", () => {
  const source = fs.readFileSync("app/components/TeamDashboard.tsx", "utf8");
  const css = fs.readFileSync("app/globals.css", "utf8");
  for (const asset of ["speler-van-het-jaar-beker.jpg"]) {
    assert.ok(source.includes(asset));
    assert.ok(fs.existsSync(`public/${asset}`));
  }
  for (const text of ["selectedYear", "award-year-selector", "award-motivation", "Winnaar"]) assert.ok(source.includes(text));
  assert.equal(source.includes("award-plaque"), false);
  assert.ok(css.includes(".award-stage"));
  assert.ok(css.includes("aspect-ratio: 2/3"));
});
