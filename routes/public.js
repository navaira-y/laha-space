const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const supabase = require('../database');
const { sendApplicationConfirmation, sendBookingConfirmationStudent, sendBookingNotificationTeacher } = require('../emails');

// ─── asyncHandler ─────────────────────────────────────────────────────────────
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ─── Validation helpers ───────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str);
  return d instanceof Date && !isNaN(d.getTime());
}

// ─── Voice note storage ──────────────────────────────────────────────────────
const voiceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/voice');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '.webm');
  }
});

const uploadVoice = multer({
  storage: voiceStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max for 15 sec audio
  fileFilter: (req, file, cb) => {
    const allowed = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(webm|ogg|mp4|mp3|wav)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format.'));
    }
  }
}).single('voice_note');

// ─── Single multer instance for teacher application ───────────────────────────
// Routes photo → uploads/photos/ and documents → uploads/documents/
// One .fields() call handles both — no nested calls, no "Unexpected field" error
const applicationStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = file.fieldname === 'photo'
      ? path.join(__dirname, '../uploads/photos')
      : path.join(__dirname, '../uploads/documents');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  }
});

const applicationFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.fieldname === 'photo') {
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return cb(null, true);
    return cb(new Error('Photo must be JPG, PNG, or WEBP.'));
  }
  if (file.fieldname === 'documents') {
    if (['.pdf', '.jpg', '.jpeg', '.png', '.docx'].includes(ext)) return cb(null, true);
    return cb(new Error('Documents must be PDF, JPG, PNG, or DOCX.'));
  }
  cb(new Error('Unexpected file field.'));
};

const uploadApplication = multer({
  storage: applicationStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: applicationFilter
}).fields([
  { name: 'photo',     maxCount: 1  },
  { name: 'documents', maxCount: 10 }
]);

// ─── Pages ────────────────────────────────────────────────────────────────────
// Serve teacher photos publicly ONLY if they belong to a published teacher
router.get('/uploads/photos/:filename', async (req, res) => {
  const filename = path.basename(req.params.filename);
  const photoPath = '/uploads/photos/' + filename;

  const { data: teacher } = await supabase.from('teachers')
    .select('id').eq('photo_path', photoPath).eq('is_published', true).maybeSingle();

  if (!teacher) return res.status(404).send('Not found');

  const filePath = path.join(__dirname, '../uploads/photos', filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
  res.sendFile(filePath);
});

router.get('/', (req, res) => res.render('index'));

router.get('/join', (req, res) => res.render('join', { success: false, error: null }));

router.post('/join', (req, res, next) => {
  uploadVoice(req, res, (err) => {
    if (err && err.code !== 'LIMIT_UNEXPECTED_FILE') {
      return res.render('join', { success: false, error: err.message });
    }
    next();
  });
}, ah(async (req, res) => {
  const { name, email, whatsapp, country, age_group, why_join, can_contribute } = req.body;
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!name || name.trim().length < 2) return res.render('join', { success: false, error: 'Please enter your full name.' });
  if (!email || !emailRe.test(email.trim())) return res.render('join', { success: false, error: 'Please enter a valid email address.' });
  if (!whatsapp || whatsapp.trim().length < 6) return res.render('join', { success: false, error: 'Please enter a valid WhatsApp number.' });
  if (!country || country.trim().length < 2) return res.render('join', { success: false, error: 'Please enter your country.' });
  if (!age_group) return res.render('join', { success: false, error: 'Please select your age group.' });
  if (!why_join || why_join.trim().length < 3) return res.render('join', { success: false, error: 'Please tell us what you are looking for.' });

  const voicePath = req.file ? '/admin/voice/' + req.file.filename : null;

  await supabase.from('community_members').insert({
    name: name.trim(),
    email: email.trim(),
    whatsapp: whatsapp.trim(),
    country: country.trim(),
    age_group,
    why_join: why_join.trim(),
    can_contribute: can_contribute?.trim() || null,
    voice_note: voicePath
  });

  res.render('join', { success: true, error: null });
}));
router.get('/apply', (req, res) => res.render('apply', { success: false, error: null }));

