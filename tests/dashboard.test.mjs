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
  assert.equal(data.trainings.some((training) => training.date === "2026-08-13"), true);
  assert.equal(data.trainings.some((training) => training.date === "2026-08-09"), true);
  const davo = data.matches.find((match) => match.id === "O000000001");
  assert.equal(davo?.home, "SV Twello 2");
  assert.equal(davo?.away, "DAVO 2");
  assert.equal(davo?.date, "2026-08-20");
  assert.equal(davo?.time, "20:00");
  assert.equal(data.matches[0]?.id, "O000000001");
  assert.equal(data.matches.find((match) => match.id === "M623608225")?.result, "");
  assert.equal(data.totals.matchesPlayed, 0);
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
  for (const tab of ["Dashboard", "Team", "Wedstrijden", "Trainingen", "Statistieken"]) assert.ok(source.includes(`label: "${tab}"`));
  assert.ok(source.includes('label: "Spelers van het jaar"'));
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
    { year: 2023, name: "Dennis Geurts" },
    { year: 2022, name: "Casper van Kooten" },
  ]);
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
