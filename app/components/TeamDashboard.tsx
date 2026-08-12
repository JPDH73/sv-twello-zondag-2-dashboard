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
type StaffMatch = Match & { status: string; late: boolean };
type Staff = { id: string; name: string; role: string; totals: { full: number; partial: number; absent: number; late: number }; matches: StaffMatch[] };
type TeamData = {
  team: string; season: string; generatedAt: string; sourceFile: string;
  totals: { players: number; guests: number; staff: number; trainings: number; matchesScheduled: number; matchesPlayed: number; goals: number; assists: number };
  matches: Match[];
  trainings: { date: string; attendees: string[] }[];
  playerOfYear: { year: number; name: string; playerId: string }[];
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
  { id: "historie", label: "Spelers van het jaar" },
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
function rankedPlayers(players: Player[], score: (player: Player) => number, direction: "max" | "min" = "max", hideWhenZero = false) {
  const sorted = [...players].sort((a, b) => (direction === "max" ? score(b) - score(a) : score(a) - score(b)) || a.name.localeCompare(b.name, "nl"));
  if (!sorted.length || (hideWhenZero && score(sorted[0]) === 0)) return [];
  const cutoff = score(sorted[Math.min(2, sorted.length - 1)]);
  return sorted.filter((player) => direction === "max" ? score(player) >= cutoff : score(player) <= cutoff);
}
export function TeamDashboard() {
  const [data, setData] = useState<TeamData | null>(null);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("nummer");
  const [selected, setSelected] = useState<Player | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch("./data/team.json", { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error("Dashboardgegevens konden niet worden geladen."); return response.json(); })
      .then((json: TeamData) => setData(json))
      .catch((err: Error) => setError(err.message));
  }, []);
  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selected]);

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
        <div className="header-title"><strong>SV Twello Zondag 2</strong><span>Teamdashboard</span></div>
        <div className="header-actions"><span className="season-pill">Seizoen {data.season}</span><button className="menu-toggle" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen((open) => !open)}><span/><span/><span/><span className="sr-only">Menu</span></button></div>
      </div>
      <nav id="main-navigation" className={menuOpen ? "tabbar open" : "tabbar"} aria-label="Dashboardonderdelen">
        {views.map((view) => <button key={view.id} className={activeView === view.id ? "tab-button active" : "tab-button"} onClick={() => { setActiveView(view.id); setMenuOpen(false); }} aria-current={activeView === view.id ? "page" : undefined}>{view.label}</button>)}
      </nav>
    </header>

    <section className="hero" aria-label="SV Twello Zondag 2">
      <div className="hero-rays" aria-hidden="true"/>
      <div className="pitch-lines" aria-hidden="true"><span className="pitch-circle"/><span className="pitch-box"/><span className="pitch-half"/></div>
      <div className="hero-main">
        <div className="hero-logo-panel"><img src="./sv-twello-logo.png" alt="Logo SV Twello" /></div>
        <div className="hero-copy"><p><span className="blue-letter">Z</span><span className="blue-letter">o</span>ndag <span className="blue-letter">2</span></p><strong>One Town, One Team, One Twello</strong></div>
      </div>
      <div className="hero-status">
        <span className="updated"><span className="updated-dot"/>Bijgewerkt op {generated}</span>
      </div>
    </section>

    <div className="content">
      {activeView === "dashboard" && <DashboardView data={data} program={program}/>}
      {activeView === "team" && <TeamView data={data} players={visiblePlayers} query={query} setQuery={setQuery} sort={sort} setSort={setSort} setSelected={setSelected}/>}
      {activeView === "wedstrijden" && <MatchesView matches={data.matches}/>}
      {activeView === "trainingen" && <TrainingsView trainings={data.trainings}/>}
      {activeView === "statistieken" && <StatisticsView data={data} ranking={ranking}/>}
      {activeView === "historie" && <HistoryView entries={data.playerOfYear}/>}
      <footer className="footer">One Town, One Team, One Twello</footer>
    </div>
    {selected && <PlayerDrawer player={selected} onClose={() => setSelected(null)}/>} 
  </main>;
}

