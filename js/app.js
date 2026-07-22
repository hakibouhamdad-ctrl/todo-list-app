/* Main Application Orchestrator */

import { db } from './db.js';
import { renderNotesList, getCurrentViewMode, setViewMode } from './views.js';
import { filterNotes } from './search.js';
import { openEditor, closeEditor, saveCurrentNote, addTaskToCurrentNote, undo, redo, execFormat, triggerImageImport, triggerCamera, triggerOCR, triggerVoiceRecording, insertTable, togglePinCurrentNote, shareCurrentNote, setMainNoteReminder, deleteCurrentNote } from './editor.js';
import { sendAnonymousFeedback } from './feedback.js';
import { initSettings } from './settings.js';
import { showToast } from './utils.js';

let allNotes = [];
let currentRating = 0;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize DB
  await db.init();
  await refreshNotesList();

  // 2. Initialize Settings & Widgets
  initSettings();

  // 3. Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('PWA Service Worker registered successfully.'))
      .catch(err => console.error('Service Worker registration failed:', err));
  }

  // 4. Navigation Handling
  const navTasks = document.getElementById('nav-tasks');
  const navInfos = document.getElementById('nav-infos');
  const secTasks = document.getElementById('sec-tasks');
  const secInfos = document.getElementById('sec-infos');
  const secSettings = document.getElementById('sec-settings');
  const fabBtn = document.getElementById('btn-fab-add');

  navTasks.addEventListener('click', () => {
    switchSection(secTasks, navTasks);
    fabBtn.style.display = 'flex';
  });

  navInfos.addEventListener('click', () => {
    switchSection(secInfos, navInfos);
    fabBtn.style.display = 'none';
  });

  document.getElementById('btn-open-settings').addEventListener('click', () => {
    switchSection(secSettings, null);
    fabBtn.style.display = 'none';
  });

  function switchSection(targetSec, activeNavBtn) {
    [secTasks, secInfos, secSettings].forEach(s => s.classList.remove('active'));
    [navTasks, navInfos].forEach(n => n.classList.remove('active'));

    targetSec.classList.add('active');
    if (activeNavBtn) activeNavBtn.classList.add('active');
  }

  // 5. Header Search Collapsible Bar
  const searchContainer = document.getElementById('search-container');
  const btnToggleSearch = document.getElementById('btn-toggle-search');
  const searchInput = document.getElementById('search-input');

  btnToggleSearch.addEventListener('click', () => {
    const isExpanded = searchContainer.style.width === '100%';
    if (isExpanded) {
      searchContainer.style.width = '42px';
      searchInput.style.display = 'none';
      searchInput.value = '';
      refreshNotesList();
    } else {
      searchContainer.style.width = '100%';
      searchInput.style.display = 'block';
      searchInput.focus();
    }
  });

  searchInput.addEventListener('input', (e) => {
    const filtered = filterNotes(allNotes, e.target.value);
    renderNotesList(filtered, document.getElementById('notes-list-container'), openEditorAndRefresh);
  });

  // 6. View Switcher (List / Cards / Grid)
  const btnSwitchView = document.getElementById('btn-switch-view');
  btnSwitchView.addEventListener('click', () => {
    const current = getCurrentViewMode();
    let nextMode = 'card-mode';
    if (current === 'card-mode') nextMode = 'list-mode';
    else if (current === 'list-mode') nextMode = 'grid-mode';
    else nextMode = 'card-mode';

    setViewMode(nextMode);
    showToast(`Vue : ${getViewModeLabel(nextMode)}`);
    renderNotesList(allNotes, document.getElementById('notes-list-container'), openEditorAndRefresh);
  });

  // 7. FAB (+) Button Create New Note
  fabBtn.addEventListener('click', () => {
    openEditor(null);
  });

  // 8. Editor Event Bindings
  document.getElementById('btn-editor-back').addEventListener('click', async () => {
    await saveCurrentNote();
    closeEditor();
    await refreshNotesList();
  });

  document.getElementById('btn-editor-undo').addEventListener('click', undo);
  document.getElementById('btn-editor-redo').addEventListener('click', redo);

  // Menu Options (⋮)
  const dropdownMenu = document.getElementById('editor-dropdown');
  const btnEditorMenu = document.getElementById('btn-editor-menu');
  
  btnEditorMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('active');
  });

  document.addEventListener('click', () => {
    dropdownMenu.classList.remove('active');
  });

  document.getElementById('menu-opt-pin').addEventListener('click', togglePinCurrentNote);
  document.getElementById('menu-opt-reminder').addEventListener('click', setMainNoteReminder);
  document.getElementById('menu-opt-share').addEventListener('click', shareCurrentNote);
  document.getElementById('menu-opt-delete').addEventListener('click', async () => {
    await deleteCurrentNote();
    await refreshNotesList();
  });

  // Add Task Button
  document.getElementById('btn-add-task-item').addEventListener('click', addTaskToCurrentNote);

  // Toolbar Format Buttons
  document.getElementById('tb-bold').addEventListener('click', () => execFormat('bold'));
  document.getElementById('tb-italic').addEventListener('click', () => execFormat('italic'));
  document.getElementById('tb-underline').addEventListener('click', () => execFormat('underline'));

  document.getElementById('tb-align-left').addEventListener('click', () => execFormat('justifyLeft'));
  document.getElementById('tb-align-center').addEventListener('click', () => execFormat('justifyCenter'));
  document.getElementById('tb-align-right').addEventListener('click', () => execFormat('justifyRight'));

  document.getElementById('tb-ul').addEventListener('click', () => execFormat('insertUnorderedList'));
  document.getElementById('tb-ol').addEventListener('click', () => execFormat('insertOrderedList'));

  document.getElementById('tb-img').addEventListener('click', triggerImageImport);
  document.getElementById('tb-ocr').addEventListener('click', triggerOCR);
  document.getElementById('tb-voice').addEventListener('click', triggerVoiceRecording);
  document.getElementById('tb-table').addEventListener('click', insertTable);

  // 9. Anonymous Star Rating & Feedback Form (EmailJS)
  const starBtns = document.querySelectorAll('.star-btn');
  starBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentRating = parseInt(btn.getAttribute('data-star'));
      starBtns.forEach((b, i) => {
        b.classList.toggle('active', i < currentRating);
      });
    });
  });

  const btnSubmitFeedback = document.getElementById('btn-submit-feedback');
  btnSubmitFeedback.addEventListener('click', async () => {
    const messageInput = document.getElementById('feedback-message');
    const message = messageInput.value.trim();

    if (currentRating === 0) {
      showToast('Veuillez cliquer sur les étoiles pour attribuer une note.', 'danger');
      return;
    }

    btnSubmitFeedback.disabled = true;
    btnSubmitFeedback.innerHTML = '<span>Envoi en cours...</span>';

    try {
      await sendAnonymousFeedback(currentRating, message);
      showToast('Merci pour votre avis ! 🎉', 'success');
      messageInput.value = '';
      currentRating = 0;
      starBtns.forEach(b => b.classList.remove('active'));
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de l\'envoi de votre avis.', 'danger');
    } finally {
      btnSubmitFeedback.disabled = false;
      btnSubmitFeedback.innerHTML = '<span>Valider & Envoyer</span>';
    }
  });

});

async function refreshNotesList() {
  allNotes = await db.getAllNotes();
  const container = document.getElementById('notes-list-container');
  renderNotesList(allNotes, container, openEditorAndRefresh);
}

function openEditorAndRefresh(note) {
  openEditor(note);
}

function getViewModeLabel(mode) {
  if (mode === 'list-mode') return 'Liste Compacte';
  if (mode === 'card-mode') return 'Cartes';
  if (mode === 'grid-mode') return 'Grille 2 Colonnes';
  return '';
}
