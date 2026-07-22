/* Views Manager (List, Cards, Grid rendering & Date Grouping) */

import { formatDate, categorizeDateGroup, stripHtml } from './utils.js';

let currentViewMode = localStorage.getItem('todo_view_mode') || 'card-mode'; // list-mode | card-mode | grid-mode

export function getCurrentViewMode() {
  return currentViewMode;
}

export function setViewMode(mode) {
  currentViewMode = mode;
  localStorage.setItem('todo_view_mode', mode);
}

export function renderNotesList(notes, container, onNoteClick) {
  container.innerHTML = '';
  container.className = `view-container ${currentViewMode}`;

  if (!notes || notes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h3>Aucune note pour le moment</h3>
        <p>Appuyez sur le bouton + en bas à droite pour créer votre première note ou liste de tâches.</p>
      </div>
    `;
    return;
  }

  // Sort notes: pinned first, then by updatedAt desc
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updatedAt - a.updatedAt;
  });

  // Group notes by date
  const groups = {
    "Aujourd'hui": [],
    "Ce mois-ci": [],
    "Cette année": [],
    "Plus ancien": []
  };

  sortedNotes.forEach(note => {
    const groupName = categorizeDateGroup(note.updatedAt);
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(note);
  });

  Object.keys(groups).forEach(groupName => {
    const groupNotes = groups[groupName];
    if (groupNotes.length === 0) return;

    const groupEl = document.createElement('div');
    groupEl.className = 'date-group';
    groupEl.innerHTML = `<div class="date-group-header">${groupName} (${groupNotes.length})</div>`;

    const groupContainer = document.createElement('div');
    groupContainer.className = `view-container ${currentViewMode}`;

    groupNotes.forEach(note => {
      const card = createNoteCard(note);
      card.addEventListener('click', () => onNoteClick(note));
      groupContainer.appendChild(card);
    });

    groupEl.appendChild(groupContainer);
    container.appendChild(groupEl);
  });
}

function createNoteCard(note) {
  const card = document.createElement('div');
  card.className = `note-card ${note.pinned ? 'pinned' : ''}`;
  card.setAttribute('data-id', note.id);

  if (note.bgColor) {
    card.style.backgroundColor = note.bgColor;
  }

  const plainContent = stripHtml(note.content || '');
  const taskCount = note.tasks ? note.tasks.length : 0;
  const completedTaskCount = note.tasks ? note.tasks.filter(t => t.completed).length : 0;
  
  let taskBadgeHtml = '';
  if (taskCount > 0) {
    taskBadgeHtml = `<span class="card-badge">☑ ${completedTaskCount}/${taskCount}</span>`;
  }

  let reminderBadgeHtml = '';
  if (note.reminder) {
    reminderBadgeHtml = `<span class="card-badge reminder-badge">⏰ ${formatDate(note.reminder)}</span>`;
  }

  card.innerHTML = `
    <div class="card-header">
      <h3 class="card-title">${escapeHtml(note.title || 'Sans titre')}</h3>
    </div>
    <div class="card-body">
      ${plainContent ? `<p class="card-preview">${escapeHtml(plainContent)}</p>` : ''}
    </div>
    <div class="card-footer">
      <span>${formatDate(note.updatedAt)}</span>
      <div style="display:flex; gap:6px;">
        ${taskBadgeHtml}
        ${reminderBadgeHtml}
      </div>
    </div>
  `;

  return card;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
