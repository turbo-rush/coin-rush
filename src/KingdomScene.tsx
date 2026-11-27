type Props = { variant?: "kingdom" | "battle" | "training" | "ranking" | "social"; compact?: boolean };

export default function KingdomScene({ variant = "kingdom", compact = false }: Props) {
  const enemy = variant === "battle" || variant === "training";
  return (
    <div className={`kingdom-scene kingdom-scene-${variant} ${compact ? "kingdom-scene-compact" : ""}`} role="img" aria-label="Isometric medieval kingdom with castles, towers, troops and resource buildings">
      <svg viewBox="0 0 800 460" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="land" x2="0" y2="1"><stop stopColor="#98744a"/><stop offset="1" stopColor="#4c4935"/></linearGradient>
          <linearGradient id="stone" x2="1" y2="1"><stop stopColor="#c9b58a"/><stop offset="1" stopColor="#625b4d"/></linearGradient>
          <linearGradient id="blue" x2="1" y2="1"><stop stopColor="#7eafd0"/><stop offset="1" stopColor="#294b70"/></linearGradient>
          <linearGradient id="red" x2="1" y2="1"><stop stopColor="#d88b68"/><stop offset="1" stopColor="#713a32"/></linearGradient>
          <linearGradient id="gold" x2="0" y2="1"><stop stopColor="#ffe5a0"/><stop offset="1" stopColor="#a96c26"/></linearGradient>
          <filter id="shadow"><feGaussianBlur stdDeviation="7"/></filter>
          <pattern id="tiles" width="44" height="34" patternUnits="userSpaceOnUse"><path d="M0 0L22 17 44 0M0 34L22 17 44 34" fill="none" stroke="#e4c58c" strokeOpacity=".12" strokeWidth="1"/></pattern>
        </defs>
        <rect width="800" height="460" fill="#242a26"/>
        <path d="M0 0H800V460H0Z" fill="url(#land)"/>
        <path d="M0 0L800 0 800 75 590 120 340 70 0 145Z" fill="#34443b"/>
        <path d="M0 370L230 260 430 300 800 180V460H0Z" fill="#5e503a"/>
        <path d="M0 0L800 0 800 460 0 460Z" fill="url(#tiles)"/>
        <path d="M-30 330L180 220 340 245 525 145 830 190" fill="none" stroke="#d5bd8c" strokeWidth="55" opacity=".38"/>
        <path d="M-30 330L180 220 340 245 525 145 830 190" fill="none" stroke="#756448" strokeWidth="39" opacity=".85"/>
        <path d="M600 0Q550 100 630 170T760 320" fill="none" stroke="#567b79" strokeWidth="44" opacity=".65"/>
        <path d="M600 0Q550 100 630 170T760 320" fill="none" stroke="#9bc4b2" strokeWidth="3" opacity=".25"/>
        <g opacity=".75" fill="#263b30"><path d="M35 70l28-42 28 42zM75 105l34-52 34 52zM720 70l30-48 30 48zM670 130l26-42 26 42zM80 410l30-48 30 48z"/></g>
        <g transform="translate(345 130)">
          <ellipse cx="0" cy="150" rx="160" ry="50" fill="#171b18" opacity=".45" filter="url(#shadow)"/>
          <path d="M-135 80L0 10 135 80 0 150Z" fill="#55554a"/><path d="M-135 80L0 150V180L-135 110Z" fill="#45483f"/><path d="M0 150L135 80V110L0 180Z" fill="#343d39"/>
          <path d="M-100 65L0 15 100 65V126L0 177-100 126Z" fill="url(#stone)" stroke="#514b40" strokeWidth="5"/>
          <path d="M-100 65L0 15 100 65 0 116Z" fill="#d4c29a"/>
          <path d="M-62 70L0 38 62 70V120L0 151-62 120Z" fill="#766b57"/>
          <path d="M-47 78L0 54 47 78 0 102Z" fill="#b7a17a"/><path d="M-47 78V126L0 150V102Z" fill="#5e5b4d"/><path d="M0 102L47 78V126L0 150Z" fill="#494b45"/>
          <path d="M-20 113Q0 92 20 113V143H-20Z" fill="#282b29"/>
          <g fill="#8e8065" stroke="#514b40" strokeWidth="4"><path d="M-110 57V-5L-80-24-50-5V82Z"/><path d="M50 82V-5L80-24 110-5V57Z"/><path d="M-24 37V-35L0-58 24-35V37Z"/></g>
          <g fill="#d1bd91"><path d="M-110-5L-80-40-50-5Z"/><path d="M50-5L80-40 110-5Z"/><path d="M-24-35L0-75 24-35Z"/></g>
          <g fill="#a84435"><path d="M-80-40V-80L-77-80-77-42Z"/><path d="M80-40V-82L83-82 83-40Z"/><path d="M0-75V-120L4-120 4-75Z"/></g>
          <path d="M0-120L38-109 0-96Z" fill={enemy ? "#b95b49" : "#3976a5"}/>
        </g>
        <g transform="translate(100 205)"><path d="M0 35L55 5 110 35 55 65Z" fill="#3f453b"/><path d="M0 35V80L55 110V65Z" fill="#695944"/><path d="M55 65L110 35V80L55 110Z" fill="#4d493a"/><path d="M0 35L55 5 110 35 55 65Z" fill="#c1a77a"/><path d="M14 30L55 8 96 30 55 52Z" fill="#7b4838"/><path d="M43 47V10L55 0 67 10V54Z" fill="#88765a"/><path d="M35 9L55-15 75 9Z" fill="#b8a27a"/><path d="M55-15V-43L58-43 58-15Z" fill="#c6a34c"/><path d="M58-42L85-34 58-25Z" fill="#4779a2"/></g>
        <g transform="translate(620 255)"><path d="M0 30L58 0 116 30 58 60Z" fill="#45483f"/><path d="M0 30V78L58 108V60Z" fill="#76644c"/><path d="M58 60L116 30V78L58 108Z" fill="#514838"/><path d="M0 30L58 0 116 30 58 60Z" fill="#bca77e"/><path d="M18 28L58 7 98 28 58 49Z" fill="#9a4d3d"/><path d="M37 45V6L58-8 79 6V45Z" fill="#87745a"/><path d="M30 7L58-20 86 7Z" fill="#c1a77a"/></g>
        <g transform="translate(485 60)"><path d="M0 35L42 12 84 35 42 58Z" fill="#42483d"/><path d="M0 35V72L42 95V58Z" fill="#76654e"/><path d="M42 58L84 35V72L42 95Z" fill="#4d493e"/><path d="M0 35L42 12 84 35 42 58Z" fill="#bda77e"/><path d="M13 30L42 15 71 30 42 45Z" fill="#a64e3c"/><path d="M25 40V8L42-5 59 8V40Z" fill="#8a7658"/></g>
        <g fill="#294b39" stroke="#667a4c" strokeWidth="3"><path d="M42 155l22-42 22 42z"/><path d="M58 177l25-46 25 46z"/><path d="M720 390l26-48 26 48z"/><path d="M690 410l22-42 22 42z"/><path d="M240 60l19-35 19 35z"/><path d="M205 80l25-44 25 44z"/></g>
        <g transform="translate(255 345)"><path d="M0 15L38-5 76 15 38 35Z" fill="#49483b"/><path d="M0 15V44L38 64V35Z" fill="#65543d"/><path d="M38 35L76 15V44L38 64Z" fill="#403d34"/><path d="M0 15L38-5 76 15 38 35Z" fill="url(#gold)"/><path d="M18 17L38 6 58 17 38 28Z" fill="#f4d477"/><path d="M38 6V-25" stroke="#d9c48e" strokeWidth="4"/><path d="M38-25L57-17 38-9Z" fill="#d8b34e"/></g>
        <g className="scene-troops" stroke="#202a2b" strokeWidth="3">
          <g transform="translate(210 260)"><ellipse cx="0" cy="24" rx="17" ry="6" fill="#171b19" stroke="none"/><path d="M-9 0L0-10 9 0 7 17H-7Z" fill="#4779a4"/><circle cy="-15" r="7" fill="#c8b48b"/><path d="M-8-19L0-27 8-19" fill="#8b9eaa"/><path d="M8 2L20-12" stroke="#d7c69b" strokeWidth="4"/></g>
          <g transform="translate(245 286)"><ellipse cx="0" cy="24" rx="17" ry="6" fill="#171b19" stroke="none"/><path d="M-9 0L0-10 9 0 7 17H-7Z" fill="#4779a4"/><circle cy="-15" r="7" fill="#c8b48b"/><path d="M-8-19L0-27 8-19" fill="#8b9eaa"/><path d="M8 2L20-12" stroke="#d7c69b" strokeWidth="4"/></g>
          <g transform="translate(560 185)"><ellipse cx="0" cy="24" rx="17" ry="6" fill="#171b19" stroke="none"/><path d="M-9 0L0-10 9 0 7 17H-7Z" fill="#a74e3c"/><circle cy="-15" r="7" fill="#c8b48b"/><path d="M-8-19L0-27 8-19" fill="#bd8b62"/><path d="M8 2L20-12" stroke="#d7c69b" strokeWidth="4"/></g>
          <g transform="translate(590 210)"><ellipse cx="0" cy="24" rx="17" ry="6" fill="#171b19" stroke="none"/><path d="M-9 0L0-10 9 0 7 17H-7Z" fill="#a74e3c"/><circle cy="-15" r="7" fill="#c8b48b"/><path d="M-8-19L0-27 8-19" fill="#bd8b62"/><path d="M8 2L20-12" stroke="#d7c69b" strokeWidth="4"/></g>
        </g>
        <g className="scene-projectiles"><path d="M270 250Q380 150 510 185" fill="none" stroke="#ffd477" strokeWidth="3" strokeDasharray="7 9"/><path d="M270 250Q380 150 510 185" fill="none" stroke="#fff1ba" strokeWidth="1"/></g>
        <g transform="translate(400 300)"><circle r="24" fill="#e3b85b" opacity=".12"/><path d="M-12 0L0-15 12 0 0 15Z" fill="#f4d178" opacity=".8"/><path d="M0-15V15M-12 0H12" stroke="#fff0b7" strokeWidth="2"/></g>
        <g fill="#e7c36d" fontFamily="sans-serif" fontSize="12" fontWeight="bold"><text x="32" y="34">THE CROWN LANDS</text><text x="32" y="52" fontSize="8" letterSpacing="2" fill="#e1d2ae">KINGDOM TERRITORY</text></g>
      </svg>
      <div className="kingdom-scene-vignette"/>
      <div className="kingdom-scene-caption"><span>{variant === "training" ? "ROYAL TRAINING GROUNDS" : variant === "battle" ? "THE CROWN FRONTIER" : variant === "ranking" ? "REALMS OF THE CROWN" : variant === "social" ? "ALLIANCE TERRITORIES" : "YOUR KINGDOM"}</span><b>{variant === "battle" ? "⚔ LIVE WARFRONT" : variant === "training" ? "✦ PRACTICE FIELD" : "♛ KINGDOM AGE"}</b></div>
    </div>
  );
}
