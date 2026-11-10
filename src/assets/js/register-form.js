/* Registrační formulář projektu (převzato z původního webu) */

// ═══════════════════════════════════════════
// COUNTRIES & PHONE PREFIXES
// ═══════════════════════════════════════════
const countries = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Argentina","Armenia","Australia","Austria","Azerbaijan",
  "Bahrain","Bangladesh","Belarus","Belgium","Bhutan","Bolivia","Bosnia and Herzegovina","Brazil","Brunei","Bulgaria",
  "Cambodia","Cameroon","Canada","Chile","China","Colombia","Costa Rica","Croatia","Cuba","Cyprus","Czech Republic",
  "Denmark","Dominican Republic","Ecuador","Egypt","Estonia","Ethiopia","Finland","France","Georgia","Germany",
  "Ghana","Greece","Guatemala","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel",
  "Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kuwait","Kyrgyzstan","Latvia","Lebanon","Libya",
  "Liechtenstein","Lithuania","Luxembourg","Malaysia","Maldives","Malta","Mexico","Moldova","Monaco","Mongolia",
  "Montenegro","Morocco","Myanmar","Nepal","Netherlands","New Zealand","Nigeria","North Macedonia","Norway","Oman",
  "Pakistan","Panama","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda",
  "Saudi Arabia","Senegal","Serbia","Singapore","Slovakia","Slovenia","South Africa","South Korea","Spain",
  "Sri Lanka","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Tunisia","Turkey",
  "Turkmenistan","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan",
  "Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"
];

const phonePrefixes = [
  {code:"+420",country:"CZ"},{code:"+421",country:"SK"},{code:"+1",country:"US/CA"},
  {code:"+44",country:"UK"},{code:"+49",country:"DE"},{code:"+43",country:"AT"},
  {code:"+33",country:"FR"},{code:"+39",country:"IT"},{code:"+34",country:"ES"},
  {code:"+31",country:"NL"},{code:"+32",country:"BE"},{code:"+41",country:"CH"},
  {code:"+46",country:"SE"},{code:"+47",country:"NO"},{code:"+45",country:"DK"},
  {code:"+48",country:"PL"},{code:"+36",country:"HU"},{code:"+40",country:"RO"},
  {code:"+359",country:"BG"},{code:"+385",country:"HR"},{code:"+386",country:"SI"},
  {code:"+371",country:"LV"},{code:"+370",country:"LT"},{code:"+372",country:"EE"},
  {code:"+358",country:"FI"},{code:"+353",country:"IE"},{code:"+352",country:"LU"},
  {code:"+356",country:"MT"},{code:"+357",country:"CY"},{code:"+30",country:"GR"},
  {code:"+351",country:"PT"},{code:"+7",country:"RU"},{code:"+380",country:"UA"},
  {code:"+375",country:"BY"},{code:"+90",country:"TR"},{code:"+972",country:"IL"},
  {code:"+971",country:"AE"},{code:"+966",country:"SA"},{code:"+91",country:"IN"},
  {code:"+86",country:"CN"},{code:"+81",country:"JP"},{code:"+82",country:"KR"},
  {code:"+61",country:"AU"},{code:"+64",country:"NZ"},{code:"+55",country:"BR"},
  {code:"+52",country:"MX"},{code:"+54",country:"AR"},{code:"+56",country:"CL"},
  {code:"+27",country:"ZA"},{code:"+234",country:"NG"},{code:"+254",country:"KE"},
  {code:"+65",country:"SG"},{code:"+60",country:"MY"},{code:"+66",country:"TH"},
  {code:"+84",country:"VN"},{code:"+62",country:"ID"},{code:"+63",country:"PH"}
];

// Populate selects
function populateCountrySelects() {
  document.querySelectorAll('select[name*="country"]').forEach(sel => {
    countries.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      sel.appendChild(opt);
    });
  });
}

function populatePhonePrefixes() {
  document.querySelectorAll('#phonePrefix, #phonePrefixPresenter').forEach(sel => {
    phonePrefixes.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.code;
      opt.textContent = `${p.code} ${p.country}`;
      sel.appendChild(opt);
    });
  });
}

populateCountrySelects();
populatePhonePrefixes();

// ═══════════════════════════════════════════
// STEP NAVIGATION
// ═══════════════════════════════════════════
let currentStep = 1;

