"use client";

import { useEffect, useMemo, useState } from "react";

type Match = { id: string; date: string; time: string; home: string; away: string; result: string; competition: string };
type PlayerMatch = Match & { status: string; goals: number; assists: number; yellow: number; red: number; penaltiesScored: number; penaltiesMissed: number; late: boolean; flagged: boolean; polo: boolean; kept: boolean; captain: boolean };
type Player = {
  id: string; number: string; name: string; position: string; foot: string; guest: boolean; captain: boolean;
  training: { attended: number; total: number; percentage: number; sessions: string[] };
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
type View = "dashboard" | "team" | "wedstrijden" | "trainingen" | "statistieken" | "historie";

const views: { id: View; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "team", label: "Team" },
  { id: "wedstrijden", label: "Wedstrijden" },
  { id: "trainingen", label: "Trainingen" },
  { id: "statistieken", label: "Statistieken" },
  { id: "historie", label: "Speler van het jaar" },
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
function opponent(match: Match) { return match.home === "SV Twello 2" ? match.away : match.home; }
function venue(match: Match) { return match.home === "SV Twello 2" ? "Thuis" : "Uit"; }
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
    fetch("./data/team.json", { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error("Dashboardgegevens konden niet worden geladen."); return response.json(); })
      .then((json: TeamData) => setData(json))
      .catch((err: Error) => setError(err.message));
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
  const program = data.matches.filter((match) => match.date).slice(0, 6);
  const ranking = [...data.players].sort((a, b) => b.totals.goals - a.totals.goals || b.totals.assists - a.totals.assists || b.training.percentage - a.training.percentage || a.name.localeCompare(b.name, "nl"));

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
      {activeView === "dashboard" && <DashboardView data={data} program={program}/>}
      {activeView === "team" && <TeamView data={data} players={visiblePlayers} query={query} setQuery={setQuery} sort={sort} setSort={setSort} setSelected={setSelected} setSelectedStaff={setSelectedStaff}/>}
      {activeView === "wedstrijden" && <MatchesView matches={data.matches}/>}
      {activeView === "trainingen" && <TrainingsView trainings={data.trainings}/>}
      {activeView === "statistieken" && <StatisticsView data={data}/>}
      {activeView === "historie" && <HistoryView entries={data.playerOfYear}/>}
      <footer className="footer">One Town, One Team, One Twello</footer>
    </div>
    {selected && <PlayerDrawer player={selected} onClose={() => setSelected(null)}/>} 
    {selectedStaff && <StaffDrawer member={selectedStaff} onClose={() => setSelectedStaff(null)}/>}
  </main>;
}

function DashboardView({ data, program }: { data: TeamData; program: Match[] }) {
  const selection = data.players.filter((player) => !player.guest);
  const hasPlayedMatches = data.totals.matchesPlayed > 0;
  const mostLate = hasPlayedMatches ? rankedPlayers(selection, (player) => player.totals.late, "max", true) : [];
  const leastTraining = hasPlayedMatches && data.totals.trainings ? rankedPlayers(selection, (player) => player.training.attended, "min") : [];
  const mostAbsent = hasPlayedMatches ? rankedPlayers(selection, (player) => player.totals.absent, "max", true) : [];
  const goalLeaders = leaders(selection, "goals");
  const assistLeaders = leaders(selection, "assists");
  const trainingLeaders = leaders(selection, "training");
  return <>
    <section className="kpi-grid" aria-label="Teamtotalen">
      <Kpi label="Aantal selectiespelers" value={data.totals.players} />
      <Kpi label="Aantal keer getraind" value={data.totals.trainings} />
      <Kpi label="Wedstrijden / gespeeld" value={`${data.totals.matchesScheduled} / ${data.totals.matchesPlayed}`} />
    </section>
    <SectionHeading title="Programma & uitslagen"/>
    <div className="fixture-grid">{program.map((match) => <Fixture key={match.id} match={match}/>)}</div>
    <SectionHeading title="Toppers"/>
    <div className="leader-grid">
      <Leader title="Trainingen" players={trainingLeaders.players} score={trainingLeaders.score}/>
      <Leader title="Doelpunten" players={goalLeaders.players} score={goalLeaders.score}/>
      <Leader title="Assists" players={assistLeaders.players} score={assistLeaders.score}/>
    </div>
    <SectionHeading title="Losers"/>
    <div className="loser-grid">
      <Loser label="Minste trainingen" players={leastTraining} score={(player) => player.training.attended}/>
      <Loser label="Meest afwezig op wedstrijddag" players={mostAbsent} score={(player) => player.totals.absent}/>
      <Loser label="Meest te laat op wedstrijddag" players={mostLate} score={(player) => player.totals.late}/>
    </div>
  </>;
}

