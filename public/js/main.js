/* ─── State ─────────────────────────────────────────────────── */
let allTeachers = [];
let activeCategory = 'all';
let selectedTeacher = null;
let selectedDate = null;
let selectedSlot = null;

/* ─── Init ──────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // AOS
  if (typeof AOS !== 'undefined') {
    AOS.init({ duration: 700, easing: 'ease-out-cubic', once: true, offset: 60 });
  }

  // GSAP hero entrance
  if (typeof gsap !== 'undefined') {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('#heroEyebrow',  { y: 30, opacity: 0, duration: 0.7 })
      .from('#heroTitle',    { y: 40, opacity: 0, duration: 0.8 }, '-=0.4')
      .from('#heroDesc',     { y: 30, opacity: 0, duration: 0.7 }, '-=0.4')
      .from('#heroActions',  { y: 20, opacity: 0, duration: 0.6 }, '-=0.4')
      .from('#heroVisual',   { scale: 0.85, opacity: 0, duration: 1, ease: 'power3.out' }, '-=0.8')
      .from('#heroBadge1',   { scale: 0, opacity: 0, duration: 0.5, ease: 'back.out(1.7)' }, '-=0.3')
      .from('#heroBadge2',   { scale: 0, opacity: 0, duration: 0.5, ease: 'back.out(1.7)' }, '-=0.3');
  }

  if (document.getElementById('teacherGrid')) {
    loadTeachers();
    setupFilters();
    setupModals();
  }
});

/* ─── Load & render teachers ────────────────────────────────── */
async function loadTeachers() {
  const grid = document.getElementById('teacherGrid');
  try {
    const res = await fetch('/api/teachers');
    allTeachers = await res.json();
    renderGrid(allTeachers);
  } catch (e) {
    grid.innerHTML = '<p style="color:#888;padding:40px 0">Unable to load teachers right now.</p>';
  }
}

function renderGrid(teachers) {
  const grid = document.getElementById('teacherGrid');
  if (!teachers.length) {
    grid.innerHTML = '<p style="color:#888;padding:40px 0;grid-column:1/-1">No teachers found.</p>';
    return;
  }
  grid.innerHTML = teachers.map((t, i) => {
    const initials = t.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
    const photo = t.photo_path
      ? `<img class="teacher-card__photo" src="${t.photo_path}" alt="${t.name}" />`
      : `<div class="teacher-card__photo-placeholder">${initials}</div>`;
    const cats = Array.isArray(t.categories) ? t.categories : [];
    const langs = Array.isArray(t.languages) ? t.languages : [];
    return `
      <div class="teacher-card" data-id="${t.id}" data-categories='${JSON.stringify(cats)}' data-aos="fade-up" data-aos-delay="${i * 60}">
        ${photo}
        <div class="teacher-card__name">${t.name}</div>
        <div class="teacher-card__tags">
          ${cats.map(c => `<span class="tag">${capitalize(c)}</span>`).join('')}
        </div>
        <div class="teacher-card__langs">${langs.join(' · ')}</div>
        <button class="btn btn--outline btn--sm teacher-card__cta">View profile</button>
      </div>
    `;
  }).join('');

  if (typeof AOS !== 'undefined') AOS.refresh();

  grid.querySelectorAll('.teacher-card').forEach(card => {
    card.addEventListener('click', () => openTeacherModal(card.dataset.id));
  });
}

/* ─── Filters ───────────────────────────────────────────────── */
function setupFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
      btn.classList.add('filter-btn--active');
      activeCategory = btn.dataset.category;
      const filtered = activeCategory === 'all'
        ? allTeachers
        : allTeachers.filter(t => (Array.isArray(t.categories) ? t.categories : []).includes(activeCategory));
      renderGrid(filtered);
    });
  });
}

/* ─── Teacher modal ─────────────────────────────────────────── */
function setupModals() {
  document.getElementById('modalClose').addEventListener('click', closeTeacherModal);
  document.getElementById('bookingModalClose').addEventListener('click', closeBookingModal);
  document.getElementById('teacherModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeTeacherModal();
  });
  document.getElementById('bookingModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeBookingModal();
  });
}

