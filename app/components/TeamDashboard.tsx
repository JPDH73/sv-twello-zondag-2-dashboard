"use client";

import { useEffect, useMemo, useState } from "react";

type Match = { id: string; date: string; time: string; home: string; away: string; result: string; competition: string };
type PlayerMatch = Match & { status: string; goals: number; assists: number; yellow: number; red: number; penaltiesScored: number; penaltiesMissed: number; late: boolean; flagged: boolean; kept: boolean };
type Player = {
  id: string; number: string; name: string; position: string; foot: string; guest: boolean;
  training: { attended: number; total: number; percentage: number; sessions: string[] };
  totals: { matches: number; goals: number; assists: number; yellow: number; red: number; penaltiesScored: number; penaltiesMissed: number; flagged: number; kept: number };
  matches: PlayerMatch[];
};
type Staff = { id: string; name: string; role: string; matches: number };
type TeamData = {
  team: string; season: string; generatedAt: string; sourceFile: string;
  totals: { players: number; staff: number; trainings: number; matchesScheduled: number; matchesPlayed: number; goals: number; assists: number };
  matches: Match[];
  trainings: { date: string; attendees: string[] }[];
  players: Player[];
  staff: Staff[];
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}
function formatDate(value: string) {
  if (!value) return "Datum nog niet bekend";
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}
function opponent(match: Match) { return match.home === "SV Twello 2" ? match.away : match.home; }
function venue(match: Match) { return match.home === "SV Twello 2" ? "Thuis" : "Uit"; }
function leader(players: Player[], field: "goals" | "assists" | "training") {
  const sorted = [...players].sort((a, b) => {
    const aScore = field === "training" ? a.training.attended : a.totals[field];
    const bScore = field === "training" ? b.training.attended : b.totals[field];
    return bScore - aScore || a.name.localeCompare(b.name, "nl");
  });
  const first = sorted[0];
  const score = first ? (field === "training" ? first.training.attended : first.totals[field]) : 0;
  return score > 0 ? first : undefined;
}

export function TeamDashboard() {
  const [data, setData] = useState<TeamData | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("nummer");
  const [selected, setSelected] = useState<Player | null>(null);

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
  const program = data.matches.filter((match) => match.date).slice(0, 8);

  return <main className="app-shell">
    <header className="hero">
      <div className="topbar"><div className="brand"><span className="logo-card"><img className="brand-logo" src="./sv-twello-logo.jpeg" alt="Logo SV Twello" /></span><span className="brand-team"><strong>Zondag 2</strong><span>Teamdashboard</span></span></div><span className="season-pill">Seizoen {data.season}</span></div>
      <div className="hero-copy"><p className="eyebrow">Teamdashboard</p><h1>Alles van Zondag 2.<br/>Eén duidelijk overzicht.</h1><p className="hero-intro">Selectie, programma, trainingen en beslissende acties rechtstreeks vanuit het gedeelde Excel-bestand.</p><span className="updated"><span className="updated-dot"/>Bijgewerkt op {generated}</span></div>
    </header>

    <div className="content">
      <section className="kpi-grid" aria-label="Teamtotalen">
        <Kpi label="Selectie" value={data.totals.players} note={`${data.totals.staff} stafleden`} />
        <Kpi label="Trainingen" value={data.totals.trainings} note="tot en met vandaag" />
        <Kpi label="Wedstrijden" value={data.totals.matchesScheduled} note={`${data.totals.matchesPlayed} met uitslag of invoer`} />
        <Kpi label="Goals + assists" value={data.totals.goals + data.totals.assists} note={`${data.totals.goals} goals · ${data.totals.assists} assists`} />
      </section>

      <section className="section"><div className="section-heading"><div><h2>Programma & uitslagen</h2><p>De eerste wedstrijden uit het actuele speelschema.</p></div></div><div className="fixture-grid">{program.map((match) => <Fixture key={match.id} match={match}/>)}</div></section>

      <section className="section"><div className="section-heading"><div><h2>Teamleiders</h2><p>Koplopers op basis van de ingevoerde gegevens.</p></div></div><div className="leader-grid">
        <Leader title="Doelpunten" player={leader(data.players, "goals")} score={leader(data.players, "goals")?.totals.goals ?? 0}/>
        <Leader title="Assists" player={leader(data.players, "assists")} score={leader(data.players, "assists")?.totals.assists ?? 0}/>
        <Leader title="Trainingen" player={leader(data.players, "training")} score={leader(data.players, "training")?.training.attended ?? 0}/>
      </div></section>

      <section className="section">
        <div className="section-heading"><div><h2>Spelers</h2><p>Kies een speler voor trainingen en wedstrijdacties.</p></div><div className="controls"><label className="search-wrap"><span className="search-icon" aria-hidden="true">⌕</span><span className="sr-only">Zoek speler</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek op naam…" /></label><label><span className="sr-only">Sorteer spelers</span><select className="sort-select" value={sort} onChange={(event) => setSort(event.target.value)}><option value="nummer">Sorteer: rugnummer</option><option value="naam">Naam</option><option value="training">Trainingspercentage</option><option value="goals">Doelpunten</option><option value="assists">Assists</option></select></label></div></div>
        {visiblePlayers.length ? <div className="player-grid">{visiblePlayers.map((player) => <PlayerCard key={player.id} player={player} onOpen={() => setSelected(player)}/>)}</div> : <div className="empty-state">Geen speler gevonden voor “{query}”.</div>}
      </section>

      <section className="section"><div className="section-heading"><div><h2>Laatste trainingen</h2><p>Aanwezigheid per trainingsmoment.</p></div></div>{data.trainings.length ? <div className="training-grid">{data.trainings.slice(0, 6).map((training) => <article className="training-card" key={training.date}><div className="training-date">{formatDate(training.date)}</div><strong>{training.attendees.length} spelers</strong><p>{training.attendees.length ? training.attendees.join(" · ") : "Geen aanwezigen geregistreerd"}</p></article>)}</div> : <div className="empty-state">Er zijn nog geen trainingen tot en met vandaag.</div>}</section>

      <section className="section"><div className="section-heading"><div><h2>Staf</h2><p>De begeleiding van SV Twello Zondag 2.</p></div></div><div className="staff-grid">{data.staff.map((member) => <article className="staff-card" key={member.id}><span className="avatar">{initials(member.name)}</span><div><strong>{member.name}</strong><span>{member.role}</span></div></article>)}</div></section>
      <footer className="footer">Bron: {data.sourceFile} · Alleen geselecteerde teamgegevens worden gepubliceerd</footer>
    </div>
    {selected && <PlayerDrawer player={selected} onClose={() => setSelected(null)}/>} 
  </main>;
}

