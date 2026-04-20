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

function newId() {
  return (crypto.randomUUID && crypto.randomUUID()) ||
    Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getOrCreateUserId() {
  let id = localStorage.getItem('aura_user_id');
  if (!id) {
    id = newId();
    localStorage.setItem('aura_user_id', id);
  }
  return id;
}

let userId = getOrCreateUserId();
const userIdEl = document.getElementById('user-id');
userIdEl.textContent = userId;

const demoBanner = document.getElementById('demo-banner');
fetch('/api/status')
  .then((r) => r.json())
  .then((s) => {
    if (!s.storage_configured) {
      demoBanner.hidden = false;
      demoBanner.textContent =
        'Server is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel to enable uploads.';
    }
  })
  .catch(() => {});

const form = document.getElementById('upload-form');
const statusEl = document.getElementById('status');
const submitBtn = document.getElementById('submit-btn');
const modal = document.getElementById('success-modal');
const newUploadBtn = document.getElementById('new-upload-btn');

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

function clearStatus() {
  statusEl.hidden = true;
  statusEl.textContent = '';
  statusEl.className = 'status';
}

function showSuccessModal() {
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
}

function hideSuccessModal() {
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
}

function resetForm() {
  form.reset();
  form.querySelectorAll('.slot').forEach((slot) => {
    slot.classList.remove('has-file');
    const preview = slot.querySelector('.preview');
    if (preview) preview.style.backgroundImage = '';
  });
  clearStatus();
  userId = newId();
  localStorage.setItem('aura_user_id', userId);
  userIdEl.textContent = userId;
}

newUploadBtn.addEventListener('click', () => {
  hideSuccessModal();
  resetForm();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
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

  try {
    for (let i = 0; i < SLOTS.length; i++) {
      const slot = SLOTS[i];
      const input = form.querySelector(`input[name="${slot}"]`);
      setStatus('', `Uploading ${SLOT_LABELS[slot]} (${i + 1}/${SLOTS.length})…`);
      await uploadOne(slot, input.files[0]);
    }
    clearStatus();
    showSuccessModal();
  } catch (err) {
    setStatus('error', err.message);
  } finally {
    submitBtn.disabled = false;
  }
});
