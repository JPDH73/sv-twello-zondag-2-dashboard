import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const defaultFile = process.env.TEAM_EXCEL_PATH;
const suppliedFile = process.argv.slice(2).find((argument) => argument !== "--");
const selectedFile = suppliedFile || defaultFile;
if (!selectedFile) {
  console.error("Geef het Excel-bestand mee als argument of via TEAM_EXCEL_PATH.");
  process.exit(1);
}
const inputPath = path.resolve(selectedFile);
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
const playerOfYearSheet = workbook.SheetNames.find((name) => ["speler_jaar", "spelerjaar", "speler van het jaar"].includes(name.toLowerCase()));
const playerOfYearRows = playerOfYearSheet ? records(playerOfYearSheet) : [];
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
const datedTrainingColumns = trainingHeaders
  .map((header, col) => ({ col, date: dateOnly(header) }))
  .filter(({ col, date }) => col >= 2 && date && date <= today);
const trainingByPlayer = new Map();
for (const row of trainingRows.slice(1)) trainingByPlayer.set(clean(row[0]), row);
const trainingColumns = datedTrainingColumns.filter(({ col }) => [...trainingByPlayer.values()].some((row) => yes(row[col])));

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
    const polo = yes(entry.polo);
    const kept = yes(entry.gekeept);
    const captain = yes(entry.aanvoerder);
    if (![status, goals, assists, yellow, red, penaltiesScored, penaltiesMissed, late, flagged, polo, kept, captain].some(meaningful)) return [];
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
      polo,
      kept,
      captain,
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
    late: sum.late + (match.late ? 1 : 0),
    flagged: sum.flagged + (match.flagged ? 1 : 0),
    polo: sum.polo + (match.polo ? 1 : 0),
    kept: sum.kept + (match.kept ? 1 : 0),
    captain: sum.captain + (match.captain ? 1 : 0),
    absent: sum.absent + (match.status.toLowerCase() === "afwezig" ? 1 : 0),
    notPlayed: sum.notPlayed + (match.status.toLowerCase() === "niet gespeeld" ? 1 : 0),
    partial: sum.partial + (match.status.toLowerCase() === "deels" ? 1 : 0),
    full: sum.full + (match.status.toLowerCase() === "volledig" ? 1 : 0),
  }), { matches: 0, goals: 0, assists: 0, yellow: 0, red: 0, penaltiesScored: 0, penaltiesMissed: 0, late: 0, flagged: 0, polo: 0, kept: 0, captain: 0, absent: 0, notPlayed: 0, partial: 0, full: 0 });
  const matchStatusTotal = totals.absent + totals.notPlayed + totals.partial + totals.full;
  const matchPresent = totals.notPlayed + totals.partial + totals.full;
  return {
    id,
    number: clean(row.rugnummer) === "-" ? "" : clean(row.rugnummer),
    name: clean(row.naam),
    position: clean(row.positie),
    foot: clean(row.voet),
    guest: yes(row.gastspeler),
    captain: yes(row.aanvoerder),
    training: {
      attended: sessions.length,
      total: trainingColumns.length,
      percentage: trainingColumns.length ? Math.round(sessions.length / trainingColumns.length * 100) : 0,
      sessions,
    },
    matchAttendance: {
      present: matchPresent,
      total: matchStatusTotal,
      percentage: matchStatusTotal ? Math.round(matchPresent / matchStatusTotal * 100) : 0,
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
  const matchRecords = entries.flatMap((entry) => {
    const status = clean(entry.status_st);
    const late = yes(entry["te laat"]);
    if (![status, late].some(meaningful)) return [];
    return [{
      ...(matchesById.get(clean(entry.wedstrijd_id)) ?? { id: clean(entry.wedstrijd_id), date: "", time: "", home: clean(entry.thuis), away: clean(entry.uit), result: "", competition: "Wedstrijd" }),
      status,
      late,
    }];
  }).sort((a, b) => b.date.localeCompare(a.date));
  const totals = matchRecords.reduce((sum, match) => ({
    full: sum.full + (match.status.toLowerCase() === "volledig" ? 1 : 0),
    partial: sum.partial + (match.status.toLowerCase() === "deels" ? 1 : 0),
    absent: sum.absent + (match.status.toLowerCase() === "afwezig" ? 1 : 0),
    late: sum.late + (match.late ? 1 : 0),
  }), { full: 0, partial: 0, absent: 0, late: 0 });
  return {
    id,
    name: clean(row.naam),
    role: clean(row.rol),
    totals,
    matches: matchRecords,
  };
});

const matches = [...matchesById.values()].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
const playedMatchIds = new Set(playerInputRows.filter((row) => clean(row.status_sp) || [row.doelpunten, row.assists, row.geel, row.rood].some(meaningful)).map((row) => clean(row.wedstrijd_id)));
const trainings = trainingColumns.map(({ col, date }) => ({
  date,
  attendees: players.filter((player) => yes((trainingByPlayer.get(player.id) ?? [])[col])).map((player) => player.name),
})).sort((a, b) => b.date.localeCompare(a.date));
const playerOfYear = playerOfYearRows
  .map((row) => ({ year: number(row.jaar), name: clean(row.naam), playerId: clean(row.speler_id) }))
  .filter((entry) => entry.year && entry.name)
  .sort((a, b) => b.year - a.year);

const data = {
  team: "SV Twello Zondag 2",
  season: "2026-2027",
  generatedAt: new Date().toISOString(),
  sourceFile: path.basename(inputPath),
  totals: {
    players: players.filter((player) => !player.guest).length,
    guests: players.filter((player) => player.guest).length,
    staff: staff.length,
    trainings: trainingColumns.length,
    matchesScheduled: matches.length,
    matchesPlayed: matches.filter((match) => match.result || playedMatchIds.has(match.id)).length,
    goals: players.reduce((sum, player) => sum + player.totals.goals, 0),
    assists: players.reduce((sum, player) => sum + player.totals.assists, 0),
  },
  matches,
  trainings,
  playerOfYear,
  players,
  staff,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Dashboard bijgewerkt: ${data.totals.players} spelers, ${data.totals.matchesScheduled} wedstrijden, ${data.totals.trainings} trainingen.`);
