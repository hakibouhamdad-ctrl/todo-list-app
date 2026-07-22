/* Dynamic Note & Task Editor Module */

import { generateId, showToast, formatDate } from './utils.js';
import { db } from './db.js';
import { scheduleNotification } from './notifications.js';

let currentNote = null;
let undoStack = [];
let redoStack = [];

export function openEditor(note = null) {
  currentNote = note ? JSON.parse(JSON.stringify(note)) : {
    id: generateId(),
    title: '',
    content: '',
    tasks: [],
    pinned: false,
    locked: false,
    bgColor: '#121212',
    reminder: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const editorEl = document.getElementById('editor-page');
  const titleInput = document.getElementById('editor-title');
  const noteBody = document.getElementById('editor-note-body');
  const tasksContainer = document.getElementById('editor-tasks-container');

  titleInput.value = currentNote.title || '';
  noteBody.innerHTML = currentNote.content || '';
  
  if (currentNote.bgColor) {
    editorEl.style.backgroundColor = currentNote.bgColor;
  } else {
    editorEl.style.backgroundColor = '#000000';
  }

  renderEditorTasks(currentNote.tasks || []);

  editorEl.classList.add('open');
  titleInput.focus();

  saveHistoryState();
}

export function closeEditor() {
  const editorEl = document.getElementById('editor-page');
  editorEl.classList.remove('open');
  currentNote = null;
}

export async function saveCurrentNote() {
  if (!currentNote) return;

  const titleInput = document.getElementById('editor-title');
  const noteBody = document.getElementById('editor-note-body');

  currentNote.title = titleInput.value.trim();
  currentNote.content = noteBody.innerHTML;
  currentNote.updatedAt = Date.now();

  // If title & content & tasks are all empty, delete note
  const hasContent = currentNote.title || currentNote.content.trim() || (currentNote.tasks && currentNote.tasks.length > 0);
  
  if (!hasContent) {
    await db.deleteNote(currentNote.id);
  } else {
    await db.saveNote(currentNote);
    showToast('Note enregistrée', 'success');
  }
}

function renderEditorTasks(tasks) {
  const container = document.getElementById('editor-tasks-container');
  container.innerHTML = '';

  tasks.forEach((task, index) => {
    const taskEl = document.createElement('div');
    taskEl.className = `task-item ${task.completed ? 'completed' : ''}`;
    taskEl.setAttribute('data-index', index);

    taskEl.innerHTML = `
      <div class="task-checkbox" data-action="toggle-task">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <input type="text" class="task-input" value="${escapeAttr(task.text)}" placeholder="Description de la tâche...">
      <div class="task-actions">
        <button class="task-clock-btn ${task.reminder ? 'has-reminder' : ''}" data-action="set-task-reminder" title="Rappel">
          ⏰
        </button>
        <button class="task-delete-btn" data-action="delete-task" title="Supprimer">
          ✕
        </button>
      </div>
    `;

    // Task Checkbox Toggle
    taskEl.querySelector('[data-action="toggle-task"]').addEventListener('click', () => {
      task.completed = !task.completed;
      taskEl.classList.toggle('completed', task.completed);
      saveHistoryState();
    });

    // Task Input Change
    const input = taskEl.querySelector('.task-input');
    input.addEventListener('input', (e) => {
      task.text = e.target.value;
    });

    // Task Reminder Clock
    taskEl.querySelector('[data-action="set-task-reminder"]').addEventListener('click', () => {
      showDateTimePicker((datetime) => {
        task.reminder = datetime;
        scheduleNotification(currentNote.id + '_' + index, `Tâche : ${task.text}`, currentNote.title || 'To-do LIST', datetime);
        showToast(`Rappel configuré pour ${formatDate(datetime)}`);
        renderEditorTasks(currentNote.tasks);
      });
    });

    // Task Delete
    taskEl.querySelector('[data-action="delete-task"]').addEventListener('click', () => {
      currentNote.tasks.splice(index, 1);
      renderEditorTasks(currentNote.tasks);
      saveHistoryState();
    });

    container.appendChild(taskEl);
  });
}

export function addTaskToCurrentNote() {
  if (!currentNote) return;
  if (!currentNote.tasks) currentNote.tasks = [];

  currentNote.tasks.push({
    id: generateId(),
    text: '',
    completed: false,
    reminder: null
  });

  renderEditorTasks(currentNote.tasks);
  
  // Focus new task input
  const inputs = document.querySelectorAll('.task-input');
  if (inputs.length > 0) {
    inputs[inputs.length - 1].focus();
  }
}

/* History Undo / Redo */
function saveHistoryState() {
  if (!currentNote) return;
  const snapshot = JSON.stringify(currentNote);
  if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== snapshot) {
    undoStack.push(snapshot);
    if (undoStack.length > 30) undoStack.shift();
    redoStack = [];
  }
}

export function undo() {
  if (undoStack.length > 1) {
    redoStack.push(undoStack.pop());
    const prevState = JSON.parse(undoStack[undoStack.length - 1]);
    currentNote = prevState;
    updateEditorUI();
  }
}

export function redo() {
  if (redoStack.length > 0) {
    const nextState = JSON.parse(redoStack.pop());
    undoStack.push(JSON.stringify(nextState));
    currentNote = nextState;
    updateEditorUI();
  }
}

