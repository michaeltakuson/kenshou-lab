import { useState } from 'react';
import './ProblemView.css';

interface StuckNoteInputProps {
  /** 自力クリアのときは控えめに、それ以外のときははっきり促す(SPEC.md第6章)。 */
  emphasize: boolean;
  initialValue: string | null;
  onSave: (note: string) => void;
}

export function StuckNoteInput({ emphasize, initialValue, onSave }: StuckNoteInputProps) {
  const [note, setNote] = useState(initialValue ?? '');
  const [saved, setSaved] = useState(false);

  return (
    <div className={`problem-view__stuck-note ${emphasize ? 'problem-view__stuck-note--emphasize' : ''}`}>
      <label htmlFor="stuck-note">
        {emphasize
          ? 'どこで詰まり、どう解決しましたか？(次に活かせます。省略もできます)'
          : 'どこで詰まり、どう解決しましたか？(任意)'}
      </label>
      <textarea
        id="stuck-note"
        rows={2}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setSaved(false);
        }}
      />
      <button
        type="button"
        onClick={() => {
          onSave(note);
          setSaved(true);
        }}
        disabled={note.trim().length === 0}
      >
        {saved ? '保存しました' : '記録する'}
      </button>
    </div>
  );
}