function goToStep(step) {
  // Validate current step before advancing
  if (step > currentStep && !validateStep(currentStep)) return;

  const panels = document.querySelectorAll('.step-panel');
  const indicators = document.querySelectorAll('.step-indicator');
  const lines = document.querySelectorAll('.step-line');

  panels.forEach(p => p.classList.remove('active'));
  document.querySelector(`[data-panel="${step}"]`).classList.add('active');

  indicators.forEach((ind, i) => {
    const s = i + 1;
    ind.classList.remove('active', 'completed');
    if (s === step) ind.classList.add('active');
    else if (s < step) ind.classList.add('completed');
  });

  lines.forEach((line, i) => {
    line.classList.toggle('done', i < step - 1);
  });

  currentStep = step;
  document.querySelector('.form-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ═══════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════
function validateStep(step) {
  const panel = document.querySelector(`[data-panel="${step}"]`);
  const inputs = panel.querySelectorAll('input[required], select[required], textarea[required]');
  let valid = true;

  inputs.forEach(input => {
    const err = input.closest('.field-group')?.querySelector('.field-error');
    if (!input.value.trim()) {
      input.classList.add('error');
      if (err) err.textContent = 'This field is required';
      valid = false;
    } else if (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
      input.classList.add('error');
      if (err) err.textContent = 'Please enter a valid e-mail address';
      valid = false;
    } else {
      input.classList.remove('error');
      if (err) err.textContent = '';
    }
  });

  // Step 4: check privacy + logo
  if (step === 4) {
    if (!document.getElementById('privacyCheck').checked) {
      valid = false;
      alert('Please agree to the Privacy Policy before submitting.');
    }
  }

  return valid;
}

// Clear errors on input
document.addEventListener('input', e => {
  if (e.target.matches('input, select, textarea')) {
    e.target.classList.remove('error');
    const err = e.target.closest('.field-group')?.querySelector('.field-error');
    if (err) err.textContent = '';
  }
});

// ═══════════════════════════════════════════
// ADD / REMOVE AUTHORS
// ═══════════════════════════════════════════
let authorCount = 1;

document.getElementById('addAuthorCheck').addEventListener('change', function() {
  if (this.checked) addAuthor();
});

function addAuthor() {
  authorCount++;
  const container = document.getElementById('authorsContainer');
  const block = document.createElement('div');
  block.className = 'author-block';
  block.dataset.author = authorCount;
  const n = authorCount;
  block.innerHTML = `
    <div class="author-block-header">
      <span class="author-block-title">Author / Inventor #${n}</span>
      <button type="button" class="remove-author" onclick="removeAuthor(this, ${n})">✕ Remove</button>
    </div>
    <div class="form-row">
      <div class="field-group">
        <label class="field-label">First Name <span class="required">*</span></label>
        <input type="text" name="author_first_${n}" required>
        <div class="field-error"></div>
      </div>
      <div class="field-group">
        <label class="field-label">Last Name <span class="required">*</span></label>
        <input type="text" name="author_last_${n}" required>
        <div class="field-error"></div>
      </div>
    </div>
    <div class="form-row">
      <div class="field-group">
        <label class="field-label">Company / University / Institute <span class="required">*</span></label>
        <input type="text" name="author_company_${n}" required>
        <div class="field-error"></div>
      </div>
      <div class="field-group">
        <label class="field-label">Country <span class="required">*</span></label>
        <select name="author_country_${n}" required>
          <option value="">Select country…</option>
        </select>
        <div class="field-error"></div>
      </div>
    </div>
  `;
  container.appendChild(block);

  // Populate the new country select
  const sel = block.querySelector('select');
  countries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    sel.appendChild(opt);
  });

  // Uncheck the checkbox so they can add another
  document.getElementById('addAuthorCheck').checked = false;
}

function removeAuthor(btn, n) {
  const block = btn.closest('.author-block');
  block.style.opacity = '0';
  block.style.transform = 'translateY(-10px)';
  block.style.transition = 'all 0.3s ease';
  setTimeout(() => block.remove(), 300);
}

// ═══════════════════════════════════════════
// SAME AS PRESENTER
// ═══════════════════════════════════════════
function handleSamePresenter(cb) {
  const notice = document.getElementById('presenterNotice');
  if (cb.checked) {
    const fields = ['first','last','email','phone','company','country'];
    fields.forEach(f => {
      const src = document.querySelector(`[name="contact_${f}"]`);
      const dst = document.querySelector(`[name="presenter_${f}"]`);
      if (src && dst) dst.value = src.value;
    });
    // Phone prefix
    const srcPfx = document.getElementById('phonePrefix');
    const dstPfx = document.getElementById('phonePrefixPresenter');
    if (srcPfx && dstPfx) dstPfx.value = srcPfx.value;
    notice.style.display = 'block';
  } else {
    notice.style.display = 'none';
  }
}

// ═══════════════════════════════════════════
// CHARACTER COUNTERS
// ═══════════════════════════════════════════
const TOTAL_LIMIT = 3600;
const totalFields = ['content_challenge','content_technology','content_commercial','content_development','content_patent','content_further'];

document.addEventListener('input', e => {
  const el = e.target;
  if (el.hasAttribute('data-counter')) {
    const max = parseInt(el.getAttribute('maxlength'));
    const len = el.value.length;
    const counter = el.closest('.field-group').querySelector('.char-counter');
    if (counter) {
      counter.textContent = `${len} / ${max}`;
      counter.className = 'char-counter' + (len > max * 0.9 ? (len >= max ? ' over' : ' warn') : '');
    }
  }

  // Update total bar
  updateTotalBar();
});

