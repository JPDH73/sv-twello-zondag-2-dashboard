import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const oneDriveFile = "/Users/jpdh/Library/CloudStorage/OneDrive-Persoonlijk/SV Twello zondag 2/2026-2027_zondag2.xlsx";
const defaultFile = process.env.TEAM_EXCEL_PATH || (fs.existsSync(oneDriveFile) ? oneDriveFile : "");
const remoteFile = process.env.TEAM_EXCEL_URL;
const suppliedFile = process.argv.slice(2).find((argument) => argument !== "--");
const selectedFile = suppliedFile || defaultFile;
if (!selectedFile && !remoteFile) {
  console.error("Geef het Excel-bestand mee, stel TEAM_EXCEL_PATH in of configureer TEAM_EXCEL_URL.");
  process.exit(1);
}
const outputPath = path.resolve("public/data/team.json");
let workbook;
let sourceFile;
if (remoteFile && !suppliedFile) {
  const response = await fetch(remoteFile, { cache: "no-store" });
  if (!response.ok) throw new Error(`OneDrive-bestand kon niet worden opgehaald (${response.status}).`);
  workbook = XLSX.read(await response.arrayBuffer(), { type: "array", cellDates: true, cellFormula: true });
  sourceFile = "2026-2027_zondag2.xlsx";
} else {
  const inputPath = path.resolve(selectedFile);
  if (!fs.existsSync(inputPath)) {
    console.error(`Excel-bestand niet gevonden: ${inputPath}`);
    process.exit(1);
  }
  workbook = XLSX.readFile(inputPath, { cellDates: true, cellFormula: true });
  sourceFile = path.basename(inputPath);
}
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
const nameKey = (value) => clean(value).toLocaleLowerCase("nl").replace(/\s+/g, " ");
const number = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(clean(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};
const yes = (value) => value === true || value === 1 || ["ja", "yes", "true", "x"].includes(clean(value).toLowerCase());
const dateOnly = (value) => {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  const text = clean(value);
  const iso = text.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const dutch = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\s|$)/);
  if (dutch) return `${dutch[3]}-${dutch[2].padStart(2, "0")}-${dutch[1].padStart(2, "0")}`;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  return "";
};
const timeOnly = (value) => {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${String(parsed.H).padStart(2, "0")}:${String(parsed.M).padStart(2, "0")}`;
  }
  const text = clean(value);
  return text.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/)?.[0]?.padStart(5, "0") ?? text;
};
const meaningful = (value) => value !== null && value !== undefined && value !== false && clean(value) !== "" && value !== 0;
const field = (row, aliases) => {
  const normalizedAliases = new Set(aliases.map((alias) => alias.toLocaleLowerCase("nl").replace(/[^a-z0-9]/g, "")));
  const key = Object.keys(row).find((name) => normalizedAliases.has(name.toLocaleLowerCase("nl").replace(/[^a-z0-9]/g, "")));
  return key ? row[key] : null;
};
const resultIsFinal = (value) => /\d+\s*[-–:]\s*\d+/.test(clean(value));

const playerRows = records("spelers");
const staffRows = records("staf");
const playerOfYearSheet = workbook.SheetNames.find((name) => ["speler_jaar", "spelerjaar", "speler van het jaar"].includes(name.toLowerCase()));
const playerOfYearRows = playerOfYearSheet ? records(playerOfYearSheet) : [];
const matchRows = records("wedstrijden");
const playerInputRows = records("wedstrijdinvoer_spelers");
const staffInputRows = records("wedstrijdinvoer_staf");
const trainingRows = matrix("trainingsinvoer");
const today = new Date().toISOString().slice(0, 10);
const goalEventsByMatch = new Map([
  ["M623608225", [
    { minute: 10, score: "1-0", team: "Voorwaarts T 5" },
    { minute: 30, score: "1-1", team: "SV Twello 2" },
    { minute: 47, score: "1-2", team: "SV Twello 2" },
    { minute: 55, score: "1-3", team: "SV Twello 2" },
    { minute: 60, score: "1-4", team: "SV Twello 2" },
    { minute: 70, score: "2-4", team: "Voorwaarts T 5" },
  ]],
  ["O000000001", [
    { minute: 10, score: "1-0", team: "SV Twello 2" },
    { minute: 65, score: "2-0", team: "SV Twello 2" },
    { minute: 70, score: "2-1", team: "DAVO 2" },
    { minute: 80, score: "3-1", team: "SV Twello 2" },
    { minute: 85, score: "3-2", team: "DAVO 2" },
  ]],
]);

const matchesById = new Map();
for (const row of matchRows) {
  const id = clean(row.wedstrijd_id);
  if (!id) continue;
  matchesById.set(id, {
    id,
    date: dateOnly(row.datum),
    time: timeOnly(row.tijd),
    home: clean(row.thuis),
    away: clean(row.uit),
    result: clean(row.uitslag),
    competition: clean(row.competitie),
    manOfTheMatch: clean(field(row, ["man van de wedstrijd", "man_of_the_match", "man of the match", "motm", "mvp"])),
    goalEvents: goalEventsByMatch.get(id) ?? [],
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
    manOfTheMatch: "",
    goalEvents: goalEventsByMatch.get(id) ?? [],
  });
}

for (const row of playerInputRows) {
  const match = matchesById.get(clean(row.wedstrijd_id));
  if (!match || match.manOfTheMatch) continue;
  const marker = field(row, ["man van de wedstrijd", "man_of_the_match", "man of the match", "motm", "mvp"]);
  if (yes(marker)) match.manOfTheMatch = clean(row.naam);
  else if (typeof marker === "string" && clean(marker).length > 1) match.manOfTheMatch = clean(marker);
}

const inputByPlayerId = new Map();
const inputByPlayerName = new Map();
for (const row of playerInputRows) {
  const playerId = clean(row.speler_id);
  const playerName = nameKey(row.naam);
  if (playerId) {
    const list = inputByPlayerId.get(playerId) ?? [];
    list.push(row);
    inputByPlayerId.set(playerId, list);
  }
  if (playerName) {
    const list = inputByPlayerName.get(playerName) ?? [];
    list.push(row);
    inputByPlayerName.set(playerName, list);
  }
}

const trainingHeaders = trainingRows[0] ?? [];
const trainingRankingColumn = trainingHeaders.findIndex((header) => clean(header).toLocaleLowerCase("nl").replace(/[^a-z0-9]/g, "") === "beestspook");
const invisibleManColumn = trainingHeaders.findIndex((header) => clean(header).toLocaleLowerCase("nl").replace(/[^a-z0-9]/g, "") === "onzichtbareman");
const datedTrainingColumns = trainingHeaders
  .map((header, col) => ({ col, date: dateOnly(header) }))
  .filter(({ col, date }) => col >= 2 && date && date <= today);
const trainingByPlayerId = new Map();
const trainingByPlayerName = new Map();
for (const row of trainingRows.slice(1)) {
  const playerId = clean(row[0]);
  const playerName = nameKey(row[1]);
  if (playerId) trainingByPlayerId.set(playerId, row);
  if (playerName) trainingByPlayerName.set(playerName, row);
}
const trainingColumns = datedTrainingColumns.filter(({ col }) => trainingRows.slice(1).some((row) => yes(row[col])));
const trainingRowFor = (playerId, playerName) => trainingByPlayerName.get(nameKey(playerName)) ?? trainingByPlayerId.get(playerId) ?? [];

const players = playerRows.map((row) => {
  const id = clean(row.speler_id);
  const playerName = clean(row.naam);
  const matchRecords = (inputByPlayerName.get(nameKey(playerName)) ?? inputByPlayerId.get(id) ?? []).flatMap((entry) => {
    const status = clean(entry.status_sp);
    const goals = number(entry.doelpunten);
    const assists = number(entry.assists);
    const yellow = number(entry.geel);
    const red = number(entry.rood);
    const penaltiesScored = number(entry["penalty gescoord"]);
    const penaltiesMissed = number(entry["penalty gemist"]);
    const late = yes(entry["te laat"]);
    const flagged = yes(entry.gevlagd);
    const polo = yes(field(entry, ["polo", "geen polo", "polo vergeten"]));
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
  const trainingRow = trainingRowFor(id, playerName);
  const sessions = trainingColumns.filter(({ col }) => yes(trainingRow[col])).map(({ date }) => date);
  const totals = matchRecords.reduce((sum, match) => ({
    matches: sum.matches + (["deels gespeeld", "volgespeeld"].includes(match.status.toLowerCase()) ? 1 : 0),
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
    partial: sum.partial + (match.status.toLowerCase() === "deels gespeeld" ? 1 : 0),
    full: sum.full + (match.status.toLowerCase() === "volgespeeld" ? 1 : 0),
  }), { matches: 0, goals: 0, assists: 0, yellow: 0, red: 0, penaltiesScored: 0, penaltiesMissed: 0, late: 0, flagged: 0, polo: 0, kept: 0, captain: 0, absent: 0, notPlayed: 0, partial: 0, full: 0 });
  const matchStatusTotal = totals.absent + totals.notPlayed + totals.partial + totals.full;
  const matchPresent = totals.notPlayed + totals.partial + totals.full;
  return {
    id,
    number: clean(row.rugnummer) === "-" ? "" : clean(row.rugnummer),
    name: playerName,
    position: clean(row.positie),
    foot: clean(row.voet),
    guest: yes(row.gastspeler),
    captain: yes(row.aanvoerder),
    invisibleManEligible: yes(field(row, ["onzichtbare man", "onzichtbare_man", "onzichtbareman"])) || (invisibleManColumn >= 0 && yes(trainingRow[invisibleManColumn])),
    training: {
      rankingEligible: trainingRankingColumn >= 0 && yes(trainingRow[trainingRankingColumn]),
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
    if (!meaningful(status)) return [];
    return [{
      ...(matchesById.get(clean(entry.wedstrijd_id)) ?? { id: clean(entry.wedstrijd_id), date: "", time: "", home: clean(entry.thuis), away: clean(entry.uit), result: "", competition: "Wedstrijd" }),
      status,
    }];
  }).sort((a, b) => b.date.localeCompare(a.date));
  const totals = matchRecords.reduce((sum, match) => ({
    present: sum.present + (match.status.toLowerCase() === "aanwezig" ? 1 : 0),
    partial: sum.partial + (match.status.toLowerCase() === "deels aanwezig" ? 1 : 0),
    absent: sum.absent + (match.status.toLowerCase() === "afwezig" ? 1 : 0),
  }), { present: 0, partial: 0, absent: 0 });
  return {
    id,
    name: clean(row.naam),
    role: clean(row.rol),
    totals,
    matches: matchRecords,
  };
});

const seasonStart = "2026-08-01";
const matches = [...matchesById.values()].sort((a, b) => {
  const aDate = !a.date || a.date < seasonStart ? "9999" : a.date;
  const bDate = !b.date || b.date < seasonStart ? "9999" : b.date;
  return aDate.localeCompare(bDate);
});
const trainings = trainingColumns.map(({ col, date }) => ({
  date,
  attendees: players.filter((player) => yes(trainingRowFor(player.id, player.name)[col])).map((player) => player.name),
})).sort((a, b) => b.date.localeCompare(a.date));
const playerOfYear = playerOfYearRows
  .map((row) => ({ year: number(row.jaar), name: clean(row.naam), playerId: clean(row.speler_id), motivation: clean(row.motivatie) }))
  .filter((entry) => entry.year && entry.name)
  .sort((a, b) => b.year - a.year);

const data = {
  team: "SV Twello Zondag 2",
  season: "2026-2027",
  generatedAt: new Date().toISOString(),
  sourceFile,
  totals: {
    players: players.filter((player) => !player.guest).length,
    guests: players.filter((player) => player.guest).length,
    staff: staff.length,
    trainings: trainingColumns.length,
    matchesScheduled: matches.length,
    matchesPlayed: matches.filter((match) => resultIsFinal(match.result)).length,
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
