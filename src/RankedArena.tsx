import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

type MatchmakingProps = {
  authStatus: "connecting" | "online" | "offline" | "error";
};

type MatchResult = {
  match_found: boolean;
  match_id: string | null;
  opponent_id: string | null;
  opponent_rating: number | null;
  opponent_combat_power: number | null;
};

type ReadyResult = {
  match_status: "matched" | "active" | "completed" | "cancelled";
  player_one_ready: boolean;
  player_two_ready: boolean;
  started_at: string | null;
  state_version: number;
};

type BattleState = {
  match_status: "active" | "completed" | "cancelled" | "matched";
  remaining_seconds: number;
  own_state: { health?: number; energy?: number; ultimate?: number; base_health?: number; gold?: number };
  opponent_state: { health?: number; energy?: number; ultimate?: number; base_health?: number; gold?: number };
  state_version: number;
  winner_id: string | null;
  last_event: string;
};

type SearchState = "idle" | "searching" | "matched" | "error";

export default function RankedArena({ authStatus }: MatchmakingProps) {
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [readyState, setReadyState] = useState<ReadyResult | null>(null);
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [readyLoading, setReadyLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function checkForMatch() {
    const client = supabase;
    if (!client || authStatus !== "online") {
      setSearchState("error");
      setErrorMessage("Connect your online profile before entering Ranked.");
      return;
    }
    const { data, error } = await client.rpc("queue_ranked_match");
    if (error) {
      console.error("Ranked matchmaking failed:", error);
      setSearchState("error");
      setErrorMessage(error.message || "Could not enter the Ranked queue.");
      return;
    }
    const result = (Array.isArray(data) ? data[0] : data) as MatchResult | null;
    if (result?.match_found && result.match_id) {
      setMatch(result);
      setSearchState("matched");
      setErrorMessage("");
      return;
    }
    setSearchState("searching");
    setErrorMessage("");
  }

  useEffect(() => {
    if (searchState !== "searching") return;
    const timer = window.setInterval(() => { void checkForMatch(); }, 5000);
    return () => window.clearInterval(timer);
  }, [searchState, authStatus]);

  async function confirmReady() {
    if (!supabase || !match?.match_id || readyLoading) return;
    setReadyLoading(true);
    setErrorMessage("");
    const { data, error } = await supabase.rpc("ready_ranked_match", {
      p_match_id: match.match_id,
    });
    setReadyLoading(false);
    if (error) {
      console.error("Ranked ready check failed:", error);
      setErrorMessage(error.message || "Could not confirm readiness.");
      return;
    }
    const result = (Array.isArray(data) ? data[0] : data) as ReadyResult | null;
    if (result) setReadyState(result);
  }

  async function performAction(action: "sync" | "mine" | "emp_strike") {
    if (!supabase || !match?.match_id || actionLoading) return;
    if (action !== "sync") setActionLoading(true);
    const { data, error } = await supabase.rpc("perform_ranked_action", {
      p_match_id: match.match_id,
      p_action: action,
    });
    if (action !== "sync") setActionLoading(false);
    if (error) {
      if (action !== "sync") setErrorMessage(error.message || "Battle action failed.");
      return;
    }
    const result = (Array.isArray(data) ? data[0] : data) as BattleState | null;
    if (result) {
      setBattleState(result);
      if (result.match_status === "completed" || result.match_status === "cancelled") {
        setReadyState((previous) => previous ? { ...previous, match_status: result.match_status } : previous);
      }
      if (action !== "sync") setErrorMessage("");
    }
  }

  const battleStarted = readyState?.match_status === "active" || battleState?.match_status === "active";

  useEffect(() => {
    if (!battleStarted || !match?.match_id) return;
    void performAction("sync");
    const timer = window.setInterval(() => { void performAction("sync"); }, 2000);
    return () => window.clearInterval(timer);
  }, [battleStarted, match?.match_id]);

  function startSearch() {
    setMatch(null);
    setReadyState(null);
    setBattleState(null);
    setErrorMessage("");
    void checkForMatch();
  }

  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

  const own = battleState?.own_state;
  const opponent = battleState?.opponent_state;
  const completed = battleState?.match_status === "completed";

  return (
    <section className="ranked-arena">
      <div className="ranked-arena-visual" aria-hidden="true">⚔️</div>
      <span className="section-kicker">RANKED • SEASON ZERO</span>
      <h2>Gold Duel</h2>
      <p>Challenge a real player in a five-minute server-created duel. Opponents are selected by rating and combat power.</p>

      <div className="ranked-spec-grid">
        <div><span>MATCH TYPE</span><strong>1 vs 1</strong></div>
        <div><span>DURATION</span><strong>05:00</strong></div>
        <div><span>QUEUE</span><strong>LIVE</strong></div>
      </div>

      {searchState === "matched" && match && (
        <div className="ranked-match-result" role="status">
          <strong>{battleStarted ? "BATTLE STARTED" : "OPPONENT FOUND"}</strong>
          <span>Opponent rating: {match.opponent_rating ?? "—"} RP</span>
          <small>Match ID: {match.match_id}</small>
          {readyState && !battleStarted && (
            <p>{readyState.player_one_ready && readyState.player_two_ready
              ? "Both players are ready. Starting battle..."
              : readyState.player_one_ready || readyState.player_two_ready
                ? "Waiting for the other player to confirm readiness."
                : "Both players must confirm readiness to start."}</p>
          )}
          {!battleStarted && (
            <button className="ranked-search-button" onClick={() => void confirmReady()} disabled={readyLoading}>
              {readyLoading ? "CONFIRMING..." : "I'M READY"}
            </button>
          )}
        </div>
      )}

      {battleStarted && battleState && (
        <div className="ranked-match-result" aria-live="polite">
          <strong>{completed ? "MATCH COMPLETED" : "LIVE BATTLE"}</strong>
          <div className="ranked-spec-grid">
            <div><span>TIME LEFT</span><strong>{formatTime(battleState.remaining_seconds)}</strong></div>
            <div><span>YOUR BASE</span><strong>{own?.base_health ?? 1000}</strong></div>
            <div><span>ENEMY BASE</span><strong>{opponent?.base_health ?? 1000}</strong></div>
          </div>
          <p>Energy: {Math.floor(own?.energy ?? 100)} / 100 · Ultimate: {Math.floor(own?.ultimate ?? 0)} / 100 · Gold: {own?.gold ?? 0}</p>
          {!completed ? (
            <div className="ranked-battle-actions">
              <button className="ranked-search-button" onClick={() => void performAction("mine")} disabled={actionLoading}>
                {actionLoading ? "PROCESSING..." : "MINE +15 GOLD"}
              </button>
              <button className="ranked-search-button" onClick={() => void performAction("emp_strike")} disabled={actionLoading}>
                EMP STRIKE · 35 ENERGY + 25 ULT
              </button>
            </div>
          ) : (
            <p>{battleState.winner_id ? battleState.winner_id === match?.opponent_id ? "Opponent wins." : "You win!" : "Draw — equal result."}</p>
          )}
        </div>
      )}

      {searchState === "searching" && (
        <div className="ranked-search-status" role="status">
          <span className="search-pulse" />
          <div><strong>SEARCHING FOR OPPONENT</strong><small>Checking the live queue every 5 seconds. Keep this screen open.</small></div>
        </div>
      )}

      {searchState === "error" && <div className="notice-card" role="alert">{errorMessage}</div>}
      {errorMessage && searchState === "matched" && <div className="notice-card" role="alert">{errorMessage}</div>}

      <button
        className="ranked-search-button"
        onClick={startSearch}
        disabled={authStatus !== "online" || searchState === "searching" || searchState === "matched"}
      >
        {searchState === "searching" ? "SEARCHING..." : searchState === "matched" ? "MATCH CREATED" : searchState === "error" ? "TRY AGAIN" : "FIND RANKED OPPONENT"}
      </button>

      {authStatus !== "online" && <div className="notice-card">Your online profile must be connected to enter Ranked matchmaking.</div>}
      <div className="notice-card">Ranked matches, readiness, resource regeneration, mining, EMP damage and victory checks are server-authoritative. This is the first playable combat loop; more abilities and defense systems will follow.</div>
    </section>
  );
}