async function openTeacherModal(id) {
  const modal = document.getElementById('teacherModal');
  const body = document.getElementById('modalBody');
  body.innerHTML = '<p style="padding:40px;color:#888;text-align:center">Loading...</p>';
  modal.hidden = false;
  document.body.style.overflow = 'hidden';

  const res = await fetch(`/api/teachers/${id}`);
  const t = await res.json();
  selectedTeacher = t;

  const initials = t.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  const photo = t.photo_path
    ? `<img class="modal__photo" src="${t.photo_path}" alt="${t.name}" />`
    : `<div class="modal__photo-placeholder">${initials}</div>`;

  const cats = Array.isArray(t.categories) ? t.categories : [];
  const langs = Array.isArray(t.languages) ? t.languages : [];
  const reviews = t.reviews || [];

  const reviewsHtml = reviews.length
    ? reviews.map(r => `
        <div class="review-item">
          <div class="review-item__stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
          <div class="review-item__name">${r.student_name}</div>
          <div class="review-item__text">${r.review_text}</div>
        </div>
      `).join('')
    : '<p style="color:#888;font-size:14px">No reviews yet.</p>';

  body.innerHTML = `
    ${photo}
    <div class="modal__name">${t.name}</div>
    <div class="modal__tags">
      ${cats.map(c => `<span class="tag">${capitalize(c)}</span>`).join('')}
      ${langs.map(l => `<span class="tag tag--sand">${l}</span>`).join('')}
    </div>
    ${t.laha_endorsement ? `<div class="modal__endorsement">"${t.laha_endorsement}"<br/><small style="font-style:normal;font-weight:700;color:var(--teal)">— Laha Space</small></div>` : ''}
    ${t.bio ? `<div class="modal__section"><h4>About</h4><p>${t.bio}</p></div>` : ''}
    ${t.qualifications ? `<div class="modal__section"><h4>Qualifications</h4><p>${t.qualifications}</p></div>` : ''}
    ${t.experience ? `<div class="modal__section"><h4>Experience</h4><p>${t.experience}</p></div>` : ''}
    <hr class="modal__divider" />
    <div class="modal__section"><h4>Reviews</h4>${reviewsHtml}</div>
    <hr class="modal__divider" />
    <button class="btn btn--primary" style="width:100%" onclick="openBookingFlow()">Book a discovery session</button>
    <hr class="modal__divider" />
    <div class="modal__section"><h4>Leave a review</h4><div id="reviewForm">${buildReviewForm(t.id)}</div></div>
  `;
}

function closeTeacherModal() {
  document.getElementById('teacherModal').hidden = true;
  document.body.style.overflow = '';
  selectedTeacher = null;
}

/* ─── Booking flow ──────────────────────────────────────────── */
async function openBookingFlow() {
  closeTeacherModal();
  const modal = document.getElementById('bookingModal');
  const body = document.getElementById('bookingModalBody');
  selectedDate = null;
  selectedSlot = null;

  body.innerHTML = `
    <div class="booking-title">Book a discovery session</div>
    <div class="booking-teacher">with ${selectedTeacher.name}</div>
    <div class="booking-step-label">Pick a date</div>
    <div class="date-grid" id="dateGrid"><p style="color:#888;font-size:14px">Loading availability...</p></div>
    <div id="slotSection" style="display:none">
      <div class="booking-step-label">Pick a time</div>
      <div class="slot-grid" id="slotGrid"></div>
    </div>
    <div id="bookingFormSection" style="display:none">
      <div class="booking-step-label">Your details</div>
      <div class="form__group"><label class="form__label">Full name *</label><input class="form__input" id="bName" type="text" required /></div>
      <div class="form__group"><label class="form__label">Email *</label><input class="form__input" id="bEmail" type="email" required /></div>
      <div class="form__group"><label class="form__label">Phone / WhatsApp *</label><input class="form__input" id="bPhone" type="text" required /></div>
      <div class="form__group"><label class="form__label">What are you looking for? <span style="color:#888;font-size:13px">(optional)</span></label><input class="form__input" id="bLooking" type="text" placeholder="e.g. Beginner, Tajweed revision..." /></div>
      <div id="bookingError" class="alert alert--error" style="display:none"></div>
      <button class="btn btn--primary" style="width:100%" onclick="submitBooking()">Confirm session</button>
    </div>
  `;

  modal.hidden = false;
  document.body.style.overflow = 'hidden';

  const res = await fetch(`/api/teachers/${selectedTeacher.id}/available-days`);
  const { days } = await res.json();
  const dateGrid = document.getElementById('dateGrid');

  if (!days.length) {
    dateGrid.innerHTML = '<p style="color:#888;font-size:14px">No availability set yet. Please check back later.</p>';
    return;
  }

  dateGrid.innerHTML = days.map(d => {
    const dateObj = new Date(d + 'T00:00:00');
    const label = dateObj.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' });
    return `<button class="date-btn" data-date="${d}">${label}</button>`;
  }).join('');

  dateGrid.querySelectorAll('.date-btn').forEach(btn => {
    btn.addEventListener('click', () => selectDate(btn));
  });
}

async function selectDate(btn) {
  document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('date-btn--active'));
  btn.classList.add('date-btn--active');
  selectedDate = btn.dataset.date;
  selectedSlot = null;

  const slotSection = document.getElementById('slotSection');
  const slotGrid = document.getElementById('slotGrid');
  const formSection = document.getElementById('bookingFormSection');
  slotSection.style.display = 'block';
  formSection.style.display = 'none';
  slotGrid.innerHTML = '<p style="color:#888;font-size:14px">Loading slots...</p>';

  const res = await fetch(`/api/teachers/${selectedTeacher.id}/slots?date=${selectedDate}`);
  const { slots } = await res.json();

  if (!slots.length) {
    slotGrid.innerHTML = '<p style="color:#888;font-size:14px">No slots for this day.</p>';
    return;
  }

  slotGrid.innerHTML = slots.map(s => {
    const label = `${formatTime(s.start)} – ${formatTime(s.end)}`;
    if (!s.available) return `<button class="slot-btn slot-btn--taken" disabled>${label}</button>`;
    return `<button class="slot-btn" data-start="${s.start}" data-end="${s.end}">${label}</button>`;
  }).join('');

  slotGrid.querySelectorAll('.slot-btn:not(.slot-btn--taken)').forEach(btn => {
    btn.addEventListener('click', () => selectSlot(btn));
  });
}