router.post('/apply', (req, res, next) => {
  uploadApplication(req, res, (err) => {
    if (err) return res.render('apply', { success: false, error: err.message });
    next();
  });
}, ah(async (req, res) => {
  const { name, email, phone, country_city, qualifications, experience, availability_text, extra_info, timezone } = req.body;
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!name || name.trim().length < 2) return res.render('apply', { success: false, error: 'Please enter your full name.' });
  if (!email || !emailRe.test(email.trim())) return res.render('apply', { success: false, error: 'Please enter a valid email address.' });
  if (!phone || phone.trim().length < 6) return res.render('apply', { success: false, error: 'Please enter a valid phone number.' });
  if (!country_city || country_city.trim().length < 2) return res.render('apply', { success: false, error: 'Please enter your country and city.' });
  const categories = [].concat(req.body.categories || []);
  let languages = [].concat(req.body.languages || []);
  if (languages.includes('Other') && req.body.languages_other?.trim()) {
    languages = languages.filter(l => l !== 'Other');
    languages.push(req.body.languages_other.trim());
  }
  const photoPath = req.files?.photo?.[0] ? '/uploads/photos/' + req.files.photo[0].filename : null;
  if (!photoPath) return res.render('apply', { success: false, error: 'Please upload a photo before submitting.' });

  const { data: applicant, error } = await supabase.from('applicants').insert({
    name, email, phone, country_city,
    photo_path: photoPath,
    qualifications, experience,
    categories, languages,
    availability_text, extra_info,
    extra_info_timezone: timezone || null,
    stage: 1, status: 'active'
  }).select().single();

  if (error) throw error;

  if (req.files?.documents?.length) {
    const docs = req.files.documents.map(f => ({
      applicant_id: applicant.id,
      file_path: '/admin/documents/' + f.filename,
      original_name: f.originalname
    }));
    await supabase.from('applicant_documents').insert(docs);
  }

  // Send confirmation email to teacher (non-blocking)
  sendApplicationConfirmation({ name, email }).catch(err => console.error('Email error:', err));

  res.render('apply', { success: true, error: null });
}));

// ─── Teacher listing API ──────────────────────────────────────────────────────
router.get('/api/teachers', ah(async (req, res) => {
  const { data } = await supabase.from('teachers').select('*').eq('is_published', true);
  res.json(data || []);
}));

router.get('/api/teachers/:id', ah(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ error: 'Invalid teacher ID.' });

  const { data: teacher } = await supabase.from('teachers').select('*')
    .eq('id', req.params.id).eq('is_published', true).single();
  if (!teacher) return res.status(404).json({ error: 'Not found' });

  const { data: reviews } = await supabase.from('reviews').select('*')
    .eq('teacher_id', teacher.id).eq('is_approved', true)
    .order('created_at', { ascending: false });

  res.json({ ...teacher, reviews: reviews || [] });
}));

router.get('/api/teachers/:id/available-days', ah(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ error: 'Invalid teacher ID.' });

  const { data: avail } = await supabase.from('teacher_availability')
    .select('day_of_week').eq('teacher_id', req.params.id);
  if (!avail?.length) return res.json({ days: [] });

  const availDays = new Set(avail.map(a => a.day_of_week));
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 1; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (availDays.has(d.getDay())) days.push(d.toISOString().split('T')[0]);
  }
  res.json({ days });
}));

router.get('/api/teachers/:id/slots', ah(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ error: 'Invalid teacher ID.' });

  const { date } = req.query;
  if (!date || !isValidDate(date))
    return res.status(400).json({ error: 'A valid date is required (YYYY-MM-DD).' });

  const dayOfWeek = new Date(date).getDay();
  const { data: windows } = await supabase.from('teacher_availability')
    .select('*').eq('teacher_id', req.params.id).eq('day_of_week', dayOfWeek);
  if (!windows?.length) return res.json({ slots: [] });

  const allSlots = [];
  for (const w of windows) {
    const [sh, sm] = w.start_time.split(':').map(Number);
    const [eh, em] = w.end_time.split(':').map(Number);
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;
    while (cur + 60 <= end) {
      const s = `${String(Math.floor(cur/60)).padStart(2,'0')}:${String(cur%60).padStart(2,'0')}`;
      const e = `${String(Math.floor((cur+60)/60)).padStart(2,'0')}:${String((cur+60)%60).padStart(2,'0')}`;
      allSlots.push({ start: s, end: e });
      cur += 60;
    }
  }

  const { data: booked } = await supabase.from('bookings')
    .select('slot_start_time').eq('teacher_id', req.params.id)
    .eq('slot_date', date).neq('status', 'cancelled');
  const bookedSet = new Set((booked || []).map(b => b.slot_start_time));

  res.json({ slots: allSlots.map(s => ({ ...s, available: !bookedSet.has(s.start) })) });
}));