function DashboardView({ data, program }: { data: TeamData; program: Match[] }) {
  const selection = data.players.filter((player) => !player.guest);
  const mostLate = rankedPlayers(selection, (player) => player.totals.late, "max", true);
  const leastTraining = data.totals.trainings ? rankedPlayers(selection, (player) => player.training.attended, "min") : [];
  const mostAbsent = rankedPlayers(selection, (player) => player.totals.absent, "max", true);
  const goalLeaders = leaders(selection, "goals");
  const assistLeaders = leaders(selection, "assists");
  const trainingLeaders = leaders(selection, "training");
  return <>
    <section className="kpi-grid" aria-label="Teamtotalen">
      <Kpi label="Selectie" value={data.totals.players} />
      <Kpi label="Trainingen" value={data.totals.trainings} />
      <Kpi label="Wedstrijden" value={`${data.totals.matchesScheduled} / ${data.totals.matchesPlayed}`} />
    </section>
    <SectionHeading title="Programma & uitslagen"/>
    <div className="fixture-grid">{program.map((match) => <Fixture key={match.id} match={match}/>)}</div>
    <SectionHeading title="Toppers"/>
    <div className="leader-grid">
      <Leader title="Doelpunten" players={goalLeaders.players} score={goalLeaders.score}/>
      <Leader title="Assists" players={assistLeaders.players} score={assistLeaders.score}/>
      <Leader title="Trainingen" players={trainingLeaders.players} score={trainingLeaders.score}/>
    </div>
    <SectionHeading title="Losers"/>
    <div className="loser-grid">
      <Loser label="Meest te laat op wedstrijddag" players={mostLate} score={(player) => player.totals.late}/>
      <Loser label="Minste trainingen" players={leastTraining} score={(player) => player.training.attended}/>
      <Loser label="Meest afwezig op wedstrijddag" players={mostAbsent} score={(player) => player.totals.absent}/>
    </div>
  </>;
}

function TeamView({ data, players, query, setQuery, sort, setSort, setSelected }: { data: TeamData; players: Player[]; query: string; setQuery: (value: string) => void; sort: string; setSort: (value: string) => void; setSelected: (player: Player) => void }) {
  return <>
    <div className="page-heading"><div><h1>Team</h1></div><div className="controls"><label className="search-wrap"><span className="search-icon" aria-hidden="true">⌕</span><span className="sr-only">Zoek speler</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek op naam…" /></label><label><span className="sr-only">Sorteer spelers</span><select className="sort-select" value={sort} onChange={(event) => setSort(event.target.value)}><option value="nummer">Sorteer: rugnummer</option><option value="naam">Naam</option><option value="training">Trainingspercentage</option><option value="goals">Doelpunten</option><option value="assists">Assists</option></select></label></div></div>
    {players.length ? <div className="player-grid">{players.map((player) => <PlayerCard key={player.id} player={player} onOpen={() => setSelected(player)}/>)}</div> : <div className="empty-state">Geen speler gevonden voor “{query}”.</div>}
    <SectionHeading title="Staf"/>
    <div className="staff-grid">{data.staff.map((member) => <StaffCard key={member.id} member={member}/>)}</div>
  </>;
}

function MatchesView({ matches }: { matches: Match[] }) {
  return <><div className="page-heading"><div><p className="eyebrow">Seizoenoverzicht</p><h1>Wedstrijden</h1></div></div><div className="fixture-grid">{matches.map((match) => <Fixture key={match.id} match={match}/>)}</div></>;
}

function TrainingsView({ trainings }: { trainings: TeamData["trainings"] }) {
  return <><div className="page-heading"><div><p className="eyebrow">Aanwezigheid</p><h1>Trainingen</h1></div></div>{trainings.length ? <div className="training-grid">{trainings.map((training) => <article className="training-card" key={training.date}><div className="training-date">{formatDate(training.date)}</div><strong>{training.attendees.length} spelers aanwezig</strong><p>{training.attendees.length ? training.attendees.join(" · ") : "Geen aanwezigen geregistreerd"}</p></article>)}</div> : <div className="empty-state">Er zijn nog geen trainingen tot en met vandaag.</div>}</>;
}

