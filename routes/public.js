const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const supabase = require('../database');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', (req, res) => res.render('index'));

router.get('/apply', (req, res) => res.render('apply', { success: false, error: null }));

router.post('/apply', upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'documents', maxCount: 10 }
]), async (req, res) => {
  try {
    const { name, email, phone, country_city, qualifications, experience, availability_text, extra_info } = req.body;
    const categories = [].concat(req.body.categories || []);
    const languages = [].concat(req.body.languages || []);
    const photoPath = req.files?.photo?.[0] ? '/uploads/' + req.files.photo[0].filename : null;

    const { data: applicant, error } = await supabase.from('applicants').insert({
      name, email, phone, country_city,
      photo_path: photoPath,
      qualifications, experience,
      categories, languages,
      availability_text, extra_info,
      stage: 1, status: 'active'
    }).select().single();

    if (error) throw error;

    if (req.files?.documents) {
      const docs = req.files.documents.map(f => ({
        applicant_id: applicant.id,
        file_path: '/uploads/' + f.filename,
        original_name: f.originalname
      }));
      await supabase.from('applicant_documents').insert(docs);
    }

    res.render('apply', { success: true, error: null });
  } catch (err) {
    console.error(err);
    res.render('apply', { success: false, error: 'Something went wrong. Please try again.' });
  }
});

router.get('/api/teachers', async (req, res) => {
  const { data } = await supabase.from('teachers').select('*').eq('is_published', true);
  res.json(data || []);
});

router.get('/api/teachers/:id', async (req, res) => {
  const { data: teacher } = await supabase.from('teachers').select('*')
    .eq('id', req.params.id).eq('is_published', true).single();
  if (!teacher) return res.status(404).json({ error: 'Not found' });

  const { data: reviews } = await supabase.from('reviews').select('*')
    .eq('teacher_id', teacher.id).eq('is_approved', true).order('created_at', { ascending: false });

  res.json({ ...teacher, reviews: reviews || [] });
});

router.get('/api/teachers/:id/available-days', async (req, res) => {
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
});

router.get('/api/teachers/:id/slots', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Date required' });

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
});

router.post('/api/bookings', express.json(), async (req, res) => {
  const { teacher_id, student_name, student_email, student_phone, slot_date, slot_start, slot_end, looking_for } = req.body;
  if (!teacher_id || !student_name || !student_email || !student_phone || !slot_date || !slot_start || !slot_end)
    return res.status(400).json({ error: 'All required fields must be filled.' });

  const { data: conflict } = await supabase.from('bookings').select('id')
    .eq('teacher_id', teacher_id).eq('slot_date', slot_date)
    .eq('slot_start_time', slot_start).neq('status', 'cancelled').single();
  if (conflict) return res.status(409).json({ error: 'This slot was just taken. Please pick another time.' });

  await supabase.from('bookings').insert({
    teacher_id, student_name, student_email, student_phone,
    slot_date, slot_start_time: slot_start, slot_end_time: slot_end,
    looking_for: looking_for || null, status: 'pending'
  });
  res.json({ success: true });
});

router.post('/api/reviews', express.json(), async (req, res) => {
  const { teacher_id, student_name, rating, review_text } = req.body;
  if (!teacher_id || !student_name || !rating || !review_text)
    return res.status(400).json({ error: 'All fields are required.' });
  if (rating < 1 || rating > 5)
    return res.status(400).json({ error: 'Rating must be between 1 and 5.' });

  await supabase.from('reviews').insert({ teacher_id, student_name, rating, review_text, is_approved: false });
  res.json({ success: true });
});

module.exports = router;