function TeamView({ data, players, query, setQuery, sort, setSort, setSelected, setSelectedStaff }: { data: TeamData; players: Player[]; query: string; setQuery: (value: string) => void; sort: string; setSort: (value: string) => void; setSelected: (player: Player) => void; setSelectedStaff: (member: Staff) => void }) {
  return <>
    <div className="page-heading"><div><h1>Team</h1></div><div className="controls"><label className="search-wrap"><span className="search-icon" aria-hidden="true">⌕</span><span className="sr-only">Zoek speler</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek op naam…" /></label><label><span className="sr-only">Sorteer spelers</span><select className="sort-select" value={sort} onChange={(event) => setSort(event.target.value)}><option value="nummer">Sorteer: rugnummer</option><option value="naam">Naam</option><option value="training">Trainingspercentage</option><option value="goals">Doelpunten</option><option value="assists">Assists</option></select></label></div></div>
    {players.length ? <div className="player-grid">{players.map((player) => <PlayerCard key={player.id} player={player} onOpen={() => setSelected(player)}/>)}</div> : <div className="empty-state">Geen speler gevonden voor “{query}”.</div>}
    <SectionHeading title="Staf"/>
    <div className="staff-grid">{data.staff.map((member) => <StaffCard key={member.id} member={member} onOpen={() => setSelectedStaff(member)}/>)}</div>
  </>;
}

function MatchesView({ matches }: { matches: Match[] }) {
  return <><div className="page-heading"><div><p className="eyebrow">Seizoenoverzicht (6e klasse-15)</p><h1>Wedstrijden</h1></div></div><div className="fixture-grid">{matches.map((match) => <Fixture key={match.id} match={match}/>)}</div></>;
}

function TrainingsView({ trainings }: { trainings: TeamData["trainings"] }) {
  return <><div className="page-heading"><div><p className="eyebrow">Aanwezigheid</p><h1>Trainingen</h1></div></div>{trainings.length ? <div className="training-grid">{trainings.map((training) => <article className="training-card" key={training.date}><div className="training-date">{formatDate(training.date)}</div><strong>{training.attendees.length} spelers aanwezig</strong><p>{training.attendees.length ? training.attendees.join(" · ") : "Geen aanwezigen geregistreerd"}</p></article>)}</div> : <div className="empty-state">Er zijn nog geen trainingen tot en met vandaag.</div>}</>;
}

