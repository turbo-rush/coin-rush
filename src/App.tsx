import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import RankedArena from "./RankedArena";
import SoloTraining from "./SoloTraining";

type Tab = "empire" | "battle" | "solo" | "ranking" | "social";
type LeaderboardProfile = { id: string; username: string; rating: number; wins: number; losses: number };
type Save = {
  coins: number; energy: number; mineLevel: number; tapPower: number;
  robotLevel: number; researchLevel: number; powerLevel: number;
  totalMined: number; lastSeen: number;
};

const SAVE_KEY = "coin-rush-mvp-v1";
const defaults: Save = {
  coins: 250, energy: 100, mineLevel: 1, tapPower: 1,
  robotLevel: 0, researchLevel: 0, powerLevel: 0, totalMined: 0, lastSeen: Date.now()
};

const fmt = (value: number) => Math.floor(value).toLocaleString("en-US");
const costFor = (base: number, level: number, growth: number) => Math.floor(base * Math.pow(growth, level));

function readSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaults;
    const parsed = { ...defaults, ...(JSON.parse(raw) as Partial<Save>) };
    const awaySeconds = Math.min(8 * 60 * 60, Math.max(0, Math.floor((Date.now() - parsed.lastSeen) / 1000)));
    const offlineRate = parsed.mineLevel * 3 + parsed.robotLevel * 5 + parsed.researchLevel * 2;
    return {
      ...parsed,
      coins: parsed.coins + offlineRate * awaySeconds,
      energy: Math.min(100 + parsed.powerLevel * 20, parsed.energy + awaySeconds * (1 + parsed.powerLevel)),
      lastSeen: Date.now()
    };
  } catch {
    return defaults;
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>("empire");
  const [save, setSave] = useState<Save>(readSave);
  const [notice, setNotice] = useState("Welcome back, Director. Your empire kept working.");
  const [rushActive, setRushActive] = useState(false);
  const [authStatus, setAuthStatus] = useState<"connecting" | "online" | "offline" | "error">("connecting");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardProfile[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");

  const baseProduction = save.mineLevel * 3 + save.robotLevel * 5 + save.researchLevel * 2;
  const production = baseProduction * (rushActive ? 2 : 1);
  const energyCap = 100 + save.powerLevel * 20;
  const tapReward = save.tapPower * 5 + save.researchLevel;
  const upgrades = [
    { id: "mine", name: "Gold Mine", detail: "Increase core coin production", icon: "⛏️", level: save.mineLevel, cost: costFor(100, save.mineLevel - 1, 1.55) },
    { id: "drill", name: "Turbo Drill", detail: "Earn more coins per manual tap", icon: "⚙️", level: save.tapPower, cost: costFor(150, save.tapPower - 1, 1.7) },
    { id: "robots", name: "Robot Crew", detail: "Automate mining operations", icon: "🤖", level: save.robotLevel, cost: costFor(220, save.robotLevel, 1.8) },
    { id: "research", name: "Research Lab", detail: "Improve all production systems", icon: "🔬", level: save.researchLevel, cost: costFor(350, save.researchLevel, 2) },
    { id: "power", name: "Power Plant", detail: "Expand energy capacity and recovery", icon: "⚡", level: save.powerLevel, cost: costFor(180, save.powerLevel, 1.75) },
  ];

  useEffect(() => {
    let cancelled = false;

    async function connectPlayer() {
      if (!supabase) {
        setAuthStatus("offline");
        return;
      }

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        let playerId = sessionData.session?.user.id;
        if (!playerId) {
          const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
          if (signInError) throw signInError;
          playerId = signInData.user?.id;
        }

        if (!playerId) throw new Error("Supabase did not return a player ID");
        if (!cancelled) {
          setCurrentUserId(playerId);
          setAuthStatus("online");
          setNotice("Player profile connected. Welcome to COIN RUSH!");
        }
      } catch (error) {
        console.error("Supabase player sign-in failed:", error);
        if (!cancelled) {
          setAuthStatus("error");
          setNotice("Online profile unavailable. Your local empire is still playable.");
        }
      }
    }

    void connectPlayer();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (tab !== "ranking" || authStatus !== "online") return;
    const client = supabase;
    if (!client) return;
    let cancelled = false;

    const loadLeaderboard = async (db: NonNullable<typeof supabase>) => {
      setLeaderboardLoading(true);
      setLeaderboardError("");
      const { data, error } = await db
        .from("profiles")
        .select("id, username, rating, wins, losses")
        .order("rating", { ascending: false })
        .order("wins", { ascending: false })
        .limit(20);

      if (cancelled) return;
      if (error) {
        console.error("Leaderboard load failed:", error);
        setLeaderboardError("Could not load the global leaderboard. Please try again.");
      } else {
        setLeaderboard((data ?? []) as LeaderboardProfile[]);
      }
      setLeaderboardLoading(false);
    };

    void loadLeaderboard(client);
    return () => { cancelled = true; };
  }, [tab, authStatus]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSave((current) => ({
        ...current,
        coins: current.coins + (current.mineLevel * 3 + current.robotLevel * 5 + current.researchLevel * 2) * (rushActive ? 2 : 1),
        energy: Math.min(100 + current.powerLevel * 20, current.energy + 1 + current.powerLevel),
        lastSeen: Date.now(),
      }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }, [save]);

  const energyProgress = useMemo(() => Math.max(0, Math.min(100, save.energy / energyCap * 100)), [save.energy, energyCap]);

  function mine() {
    if (save.energy < 2) {
      setNotice("Not enough Rush Energy. Your power plant is recharging.");
      return;
    }
    setSave((current) => ({
      ...current,
      coins: current.coins + current.tapPower * 5 + current.researchLevel,
      totalMined: current.totalMined + current.tapPower * 5 + current.researchLevel,
      energy: Math.max(0, current.energy - 2),
    }));
    setNotice(`+${tapReward} coins mined!`);
  }

  function buyUpgrade(id: string) {
    const item = upgrades.find((upgrade) => upgrade.id === id);
    if (!item || save.coins < item.cost) {
      setNotice("Not enough coins yet. Keep mining!");
      return;
    }
    setSave((current) => ({
      ...current,
      coins: current.coins - item.cost,
      mineLevel: id === "mine" ? current.mineLevel + 1 : current.mineLevel,
      tapPower: id === "drill" ? current.tapPower + 1 : current.tapPower,
      robotLevel: id === "robots" ? current.robotLevel + 1 : current.robotLevel,
      researchLevel: id === "research" ? current.researchLevel + 1 : current.researchLevel,
      powerLevel: id === "power" ? current.powerLevel + 1 : current.powerLevel,
    }));
    setNotice(`${item.name} upgraded to level ${item.level + 1}!`);
  }

  function activateRush() {
    if (save.energy < 25 || rushActive) {
      setNotice(rushActive ? "Rush Overdrive is already active." : "You need 25 energy to activate Overdrive.");
      return;
    }
    setSave((current) => ({ ...current, energy: current.energy - 25 }));
    setRushActive(true);
    setNotice("RUSH OVERDRIVE activated — double production for 20 seconds!");
    window.setTimeout(() => setRushActive(false), 20000);
  }

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: "empire", icon: "🏭", label: "Empire" },
    { id: "battle", icon: "⚔️", label: "Battle" },
    { id: "solo", icon: "🎯", label: "Solo" },
    { id: "ranking", icon: "🏆", label: "Ranking" },
    { id: "social", icon: "👥", label: "Social" },
  ];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-mark">CR</div><div><p className="eyebrow">BUILD • UPGRADE • DOMINATE</p><h1>COIN <span>RUSH</span></h1></div></div>
        <button className="avatar-button" onClick={() => setTab("social")} aria-label="Open profile">👤</button>
      </header>

      <section className="player-strip"><div><span className="online-dot" /> CORPORATION <strong>ROOKIE MINERS</strong><small className="connection-status"> · {authStatus === "online" ? "ONLINE PROFILE" : authStatus === "connecting" ? "CONNECTING..." : authStatus === "error" ? "OFFLINE MODE" : "LOCAL MODE"}</small></div><div className="level-pill">LVL {save.mineLevel}</div></section>

      <section className="wallet-grid">
        <div className="wallet-card coin-wallet"><span className="wallet-label">COIN BALANCE</span><strong>◈ {fmt(save.coins)}</strong><small>+{production} / SEC</small></div>
        <div className="wallet-card energy-wallet"><span className="wallet-label">RUSH ENERGY</span><strong>⚡ {fmt(save.energy)}<small className="out-of"> / {energyCap}</small></strong><div className="energy-track"><div className="energy-fill" style={{ width: `${energyProgress}%` }} /></div></div>
      </section>

      {tab === "empire" && <>
        <section className="hero-panel"><div className="hero-glow" /><div className="hero-copy"><span className="section-kicker">YOUR HEADQUARTERS</span><h2>Gold Mine <em>01</em></h2><p>Your empire works even when you are away.</p></div><div className="mine-art" aria-hidden="true"><div className="ore-ring" /><div className="ore-core">◆</div><span className="spark spark-one">✦</span><span className="spark spark-two">✧</span><span className="mine-crate">▰</span></div><div className="production-line"><span>PRODUCTION RATE</span><strong>+{production} <small>COINS / SEC</small></strong></div></section>

        <section className="rush-panel"><div><span className="section-kicker">SIGNATURE ABILITY</span><h2>Rush Overdrive</h2><p>{rushActive ? "Overdrive is active! Production boost engaged." : "Spend 25 energy to double your mining output for 20 seconds."}</p></div><button className={rushActive ? "rush-button active-rush" : "rush-button"} onClick={activateRush} disabled={rushActive}>⚡ {rushActive ? "ACTIVE" : "ACTIVATE"}</button></section>

        <section className="section-heading"><div><span className="section-kicker">GROW YOUR POWER</span><h2>Upgrade your empire</h2></div><span className="tiny-tag">5 SYSTEMS</span></section>
        <section className="upgrade-list">{upgrades.map((item) => <article className="upgrade-card" key={item.id}><div className="upgrade-icon">{item.icon}</div><div className="upgrade-info"><h3>{item.name}</h3><p>{item.detail}</p><span>LEVEL {item.level}</span></div><button className="buy-button" onClick={() => buyUpgrade(item.id)} disabled={save.coins < item.cost}><strong>◈ {fmt(item.cost)}</strong><small>UPGRADE</small></button></article>)}</section>

        <section className="mine-action"><div><span className="section-kicker">MANUAL MINING</span><h2>Boost your output</h2><p>Tap to mine extra coins. Each tap uses 2 energy.</p></div><button className="mine-button" onClick={mine}><span>◈</span><strong>RUSH MINE</strong><small>+{tapReward} COINS</small></button></section>
        <section className="stats-strip"><div><span>TOTAL MINED</span><strong>{fmt(save.totalMined)}</strong></div><div><span>ROBOT CREW</span><strong>LVL {save.robotLevel}</strong></div><div><span>RESEARCH</span><strong>LVL {save.researchLevel}</strong></div></section>
      </>}

      {tab === "battle" && <RankedArena authStatus={authStatus} />}

      {tab === "solo" && <SoloTraining />}

      {tab === "ranking" && <section className="feature-page"><div className="feature-art trophy-art">🏆</div><span className="section-kicker">SEASON ZERO</span><h2>Global ranking</h2><p>Live player profiles from the COIN RUSH server, sorted by rating.</p>{leaderboardLoading && <div className="notice-card">Loading global leaderboard...</div>}{leaderboardError && <div className="notice-card">{leaderboardError}</div>}{!leaderboardLoading && !leaderboardError && leaderboard.length > 0 && <><div className="rank-preview"><span>YOUR CURRENT RANK</span><strong>{(() => { const index = leaderboard.findIndex((player) => player.id === currentUserId); return index >= 0 ? `#${index + 1}` : "NOT IN TOP 20"; })()}</strong><small>{leaderboard.find((player) => player.id === currentUserId)?.username ?? "Your profile is outside the top 20"} · Rating {leaderboard.find((player) => player.id === currentUserId)?.rating ?? "—"}</small></div><div className="leaderboard-list">{leaderboard.map((player, index) => <div className={player.id === currentUserId ? "rank-row current-player" : "rank-row"} key={player.id}><span>{String(index + 1).padStart(2, "0")}</span><b>{player.username}{player.id === currentUserId ? " (YOU)" : ""}<small>{player.wins} W · {player.losses} L</small></b><strong>{player.rating.toLocaleString("en-US")} RP</strong></div>)}</div></>}{!leaderboardLoading && !leaderboardError && leaderboard.length === 0 && <div className="notice-card">No player profiles found yet. Your profile will appear here once it is available.</div>}{authStatus !== "online" && <div className="notice-card">Connect to your online profile to view the live leaderboard.</div>}</section>}

      {tab === "social" && <section className="feature-page"><div className="feature-art social-art">👥</div><span className="section-kicker">BUILD YOUR CREW</span><h2>Find your people</h2><p>Invite friends, form a corporation and compete together for control of the richest mines.</p><div className="mode-card"><div className="mode-icon">🛡️</div><div><h3>Corporations</h3><p>Team up and climb clan rankings</p></div><span className="coming-tag">NEXT STAGE</span></div><div className="mode-card"><div className="mode-icon">🎁</div><div><h3>Invite friends</h3><p>Referral rewards and crew bonuses</p></div><span className="coming-tag">NEXT STAGE</span></div></section>}

      <div className="toast" role="status">{notice}</div>
      <nav className="bottom-nav" aria-label="Main navigation">{tabs.map((item) => <button key={item.id} className={tab === item.id ? "nav-item active" : "nav-item"} onClick={() => setTab(item.id)}><span>{item.icon}</span><small>{item.label}</small></button>)}</nav>
    </main>
  );
}
