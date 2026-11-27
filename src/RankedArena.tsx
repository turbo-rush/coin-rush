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

type SearchState = "idle" | "searching" | "matched" | "error";

export default function RankedArena({ authStatus }: MatchmakingProps) {
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [readyState, setReadyState] = useState<ReadyResult | null>(null);
  const [readyLoading, setReadyLoading] = useState(false);
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

  function startSearch() {
    setMatch(null);
    setReadyState(null);
    setErrorMessage("");
    void checkForMatch();
  }

  const battleStarted = readyState?.match_status === "active";

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
          {battleStarted && <p>Server started the five-minute match. Battle actions are the next development step.</p>}
          {!battleStarted && (
            <button className="ranked-search-button" onClick={() => void confirmReady()} disabled={readyLoading}>
              {readyLoading ? "CONFIRMING..." : readyState?.player_one_ready || readyState?.player_two_ready ? "UPDATE READY STATUS" : "I'M READY"}
            </button>
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
      <div className="notice-card">Real-player matchmaking and server-side readiness are live. The server starts the match only after both players confirm. Combat actions are still in development.</div>
    </section>
  );
}