function selectSlot(btn) {
  document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('slot-btn--active'));
  btn.classList.add('slot-btn--active');
  selectedSlot = { start: btn.dataset.start, end: btn.dataset.end };
  document.getElementById('bookingFormSection').style.display = 'block';
  document.getElementById('bookingFormSection').scrollIntoView({ behavior:'smooth', block:'nearest' });
}

async function submitBooking() {
  const name = document.getElementById('bName').value.trim();
  const email = document.getElementById('bEmail').value.trim();
  const phone = document.getElementById('bPhone').value.trim();
  const looking = document.getElementById('bLooking').value.trim();
  const errEl = document.getElementById('bookingError');

  if (!name || !email || !phone) { errEl.textContent = 'Please fill in all required fields.'; errEl.style.display = 'block'; return; }
  if (!selectedSlot) { errEl.textContent = 'Please pick a time slot.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  const res = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teacher_id: selectedTeacher.id, student_name: name, student_email: email, student_phone: phone, slot_date: selectedDate, slot_start: selectedSlot.start, slot_end: selectedSlot.end, looking_for: looking })
  });
  const data = await res.json();

  if (data.success) {
    document.getElementById('bookingModalBody').innerHTML = `
      <div class="booking-success">
        <div class="booking-success__icon">🌿</div>
        <div class="booking-success__title">Session booked!</div>
        <div class="booking-success__text">Your discovery session with ${selectedTeacher.name} on ${formatDateFull(selectedDate)} at ${formatTime(selectedSlot.start)} has been booked. The teacher will be in touch with you shortly. JazakAllahu khairan.</div>
      </div>
    `;
  } else {
    errEl.textContent = data.error || 'Something went wrong. Please try again.';
    errEl.style.display = 'block';
  }
}

function closeBookingModal() {
  document.getElementById('bookingModal').hidden = true;
  document.body.style.overflow = '';
  selectedDate = null;
  selectedSlot = null;
}

/* ─── Review form ───────────────────────────────────────────── */
function buildReviewForm(teacherId) {
  return `
    <div class="form__group" style="margin-top:12px">
      <label class="form__label">Your name</label>
      <input class="form__input" id="rName" type="text" />
    </div>
    <div class="form__group">
      <label class="form__label">Rating</label>
      <div id="starPicker" data-rating="0">
        ${[1,2,3,4,5].map(i => `<span class="star-pick" data-val="${i}" style="font-size:28px;cursor:pointer;color:#DFDFDF;transition:color 0.2s">★</span>`).join('')}
      </div>
      <input type="hidden" id="rRating" value="0" />
    </div>
    <div class="form__group">
      <label class="form__label">Your review</label>
      <textarea class="form__input form__textarea" id="rText" rows="3"></textarea>
    </div>
    <div id="reviewError" class="alert alert--error" style="display:none"></div>
    <div id="reviewSuccess" class="alert alert--success" style="display:none"></div>
    <button class="btn btn--outline btn--sm" onclick="submitReview(${teacherId})">Submit review</button>
  `;
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('star-pick')) {
    const val = parseInt(e.target.dataset.val);
    document.getElementById('rRating').value = val;
    document.querySelectorAll('.star-pick').forEach((s, i) => {
      s.style.color = i < val ? '#D4A574' : '#DFDFDF';
    });
  }
});

async function submitReview(teacherId) {
  const name = document.getElementById('rName')?.value.trim();
  const rating = parseInt(document.getElementById('rRating')?.value || 0);
  const text = document.getElementById('rText')?.value.trim();
  const errEl = document.getElementById('reviewError');
  const sucEl = document.getElementById('reviewSuccess');
  if (!name || !rating || !text) { errEl.textContent = 'Please fill in all fields and select a rating.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';
  const res = await fetch('/api/reviews', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ teacher_id: teacherId, student_name: name, rating, review_text: text }) });
  const data = await res.json();
  if (data.success) {
    sucEl.textContent = 'Thank you! Your review is pending approval.';
    sucEl.style.display = 'block';
    document.getElementById('rName').value = '';
    document.getElementById('rText').value = '';
    document.getElementById('rRating').value = 0;
    document.querySelectorAll('.star-pick').forEach(s => s.style.color = '#DFDFDF');
  } else {
    errEl.textContent = data.error;
    errEl.style.display = 'block';
  }
}

/* ─── Utils ─────────────────────────────────────────────────── */
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function formatTime(t) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2,'0')} ${ampm}`;
}
function formatDateFull(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}
