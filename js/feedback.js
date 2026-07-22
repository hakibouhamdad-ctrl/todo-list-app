/* Anonymous Feedback Layer using EmailJS */

const EMAILJS_SERVICE_ID = 'service_tm73bul';
const EMAILJS_TEMPLATE_ID = 'template_hv103dt';
const EMAILJS_PUBLIC_KEY = 'v4rb0jkFBF0lZQBaE';

export async function sendAnonymousFeedback(rating, message) {
  if (!rating || rating === 0) {
    throw new Error('Veuillez sélectionner au moins une étoile.');
  }

  // Load EmailJS SDK dynamically if not loaded
  if (typeof emailjs === 'undefined') {
    await loadScript('https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js');
  }

  emailjs.init({
    publicKey: EMAILJS_PUBLIC_KEY
  });

  const templateParams = {
    rating: rating.toString(),
    message: message || '(Aucun commentaire rédigé)',
    to_email: 'hakibouhamdad@gmail.com'
  };

  const response = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
  return response;
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