function Kpi({ label, value, note }: { label: string; value: number; note: string }) { return <article className="kpi-card"><div className="kpi-label">{label}</div><div className="kpi-value">{value}</div><div className="kpi-note">{note}</div></article>; }
function Leader({ title, player, score }: { title: string; player?: Player; score: number }) { return <article className="leader-card"><span className="leader-kind">Meeste {title.toLowerCase()}</span><span className="leader-score">{score}</span><div className="leader-name">{player?.name ?? "Nog geen invoer"}</div></article>; }
function Fixture({ match }: { match: Match }) { return <article className="fixture-card"><div className="fixture-meta"><span>{match.competition || "Wedstrijd"}</span><span>{formatDate(match.date)} {match.time && `· ${match.time}`}</span></div><div className="fixture-teams"><strong>{match.home}</strong><span>{match.result || "–"}</span><strong>{match.away}</strong></div></article>; }
function PlayerCard({ player, onOpen }: { player: Player; onOpen: () => void }) { return <button className="player-card" onClick={onOpen} aria-label={`Bekijk statistieken van ${player.name}`}><div className="player-band"/><div className="player-body"><div className="player-head"><span className="avatar">{initials(player.name)}</span><span className="player-name"><strong>{player.name}</strong><span>{player.position}{player.guest ? " · gastspeler" : ""}</span></span><span className="availability-badge" title="Rugnummer">{player.number || "–"}</span></div><div className="mini-stats"><span className="mini-stat"><strong>{player.training.attended}</strong><span>Training</span></span><span className="mini-stat"><strong>{player.totals.goals}</strong><span>Goals</span></span><span className="mini-stat"><strong>{player.totals.assists}</strong><span>Assists</span></span></div><div className="progress-row"><span>Opkomst</span><span className="progress-track"><span className="progress-fill" style={{ width: `${player.training.percentage}%` }}/></span><strong>{player.training.percentage}%</strong></div></div></button>; }
function PlayerDrawer({ player, onClose }: { player: Player; onClose: () => void }) { return <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="drawer" role="dialog" aria-modal="true" aria-label={`Statistieken van ${player.name}`}><div className="drawer-hero"><div className="drawer-top"><span className="eyebrow">Spelerskaart</span><button className="close-button" onClick={onClose} aria-label="Sluiten">×</button></div><div className="drawer-person"><span className="avatar">{player.number || initials(player.name)}</span><div><h2>{player.name}</h2><p>{player.position} · {player.foot ? `${player.foot}benig` : "voorkeursvoet onbekend"}{player.guest ? " · gastspeler" : ""}</p></div></div></div><div className="drawer-content"><div className="detail-kpis"><Detail label="Wedstrijden" value={player.totals.matches}/><Detail label="Doelpunten" value={player.totals.goals}/><Detail label="Assists" value={player.totals.assists}/><Detail label="Opkomst" value={`${player.training.percentage}%`}/><Detail label="Geel" value={player.totals.yellow}/><Detail label="Rood" value={player.totals.red}/><Detail label="Penalty's" value={player.totals.penaltiesScored}/><Detail label="Gekeept" value={player.totals.kept}/></div><section className="detail-section"><h3>Trainingen</h3>{player.training.sessions.length ? <div className="session-list">{player.training.sessions.map((date) => <span key={date}>{formatDate(date)}</span>)}</div> : <div className="no-matches">Nog geen aanwezigheid geregistreerd.</div>}</section><section className="detail-section"><h3>Wedstrijdhistorie</h3>{player.matches.length ? <div className="match-list">{player.matches.map((match) => <MatchRow key={match.id} match={match}/>)}</div> : <div className="no-matches">Nog geen wedstrijdgegevens voor deze speler.</div>}</section></div></aside></div>; }
function Detail({ label, value }: { label: string; value: string | number }) { return <div className="detail-kpi"><span>{label}</span><strong>{value}</strong></div>; }
function MatchRow({ match }: { match: PlayerMatch }) { return <article className="match-row"><div className="match-main"><strong>{opponent(match) || "Tegenstander onbekend"}</strong><span>{formatDate(match.date)} · {venue(match)} · {match.status || "Status onbekend"}</span></div><MatchCell value={match.goals} label="Goals"/><MatchCell value={match.assists} label="Assists"/><MatchCell value={match.yellow} label="Geel"/><MatchCell value={match.red} label="Rood"/></article>; }
function MatchCell({ value, label }: { value: number; label: string }) { return <div className="match-cell"><strong>{value}</strong><span>{label}</span></div>; }
