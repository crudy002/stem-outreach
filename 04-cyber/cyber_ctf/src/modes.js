// The three difficulty modes, shared by the start screen's picker and the
// leaderboard's tabs so the two can't drift apart.
//
// Runs are ranked per mode, never across modes: ROOKIE taps coloured blocks
// and HARD types every command, so one mixed board would just sort by mode
// and a hard-mode player would never appear near the top. The API enforces
// the same split (see ../../leaderboard-api/main.py).
export const MODES = [
  { id: 'rookie', label: 'ROOKIE', sub: 'Tap blocks' },
  { id: 'easy', label: 'EASY', sub: 'Guided, click-to-explore' },
  { id: 'hard', label: 'HARD', sub: 'Type every command' },
];

export const MODE_LABELS = Object.fromEntries(MODES.map((m) => [m.id, m.label]));

export const modeLabel = (id) => MODE_LABELS[id] || 'UNRANKED';