function updateEditorUI() {
  document.getElementById('editor-title').value = currentNote.title || '';
  document.getElementById('editor-note-body').innerHTML = currentNote.content || '';
  renderEditorTasks(currentNote.tasks || []);
}

/* Toolbar Format Commands */
export function execFormat(command, value = null) {
  document.execCommand(command, false, value);
  saveHistoryState();
}

/* Advanced Features: Image, Camera, OCR, Voice, Table */
export function triggerImageImport() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      insertImageToEditor(event.target.result);
    };
    reader.readAsDataURL(file);
  };
  fileInput.click();
}

export async function triggerCamera() {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Camera) {
    try {
      const { Camera, CameraResultType } = window.Capacitor.Plugins;
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl
      });
      insertImageToEditor(image.dataUrl);
      return;
    } catch (err) {
      console.warn('Capacitor Camera fallback:', err);
    }
  }
  triggerImageImport();
}

function insertImageToEditor(dataUrl) {
  const noteBody = document.getElementById('editor-note-body');
  const imgHtml = `<div class="editor-media-preview" contenteditable="false"><img src="${dataUrl}" /><button class="editor-media-remove" onclick="this.parentElement.remove()">✕</button></div><p></p>`;
  noteBody.innerHTML += imgHtml;
  saveHistoryState();
}

/* OCR Recognition via Tesseract.js */
export function triggerOCR() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    showToast('Analyse du texte dans l\'image (OCR)...');

    // Load Tesseract dynamically
    if (typeof Tesseract === 'undefined') {
      await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
    }

    try {
      const result = await Tesseract.recognize(file, 'fra+eng');
      const text = result.data.text;
      const noteBody = document.getElementById('editor-note-body');
      noteBody.innerHTML += `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
      showToast('Texte extrait avec succès !', 'success');
      saveHistoryState();
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de l\'extraction OCR', 'danger');
    }
  };
  fileInput.click();
}

/* Voice Recording to Text */
export function triggerVoiceRecording() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('Reconnaissance vocale non supportée par votre navigateur', 'danger');
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'fr-FR';
  recognition.interimResults = false;

  showToast('Parlez maintenant... 🎤');

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const noteBody = document.getElementById('editor-note-body');
    noteBody.innerHTML += ` ${escapeHtml(transcript)}`;
    showToast('Dictée insérée !', 'success');
    saveHistoryState();
  };

  recognition.onerror = () => {
    showToast('Erreur d\'écoute vocale', 'danger');
  };

  recognition.start();
}

/* Table Insertion */
export function insertTable() {
  const tableHtml = `
    <table class="editor-table">
      <tr><th>Entête 1</th><th>Entête 2</th></tr>
      <tr><td>Donnée 1</td><td>Donnée 2</td></tr>
    </table>
    <p></p>
  `;
  const noteBody = document.getElementById('editor-note-body');
  noteBody.innerHTML += tableHtml;
  saveHistoryState();
}

/* Three Dots Context Menu Actions */
export function togglePinCurrentNote() {
  if (!currentNote) return;
  currentNote.pinned = !currentNote.pinned;
  showToast(currentNote.pinned ? 'Note épinglée 📌' : 'Note désépinglée');
}

export function shareCurrentNote() {
  if (!currentNote) return;
  const title = currentNote.title || 'Note';
  const text = currentNote.title + '\n\n' + (document.getElementById('editor-note-body').innerText || '');

  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share) {
    window.Capacitor.Plugins.Share.share({ title, text });
  } else if (navigator.share) {
    navigator.share({ title, text });
  } else {
    navigator.clipboard.writeText(text);
    showToast('Texte copié dans le presse-papier !');
  }
}

export function setMainNoteReminder() {
  showDateTimePicker((datetime) => {
    currentNote.reminder = datetime;
    scheduleNotification(currentNote.id, currentNote.title || 'Rappel', 'Aperçu de votre note To-do LIST', datetime);
    showToast(`Rappel configuré pour ${formatDate(datetime)}`);
  });
}

export async function deleteCurrentNote() {
  if (!currentNote) return;
  if (confirm('Voulez-vous vraiment supprimer cette note ?')) {
    await db.deleteNote(currentNote.id);
    showToast('Note supprimée', 'danger');
    closeEditor();
  }
}

/* Date Time Picker Modal Helper */
function showDateTimePicker(callback) {
  const modalHtml = `
    <div class="modal-overlay active" id="datetime-modal">
      <div class="modal-box">
        <div class="modal-header">
          <h3 class="modal-title">Programmer un rappel ⏰</h3>
          <button class="icon-btn" onclick="document.getElementById('datetime-modal').remove()">✕</button>
        </div>
        <div style="margin: 16px 0;">
          <input type="datetime-local" id="dt-picker" style="width:100%; padding:12px; background:var(--bg-input); color:#fff; border:1px solid var(--border-color); border-radius:var(--radius-md); font-size:1rem;">
        </div>
        <button class="btn-submit-feedback" id="btn-save-dt">Valider l'alarme</button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById('btn-save-dt').addEventListener('click', () => {
    const val = document.getElementById('dt-picker').value;
    if (val) {
      callback(new Date(val).getTime());
      document.getElementById('datetime-modal').remove();
    } else {
      showToast('Veuillez choisir une date et heure valide.');
    }
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(str) {
  return (str || '').replace(/"/g, "&quot;");
}