function StatisticsView({ data }: { data: TeamData }) {
  const [rankingSort, setRankingSort] = useState("matches");
  const [rankingDirection, setRankingDirection] = useState<"desc" | "asc">("desc");
  const goalLeaders = leaders(data.players, "goals");
  const assistLeaders = leaders(data.players, "assists");
  const trainingLeaders = leaders(data.players, "training");
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
  return <><div className="page-heading"><div><p className="eyebrow">Prestaties</p><h1>Statistieken</h1></div></div><div className="leader-grid stats-leaders"><Leader title="Doelpunten" players={goalLeaders.players} score={goalLeaders.score}/><Leader title="Assists" players={assistLeaders.players} score={assistLeaders.score}/><Leader title="Trainingen" players={trainingLeaders.players} score={trainingLeaders.score}/></div><div className="ranking-title"><SectionHeading title="Spelersranglijst"/><div className="ranking-controls"><label><span>Sorteer op</span><select value={rankingSort} onChange={(event) => { setRankingSort(event.target.value); setRankingDirection("desc"); }}>{columns.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button onClick={() => setRankingDirection((direction) => direction === "desc" ? "asc" : "desc")} aria-label="Draai sorteervolgorde om">{rankingDirection === "desc" ? "Hoog → laag" : "Laag → hoog"}</button></div></div><div className="ranking-card"><div className="ranking-head"><span>Speler</span>{columns.map(([key, label]) => <span key={key}><button className={rankingSort === key ? "ranking-sort active" : "ranking-sort"} onClick={() => changeSort(key)}>{label}{rankingSort === key && <b aria-hidden="true">{rankingDirection === "desc" ? "↓" : "↑"}</b>}</button></span>)}</div>{ranking.map((player, index) => <div className="ranking-row" key={player.id}><span className="ranking-player"><b>{index + 1}</b><span className="avatar small">{initials(player.name)}</span><span className="ranking-name"><strong>{player.name}</strong>{player.captain && <em>Aanvoerder</em>}{player.guest && <em>Gastspeler</em>}</span></span>{columns.map(([key, label, value]) => <span key={key} data-label={label}>{value(player)}</span>)}</div>)}</div></>;
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
        <img className="award-trophy" src="./speler-van-het-jaar-beker.png" alt={`Beker Speler van het jaar voor ${selectedEntry.name}`} />
        <div className="award-plaque">
          <img src="./sv-twello-mark.png" alt="SV Twello" />
          <span aria-hidden="true" />
          <strong>{selectedEntry.name}</strong>
        </div>
      </div>
      <article className="award-motivation">
        <span>Motivatie · {selectedEntry.year}</span>
        <h2>{selectedEntry.name}</h2>
        <p>{selectedEntry.motivation || "De motivatie voor deze winnaar is nog niet ingevuld in Excel."}</p>
      </article>
    </section> : <div className="empty-state">Nog geen winnaar vastgelegd.</div>}
  </>;
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) { return <div className="section-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>; }
function Kpi({ label, value }: { label: string; value: number | string }) { return <article className="kpi-card"><div className="kpi-label">{label}</div><div className="kpi-value">{value}</div></article>; }
function Leader({ title, players, score }: { title: string; players: Player[]; score: number }) { return <article className="leader-card"><span className="leader-kind">Meeste {title.toLowerCase()}</span><span className="leader-score">{score}</span><div className="leader-name">{players.length ? players.map((player) => player.name).join(" · ") : "Nog geen invoer"}</div></article>; }
function Loser({ label, players, score }: { label: string; players: Player[]; score: (player: Player) => number }) { return <article className="loser-card"><span className="loser-title">{label}</span>{players.length ? <ol>{players.map((player) => <li key={player.id}><strong>{player.name}</strong><b>{score(player)}</b></li>)}</ol> : <p>Nog geen invoer</p>}</article>; }
function Fixture({ match }: { match: Match }) { return <article className="fixture-card"><div className="fixture-meta"><span>{match.competition || "Wedstrijd"}</span><span>{formatDate(match.date)} {match.time && `· ${match.time}`}</span></div><div className="fixture-teams"><strong>{match.home}</strong><span>{match.result || "–"}</span><strong>{match.away}</strong></div></article>; }
function StaffCard({ member, onOpen }: { member: Staff; onOpen: () => void }) { return <button className="staff-card" onClick={onOpen} aria-label={`Bekijk wedstrijdhistorie van ${member.name}`}><div className="staff-head"><span className="avatar">{initials(member.name)}</span><div><strong>{member.name}</strong><span>{member.role}</span></div><span className="staff-arrow" aria-hidden="true">›</span></div><div className="staff-statuses"><span><b>{member.totals.present}</b>Aanwezig</span><span><b>{member.totals.partial}</b>Deels aanwezig</span><span><b>{member.totals.absent}</b>Afwezig</span></div><p className="staff-open">Bekijk wedstrijdhistorie</p></button>; }
function StaffDrawer({ member, onClose }: { member: Staff; onClose: () => void }) { return <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="drawer" role="dialog" aria-modal="true" aria-label={`Wedstrijdhistorie van ${member.name}`}><div className="drawer-hero"><div className="drawer-top"><span className="eyebrow">Stafkaart</span><button className="close-button" onClick={onClose} aria-label="Sluiten">×</button></div><div className="drawer-person"><span className="avatar">{initials(member.name)}</span><div><h2>{member.name}</h2><p>{member.role}</p></div></div></div><div className="drawer-content"><div className="detail-kpis staff-detail-kpis"><Detail label="Aanwezig" value={member.totals.present}/><Detail label="Deels aanwezig" value={member.totals.partial}/><Detail label="Afwezig" value={member.totals.absent}/></div><section className="detail-section"><h3>Wedstrijdhistorie</h3>{member.matches.length ? <div className="staff-match-list">{member.matches.map((match) => <article className="staff-match-row" key={match.id}><div><strong>{opponent(match) || "Tegenstander onbekend"}</strong><span>{formatDate(match.date)} · {venue(match)} · {match.competition || "Wedstrijd"}</span></div><span className={`staff-status ${match.status.toLowerCase().replaceAll(" ", "-")}`}>{match.status}</span></article>)}</div> : <div className="no-matches">Nog geen wedstrijdgegevens voor dit staflid.</div>}</section></div></aside></div>; }
function PlayerCard({ player, onOpen }: { player: Player; onOpen: () => void }) { return <button className="player-card" onClick={onOpen} aria-label={`Bekijk statistieken van ${player.name}`}><div className="player-band"/><div className="player-body"><div className="player-head"><span className="avatar">{initials(player.name)}</span><span className="player-name"><strong>{player.name}</strong><span>{player.position}</span></span><span className="availability-badge" title="Rugnummer">{player.number || "–"}</span></div>{(player.captain || player.guest) && <div className="role-tags">{player.captain && <span className="role-tag captain">C · Aanvoerder</span>}{player.guest && <span className="role-tag guest">Gastspeler</span>}</div>}<div className="attendance-pair"><span><small>Training</small><strong>{player.training.percentage}%</strong></span><span><small>Wedstrijd</small><strong>{player.matchAttendance.total ? `${player.matchAttendance.percentage}%` : "–"}</strong></span></div><div className="mini-stats"><span className="mini-stat"><strong>{player.totals.matches}</strong><span>Gespeeld</span></span><span className="mini-stat"><strong>{player.totals.goals}</strong><span>Goals</span></span><span className="mini-stat"><strong>{player.totals.assists}</strong><span>Assists</span></span></div><div className="status-chips"><span>Afwezig {player.totals.absent}</span><span>Niet gespeeld {player.totals.notPlayed}</span><span>Deels gespeeld {player.totals.partial}</span><span>Volgespeeld {player.totals.full}</span></div></div></button>; }
function PlayerDrawer({ player, onClose }: { player: Player; onClose: () => void }) { return <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="drawer" role="dialog" aria-modal="true" aria-label={`Statistieken van ${player.name}`}><div className="drawer-hero"><div className="drawer-top"><span className="eyebrow">Spelerskaart</span><button className="close-button" onClick={onClose} aria-label="Sluiten">×</button></div><div className="drawer-person"><span className="avatar">{player.number || initials(player.name)}</span><div><h2>{player.name}</h2><p>{player.position} · {player.foot ? `${player.foot}benig` : "voorkeursvoet onbekend"}{player.captain ? " · aanvoerder" : ""}{player.guest ? " · gastspeler" : ""}</p></div></div></div><div className="drawer-content"><div className="detail-kpis"><Detail label="Wedstrijden" value={player.totals.matches}/><Detail label="Doelpunten" value={player.totals.goals}/><Detail label="Assists" value={player.totals.assists}/><Detail label="Training opkomst" value={`${player.training.percentage}%`}/><Detail label="Wedstrijd opkomst" value={player.matchAttendance.total ? `${player.matchAttendance.percentage}%` : "Nog geen invoer"}/><Detail label="Afwezig" value={player.totals.absent}/><Detail label="Niet gespeeld" value={player.totals.notPlayed}/><Detail label="Deels gespeeld" value={player.totals.partial}/><Detail label="Volgespeeld" value={player.totals.full}/><Detail label="Penalty gescoord" value={player.totals.penaltiesScored}/><Detail label="Penalty gemist" value={player.totals.penaltiesMissed}/><Detail label="Te laat" value={player.totals.late}/><Detail label="Gevlagd" value={player.totals.flagged}/><Detail label="Polo vergeten" value={player.totals.polo}/><Detail label="Gekeept" value={player.totals.kept}/><Detail label="Aanvoerder" value={player.totals.captain}/><Detail label="Geel" value={player.totals.yellow}/><Detail label="Rood" value={player.totals.red}/></div><section className="detail-section"><h3>Trainingen</h3>{player.training.sessions.length ? <div className="session-list">{player.training.sessions.map((date) => <span key={date}>{formatDate(date)}</span>)}</div> : <div className="no-matches">Nog geen aanwezigheid geregistreerd.</div>}</section><section className="detail-section"><h3>Wedstrijdhistorie</h3>{player.matches.length ? <div className="match-list">{player.matches.map((match) => <MatchRow key={match.id} match={match}/>)}</div> : <div className="no-matches">Nog geen wedstrijdgegevens voor deze speler.</div>}</section></div></aside></div>; }
function Detail({ label, value }: { label: string; value: string | number }) { return <div className="detail-kpi"><span>{label}</span><strong>{value}</strong></div>; }
function MatchRow({ match }: { match: PlayerMatch }) { const tags = [`Penalty ${match.penaltiesScored}/${match.penaltiesMissed}`, match.late && "Te laat", match.flagged && "Gevlagd", match.polo && "Polo vergeten", match.kept && "Gekeept", match.captain && "Aanvoerder"].filter(Boolean); return <article className="match-row"><div className="match-main"><strong>{opponent(match) || "Tegenstander onbekend"}</strong><span>{formatDate(match.date)} · {venue(match)} · {match.status || "Status onbekend"}</span></div><MatchCell value={match.goals} label="Goals"/><MatchCell value={match.assists} label="Assists"/><MatchCell value={match.yellow} label="Geel"/><MatchCell value={match.red} label="Rood"/><div className="match-tags">{tags.map((tag) => <span key={String(tag)}>{tag}</span>)}</div></article>; }
function MatchCell({ value, label }: { value: number; label: string }) { return <div className="match-cell"><strong>{value}</strong><span>{label}</span></div>; }