function StatisticsView({ data, ranking }: { data: TeamData; ranking: Player[] }) {
  const goalLeaders = leaders(data.players, "goals");
  const assistLeaders = leaders(data.players, "assists");
  const trainingLeaders = leaders(data.players, "training");
  const columns = [
    ["Wedstrijden", (p: Player) => p.totals.matches], ["Goals", (p: Player) => p.totals.goals], ["Assists", (p: Player) => p.totals.assists],
    ["Penalty +", (p: Player) => p.totals.penaltiesScored], ["Penalty −", (p: Player) => p.totals.penaltiesMissed], ["Training", (p: Player) => `${p.training.percentage}%`],
    ["Wedstrijd", (p: Player) => p.matchAttendance.total ? `${p.matchAttendance.percentage}%` : "Nog geen invoer"], ["Polo", (p: Player) => p.totals.polo],
    ["Gevlagd", (p: Player) => p.totals.flagged], ["Gekeept", (p: Player) => p.totals.kept], ["Aanvoerder", (p: Player) => p.totals.captain],
    ["Geel", (p: Player) => p.totals.yellow], ["Rood", (p: Player) => p.totals.red], ["Afwezig", (p: Player) => p.totals.absent],
    ["Niet gespeeld", (p: Player) => p.totals.notPlayed], ["Deels", (p: Player) => p.totals.partial], ["Volledig", (p: Player) => p.totals.full],
  ] as const;
  return <><div className="page-heading"><div><p className="eyebrow">Prestaties</p><h1>Statistieken</h1></div></div><div className="leader-grid stats-leaders"><Leader title="Doelpunten" players={goalLeaders.players} score={goalLeaders.score}/><Leader title="Assists" players={assistLeaders.players} score={assistLeaders.score}/><Leader title="Trainingen" players={trainingLeaders.players} score={trainingLeaders.score}/></div><SectionHeading title="Spelersranglijst"/><div className="ranking-card"><div className="ranking-head"><span>Speler</span>{columns.map(([label]) => <span key={label}>{label}</span>)}</div>{ranking.map((player, index) => <div className="ranking-row" key={player.id}><span className="ranking-player"><b>{index + 1}</b><span className="avatar small">{initials(player.name)}</span><span className="ranking-name"><strong>{player.name}</strong>{player.captain && <em>Aanvoerder</em>}{player.guest && <em>Gastspeler</em>}</span></span>{columns.map(([label, value]) => <span key={label} data-label={label}>{value(player)}</span>)}</div>)}</div></>;
}

