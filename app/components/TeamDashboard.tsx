"use client";

import { Children, useEffect, useMemo, useState, type ReactNode } from "react";

type GoalEvent = { minute: number; score: string; team: string };
type Match = { id: string; date: string; time: string; home: string; away: string; result: string; competition: string; manOfTheMatch: string; goalEvents: GoalEvent[] };
type PlayerMatch = Match & { status: string; goals: number; assists: number; yellow: number; red: number; penaltiesScored: number; penaltiesMissed: number; late: boolean; flagged: boolean; polo: boolean; kept: boolean; captain: boolean };
type MatchContributors = { goals: { name: string; count: number }[]; assists: { name: string; count: number }[] };
type Player = {
  id: string; number: string; name: string; position: string; foot: string; guest: boolean; captain: boolean;
  training: { rankingEligible: boolean; attended: number; total: number; percentage: number; sessions: string[] };
  matchAttendance: { present: number; total: number; percentage: number };
  totals: { matches: number; goals: number; assists: number; yellow: number; red: number; penaltiesScored: number; penaltiesMissed: number; late: number; flagged: number; polo: number; kept: number; captain: number; absent: number; notPlayed: number; partial: number; full: number };
  matches: PlayerMatch[];
};
type StaffMatch = Match & { status: string };
type Staff = { id: string; name: string; role: string; totals: { present: number; partial: number; absent: number }; matches: StaffMatch[] };
type TeamData = {
  team: string; season: string; generatedAt: string; sourceFile: string;
  totals: { players: number; guests: number; staff: number; trainings: number; matchesScheduled: number; matchesPlayed: number; goals: number; assists: number };
  matches: Match[];
  trainings: { date: string; attendees: string[] }[];
  playerOfYear: { year: number; name: string; playerId: string; motivation: string }[];
  players: Player[];
  staff: Staff[];
};
type View = "dashboard" | "staf" | "team" | "wedstrijden" | "trainingen" | "statistieken" | "teamhistorie" | "historie";

const views: { id: View; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "staf", label: "Staf" },
  { id: "team", label: "Selectie" },
  { id: "wedstrijden", label: "Wedstrijden" },
  { id: "trainingen", label: "Trainingen" },
  { id: "statistieken", label: "Statistieken" },
  { id: "teamhistorie", label: "Teamhistorie" },
  { id: "historie", label: "Speler van het jaar" },
];

const staffOrder = [
  "Andrew Hietbrink",
  "Jeffrey Karrenbeld",
  "Sander Bouwmeester",
  "Jan Berkenbosch",
  "Christiaan Grootgens",
  "Jean-Paul de Haas",
];
const selectionLines = [
  { position: "Keeper", title: "Keepers" },
  { position: "Verdediger", title: "Verdedigers" },
  { position: "Middenvelder", title: "Middenvelders" },
  { position: "Aanvaller", title: "Aanvallers" },
];
const panenkaFrames = Array.from({ length: 30 }, (_, index) => `./media/panenka-frames/frame-${String(index + 1).padStart(2, "0")}.jpg`);

const teamHistory = [
  { season: "2025/2026", team: "SV Twello 2", division: "5e klasse", position: "12e van 12", result: "last" },
  { season: "2024/2025", team: "SV Twello 2", division: "5e klasse", position: "5e van 10" },
  { season: "2023/2024", team: "SV Twello 2", division: "5e klasse", position: "10e van 11" },
  { season: "2022/2023", team: "SV Twello 2", division: "6e klasse", position: "1e van 10", result: "champion" },
  { season: "2021/2022", team: "SV Twello 2", division: "6e klasse", position: "1e van 12", result: "champion" },
  { season: "2019/2020", team: "SV Twello 2", division: "6e klasse", position: "10e van 12" },
  { season: "2018/2019", team: "SV Twello 2", formerTeam: "toen nog SV Twello 3", division: "6e klasse", position: "12e van 12", result: "last" },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts[0]?.includes("-")) return parts[0].split("-").map((part) => part[0] ?? "").join("").toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}
