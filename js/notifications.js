/* Notifications & Real Alarms Layer */

export async function requestNotificationPermission() {
  if ('Notification' in window) {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  return false;
}

export async function scheduleNotification(id, title, body, dateTimestamp) {
  // Check if running inside Capacitor
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
    try {
      const { LocalNotifications } = window.Capacitor.Plugins;
      await LocalNotifications.requestPermissions();
      
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.abs(hashCode(id)),
            title: title || 'Rappel To-do LIST',
            body: body || 'Vous avez une tâche à effectuer.',
            schedule: { at: new Date(dateTimestamp), allowWhileIdle: true },
            sound: 'alarm.mp3',
            extra: { noteId: id }
          }
        ]
      });
      console.log('Capacitor exact alarm scheduled for:', new Date(dateTimestamp));
      return true;
    } catch (err) {
      console.error('Capacitor notification error:', err);
    }
  }

  // Fallback Web Notification Timer
  const delay = dateTimestamp - Date.now();
  if (delay > 0) {
    setTimeout(() => {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title || 'Rappel To-do LIST', {
          body: body || 'Vous avez une tâche à effectuer.',
          icon: './assets/logo.png',
          vibrate: [200, 100, 200]
        });
      }
    }, delay);
    return true;
  }
  return false;
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
