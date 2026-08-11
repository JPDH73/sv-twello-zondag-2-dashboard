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
  assert.equal(data.players.find((player) => player.name === "Rodi Gerritsen")?.training.sessions.includes("2026-08-06"), true);
  assert.equal(data.players.find((player) => player.name === "Denzel Boscher")?.guest, true);
  assert.equal(data.players.find((player) => player.name === "Stan Martens")?.guest, true);
  assert.equal(data.players.find((player) => player.name === "Robbert Teelen")?.captain, true);
  assert.equal(data.totals.players, 25);
  assert.equal(data.totals.guests, 2);
  assert.equal(data.totals.trainings, 1);
  const davo = data.matches.find((match) => match.id === "O000000001");
  assert.equal(davo?.date, "2026-08-20");
  assert.equal(davo?.time, "20:00");
  assert.equal(data.matches.find((match) => match.id === "M623608225")?.result, "");
});

test("dashboard gebruikt de nieuwe header en tabnavigatie", () => {
  const source = fs.readFileSync("app/components/TeamDashboard.tsx", "utf8");
  assert.ok(source.includes("sv-twello-logo.png"));
  assert.ok(source.includes("One Town, One Team, One Twello"));
  for (const field of ["Penalty gescoord", "Penalty gemist", "Te laat", "Gevlagd", "Gekeept", "Aanvoerder"]) assert.ok(source.includes(field));
  for (const section of ["Toppers", "Losers", "Wie deed wat?"]) assert.ok(source.includes(section));
  assert.ok(source.includes("Teamdashboard 26–27"));
  assert.ok(source.includes('parts[0]?.includes("-")'));
  for (const tab of ["Dashboard", "Team", "Wedstrijden", "Trainingen", "Statistieken"]) assert.ok(source.includes(`label: "${tab}"`));
  assert.equal(source.includes("Selectie, programma, trainingen en beslissende acties rechtstreeks vanuit het gedeelde Excel-bestand."), false);
});
