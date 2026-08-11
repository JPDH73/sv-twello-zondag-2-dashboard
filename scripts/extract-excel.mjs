import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const defaultFile = "/Users/jpdh/Library/CloudStorage/OneDrive-Persoonlijk/SV Twello zondag 2/2026-2027_zondag2.xlsx";
const suppliedFile = process.argv.slice(2).find((argument) => argument !== "--");
const inputPath = path.resolve(suppliedFile || defaultFile);
const outputPath = path.resolve("public/data/team.json");

if (!fs.existsSync(inputPath)) {
  console.error(`Excel-bestand niet gevonden: ${inputPath}`);
  process.exit(1);
}

const workbook = XLSX.readFile(inputPath, { cellDates: true, cellFormula: true });
const records = (sheetName) => {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Tabblad ontbreekt: ${sheetName}`);
  return XLSX.utils.sheet_to_json(sheet, { raw: true, defval: null });
};
const matrix = (sheetName) => {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Tabblad ontbreekt: ${sheetName}`);
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
};

const clean = (value) => String(value ?? "").trim();
const number = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(clean(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};
const yes = (value) => value === true || value === 1 || ["ja", "yes", "true", "x"].includes(clean(value).toLowerCase());
const dateOnly = (value) => {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  const text = clean(value);
  const iso = text.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  return "";
};
const meaningful = (value) => value !== null && value !== undefined && value !== false && clean(value) !== "" && value !== 0;

const playerRows = records("spelers");
const staffRows = records("staf");
const matchRows = records("wedstrijden");
const playerInputRows = records("wedstrijdinvoer_spelers");
const staffInputRows = records("wedstrijdinvoer_staf");
const trainingRows = matrix("trainingsinvoer");
const today = new Date().toISOString().slice(0, 10);

const matchesById = new Map();
for (const row of matchRows) {
  const id = clean(row.wedstrijd_id);
  if (!id) continue;
  matchesById.set(id, {
    id,
    date: dateOnly(row.datum),
    time: clean(row.tijd),
    home: clean(row.thuis),
    away: clean(row.uit),
    result: clean(row.uitslag),
    competition: clean(row.competitie),
  });
}

for (const row of [...playerInputRows, ...staffInputRows]) {
  const id = clean(row.wedstrijd_id);
  if (!id || matchesById.has(id)) continue;
  matchesById.set(id, {
    id,
    date: "",
    time: "",
    home: clean(row.thuis),
    away: clean(row.uit),
    result: "",
    competition: id.startsWith("O") ? "Oefenwedstrijd" : "Wedstrijd",
  });
}

const inputByPlayer = new Map();
for (const row of playerInputRows) {
  const playerId = clean(row.speler_id);
  if (!playerId) continue;
  const list = inputByPlayer.get(playerId) ?? [];
  list.push(row);
  inputByPlayer.set(playerId, list);
}

const trainingHeaders = trainingRows[0] ?? [];
const trainingColumns = trainingHeaders
  .map((header, col) => ({ col, date: dateOnly(header) }))
  .filter(({ col, date }) => col >= 2 && date && date <= today);
const trainingByPlayer = new Map();
for (const row of trainingRows.slice(1)) trainingByPlayer.set(clean(row[0]), row);

const players = playerRows.map((row) => {
  const id = clean(row.speler_id);
  const matchRecords = (inputByPlayer.get(id) ?? []).flatMap((entry) => {
    const status = clean(entry.status_sp);
    const goals = number(entry.doelpunten);
    const assists = number(entry.assists);
    const yellow = number(entry.geel);
    const red = number(entry.rood);
    const penaltiesScored = number(entry["penalty gescoord"]);
    const penaltiesMissed = number(entry["penalty gemist"]);
    const late = yes(entry["te laat"]);
    const flagged = yes(entry.gevlagd);
    const kept = yes(entry.gekeept);
    if (![status, goals, assists, yellow, red, penaltiesScored, penaltiesMissed, late, flagged, kept].some(meaningful)) return [];
    return [{
      ...(matchesById.get(clean(entry.wedstrijd_id)) ?? { id: clean(entry.wedstrijd_id), date: "", time: "", home: clean(entry.thuis), away: clean(entry.uit), result: "", competition: "Wedstrijd" }),
      status,
      goals,
      assists,
      yellow,
      red,
      penaltiesScored,
      penaltiesMissed,
      late,
      flagged,
      kept,
    }];
  }).sort((a, b) => b.date.localeCompare(a.date));
  const trainingRow = trainingByPlayer.get(id) ?? [];
  const sessions = trainingColumns.filter(({ col }) => yes(trainingRow[col])).map(({ date }) => date);
  const totals = matchRecords.reduce((sum, match) => ({
    matches: sum.matches + (["deels", "volledig"].includes(match.status.toLowerCase()) ? 1 : 0),
    goals: sum.goals + match.goals,
    assists: sum.assists + match.assists,
    yellow: sum.yellow + match.yellow,
    red: sum.red + match.red,
    penaltiesScored: sum.penaltiesScored + match.penaltiesScored,
    penaltiesMissed: sum.penaltiesMissed + match.penaltiesMissed,
    flagged: sum.flagged + (match.flagged ? 1 : 0),
    kept: sum.kept + (match.kept ? 1 : 0),
  }), { matches: 0, goals: 0, assists: 0, yellow: 0, red: 0, penaltiesScored: 0, penaltiesMissed: 0, flagged: 0, kept: 0 });
  return {
    id,
    number: clean(row.rugnummer) === "-" ? "" : clean(row.rugnummer),
    name: clean(row.naam),
    position: clean(row.positie),
    foot: clean(row.voet),
    guest: yes(row.gastspeler),
    training: {
      attended: sessions.length,
      total: trainingColumns.length,
      percentage: trainingColumns.length ? Math.round(sessions.length / trainingColumns.length * 100) : 0,
      sessions,
    },
    totals,
    matches: matchRecords,
  };
});

const staffInputById = new Map();
for (const row of staffInputRows) {
  const id = clean(row.staf_id);
  if (!id) continue;
  const list = staffInputById.get(id) ?? [];
  list.push(row);
  staffInputById.set(id, list);
}
const staff = staffRows.map((row) => {
  const id = clean(row.staf_id);
  const entries = staffInputById.get(id) ?? [];
  return {
    id,
    name: clean(row.naam),
    role: clean(row.rol),
    matches: entries.filter((entry) => ["volledig", "deels"].includes(clean(entry.status_st).toLowerCase())).length,
  };
});

const matches = [...matchesById.values()].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
const playedMatchIds = new Set(playerInputRows.filter((row) => clean(row.status_sp) || [row.doelpunten, row.assists, row.geel, row.rood].some(meaningful)).map((row) => clean(row.wedstrijd_id)));
const trainings = trainingColumns.map(({ col, date }) => ({
  date,
  attendees: players.filter((player) => yes((trainingByPlayer.get(player.id) ?? [])[col])).map((player) => player.name),
})).sort((a, b) => b.date.localeCompare(a.date));

const data = {
  team: "SV Twello Zondag 2",
  season: "2026-2027",
  generatedAt: new Date().toISOString(),
  sourceFile: path.basename(inputPath),
  totals: {
    players: players.length,
    staff: staff.length,
    trainings: trainingColumns.length,
    matchesScheduled: matches.length,
    matchesPlayed: matches.filter((match) => match.result || playedMatchIds.has(match.id)).length,
    goals: players.reduce((sum, player) => sum + player.totals.goals, 0),
    assists: players.reduce((sum, player) => sum + player.totals.assists, 0),
  },
  matches,
  trainings,
  players,
  staff,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Dashboard bijgewerkt: ${data.totals.players} spelers, ${data.totals.matchesScheduled} wedstrijden, ${data.totals.trainings} trainingen.`);