// ─── Bookings API — 10 KB body limit ─────────────────────────────────────────
router.post('/api/bookings', express.json({ limit: '10kb' }), ah(async (req, res) => {
  const { teacher_id, student_name, student_email, student_phone, slot_date, slot_start, slot_end, looking_for } = req.body;

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!teacher_id || !student_name || !student_email || !student_phone || !slot_date || !slot_start || !slot_end)
    return res.status(400).json({ error: 'All required fields must be filled.' });
  if (student_name.trim().length < 2)
    return res.status(400).json({ error: 'Please enter your full name.' });
  if (!emailRe.test(student_email.trim()))
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (student_phone.trim().length < 6)
    return res.status(400).json({ error: 'Please enter a valid phone number.' });
  if (!UUID_RE.test(teacher_id))
    return res.status(400).json({ error: 'Invalid teacher.' });
  if (!isValidDate(slot_date))
    return res.status(400).json({ error: 'Invalid date.' });

  const { data: teacher } = await supabase.from('teachers').select('id')
    .eq('id', teacher_id).eq('is_published', true).single();
  if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });

  const { data: conflict } = await supabase.from('bookings').select('id')
    .eq('teacher_id', teacher_id).eq('slot_date', slot_date)
    .eq('slot_start_time', slot_start).neq('status', 'cancelled').maybeSingle();
  if (conflict) return res.status(409).json({ error: 'This slot was just taken. Please pick another time.' });

  await supabase.from('bookings').insert({
    teacher_id, student_name, student_email, student_phone,
    slot_date, slot_start_time: slot_start, slot_end_time: slot_end,
    looking_for: looking_for || null, status: 'pending'
  });

  // Send confirmation to student and notification to teacher (non-blocking)
  const { data: teacher } = await supabase.from('teachers').select('name, email, timezone').eq('id', teacher_id).single();
  if (teacher) {
    sendBookingConfirmationStudent({
      studentName: student_name, studentEmail: student_email,
      teacherName: teacher.name, slotDate: slot_date,
      slotStart: slot_start, slotEnd: slot_end, teacherTimezone: teacher.timezone
    }).catch(err => console.error('Email error:', err));

    sendBookingNotificationTeacher({
      teacherName: teacher.name, teacherEmail: teacher.email,
      studentName: student_name, studentEmail: student_email,
      studentPhone: student_phone, slotDate: slot_date,
      slotStart: slot_start, slotEnd: slot_end, lookingFor: looking_for
    }).catch(err => console.error('Email error:', err));
  }

  res.json({ success: true });
}));

// ─── Reviews API — 10 KB body limit ──────────────────────────────────────────
router.post('/api/reviews', express.json({ limit: '10kb' }), ah(async (req, res) => {
  const { teacher_id, student_name, rating, review_text } = req.body;

  if (!teacher_id || !student_name || !rating || !review_text)
    return res.status(400).json({ error: 'All fields are required.' });
  if (!UUID_RE.test(teacher_id))
    return res.status(400).json({ error: 'Invalid teacher.' });

  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5)
    return res.status(400).json({ error: 'Rating must be between 1 and 5.' });

  const { data: teacher } = await supabase.from('teachers').select('id')
    .eq('id', teacher_id).eq('is_published', true).single();
  if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });

  await supabase.from('reviews').insert({
    teacher_id, student_name, rating: ratingNum, review_text, is_approved: false
  });
  res.json({ success: true });
}));

module.exports = router;
