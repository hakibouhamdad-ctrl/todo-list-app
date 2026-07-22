/* Settings & Widgets Handler */

import { getCurrentViewMode, setViewMode } from './views.js';
import { showToast } from './utils.js';
import { db } from './db.js';

export function initSettings() {
  const selectView = document.getElementById('setting-default-view');
  if (selectView) {
    selectView.value = getCurrentViewMode();
    selectView.addEventListener('change', (e) => {
      setViewMode(e.target.value);
      showToast('Vue par défaut mise à jour');
    });
  }

  const exportBtn = document.getElementById('btn-export-data');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const notes = await db.getAllNotes();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(notes, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `todo_list_backup_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Sauvegarde exportée avec succès');
    });
  }

  const importInput = document.getElementById('input-import-data');
  if (importInput) {
    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const notes = JSON.parse(event.target.result);
          if (Array.isArray(notes)) {
            for (const note of notes) {
              await db.saveNote(note);
            }
            showToast('Données importées avec succès !', 'success');
            window.location.reload();
          }
        } catch (err) {
          showToast('Fichier JSON invalide', 'danger');
        }
      };
      reader.readAsText(file);
    });
  }
}