function HistoryView({ entries }: { entries: TeamData["playerOfYear"] }) {
  return <><div className="page-heading"><div><p className="eyebrow">Erelijst</p><h1>Spelers van het jaar</h1></div></div><div className="history-grid">{entries.length ? entries.map((entry) => <article className="history-card" key={`${entry.year}-${entry.playerId}`}><span>{entry.year}</span><strong>{entry.name}</strong></article>) : <div className="empty-state">Nog geen winnaar vastgelegd.</div>}</div></>;
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) { return <div className="section-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>; }
function Kpi({ label, value }: { label: string; value: number | string }) { return <article className="kpi-card"><div className="kpi-label">{label}</div><div className="kpi-value">{value}</div></article>; }
function Leader({ title, players, score }: { title: string; players: Player[]; score: number }) { return <article className="leader-card"><span className="leader-kind">Meeste {title.toLowerCase()}</span><span className="leader-score">{score}</span><div className="leader-name">{players.length ? players.map((player) => player.name).join(" · ") : "Nog geen invoer"}</div></article>; }
function Loser({ label, players, score }: { label: string; players: Player[]; score: (player: Player) => number }) { return <article className="loser-card"><span className="loser-title">{label}</span>{players.length ? <ol>{players.map((player) => <li key={player.id}><strong>{player.name}</strong><b>{score(player)}</b></li>)}</ol> : <p>Nog geen invoer</p>}</article>; }
function Fixture({ match }: { match: Match }) { return <article className="fixture-card"><div className="fixture-meta"><span>{match.competition || "Wedstrijd"}</span><span>{formatDate(match.date)} {match.time && `· ${match.time}`}</span></div><div className="fixture-teams"><strong>{match.home}</strong><span>{match.result || "–"}</span><strong>{match.away}</strong></div></article>; }
function StaffCard({ member }: { member: Staff }) { return <article className="staff-card"><div className="staff-head"><span className="avatar">{initials(member.name)}</span><div><strong>{member.name}</strong><span>{member.role}</span></div></div><div className="staff-statuses"><span><b>{member.totals.full}</b>Volledig</span><span><b>{member.totals.partial}</b>Deels</span><span><b>{member.totals.absent}</b>Afwezig</span><span><b>{member.totals.late}</b>Te laat</span></div>{member.matches.length ? <div className="staff-history">{member.matches.map((match) => <div key={match.id}><strong>{opponent(match) || "Tegenstander onbekend"}</strong><span>{formatDate(match.date)} · {match.status}{match.late ? " · te laat" : ""}</span></div>)}</div> : <p className="staff-empty">Nog geen wedstrijdinvoer</p>}</article>; }
function PlayerCard({ player, onOpen }: { player: Player; onOpen: () => void }) { return <button className="player-card" onClick={onOpen} aria-label={`Bekijk statistieken van ${player.name}`}><div className="player-band"/><div className="player-body"><div className="player-head"><span className="avatar">{initials(player.name)}</span><span className="player-name"><strong>{player.name}</strong><span>{player.position}</span></span><span className="availability-badge" title="Rugnummer">{player.number || "–"}</span></div>{(player.captain || player.guest) && <div className="role-tags">{player.captain && <span className="role-tag captain">C · Aanvoerder</span>}{player.guest && <span className="role-tag guest">Gastspeler</span>}</div>}<div className="attendance-pair"><span><small>Training</small><strong>{player.training.percentage}%</strong></span><span><small>Wedstrijd</small><strong>{player.matchAttendance.total ? `${player.matchAttendance.percentage}%` : "–"}</strong></span></div><div className="mini-stats"><span className="mini-stat"><strong>{player.totals.matches}</strong><span>Gespeeld</span></span><span className="mini-stat"><strong>{player.totals.goals}</strong><span>Goals</span></span><span className="mini-stat"><strong>{player.totals.assists}</strong><span>Assists</span></span></div><div className="status-chips"><span>Afwezig {player.totals.absent}</span><span>Niet gespeeld {player.totals.notPlayed}</span><span>Deels {player.totals.partial}</span><span>Volledig {player.totals.full}</span></div></div></button>; }
function PlayerDrawer({ player, onClose }: { player: Player; onClose: () => void }) { return <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="drawer" role="dialog" aria-modal="true" aria-label={`Statistieken van ${player.name}`}><div className="drawer-hero"><div className="drawer-top"><span className="eyebrow">Spelerskaart</span><button className="close-button" onClick={onClose} aria-label="Sluiten">×</button></div><div className="drawer-person"><span className="avatar">{player.number || initials(player.name)}</span><div><h2>{player.name}</h2><p>{player.position} · {player.foot ? `${player.foot}benig` : "voorkeursvoet onbekend"}{player.captain ? " · aanvoerder" : ""}{player.guest ? " · gastspeler" : ""}</p></div></div></div><div className="drawer-content"><div className="detail-kpis"><Detail label="Wedstrijden" value={player.totals.matches}/><Detail label="Doelpunten" value={player.totals.goals}/><Detail label="Assists" value={player.totals.assists}/><Detail label="Training opkomst" value={`${player.training.percentage}%`}/><Detail label="Wedstrijd opkomst" value={player.matchAttendance.total ? `${player.matchAttendance.percentage}%` : "Nog geen invoer"}/><Detail label="Afwezig" value={player.totals.absent}/><Detail label="Niet gespeeld" value={player.totals.notPlayed}/><Detail label="Deels" value={player.totals.partial}/><Detail label="Volledig" value={player.totals.full}/><Detail label="Penalty gescoord" value={player.totals.penaltiesScored}/><Detail label="Penalty gemist" value={player.totals.penaltiesMissed}/><Detail label="Te laat" value={player.totals.late}/><Detail label="Gevlagd" value={player.totals.flagged}/><Detail label="Polo vergeten" value={player.totals.polo}/><Detail label="Gekeept" value={player.totals.kept}/><Detail label="Aanvoerder" value={player.totals.captain}/><Detail label="Geel" value={player.totals.yellow}/><Detail label="Rood" value={player.totals.red}/></div><section className="detail-section"><h3>Trainingen</h3>{player.training.sessions.length ? <div className="session-list">{player.training.sessions.map((date) => <span key={date}>{formatDate(date)}</span>)}</div> : <div className="no-matches">Nog geen aanwezigheid geregistreerd.</div>}</section><section className="detail-section"><h3>Wedstrijdhistorie</h3>{player.matches.length ? <div className="match-list">{player.matches.map((match) => <MatchRow key={match.id} match={match}/>)}</div> : <div className="no-matches">Nog geen wedstrijdgegevens voor deze speler.</div>}</section></div></aside></div>; }
function Detail({ label, value }: { label: string; value: string | number }) { return <div className="detail-kpi"><span>{label}</span><strong>{value}</strong></div>; }
function MatchRow({ match }: { match: PlayerMatch }) { const tags = [`Penalty ${match.penaltiesScored}/${match.penaltiesMissed}`, match.late && "Te laat", match.flagged && "Gevlagd", match.polo && "Polo vergeten", match.kept && "Gekeept", match.captain && "Aanvoerder"].filter(Boolean); return <article className="match-row"><div className="match-main"><strong>{opponent(match) || "Tegenstander onbekend"}</strong><span>{formatDate(match.date)} · {venue(match)} · {match.status || "Status onbekend"}</span></div><MatchCell value={match.goals} label="Goals"/><MatchCell value={match.assists} label="Assists"/><MatchCell value={match.yellow} label="Geel"/><MatchCell value={match.red} label="Rood"/><div className="match-tags">{tags.map((tag) => <span key={String(tag)}>{tag}</span>)}</div></article>; }
function MatchCell({ value, label }: { value: number; label: string }) { return <div className="match-cell"><strong>{value}</strong><span>{label}</span></div>; }