function formatDate(value: string) {
  if (!value) return "Datum nog niet bekend";
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}
function formatTrainingDate(value: string) {
  if (!value) return "Datum nog niet bekend";
  const date = new Date(`${value}T12:00:00`);
  const weekday = new Intl.DateTimeFormat("nl-NL", { weekday: "long" }).format(date);
  return `${weekday} ${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
}
function sortNames(names: string[]) { return [...names].sort((a, b) => a.localeCompare(b, "nl", { sensitivity: "base" })); }
function dashboardPlayerName(name: string, players: Player[]) {
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0] ?? name;
  const sameFirstName = players.filter((player) => (player.name.trim().split(/\s+/)[0] ?? "").localeCompare(firstName, "nl", { sensitivity: "base" }) === 0);
  const surname = parts.at(-1);
  return sameFirstName.length > 1 && surname && surname !== firstName ? `${firstName} ${surname[0].toLocaleUpperCase("nl")}.` : firstName;
}
function opponent(match: Match) { return match.home === "SV Twello 2" ? match.away : match.home; }
function venue(match: Match) { return match.home === "SV Twello 2" ? "Thuis" : "Uit"; }
function positionCode(position: string) {
  const normalized = position.toLocaleLowerCase("nl");
  if (normalized.includes("keeper")) return "KEE";
  if (normalized.includes("verded")) return "VER";
  if (normalized.includes("midden")) return "MID";
  if (normalized.includes("aanval")) return "AAN";
  return "SVT";
}
function staffCode(role: string) {
  const normalized = role.toLocaleLowerCase("nl");
  if (normalized.includes("trainer")) return "TRAINER";
  if (normalized.includes("coach")) return "COACH";
  if (normalized.includes("leider")) return "LEI";
  return "STAF";
}
function upcomingMatches(matches: Match[], limit = 2) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return matches.filter((match) => match.date && match.date >= today && !hasFinalResult(match.result)).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).slice(0, limit);
}
function hasFinalResult(result: string) { return /\d+\s*[-–:]\s*\d+/.test(result?.trim() ?? ""); }
function latestPlayedMatch(matches: Match[]) {
  return [...matches]
    .filter((match) => match.date && hasFinalResult(match.result))
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))[0];
}
function matchContributors(players: Player[], matchId: string): MatchContributors {
  const contributions = (field: "goals" | "assists") => players.flatMap((player) => {
    const count = player.matches.find((match) => match.id === matchId)?.[field] ?? 0;
    return count > 0 ? [{ name: dashboardPlayerName(player.name, players), count }] : [];
  }).sort((a, b) => a.name.localeCompare(b.name, "nl", { sensitivity: "base" }));
  return { goals: contributions("goals"), assists: contributions("assists") };
}
function leaders(players: Player[], field: "goals" | "assists" | "training") {
  const score = (player: Player) => field === "training" ? player.training.attended : player.totals[field];
  const highest = Math.max(0, ...players.map(score));
  return {
    players: highest > 0 ? players.filter((player) => score(player) === highest).sort((a, b) => a.name.localeCompare(b.name, "nl")) : [],
    score: highest,
  };
}
function rankedPlayers(players: Player[], score: (player: Player) => number, direction: "max" | "min" = "max", hideWhenZero = false, limit = 5) {
  const sorted = [...players].sort((a, b) => (direction === "max" ? score(b) - score(a) : score(a) - score(b)) || a.name.localeCompare(b.name, "nl"));
  if (!sorted.length || (hideWhenZero && score(sorted[0]) === 0)) return [];
  return sorted.slice(0, limit);
}
function lowestTrainingPlayers(players: Player[], target = 3, max = 5) {
  const sorted = [...players].sort((a, b) => a.training.attended - b.training.attended || a.name.localeCompare(b.name, "nl"));
  const selected: Player[] = [];
  for (let index = 0; index < sorted.length && selected.length < target;) {
    const score = sorted[index].training.attended;
    const group = sorted.slice(index).filter((player) => player.training.attended === score);
    if (selected.length && selected.length + group.length > max) break;
    selected.push(...group.slice(0, Math.max(0, max - selected.length)));
    index += group.length;
  }
  return selected;
}
export function TeamDashboard() {
  const [data, setData] = useState<TeamData | null>(null);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("nummer");
  const [selected, setSelected] = useState<Player | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const loadData = () => fetch(`./data/team.json?updated=${Date.now()}`, { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error("Dashboardgegevens konden niet worden geladen."); return response.json(); })
      .then((json: TeamData) => { if (active) { setData(json); setError(""); } })
      .catch((err: Error) => { if (active) setError(err.message); });
    void loadData();
    const refresh = window.setInterval(loadData, 5 * 60 * 1000);
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") void loadData(); };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => { active = false; window.clearInterval(refresh); document.removeEventListener("visibilitychange", refreshWhenVisible); };
  }, []);
  useEffect(() => {
    if (!selected && !selectedStaff) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setSelected(null); setSelectedStaff(null); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selected, selectedStaff]);

  const visiblePlayers = useMemo(() => {
    if (!data) return [];
    const normalized = query.trim().toLocaleLowerCase("nl");
    return data.players.filter((player) => player.name.toLocaleLowerCase("nl").includes(normalized)).sort((a, b) => {
      if (sort === "goals") return b.totals.goals - a.totals.goals || a.name.localeCompare(b.name, "nl");
      if (sort === "assists") return b.totals.assists - a.totals.assists || a.name.localeCompare(b.name, "nl");
      if (sort === "training") return b.training.percentage - a.training.percentage || a.name.localeCompare(b.name, "nl");
      if (sort === "naam") return a.name.localeCompare(b.name, "nl");
      return (Number(a.number) || 999) - (Number(b.number) || 999) || a.name.localeCompare(b.name, "nl");
    });
  }, [data, query, sort]);

  if (error) return <main className="error-box"><h1>Dashboard niet beschikbaar</h1><p>{error}</p></main>;
  if (!data) return <main className="loading"><div className="loading-card"><div className="loading-ball"/><strong>Teamdashboard laden…</strong></div></main>;

  const generated = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(data.generatedAt));
  const program = upcomingMatches(data.matches);

  return <main className="app-shell">
    <header className="site-header">
      <div className="header-inner">
        <button className="header-title" type="button" onClick={() => { setActiveView("dashboard"); setMenuOpen(false); }} aria-label="Ga naar dashboard"><strong>SV Twello Zondag 2</strong><span>Teamdashboard</span></button>
        <div className="header-actions"><span className="season-pill">Seizoen {data.season}</span><button className="menu-toggle" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen((open) => !open)}><span/><span/><span/><span className="sr-only">Menu</span></button></div>
      </div>
      <nav id="main-navigation" className={menuOpen ? "tabbar open" : "tabbar"} aria-label="Dashboardonderdelen">
        {views.map((view) => <button key={view.id} className={activeView === view.id ? "tab-button active" : "tab-button"} onClick={() => { setActiveView(view.id); setMenuOpen(false); }} aria-current={activeView === view.id ? "page" : undefined}>{view.label}</button>)}
      </nav>
    </header>

    {activeView === "dashboard" && <section className="hero" aria-label="SV Twello Zondag 2">
      <div className="hero-rays" aria-hidden="true"/>
      <div className="pitch-lines" aria-hidden="true">
        <span className="full-pitch">
          <span className="pitch-halfway" />
          <span className="pitch-center"><span className="pitch-center-spot" /></span>
          <span className="pitch-area pitch-area-left"><span className="pitch-goal-area"/><span className="pitch-penalty-spot"/><span className="pitch-goal"/></span>
          <span className="pitch-area pitch-area-right"><span className="pitch-goal-area"/><span className="pitch-penalty-spot"/><span className="pitch-goal"/></span>
        </span>
      </div>
      <div className="hero-main">
        <div className="hero-logo-panel"><img src="./sv-twello-logo.png" alt="Logo SV Twello" /></div>
        <div className="hero-copy"><p><span className="blue-letter">Z</span><span className="blue-letter">o</span>ndag <span className="blue-letter">2</span></p><strong>One Town, One Team, One Twello</strong></div>
      </div>
      <div className="hero-status">
        <span className="updated"><span className="updated-dot"/>Bijgewerkt op {generated}</span>
      </div>
    </section>}

    <div className="content">
      {activeView === "dashboard" && <DashboardView data={data} program={program} onNavigate={setActiveView}/>}
      {activeView === "staf" && (
        <StaffView staff={data.staff} setSelectedStaff={setSelectedStaff}/>
      )}
      {activeView === "team" && (
        <TeamView players={visiblePlayers} query={query} setQuery={setQuery} sort={sort} setSort={setSort} setSelected={setSelected}/>
      )}
      {activeView === "wedstrijden" && <MatchesView matches={data.matches} players={data.players} staff={data.staff}/>}
      {activeView === "trainingen" && <TrainingsView trainings={data.trainings} players={data.players}/>}
      {activeView === "statistieken" && <StatisticsView data={data}/>}
      {activeView === "teamhistorie" && <TeamHistoryView/>}
      {activeView === "historie" && <HistoryView entries={data.playerOfYear}/>}
      <footer className="footer">One Town, One Team, One Twello</footer>
    </div>
    {selected && <PlayerDrawer player={selected} onClose={() => setSelected(null)}/>} 
    {selectedStaff && <StaffDrawer member={selectedStaff} onClose={() => setSelectedStaff(null)}/>}
  </main>;
}

function DashboardView({ data, program, onNavigate }: { data: TeamData; program: Match[]; onNavigate: (view: View) => void }) {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const selection = data.players.filter((player) => !player.guest);
  const trainingRankingPlayers = selection.filter((player) => player.training.rankingEligible);
  const hasPlayedMatches = data.totals.matchesPlayed > 0;
  const mostLate = hasPlayedMatches ? rankedPlayers(selection, (player) => player.totals.late, "max", true) : [];
  const leastTraining = data.totals.trainings ? lowestTrainingPlayers(trainingRankingPlayers) : [];
  const mostAbsent = hasPlayedMatches ? rankedPlayers(selection, (player) => player.totals.absent, "max", true) : [];
  const goalLeaders = leaders(selection, "goals");
  const assistLeaders = leaders(selection, "assists");
  const trainingLeaders = leaders(trainingRankingPlayers, "training");
  const latestResult = latestPlayedMatch(data.matches);
  const latestContributors = latestResult ? matchContributors(data.players, latestResult.id) : undefined;
  const displayName = (player: Player) => dashboardPlayerName(player.name, data.players);
  const latestMvp = latestResult?.manOfTheMatch ? dashboardPlayerName(latestResult.manOfTheMatch, data.players) : undefined;
  return <>
    <section className="kpi-grid" aria-label="Teamtotalen">
      <Kpi label="Aantal selectiespelers" value={data.totals.players} linkLabel="Bekijk team" onOpen={() => onNavigate("team")} />
      <Kpi label="Aantal keer getraind" value={data.totals.trainings} linkLabel="Bekijk trainingen" onOpen={() => onNavigate("trainingen")} />
      <Kpi label="Wedstrijden / gespeeld" value={`${data.totals.matchesScheduled} / ${data.totals.matchesPlayed}`} linkLabel="Bekijk wedstrijden" onOpen={() => onNavigate("wedstrijden")} />
    </section>
    <SectionHeading title="Laatste uitslag & komende speeldag"/>
    <div className="match-overview">
      <MatchGroup label="Laatste uitslag" empty="Er is nog geen wedstrijd met een ingevulde eindstand.">
        {latestResult && <Fixture match={latestResult} emphasis contributors={latestContributors} manOfTheMatchLabel={latestMvp} onOpen={() => setSelectedMatch(latestResult)}/>}
      </MatchGroup>
      <MatchGroup label="Komende speeldag" empty="Er staan nog geen volgende wedstrijden gepland.">
        {program.map((match) => <Fixture key={match.id} match={match} showResult={false}/>)}
      </MatchGroup>
    </div>
    <SectionHeading title="Toppers"/>
    <div className="leader-grid">
      <Leader title="Trainingen" awardTitle="Trainingsbeest" players={trainingLeaders.players} score={trainingLeaders.score} displayName={displayName}/>
      <Leader title="Doelpunten" awardTitle="Scherpschutter" players={goalLeaders.players} score={goalLeaders.score} displayName={displayName}/>
      <Leader title="Assists" awardTitle="Assistkoning" players={assistLeaders.players} score={assistLeaders.score} displayName={displayName}/>
    </div>
    <SectionHeading title="Losers"/>
    <div className="loser-grid">
      <Loser label="Minste trainingen" awardTitle="Trainingsspook" players={leastTraining} score={(player) => player.training.attended} displayName={displayName} maxNames={5} showScore={false}/>
      <Loser label="Meest afwezig op wedstrijddag" awardTitle="Onzichtbare man" players={mostAbsent} score={(player) => player.totals.absent} displayName={displayName}/>
      <Loser label="Meest te laat op wedstrijddag" awardTitle="Uitslaper" players={mostLate} score={(player) => player.totals.late} displayName={displayName}/>
    </div>
    {selectedMatch && <MatchDetailsDrawer match={selectedMatch} players={data.players} staff={data.staff} onClose={() => setSelectedMatch(null)}/>}
  </>;
}

function StaffView({ staff, setSelectedStaff }: { staff: Staff[]; setSelectedStaff: (member: Staff) => void }) {
  const orderedStaff = [...staff].sort((a, b) => {
    const aIndex = staffOrder.indexOf(a.name);
    const bIndex = staffOrder.indexOf(b.name);
    return (aIndex < 0 ? staffOrder.length : aIndex) - (bIndex < 0 ? staffOrder.length : bIndex);
  });
  return <>
    <div className="page-heading"><div><h1>Teammanagement</h1></div></div>
    <div className="staff-grid">{orderedStaff.map((member) => <StaffCard key={member.id} member={member} onOpen={() => setSelectedStaff(member)}/>)}</div>
  </>;
}

function TeamView({ players, query, setQuery, sort, setSort, setSelected }: { players: Player[]; query: string; setQuery: (value: string) => void; sort: string; setSort: (value: string) => void; setSelected: (player: Player) => void }) {
  const groupedPlayers = selectionLines.map((line) => ({
    ...line,
    players: players.filter((player) => !player.guest && player.position === line.position),
  }));
  const guestPlayers = players.filter((player) => player.guest);
  return <>
    <div className="page-heading"><div><h1>Selectie</h1></div><div className="controls"><label className="search-wrap"><span className="search-icon" aria-hidden="true">⌕</span><span className="sr-only">Zoek speler</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek op naam…" /></label><label><span className="sr-only">Sorteer spelers</span><select className="sort-select" value={sort} onChange={(event) => setSort(event.target.value)}><option value="nummer">Sorteer: rugnummer</option><option value="naam">Naam</option><option value="training">Trainingspercentage</option><option value="goals">Doelpunten</option><option value="assists">Assists</option></select></label></div></div>
    {players.length ? <div className="selection-lines">{groupedPlayers.map((line) => line.players.length ? <section className="selection-line" key={line.position} aria-labelledby={`selection-${line.position}`}><h2 id={`selection-${line.position}`}>{line.title}</h2><div className="player-grid">{line.players.map((player) => <PlayerCard key={player.id} player={player} onOpen={() => setSelected(player)}/>)}</div></section> : null)}{guestPlayers.length ? <section className="selection-line" aria-labelledby="selection-guests"><h2 id="selection-guests">Gastspelers</h2><div className="player-grid">{guestPlayers.map((player) => <PlayerCard key={player.id} player={player} onOpen={() => setSelected(player)}/>)}</div></section> : null}</div> : <div className="empty-state">Geen speler gevonden voor “{query}”.</div>}
  </>;
}

function MatchesView({ matches, players, staff }: { matches: Match[]; players: Player[]; staff: Staff[] }) {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  return <><div className="page-heading"><div><p className="eyebrow">Seizoenoverzicht (6e klasse-15)</p><h1>Wedstrijden</h1></div></div><SectionHeading title="Programma"/><div className="fixture-grid">{matches.map((match) => <Fixture key={match.id} match={match} showMvp={false} onOpen={() => setSelectedMatch(match)}/>)}</div>{selectedMatch && <MatchDetailsDrawer match={selectedMatch} players={players} staff={staff} onClose={() => setSelectedMatch(null)}/>}</>;
}

function TrainingsView({ trainings, players }: { trainings: TeamData["trainings"]; players: Player[] }) {
  const shortName = (name: string) => dashboardPlayerName(name, players);
  return <><div className="page-heading"><div><p className="eyebrow">Aanwezigheid</p><h1>Trainingen</h1></div></div>{trainings.length ? <div className="training-grid">{trainings.map((training) => <article className="training-card" key={training.date}><div className="training-date">{formatTrainingDate(training.date)}</div><strong>{training.attendees.length} spelers aanwezig</strong><p>{training.attendees.length ? sortNames(training.attendees.map(shortName)).join(" · ") : "Geen aanwezigen geregistreerd"}</p></article>)}</div> : <div className="empty-state">Er zijn nog geen trainingen tot en met vandaag.</div>}</>;
}

function StatisticsView({ data }: { data: TeamData }) {
  const [rankingSort, setRankingSort] = useState("matches");
  const [rankingDirection, setRankingDirection] = useState<"desc" | "asc">("desc");
  const columns = [
    ["matches", "Wedstrijden", (p: Player) => p.totals.matches, (p: Player) => p.totals.matches], ["goals", "Goals", (p: Player) => p.totals.goals, (p: Player) => p.totals.goals], ["assists", "Assists", (p: Player) => p.totals.assists, (p: Player) => p.totals.assists],
    ["penaltiesScored", "Penalty +", (p: Player) => p.totals.penaltiesScored, (p: Player) => p.totals.penaltiesScored], ["penaltiesMissed", "Penalty −", (p: Player) => p.totals.penaltiesMissed, (p: Player) => p.totals.penaltiesMissed], ["training", "Training", (p: Player) => `${p.training.percentage}%`, (p: Player) => p.training.percentage],
    ["matchAttendance", "Wedstrijd", (p: Player) => p.matchAttendance.total ? `${p.matchAttendance.percentage}%` : "Nog geen invoer", (p: Player) => p.matchAttendance.percentage], ["polo", "Polo", (p: Player) => p.totals.polo, (p: Player) => p.totals.polo],
    ["flagged", "Gevlagd", (p: Player) => p.totals.flagged, (p: Player) => p.totals.flagged], ["kept", "Gekeept", (p: Player) => p.totals.kept, (p: Player) => p.totals.kept], ["captain", "Aanvoerder", (p: Player) => p.totals.captain, (p: Player) => p.totals.captain],
    ["yellow", "Geel", (p: Player) => p.totals.yellow, (p: Player) => p.totals.yellow], ["red", "Rood", (p: Player) => p.totals.red, (p: Player) => p.totals.red], ["absent", "Afwezig", (p: Player) => p.totals.absent, (p: Player) => p.totals.absent],
    ["notPlayed", "Niet gespeeld", (p: Player) => p.totals.notPlayed, (p: Player) => p.totals.notPlayed], ["partial", "Deels gespeeld", (p: Player) => p.totals.partial, (p: Player) => p.totals.partial], ["full", "Volgespeeld", (p: Player) => p.totals.full, (p: Player) => p.totals.full],
  ] as const;
  const activeColumn = columns.find(([key]) => key === rankingSort) ?? columns[0];
  const ranking = [...data.players].sort((a, b) => {
    const difference = activeColumn[3](b) - activeColumn[3](a);
    return (rankingDirection === "desc" ? difference : -difference) || a.name.localeCompare(b.name, "nl");
  });
  const changeSort = (key: string) => { if (key === rankingSort) setRankingDirection((direction) => direction === "desc" ? "asc" : "desc"); else { setRankingSort(key); setRankingDirection("desc"); } };
  return <>
    <div className="page-heading"><div><p className="eyebrow">Prestaties</p><h1>Statistieken</h1></div></div>
    <div className="ranking-title"><SectionHeading title="Spelersranglijst"/><div className="ranking-controls"><label><span>Sorteer op</span><select value={rankingSort} onChange={(event) => { setRankingSort(event.target.value); setRankingDirection("desc"); }}>{columns.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button onClick={() => setRankingDirection((direction) => direction === "desc" ? "asc" : "desc")} aria-label="Draai sorteervolgorde om">{rankingDirection === "desc" ? "Hoog → laag" : "Laag → hoog"}</button></div></div>
    <div className="ranking-card"><div className="ranking-head"><span>Speler</span>{columns.map(([key, label]) => <span key={key}><button className={rankingSort === key ? "ranking-sort active" : "ranking-sort"} onClick={() => changeSort(key)}>{label}{rankingSort === key && <b aria-hidden="true">{rankingDirection === "desc" ? "↓" : "↑"}</b>}</button></span>)}</div>{ranking.map((player, index) => <div className="ranking-row" key={player.id}><span className="ranking-player"><b>{index + 1}</b><span className="avatar small">{initials(player.name)}</span><span className="ranking-name"><strong>{player.name}</strong>{player.captain && <em>Aanvoerder</em>}{player.guest && <em>Gastspeler</em>}</span></span>{columns.map(([key, label, value]) => <span key={key} data-label={label}>{value(player)}</span>)}</div>)}</div>
  </>;
}

function TeamHistoryView() {
  const [storyReady, setStoryReady] = useState(false);
  const [storyPlaying, setStoryPlaying] = useState(false);
  const [storyLoadError, setStoryLoadError] = useState(false);
  const [storyFrame, setStoryFrame] = useState(0);
  useEffect(() => {
    let active = true;
    let loaded = 0;
    const images = panenkaFrames.map((source) => {
      const image = new Image();
      image.onload = () => {
        loaded += 1;
        if (active && loaded === panenkaFrames.length) setStoryReady(true);
      };
      image.onerror = () => { if (active) setStoryLoadError(true); };
      image.src = source;
      return image;
    });
    return () => {
      active = false;
      images.forEach((image) => { image.onload = null; image.onerror = null; });
    };
  }, []);
  useEffect(() => {
    if (!storyPlaying) return;
    const timer = window.setInterval(() => setStoryFrame((frame) => (frame + 1) % panenkaFrames.length), 1000 / 6);
    return () => window.clearInterval(timer);
  }, [storyPlaying]);
  return <>
    <div className="page-heading"><div><p className="eyebrow">De eindstanden door de jaren heen</p><h1>Teamhistorie</h1></div></div>
    <section className="team-history">
      <div className="team-history-table" role="table" aria-label="Teamhistorie">
        <div className="team-history-head" role="row"><span>Seizoen</span><span>Team</span><span>Klasse</span><span>Eindpositie</span></div>
        {teamHistory.map((entry) => <div className="team-history-row" role="row" key={entry.season}>
          <strong data-label="Seizoen">{entry.season}</strong>
          <span data-label="Team" className={entry.formerTeam ? "former-team" : ""}>{entry.team}{entry.formerTeam && <small>({entry.formerTeam})</small>}</span>
          <span data-label="Klasse">{entry.division}</span>
          <strong data-label="Eindpositie" className={entry.result ? `history-result ${entry.result}` : ""}>{entry.result === "champion" && <span aria-label="Kampioen" title="Kampioen">🏆</span>}{entry.result === "last" && <span aria-label="Laatste plaats" title="Laatste plaats">🏮</span>}{entry.position}</strong>
        </div>)}
      </div>
    </section>
    <section className="team-story" aria-labelledby="panenka-title">
      <div className="team-story-copy">
        <p className="eyebrow">Team story</p>
        <h2 id="panenka-title"><span>Jan’s Legendarische Panenka</span><small>| Afscheidswedstrijd 12 juni 2022</small></h2>
      </div>
      <div className="team-story-video">
        {!storyPlaying && <button className="team-story-play" type="button" onClick={() => { setStoryFrame(0); setStoryPlaying(true); }} disabled={!storyReady} aria-label="Speel Jan’s Legendarische Panenka af"><span aria-hidden="true">▶</span><strong>{storyLoadError ? "Beelden konden niet laden" : storyReady ? "Bekijk de Panenka" : "Beelden laden…"}</strong></button>}
        <img className="team-story-frame" src={panenkaFrames[storyFrame]} alt="Jan’s Legendarische Panenka tijdens de afscheidswedstrijd van 12 juni 2022" />
      </div>
    </section>
  </>;
}

function HistoryView({ entries }: { entries: TeamData["playerOfYear"] }) {
  const [selectedYear, setSelectedYear] = useState(entries[0]?.year ?? 0);
  useEffect(() => {
    if (entries.length && !entries.some((entry) => entry.year === selectedYear)) setSelectedYear(entries[0].year);
  }, [entries, selectedYear]);
  const selectedEntry = entries.find((entry) => entry.year === selectedYear) ?? entries[0];

  return <>
    <div className="page-heading award-heading"><div><p className="eyebrow">Erelijst</p><h1>Speler van het jaar</h1></div></div>
    {selectedEntry ? <section className="award-shell">
      <div className="award-year-selector" role="tablist" aria-label="Kies een seizoen">
        {entries.map((entry) => <button key={`${entry.year}-${entry.playerId}`} type="button" role="tab" aria-selected={entry.year === selectedEntry.year} className={entry.year === selectedEntry.year ? "active" : ""} onClick={() => setSelectedYear(entry.year)}>{entry.year}</button>)}
      </div>
      <div className="award-stage" aria-live="polite">
        <img className="award-trophy" src="./speler-van-het-jaar-beker.jpg" alt={`Beker Speler van het jaar voor ${selectedEntry.name}`} decoding="async" />
      </div>
      <article className="award-motivation">
        <span>Winnaar {selectedEntry.year - 1}/{selectedEntry.year}</span>
        <h2>{selectedEntry.name}</h2>
        <p>{selectedEntry.motivation || "De motivatie voor deze winnaar is nog niet ingevuld in Excel."}</p>
      </article>
    </section> : <div className="empty-state">Nog geen winnaar vastgelegd.</div>}
  </>;
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) { return <div className="section-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>; }
function Kpi({ label, value, linkLabel, onOpen }: { label: string; value: number | string; linkLabel?: string; onOpen?: () => void }) { const content = <><span className="kpi-label">{label}</span><span className="kpi-value">{value}</span>{linkLabel && <span className="kpi-link">{linkLabel} <b aria-hidden="true">›</b></span>}</>; return onOpen ? <button type="button" className="kpi-card interactive" onClick={onOpen} aria-label={`${label}: ${value}. ${linkLabel}`}>{content}</button> : <article className="kpi-card">{content}</article>; }
function Leader({ title, awardTitle, players, score, displayName = (player) => player.name }: { title: string; awardTitle?: string; players: Player[]; score: number; displayName?: (player: Player) => string }) { return <article className="leader-card"><span className="leader-kind">Meeste {title.toLowerCase()}</span>{awardTitle && <strong className="leader-award">{awardTitle}</strong>}<span className="leader-score">{score}</span><div className="leader-name">{players.length ? players.map(displayName).join(" · ") : "Nog geen invoer"}</div></article>; }
function Loser({ label, awardTitle, players, score, displayName = (player) => player.name, maxNames = 3, showScore = true }: { label: string; awardTitle: string; players: Player[]; score: (player: Player) => number; displayName?: (player: Player) => string; maxNames?: number; showScore?: boolean }) { return <article className="loser-card"><span className="loser-title">{label}</span><strong className="loser-award">{awardTitle}</strong>{players.length > maxNames ? <p>Meerdere spelers delen deze positie.</p> : players.length ? <ol>{players.map((player) => <li key={player.id}><strong>{displayName(player)}</strong>{showScore && <b>{score(player)}</b>}</li>)}</ol> : <p>Nog geen invoer</p>}</article>; }
function MatchGroup({ label, empty, children }: { label?: string; empty: string; children?: ReactNode }) { return <section className="match-group">{label && <h3>{label}</h3>}<div className="fixture-stack">{Children.count(children) ? children : <div className="match-empty">{empty}</div>}</div></section>; }
function Fixture({ match, showResult = true, emphasis = false, contributors, manOfTheMatchLabel, showMvp = true, onOpen }: { match: Match; showResult?: boolean; emphasis?: boolean; contributors?: MatchContributors; manOfTheMatchLabel?: string; showMvp?: boolean; onOpen?: () => void }) { const finalResult = showResult && hasFinalResult(match.result); const contributorLabel = (entries: MatchContributors["goals"]) => entries.map((entry) => `${entry.name}${entry.count > 1 ? ` ×${entry.count}` : ""}`).join(" · "); const content = <><div className="fixture-meta"><span>{match.competition || "Wedstrijd"}</span><span>{formatDate(match.date)} {match.time && `· ${match.time}`}</span></div><div className={finalResult ? "fixture-teams" : "fixture-teams upcoming"}><strong>{match.home || "Thuisteam onbekend"}</strong>{finalResult ? <span>{match.result.trim()}</span> : <span className="fixture-separator" aria-label="Nog niet gespeeld">vs</span>}<strong>{match.away || "Uitteam onbekend"}</strong></div>{finalResult && contributors && (contributors.goals.length > 0 || contributors.assists.length > 0) && <div className="match-contributors">{contributors.goals.length > 0 && <div><span aria-hidden="true">⚽</span><span>{contributorLabel(contributors.goals)}</span></div>}{contributors.assists.length > 0 && <div><span aria-hidden="true">🎯</span><span>{contributorLabel(contributors.assists)}</span></div>}</div>}{showMvp && finalResult && match.manOfTheMatch?.trim() && <div className="match-mvp"><span aria-hidden="true">⭐</span> {(manOfTheMatchLabel || match.manOfTheMatch).trim()}</div>}</>; const className = `fixture-card${emphasis ? " latest-result" : ""}${onOpen ? " interactive" : ""}`; return onOpen ? <button type="button" className={className} onClick={onOpen} aria-label={`Bekijk wedstrijdstatistieken van ${match.home} tegen ${match.away}`}>{content}<span className="fixture-open">Bekijk wedstrijdstatistieken <b aria-hidden="true">›</b></span></button> : <article className={className}>{content}</article>; }
function GoalTimeline({ match }: { match: Match }) { if (!match.goalEvents?.length) return null; const teamClass = (team: string) => team.localeCompare("SV Twello 2", "nl", { sensitivity: "base" }) === 0 ? "twello" : "opponent"; return <section className="goal-flow" aria-label={`Wedstrijdverloop van ${match.home} tegen ${match.away}`}><div className="goal-flow-heading"><h3>Wedstrijdverloop</h3><div className="goal-flow-matchup"><span><i className={`goal-flow-team-dot ${teamClass(match.home)}`} aria-hidden="true"/>{match.home}</span><b aria-hidden="true">–</b><span><i className={`goal-flow-team-dot ${teamClass(match.away)}`} aria-hidden="true"/>{match.away}</span></div></div><div className="goal-flow-halves" aria-hidden="true"><span>Eerste helft</span><span>Tweede helft</span></div><div className="goal-flow-timeline" role="img" aria-label={match.goalEvents.map((event) => `Na ${event.minute} minuten ${event.score}`).join(", ")}><div className="goal-flow-track"/><div className="goal-flow-half-divider"/>{match.goalEvents.map((event, index) => <div className={`goal-flow-event ${teamClass(event.team)} ${index === 0 || index % 2 === 1 ? "above" : "below"}`} style={{ left: `${Math.max(0, Math.min(100, event.minute / 90 * 100))}%` }} key={`${event.minute}-${event.score}`}><span aria-hidden="true">⚽</span><strong>{event.score}</strong></div>)}</div></section>; }
function MatchDetailsDrawer({ match, players, staff, onClose }: { match: Match; players: Player[]; staff: Staff[]; onClose: () => void }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  const entries = players.flatMap((player) => {
    const stats = player.matches.find((playerMatch) => playerMatch.id === match.id);
    return stats ? [{ player, stats }] : [];
  }).sort((a, b) => a.player.name.localeCompare(b.player.name, "nl", { sensitivity: "base" }));
  const staffEntries = staff.flatMap((member) => {
    const stats = member.matches.find((staffMatch) => staffMatch.id === match.id);
    return stats ? [{ member, stats }] : [];
  }).sort((a, b) => a.member.name.localeCompare(b.member.name, "nl", { sensitivity: "base" }));
  return <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Wedstrijdstatistieken van ${match.home} tegen ${match.away}`}>
      <div className="drawer-hero match-detail-hero">
        <div className="drawer-top"><span className="eyebrow">Wedstrijdstatistieken</span><button className="close-button" onClick={onClose} aria-label="Sluiten">×</button></div>
        <div className="match-detail-heading"><h2>{match.home || "Thuisteam onbekend"} <span>{hasFinalResult(match.result) ? match.result.trim() : "–"}</span> {match.away || "Uitteam onbekend"}</h2><p>{formatDate(match.date)} {match.time && `· ${match.time}`} · {match.competition || "Wedstrijd"}</p></div>
      </div>
      <div className="drawer-content"><GoalTimeline match={match}/><section className="detail-section match-player-section"><h3>Statistieken per speler</h3>{entries.length ? <div className="match-player-list">{entries.map(({ player, stats }) => {
        const isManOfTheMatch = Boolean(match.manOfTheMatch?.trim()) && player.name.localeCompare(match.manOfTheMatch.trim(), "nl", { sensitivity: "base" }) === 0;
        const tags = [isManOfTheMatch && "⭐ Man van de wedstrijd", stats.penaltiesScored > 0 && `Penalty gescoord: ${stats.penaltiesScored}`, stats.penaltiesMissed > 0 && `Penalty gemist: ${stats.penaltiesMissed}`, stats.captain && "Aanvoerder", stats.kept && "Gekeept", stats.flagged && "Gevlagd", stats.polo && "Polo vergeten", stats.late && "Te laat"].filter(Boolean);
        return <article className={`match-player-row${isManOfTheMatch ? " man-of-the-match" : ""}`} key={player.id}><div className="match-player-name"><strong>{player.name}</strong><span>{stats.status || "Geen status ingevuld"}</span></div><MatchCell value={stats.goals} label="Goals"/><MatchCell value={stats.assists} label="Assists"/><MatchCell value={stats.yellow} label="Geel"/><MatchCell value={stats.red} label="Rood"/>{tags.length > 0 && <div className="match-tags">{tags.map((tag) => <span key={String(tag)}>{tag}</span>)}</div>}</article>;
      })}</div> : <div className="no-matches">Voor deze wedstrijd zijn nog geen spelerstatistieken ingevuld.</div>}</section><section className="detail-section match-staff-section"><h3>Statistieken per staf</h3>{staffEntries.length ? <div className="staff-match-list">{staffEntries.map(({ member, stats }) => <article className="staff-match-row" key={member.id}><div><strong>{member.name}</strong></div><span className={`staff-status ${stats.status.toLowerCase().replaceAll(" ", "-")}`}>{stats.status || "Geen status ingevuld"}</span></article>)}</div> : <div className="no-matches">Voor deze wedstrijd zijn nog geen stafstatistieken ingevuld.</div>}</section></div>
    </aside>
  </div>;
}
function ClubBadge() { return <span className="club-badge" aria-label="SV Twello"><span className="club-badge-mark"><img src="./sv-twello-mark-transparent.png" alt="" aria-hidden="true"/><span className="club-badge-name"><b>SV</b><span>TWELLO</span></span></span></span>; }
function StaffCard({ member, onOpen }: { member: Staff; onOpen: () => void }) {
  const total = member.totals.present + member.totals.partial + member.totals.absent;
  return <button className="player-card staff-ea-card" onClick={onOpen} aria-label={`Bekijk wedstrijdhistorie van ${member.name}`}><span className="player-pitch" aria-hidden="true"/><span className="player-topline"><span>SVT · 2026/27</span><span>{staffCode(member.role)}</span></span><span className="player-identity"><span className="player-rating"><strong>{total}</strong><small>WD</small></span><span className="player-portrait" aria-hidden="true"><strong>{initials(member.name)}</strong><i/></span><ClubBadge/></span><span className="player-card-name"><strong>{member.name}</strong><small>{member.role}</small></span><span className="player-key-stats staff-key-stats"><span><strong>{total}</strong><small>Wedstr.</small></span><span><strong>{member.totals.present}</strong><small>Aanwezig</small></span><span><strong>{member.totals.partial}</strong><small>Deels</small></span><span><strong>{member.totals.absent}</strong><small>Afwezig</small></span></span><span className="player-open">Bekijk wedstrijdhistorie <b aria-hidden="true">›</b></span></button>;
}
function StaffDrawer({ member, onClose }: { member: Staff; onClose: () => void }) { return <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="drawer" role="dialog" aria-modal="true" aria-label={`Wedstrijdhistorie van ${member.name}`}><div className="drawer-hero"><div className="drawer-top"><span className="eyebrow">Stafkaart</span><button className="close-button" onClick={onClose} aria-label="Sluiten">×</button></div><div className="drawer-person"><span className="avatar">{initials(member.name)}</span><div><h2>{member.name}</h2><p>{member.role}</p></div></div></div><div className="drawer-content"><div className="detail-kpis staff-detail-kpis"><Detail label="Aanwezig" value={member.totals.present}/><Detail label="Deels aanwezig" value={member.totals.partial}/><Detail label="Afwezig" value={member.totals.absent}/></div><section className="detail-section"><h3>Wedstrijdhistorie</h3>{member.matches.length ? <div className="staff-match-list">{member.matches.map((match) => <article className="staff-match-row" key={match.id}><div><strong>{opponent(match) || "Tegenstander onbekend"}</strong><span>{formatDate(match.date)} · {venue(match)} · {match.competition || "Wedstrijd"}</span></div><span className={`staff-status ${match.status.toLowerCase().replaceAll(" ", "-")}`}>{match.status}</span></article>)}</div> : <div className="no-matches">Nog geen wedstrijdgegevens voor dit staflid.</div>}</section></div></aside></div>; }
function PlayerCard({ player, onOpen }: { player: Player; onOpen: () => void }) { return <button className="player-card" onClick={onOpen} aria-label={`Bekijk alle statistieken van ${player.name}`}><span className="player-pitch" aria-hidden="true"/><span className="player-topline"><span>SVT · 2026/27</span><span>{player.guest ? "Gast" : positionCode(player.position)}</span></span><span className="player-identity"><span className="player-rating"><strong>{player.number || "–"}</strong><small>{positionCode(player.position)}</small></span><span className="player-portrait" aria-hidden="true"><strong>{initials(player.name)}</strong><i/></span><ClubBadge/></span><span className="player-card-name"><strong>{player.name}</strong><small>{player.position}{player.foot ? ` · ${player.foot}benig` : ""}</small></span>{(player.captain || player.guest) && <span className="role-tags">{player.captain && <span className="role-tag captain">C · Aanvoerder</span>}{player.guest && <span className="role-tag guest">Gastspeler</span>}</span>}<span className="player-key-stats"><span><strong>{player.totals.matches}</strong><small>Wedstr.</small></span><span><strong>{player.totals.goals}</strong><small>Goals</small></span><span><strong>{player.totals.assists}</strong><small>Assists</small></span><span><strong>{player.training.percentage}%</strong><small>Training</small></span></span><span className="player-open">Bekijk alle statistieken <b aria-hidden="true">›</b></span></button>; }
function PlayerDrawer({ player, onClose }: { player: Player; onClose: () => void }) { return <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="drawer" role="dialog" aria-modal="true" aria-label={`Statistieken van ${player.name}`}><div className="drawer-hero"><div className="drawer-top"><span className="eyebrow">Spelerskaart</span><button className="close-button" onClick={onClose} aria-label="Sluiten">×</button></div><div className="drawer-person"><span className="avatar">{player.number || initials(player.name)}</span><div><h2>{player.name}</h2><p>{player.position} · {player.foot ? `${player.foot}benig` : "voorkeursvoet onbekend"}{player.captain ? " · aanvoerder" : ""}{player.guest ? " · gastspeler" : ""}</p></div></div></div><div className="drawer-content"><div className="detail-kpis"><Detail label="Trainingspercentage" value={`${player.training.percentage}%`}/><Detail label="Wedstrijden" value={player.totals.matches}/><Detail label="Wedstrijd opkomst" value={player.matchAttendance.total ? `${player.matchAttendance.percentage}%` : "Nog geen invoer"}/><Detail label="Afwezig" value={player.totals.absent}/><Detail label="Volgespeeld" value={player.totals.full}/><Detail label="Deels gespeeld" value={player.totals.partial}/><Detail label="Niet gespeeld" value={player.totals.notPlayed}/><Detail label="Doelpunten" value={player.totals.goals}/><Detail label="Assists" value={player.totals.assists}/><Detail label="Penalty gescoord" value={player.totals.penaltiesScored}/><Detail label="Penalty gemist" value={player.totals.penaltiesMissed}/><Detail label="Geel" value={player.totals.yellow}/><Detail label="Rood" value={player.totals.red}/><Detail label="Aanvoerder" value={player.totals.captain}/><Detail label="Gekeept" value={player.totals.kept}/><Detail label="Gevlagd" value={player.totals.flagged}/><Detail label="Polo vergeten" value={player.totals.polo}/><Detail label="Te laat" value={player.totals.late}/></div><section className="detail-section"><h3>Trainingen</h3>{player.training.sessions.length ? <div className="session-list">{player.training.sessions.map((date) => <span key={date}>{formatDate(date)}</span>)}</div> : <div className="no-matches">Nog geen aanwezigheid geregistreerd.</div>}</section><section className="detail-section"><h3>Wedstrijdhistorie</h3>{player.matches.length ? <div className="match-list">{player.matches.map((match) => <MatchRow key={match.id} match={match}/>)}</div> : <div className="no-matches">Nog geen wedstrijdgegevens voor deze speler.</div>}</section></div></aside></div>; }
function Detail({ label, value }: { label: string; value: string | number }) { return <div className="detail-kpi"><span>{label}</span><strong>{value}</strong></div>; }
function MatchRow({ match }: { match: PlayerMatch }) { const tags = [`Penalty ${match.penaltiesScored}/${match.penaltiesMissed}`, match.late && "Te laat", match.flagged && "Gevlagd", match.polo && "Polo vergeten", match.kept && "Gekeept", match.captain && "Aanvoerder"].filter(Boolean); return <article className="match-row"><div className="match-main"><strong>{opponent(match) || "Tegenstander onbekend"}</strong><span>{formatDate(match.date)} · {venue(match)} · {match.status || "Status onbekend"}</span></div><MatchCell value={match.goals} label="Goals"/><MatchCell value={match.assists} label="Assists"/><MatchCell value={match.yellow} label="Geel"/><MatchCell value={match.red} label="Rood"/><div className="match-tags">{tags.map((tag) => <span key={String(tag)}>{tag}</span>)}</div></article>; }
function MatchCell({ value, label }: { value: number; label: string }) { return <div className="match-cell"><strong>{value}</strong><span>{label}</span></div>; }
