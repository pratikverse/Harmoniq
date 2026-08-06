import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { RecommendResponse } from "../api";
import AddToPlaylistButton from "./AddToPlaylistButton";
import SpotifyEmbed from "./SpotifyEmbed";

export default function RecommendationCard({
  recommendation,
}: {
  recommendation: RecommendResponse["recommendations"][number];
}) {
  const [showDetails, setShowDetails] = useState(false);
  const explanation = recommendation.explanation;
  const activeSources = [
    explanation.source_latent && "latent",
    explanation.source_audio && "audio",
    explanation.source_genre && "genre",
    explanation.source_popularity && "popularity",
  ].filter(Boolean);

  return (
    <article className="rise space-y-3 rounded-md border border-border bg-surface p-4">
      <div>
        <h3 className="font-display text-base font-semibold">{recommendation.track_name}</h3>
        <p className="text-sm text-muted-foreground">{recommendation.artists}</p>
        <p className="text-sm text-muted-foreground">Genre: {recommendation.track_genre}</p>
        <span className="mt-2 inline-block rounded-sm border border-border bg-accent px-2 py-0.5 text-xs text-foreground">
          Popularity {recommendation.popularity}
        </span>
      </div>

      <div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary"
            style={{ width: `${Math.min(Math.max(recommendation.ranking_score, 0), 1) * 100}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {explanation.ranking_score_percent.toFixed(2)}% ranking score | popularity{" "}
          {recommendation.popularity}
        </p>
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        <p className="text-foreground">Why this song was chosen</p>
        <p>{explanation.summary}</p>
        <p>
          Hybrid breakdown: latent {explanation.latent_similarity_percent.toFixed(2)}% | audio{" "}
          {explanation.audio_similarity_percent.toFixed(2)}% | genre{" "}
          {explanation.genre_score_percent.toFixed(2)}% | popularity{" "}
          {explanation.popularity_score_percent.toFixed(2)}% | source support{" "}
          {explanation.source_support_percent.toFixed(2)}%.
        </p>

        {explanation.same_genre ? (
          <p>Genre alignment: exact genre match.</p>
        ) : explanation.same_genre_family ? (
          <p>Genre alignment: matched through a broader genre family.</p>
        ) : null}

        {activeSources.length > 0 && <p>Retrieval sources: {activeSources.join(", ")}.</p>}

        {explanation.top_reasons.length > 0 && (
          <div>
            <p className="text-foreground">Main reasons:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {explanation.top_reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button
        className="inline-flex items-center gap-1 text-xs text-muted-foreground underline decoration-dotted hover:text-foreground"
        onClick={() => setShowDetails((value) => !value)}
      >
        {showDetails ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        {showDetails ? "Hide score details" : "Show score details"}
      </button>

      {showDetails && (
        <div className="space-y-2">
          {[
            ["Latent similarity", explanation.latent_similarity_percent],
            ["Audio similarity", explanation.audio_similarity_percent],
            ["Genre score", explanation.genre_score_percent],
            ["Popularity score", explanation.popularity_score_percent],
            ["Source support", explanation.source_support_percent],
          ].map(([label, value]) => (
            <div key={label as string} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-2 text-xs text-muted-foreground">
              <span>{label}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${value}%` }} />
              </div>
              <span>{(value as number).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}

      {explanation.feature_matches.length > 0 && (
        <div className="text-sm text-muted-foreground">
          <p className="text-foreground">Feature-level similarity:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {explanation.feature_matches.slice(0, 5).map((match) => (
              <li key={match.feature}>
                {match.label}: {(match.closeness * 100).toFixed(1)}% close (difference{" "}
                {match.difference.toFixed(3)})
              </li>
            ))}
          </ul>
        </div>
      )}

      <SpotifyEmbed trackId={recommendation.track_id} />
      <AddToPlaylistButton track={recommendation} />
    </article>
  );
}
