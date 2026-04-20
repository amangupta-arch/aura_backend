const SLOTS = [
  'front_face',
  'left_face',
  'right_face',
  'front_body',
  'left_body',
  'right_body',
];

const SLOT_LABELS = {
  front_face: 'Front face',
  left_face: 'Left face',
  right_face: 'Right face',
  front_body: 'Front body',
  left_body: 'Left body',
  right_body: 'Right body',
};

function getOrCreateUserId() {
  let id = localStorage.getItem('aura_user_id');
  if (!id) {
    id =
      (crypto.randomUUID && crypto.randomUUID()) ||
      Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('aura_user_id', id);
  }
  return id;
}

const userId = getOrCreateUserId();
document.getElementById('user-id').textContent = userId;

const form = document.getElementById('upload-form');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const submitBtn = document.getElementById('submit-btn');

form.querySelectorAll('input[type="file"]').forEach((input) => {
  input.addEventListener('change', () => {
    const slot = input.closest('.slot');
    const preview = slot.querySelector('.preview');
    const file = input.files && input.files[0];
    if (!file) {
      slot.classList.remove('has-file');
      preview.style.backgroundImage = '';
      return;
    }
    const url = URL.createObjectURL(file);
    preview.style.backgroundImage = `url(${url})`;
    slot.classList.add('has-file');
  });
});

function setStatus(kind, message) {
  statusEl.hidden = false;
  statusEl.className = `status ${kind}`;
  statusEl.textContent = message;
}

function renderResults(row) {
  resultsEl.hidden = false;
  const items = SLOTS.map((slot) => {
    const link = row[slot];
    const linkHtml = link
      ? `<a href="${link}" target="_blank" rel="noreferrer">${link}</a>`
      : '<span style="color:#6b7588">not uploaded</span>';
    return `<li><span>${SLOT_LABELS[slot]}</span>${linkHtml}</li>`;
  }).join('');

  resultsEl.innerHTML = `
    <h3>Saved for user <code>${row.user_id}</code></h3>
    <ul>${items}</ul>
  `;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const missing = SLOTS.filter((slot) => {
    const input = form.querySelector(`input[name="${slot}"]`);
    return !input.files || !input.files[0];
  });
  if (missing.length > 0) {
    setStatus(
      'error',
      `Please choose an image for: ${missing.map((s) => SLOT_LABELS[s]).join(', ')}`
    );
    return;
  }

  const fd = new FormData();
  fd.append('user_id', userId);
  SLOTS.forEach((slot) => {
    const input = form.querySelector(`input[name="${slot}"]`);
    fd.append(slot, input.files[0]);
  });

  submitBtn.disabled = true;
  setStatus('', 'Uploading to Google Drive...');

  try {
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    setStatus('success', 'All six images uploaded and linked.');
    renderResults(data.links);
  } catch (err) {
    setStatus('error', err.message);
  } finally {
    submitBtn.disabled = false;
  }
});
