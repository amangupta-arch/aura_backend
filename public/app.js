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

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

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

const demoBanner = document.getElementById('demo-banner');
fetch('/api/status')
  .then((r) => r.json())
  .then((s) => {
    if (!s.drive_configured) {
      demoBanner.hidden = false;
      demoBanner.textContent =
        'Demo mode: Google Drive is not configured on the server. Uploads will return placeholder links. Set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_DRIVE_FOLDER_ID in Vercel to enable real uploads.';
    }
  })
  .catch(() => {});

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

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });
}

async function compressImage(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  );
  if (!blob) throw new Error('Image compression failed');
  return new File([blob], (file.name || 'image').replace(/\.\w+$/, '') + '.jpg', {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

async function parseResponse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    const snippet = text.slice(0, 140).trim();
    if (res.status === 413) {
      throw new Error('File too large for the server (4.5 MB limit). Try a smaller image.');
    }
    throw new Error(`Server returned ${res.status}: ${snippet || res.statusText}`);
  }
}

async function uploadOne(slot, file) {
  const compressed = await compressImage(file);
  const fd = new FormData();
  fd.append('user_id', userId);
  fd.append(slot, compressed, compressed.name);

  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  const data = await parseResponse(res);
  if (!res.ok) throw new Error(data.error || `Upload failed for ${SLOT_LABELS[slot]}`);
  return data;
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

  submitBtn.disabled = true;
  let lastResult = null;

  try {
    for (let i = 0; i < SLOTS.length; i++) {
      const slot = SLOTS[i];
      const input = form.querySelector(`input[name="${slot}"]`);
      setStatus('', `Uploading ${SLOT_LABELS[slot]} (${i + 1}/${SLOTS.length})…`);
      lastResult = await uploadOne(slot, input.files[0]);
    }
    setStatus('success', 'All six images uploaded and linked.');
    if (lastResult) renderResults(lastResult.links);
  } catch (err) {
    setStatus('error', err.message);
  } finally {
    submitBtn.disabled = false;
  }
});