function updateTotalBar() {
  let total = 0;
  totalFields.forEach(name => {
    const el = document.querySelector(`[name="${name}"]`);
    if (el) total += el.value.length;
  });
  const pct = Math.min((total / TOTAL_LIMIT) * 100, 100);
  const bar = document.getElementById('totalBar');
  const text = document.getElementById('totalBarText');
  bar.style.width = pct + '%';
  bar.className = 'bar-fill' + (total > TOTAL_LIMIT ? ' over' : (total > TOTAL_LIMIT * 0.9 ? ' warn' : ''));
  text.textContent = `${total.toLocaleString('cs')} / ${TOTAL_LIMIT.toLocaleString('cs')}`;
  text.style.color = total > TOTAL_LIMIT ? 'var(--error)' : '';
}

// ═══════════════════════════════════════════
// FILE UPLOADS
// ═══════════════════════════════════════════
let imageFiles = [];
let logoFile = null;

function setupUploadArea(areaId, listId, isMultiple) {
  const area = document.getElementById(areaId);
  const input = area.querySelector('input[type="file"]');
  const listEl = document.getElementById(listId);

  area.addEventListener('click', () => input.click());
  area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('dragover'); });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.classList.remove('dragover');
    handleFiles(e.dataTransfer.files, isMultiple, listEl, areaId);
  });
  input.addEventListener('change', () => {
    handleFiles(input.files, isMultiple, listEl, areaId);
    input.value = '';
  });
}

function handleFiles(files, isMultiple, listEl, areaId) {
  Array.from(files).forEach(file => {
    if (areaId === 'logoUpload') {
      logoFile = file;
      document.getElementById('logoError').textContent = '';
      renderFileList([file], listEl, false);
    } else {
      imageFiles.push(file);
      renderFileList(imageFiles, listEl, true);
    }
  });
}

function renderFileList(files, listEl, isImages) {
  listEl.innerHTML = '';
  files.forEach((f, i) => {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.innerHTML = `
      <span class="file-item-name">${f.name} (${(f.size/1024).toFixed(0)} KB)</span>
      <button type="button" class="file-remove" onclick="removeFile(${i}, ${isImages})" title="Remove">✕</button>
    `;
    listEl.appendChild(div);
  });
}

function removeFile(index, isImages) {
  if (isImages) {
    imageFiles.splice(index, 1);
    renderFileList(imageFiles, document.getElementById('imagesList'), true);
  } else {
    logoFile = null;
    document.getElementById('logoList').innerHTML = '';
  }
}

setupUploadArea('imagesUpload', 'imagesList', true);
setupUploadArea('logoUpload', 'logoList', false);

// ═══════════════════════════════════════════
// FORM SUBMIT
// ═══════════════════════════════════════════
document.getElementById('pitchForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  if (!validateStep(4)) return;

  // Check total char limit
  let total = 0;
  totalFields.forEach(name => {
    const el = document.querySelector(`[name="${name}"]`);
    if (el) total += el.value.length;
  });
  if (total > TOTAL_LIMIT) {
    alert(`Total character count (${total}) exceeds the limit of ${TOTAL_LIMIT}. Please shorten your texts.`);
    return;
  }

  const btn = document.getElementById('submitBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    // reCAPTCHA je volitelná – načtěte ji na stránce a nastavte window.PRAGUE_BIO.recaptchaSiteKey
    const cfg = window.PRAGUE_BIO || {};
    const token = (window.grecaptcha && cfg.recaptchaSiteKey) ? await grecaptcha.execute(cfg.recaptchaSiteKey, { action: 'submit_pitch' }) : '';

    // Collect form data
    const formData = new FormData(this);
    formData.append('recaptcha_token', token);
    formData.append('author_count', authorCount);

    // Append files
    imageFiles.forEach((f, i) => formData.append(`image_${i}`, f));
    if (logoFile) formData.append('logo_file', logoFile);

    // WordPress AJAX endpoint – funguje automaticky pokud je handler načtený
    // Endpoint nastavte v assets/js/config.js (window.PRAGUE_BIO.pitchFormEndpoint). Bez něj běží demo režim.
    let result = { success: true };
    if (cfg.pitchFormEndpoint) {
      const response = await fetch(cfg.pitchFormEndpoint, { method: 'POST', body: formData });
      result = await response.json();
    } else {
      console.info('[Prague.bio] Formulář není napojený na backend (pitchFormEndpoint). Demo režim – data se neodesílají.');
    }

    if (result.success) {
      document.getElementById('pitchForm').style.display = 'none';
      document.querySelector('.stepper').style.display = 'none';
      document.getElementById('successPanel').classList.add('active');
    } else {
      // Show debug info in console for troubleshooting
      console.error('Submission failed:', result);
      throw new Error(result.message || 'Server error');
    }
  } catch (err) {
    console.error(err);
    document.getElementById('pitchForm').style.display = 'none';
    document.querySelector('.stepper').style.display = 'none';
    document.getElementById('errorPanel').classList.add('active');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
});

function resetToForm() {
  document.getElementById('errorPanel').classList.remove('active');
  document.getElementById('pitchForm').style.display = '';
  document.querySelector('.stepper').style.display = '';
  goToStep(4);
}
