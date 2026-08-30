import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extractor = path.join(repoRoot, "scripts", "extract-excel.mjs");

test("kiest alleen de nieuwste wedstrijd met echte uitslag en neemt de MVP over", () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "svt-dashboard-"));
  const workbookPath = path.join(testDir, "bron.xlsx");
  const workbook = XLSX.utils.book_new();
  const addJson = (name, rows) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name);

  addJson("spelers", [{ speler_id: "sp1", rugnummer: 9, naam: "Jan Jansen", positie: "Aanvaller", voet: "rechts" }]);
  addJson("staf", []);
  addJson("speler_jaar", []);
  addJson("wedstrijden", [
    { wedstrijd_id: "oud", datum: "2026-08-10", tijd: "10:30", thuis: "SV Twello 2", uit: "Club A", uitslag: "1-0", competitie: "Beker" },
    { wedstrijd_id: "M623608225", datum: "2026-08-17", tijd: "10:30", thuis: "Voorwaarts T 5", uit: "SV Twello 2", uitslag: "2-4", competitie: "Beker", "Man van de wedstrijd": "Jan Jansen" },
    { wedstrijd_id: "open", datum: "2026-08-24", tijd: "10:30", thuis: "SV Twello 2", uit: "Club C", uitslag: "", competitie: "Beker" },
  ]);
  addJson("wedstrijdinvoer_spelers", []);
  addJson("wedstrijdinvoer_staf", []);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["speler_id", "naam"], ["sp1", "Jan Jansen"]]), "trainingsinvoer");
  XLSX.writeFile(workbook, workbookPath);

  execFileSync(process.execPath, [extractor, workbookPath], { cwd: testDir, stdio: "pipe" });
  const data = JSON.parse(fs.readFileSync(path.join(testDir, "public", "data", "team.json"), "utf8"));
  const played = data.matches.filter((match) => /\d+\s*[-–:]\s*\d+/.test(match.result));
  const latest = played.sort((a, b) => b.date.localeCompare(a.date))[0];

  assert.equal(data.totals.matchesPlayed, 2);
  assert.equal(latest.id, "M623608225");
  assert.equal(latest.result, "2-4");
  assert.equal(latest.manOfTheMatch, "Jan Jansen");
  assert.deepEqual(latest.goalEvents.map(({ minute, score }) => ({ minute, score })), [
    { minute: 10, score: "1-0" },
    { minute: 30, score: "1-1" },
    { minute: 47, score: "1-2" },
    { minute: 55, score: "1-3" },
    { minute: 60, score: "1-4" },
    { minute: 66, score: "2-4" },
  ]);
  assert.equal(data.matches.find((match) => match.id === "open").manOfTheMatch, "");
});

test("koppelt wedstrijd- en trainingsinvoer op naam als Excel-ID's verschoven zijn", () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "svt-dashboard-names-"));
  const workbookPath = path.join(testDir, "bron.xlsx");
  const workbook = XLSX.utils.book_new();
  const addJson = (name, rows) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name);

  addJson("spelers", [
    { speler_id: "sp23", naam: "Nicky Eekhuis" },
    { speler_id: "sp24", naam: "Bram Dolman" },
    { speler_id: "sp25", naam: "Denzel Boscher" },
  ]);
  addJson("staf", []);
  addJson("speler_jaar", []);
  addJson("wedstrijden", [{ wedstrijd_id: "O1", datum: "2026-08-20", thuis: "SV Twello 2", uit: "DAVO 2", uitslag: "3-2" }]);
  addJson("wedstrijdinvoer_spelers", [
    { wedstrijd_id: "O1", speler_id: "sp24", naam: "Nicky Eekhuis", status_sp: "Volgespeeld", doelpunten: 1, "geen polo": 1 },
    { wedstrijd_id: "O1", speler_id: "sp25", naam: "Bram Dolman", status_sp: "Deels gespeeld", assists: 1 },
    { wedstrijd_id: "O1", speler_id: "sp26", naam: "Denzel Boscher", status_sp: "Afwezig", gevlagd: 1 },
  ]);
  addJson("wedstrijdinvoer_staf", []);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["speler_id", "naam", "Beest/Spook", "13-08-2026"],
    ["sp24", "Nicky Eekhuis", 1, 1],
    ["sp25", "Bram Dolman", null, null],
    ["sp26", "Denzel Boscher", 1, 1],
  ]), "trainingsinvoer");
  XLSX.writeFile(workbook, workbookPath);

  execFileSync(process.execPath, [extractor, workbookPath], { cwd: testDir, stdio: "pipe" });
  const data = JSON.parse(fs.readFileSync(path.join(testDir, "public", "data", "team.json"), "utf8"));
  const byName = (name) => data.players.find((player) => player.name === name);

  assert.equal(byName("Nicky Eekhuis").totals.goals, 1);
  assert.equal(byName("Nicky Eekhuis").totals.polo, 1);
  assert.equal(byName("Nicky Eekhuis").training.percentage, 100);
  assert.equal(byName("Nicky Eekhuis").training.rankingEligible, true);
  assert.equal(byName("Bram Dolman").totals.assists, 1);
  assert.equal(byName("Bram Dolman").training.rankingEligible, false);
  assert.equal(byName("Denzel Boscher").totals.absent, 1);
  assert.equal(byName("Denzel Boscher").totals.flagged, 1);
});

test("spelerskaart gebruikt de afgesproken volgorde en vat grote gedeelde loser-posities samen", () => {
  const source = fs.readFileSync(path.join(repoRoot, "app", "components", "TeamDashboard.tsx"), "utf8");
  const labels = ["Trainingspercentage", "Wedstrijden", "Wedstrijd opkomst", "Afwezig", "Volgespeeld", "Deels gespeeld", "Niet gespeeld", "Doelpunten", "Assists", "Penalty gescoord", "Penalty gemist", "Geel", "Rood", "Aanvoerder", "Gekeept", "Gevlagd", "Polo vergeten", "Te laat"];
  let previous = -1;
  for (const label of labels) {
    const current = source.indexOf(`<Detail label="${label}"`, previous + 1);
    assert.ok(current > previous, `${label} staat niet in de afgesproken volgorde`);
    previous = current;
  }
  assert.match(source, /players\.length > maxNames \? <p>Meerdere spelers delen deze positie\.<\/p>/);
  assert.match(source, /contributors\.goals/);
  assert.match(source, /contributors\.assists/);
  assert.match(source, /\.sort\(\(a, b\) => a\.name\.localeCompare\(b\.name, "nl", \{ sensitivity: "base" \}\)\)/);
  assert.match(source, /function dashboardPlayerName/);
  assert.match(source, /sameFirstName\.length > 1/);
  assert.match(source, /function MatchDetailsDrawer/);
  assert.match(source, /showMvp=\{false\}/);
  assert.match(source, /Bekijk wedstrijdstatistieken/);
  assert.match(source, /⭐ Man van de wedstrijd/);
  assert.match(source, /Statistieken per staf/);
  assert.match(source, /staffEntries/);
  assert.match(source, /training\.attendees\.map\(shortName\)/);
  assert.match(source, /function GoalTimeline/);
  assert.match(source, /Bekijk team/);
  assert.match(source, /Bekijk trainingen/);
  assert.match(source, /Bekijk wedstrijden/);
  assert.doesNotMatch(source, /function MatchesView[\s\S]*SectionHeading title="Laatste uitslag"[\s\S]*function TrainingsView/);
});
