import { useEffect, useState } from "react";

type Mode = "menu" | "practice" | "ai";
type Side = { base: number; energy: number; ultimate: number; gold: number; shield: number; shieldUntil: number; empReady: number; raidReady: number };
type Session = { mode: Mode; player: Side; enemy: Side; seconds: number; actions: number; damage: number; blocked: number; mined: number; log: string[]; result: "playing" | "win" | "loss" | "draw" };

const freshSide = (): Side => ({ base: 1000, energy: 100, ultimate: 0, gold: 0, shield: 0, shieldUntil: 0, empReady: 0, raidReady: 0 });
const freshSession = (mode: Mode): Session => ({ mode, player: freshSide(), enemy: freshSide(), seconds: 300, actions: 0, damage: 0, blocked: 0, mined: 0, log: ["Training simulation started. No Ranked points are at stake."], result: "playing" });
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export default function SoloTraining() {
  const [mode, setMode] = useState<Mode>("menu");
  const [session, setSession] = useState<Session | null>(null);
  const [difficulty, setDifficulty] = useState<"easy" | "normal" | "hard">("normal");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!session || session.result !== "playing" || session.mode !== "ai") return;
    const timer = window.setInterval(() => {
      setSession((current) => {
        if (!current || current.result !== "playing") return current;
        const next = { ...current, player: { ...current.player, energy: clamp(current.player.energy + 2, 0, 100), ultimate: clamp(current.player.ultimate + 0.4, 0, 100) }, enemy: { ...current.enemy, energy: clamp(current.enemy.energy + (difficulty === "hard" ? 5 : difficulty === "normal" ? 4 : 3), 0, 100), ultimate: clamp(current.enemy.ultimate + (difficulty === "hard" ? 0.7 : 0.5), 0, 100) }, log: [...current.log] };
        next.seconds = Math.max(0, current.seconds - 1);
        const enemy = next.enemy;
        const now = 300 - next.seconds;
        let action = "";
        let damage = 0;
        if (enemy.base < 650 && enemy.energy >= 25 && now >= enemy.empReady && difficulty !== "easy") {
          enemy.energy -= 25; enemy.shield = 200; enemy.shieldUntil = now + 12; action = "AI activated Golden Shield";
        } else if (enemy.ultimate >= 100) {
          enemy.ultimate = 0; damage = 350; action = "AI used Ultimate Overdrive";
        } else if (enemy.energy >= 40 && enemy.ultimate >= 20 && now >= enemy.raidReady && difficulty !== "easy") {
          enemy.energy -= 40; enemy.ultimate -= 20; enemy.raidReady = now + 30; damage = 220; action = "AI launched Robot Raid";
        } else if (enemy.energy >= 35 && enemy.ultimate >= 25 && now >= enemy.empReady) {
          enemy.energy -= 35; enemy.ultimate -= 25; enemy.empReady = now + 25; damage = 120; action = "AI used EMP Strike";
        } else if (enemy.energy >= 10) {
          enemy.energy -= 10; enemy.gold += 15; enemy.ultimate = clamp(enemy.ultimate + 5, 0, 100); action = "AI mined +15 gold";
        }
        if (damage > 0) {
          const absorbed = now < next.player.shieldUntil ? Math.min(next.player.shield, damage) : 0;
          next.player.shield -= absorbed;
          next.player.base = Math.max(0, next.player.base - (damage - absorbed));
          next.blocked += absorbed;
          next.log.unshift(`${action} · ${damage - absorbed} damage · ${absorbed} blocked`);
        } else if (action) next.log.unshift(action);
        if (next.seconds === 0 || next.player.base <= 0 || next.enemy.base <= 0) {
          next.result = next.player.base > next.enemy.base ? "win" : next.player.base < next.enemy.base ? "loss" : "draw";
          next.log.unshift("Simulation complete. Review your strategy report.");
        }
        return { ...next, log: next.log.slice(0, 8) };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session?.mode, session?.result, difficulty]);

  function start(nextMode: Mode) {
    setMode(nextMode);
    setSession(freshSession(nextMode));
    setMessage("");
  }

  function act(action: "mine" | "emp" | "shield" | "raid" | "ultimate") {
    setSession((current) => {
      if (!current || current.result !== "playing") return current;
      const next: Session = { ...current, player: { ...current.player }, enemy: { ...current.enemy }, log: [...current.log] };
      const p = next.player;
      const now = 300 - next.seconds;
      let damage = 0;
      let label = "";
      if (action === "mine") {
        if (p.energy < 10) { setMessage("Not enough energy. Wait for regeneration."); return current; }
        p.energy -= 10; p.gold += 15; p.ultimate = clamp(p.ultimate + 5, 0, 100); next.mined += 15; label = "You mined +15 gold";
      } else if (action === "emp") {
        if (p.energy < 35 || p.ultimate < 25 || now < p.empReady) { setMessage("EMP needs 35 energy, 25 Ultimate and its cooldown to be ready."); return current; }
        p.energy -= 35; p.ultimate -= 25; p.empReady = now + 25; damage = 120; label = "You used EMP Strike";
      } else if (action === "shield") {
        if (p.energy < 25) { setMessage("Golden Shield needs 25 energy."); return current; }
        p.energy -= 25; p.shield = 200; p.shieldUntil = now + 12; label = "You activated Golden Shield (200 shield / 12 sec)";
      } else if (action === "raid") {
        if (p.energy < 40 || p.ultimate < 20 || now < p.raidReady) { setMessage("Robot Raid needs 40 energy, 20 Ultimate and its cooldown to be ready."); return current; }
        p.energy -= 40; p.ultimate -= 20; p.raidReady = now + 30; damage = 220; label = "You launched Robot Raid";
      } else {
        if (p.ultimate < 100) { setMessage("Ultimate Overdrive requires 100 charge."); return current; }
        p.ultimate = 0; damage = 350; label = "You unleashed Ultimate Overdrive";
      }
      if (damage > 0) {
        if (current.mode === "practice") {
          next.enemy.base = Math.max(0, next.enemy.base - damage);
          next.damage += damage;
        } else {
          const absorbed = now < next.enemy.shieldUntil ? Math.min(next.enemy.shield, damage) : 0;
          next.enemy.shield -= absorbed;
          next.enemy.base = Math.max(0, next.enemy.base - (damage - absorbed));
          next.damage += damage - absorbed;
          next.blocked += absorbed;
        }
      }
      next.actions += 1;
      next.log.unshift(`${label}${damage ? ` · ${damage} damage` : ""}`);
      if (next.enemy.base <= 0) next.result = "win";
      setMessage("");
      return { ...next, log: next.log.slice(0, 8) };
    });
  }

  const s = session;
  const time = s ? `${Math.floor(s.seconds / 60).toString().padStart(2, "0")}:${(s.seconds % 60).toString().padStart(2, "0")}` : "05:00";
  const report = s && s.result !== "playing";
  return (
    <section className="ranked-arena solo-arena">
      <div className="ranked-arena-visual" aria-hidden="true">🎯</div>
      <span className="section-kicker">SOLO • TRAINING ARENA</span>
      <h2>Learn. Adapt. Dominate.</h2>
      <p>Practice every ability or challenge a tactical AI. Solo simulations never change your Ranked rating, wins or losses.</p>
      {mode === "menu" && (
        <>
          <div className="solo-mode-card"><strong>🎯 FREE PRACTICE</strong><p>Stationary target, unlimited experimentation and instant feedback.</p><button className="ranked-search-button" onClick={() => start("practice")}>START FREE PRACTICE</button></div>
          <div className="solo-mode-card"><strong>🤖 AI BATTLE</strong><p>A five-minute opponent that mines, manages energy, shields and attacks.</p><label className="solo-difficulty">AI DIFFICULTY <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}><option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option></select></label><button className="ranked-search-button" onClick={() => start("ai")}>CHALLENGE AI</button></div>
        </>
      )}
      {s && (
        <>
          <div className="ranked-spec-grid">
            <div><span>MODE</span><strong>{s.mode === "ai" ? "AI BATTLE" : "PRACTICE"}</strong></div>
            <div><span>YOUR BASE</span><strong>{s.player.base}</strong></div>
            <div><span>{s.mode === "ai" ? "AI BASE" : "TARGET HP"}</span><strong>{s.enemy.base}</strong></div>
          </div>
          {s.mode === "ai" && <div className="solo-bars"><span>TIME {time}</span><span>AI ENERGY {Math.floor(s.enemy.energy)} · ULT {Math.floor(s.enemy.ultimate)}</span></div>}
          <p>YOUR ENERGY {Math.floor(s.player.energy)}/100 · ULTIMATE {Math.floor(s.player.ultimate)}/100 · GOLD {s.player.gold} · SHIELD {s.player.shield}</p>
          <div className="ranked-battle-actions">
            <button className="ranked-search-button" onClick={() => act("mine")} disabled={s.result !== "playing"}>⛏️ MINE +15 GOLD</button>
            <button className="ranked-search-button" onClick={() => act("emp")} disabled={s.result !== "playing"}>⚡ EMP STRIKE · 120 DMG</button>
            <button className="ranked-search-button" onClick={() => act("shield")} disabled={s.result !== "playing"}>🛡️ GOLDEN SHIELD</button>
            <button className="ranked-search-button" onClick={() => act("raid")} disabled={s.result !== "playing"}>🤖 ROBOT RAID · 220 DMG</button>
            <button className="ranked-search-button ranked-ultimate-button" onClick={() => act("ultimate")} disabled={s.result !== "playing"}>🔥 ULTIMATE · 350 DMG</button>
          </div>
          {message && <div className="notice-card">{message}</div>}
          <div className="ranked-event-log"><strong>TRAINING LOG</strong>{s.log.map((line, index) => <div className="ranked-event-row" key={index}><span>{line}</span></div>)}</div>
          {report && <div className="solo-report"><strong>STRATEGY REPORT · {s.result.toUpperCase()}</strong><p>Actions: {s.actions} · Damage dealt: {s.damage} · Damage blocked: {s.blocked} · Gold mined: {s.mined}</p><p>{s.damage >= 500 ? "Strong offensive pressure. Keep balancing attacks with energy recovery." : "Try chaining mining with well-timed abilities to build stronger attacks."}</p><button className="ranked-search-button" onClick={() => start(s.mode)}>PLAY AGAIN</button></div>}
          <button className="solo-back-button" onClick={() => { setMode("menu"); setSession(null); setMessage(""); }}>BACK TO TRAINING MENU</button>
        </>
      )}
      <div className="notice-card">TRAINING ONLY · No RP, Ranked records or season points are changed.</div>
    </section>
  );
}
