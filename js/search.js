/* Search & Filter Component */

import { stripHtml } from './utils.js';

export function filterNotes(notes, query) {
  if (!query || !query.trim()) return notes;

  const q = query.toLowerCase().trim();
  return notes.filter(note => {
    const titleMatch = (note.title || '').toLowerCase().includes(q);
    const contentMatch = stripHtml(note.content || '').toLowerCase().includes(q);
    const taskMatch = note.tasks && note.tasks.some(t => (t.text || '').toLowerCase().includes(q));

    return titleMatch || contentMatch || taskMatch;
  });
}
