import { useState } from "react";

export default function App() {
  const [coins, setCoins] = useState(0);
  const [energy, setEnergy] = useState(100);
  const tap = () => {
    if (energy <= 0) return;
    setCoins((value) => value + 1);
    setEnergy((value) => value - 1);
  };

  return (
    <main className="app-shell">
      <header className="topbar"><div className="brand-mark">CR</div><div><p className="eyebrow">ARCADE • IDLE • COMPETE</p><h1>COIN RUSH</h1></div><div className="profile">👤</div></header>
      <section className="balance-card"><p className="muted">YOUR BALANCE</p><div className="balance">🪙 {coins.toLocaleString()}</div><p className="muted">Keep tapping to build your fortune</p></section>
      <button className="coin-button" onClick={tap} aria-label="Tap to earn a coin"><span>₿</span><small>TAP TO EARN</small></button>
      <section className="energy"><div className="energy-label"><span>⚡ ENERGY</span><strong>{energy}/100</strong></div><div className="energy-track"><div className="energy-fill" style={{ width: `${energy}%` }} /></div></section>
      <nav className="bottom-nav"><button className="active">🪙<span>Earn</span></button><button>🛠️<span>Upgrade</span></button><button>🎯<span>Tasks</span></button><button>🏆<span>League</span></button></nav>
    </main>
  );
}
