import './ProblemView.css';

interface HintsPanelProps {
  hints: string[];
  openedCount: number;
  onOpenNext: () => void;
}

/** ヒントは配列の順に1段ずつ開く(SPEC.md第6章)。 */
export function HintsPanel({ hints, openedCount, onOpenNext }: HintsPanelProps) {
  if (hints.length === 0) return null;
  return (
    <div className="problem-view__hints">
      <div className="problem-view__block-title">ヒント</div>
      {hints.slice(0, openedCount).map((hint, i) => (
        <p key={i} className="problem-view__hint-text">
          {i + 1}. {hint}
        </p>
      ))}
      {openedCount < hints.length && (
        <button type="button" className="problem-view__hint-button" onClick={onOpenNext}>
          ヒントを見る({openedCount + 1}/{hints.length})
        </button>
      )}
    </div>
  );
}
