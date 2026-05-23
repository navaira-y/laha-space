const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const supabase = require('../database');
const { requireAdmin } = require('../middleware/auth');

const STAGES = ['','Application Received','Initial Screening','Interview Scheduled','Interview Completed','Teaching Test','Training Program','Fully Vetted'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => {
    const u = Date.now() + '-' + Math.round(Math.random()*1e9);
    cb(null, u + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 5*1024*1024 } });

// Auth
router.get('/login', (req, res) => {
  if (req.session.adminId) return res.redirect('/admin');
  res.render('admin/login', { error: null });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
    return res.render('admin/login', { error: 'Invalid email or password.' });
  }
  req.session.adminId = 1;
  req.session.adminEmail = email;
  res.redirect('/admin');
});

router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/admin/login'); });

// Dashboard
router.get('/', requireAdmin, async (req, res) => {
  const [a, t, b, r, recent] = await Promise.all([
    supabase.from('applicants').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('is_published', true),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('is_approved', false),
    supabase.from('applicants').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(5)
  ]);
  res.render('admin/dashboard', {
    stats: { applicants: a.count||0, teachers: t.count||0, bookings: b.count||0, pendingReviews: r.count||0 },
    recentApplicants: recent.data || [],
    STAGES
  });
});

// Applicants
router.get('/applicants', requireAdmin, async (req, res) => {
  let query = supabase.from('applicants').select('*').order('created_at', { ascending: false });
  if (req.query.status === 'not_proceeding') {
    query = query.eq('status', 'not_proceeding');
  } else if (req.query.stage) {
    query = query.eq('stage', req.query.stage).eq('status', 'active');
  } else {
    query = query.eq('status', 'active');
  }
  const { data: applicants } = await query;
  res.render('admin/applicants', { applicants: applicants||[], STAGES, selectedStage: req.query.stage||'', selectedStatus: req.query.status||'' });
});

router.get('/applicants/:id', requireAdmin, async (req, res) => {
  const { data: applicant } = await supabase.from('applicants').select('*').eq('id', req.params.id).single();
  if (!applicant) return res.redirect('/admin/applicants');
  const [{ data: docs }, { data: notes }] = await Promise.all([
    supabase.from('applicant_documents').select('*').eq('applicant_id', applicant.id),
    supabase.from('stage_notes').select('*').eq('applicant_id', applicant.id).order('created_at', { ascending: false })
  ]);
  res.render('admin/applicant-detail', { applicant, docs: docs||[], notes: notes||[], STAGES });
});

router.post('/applicants/:id/stage', requireAdmin, async (req, res) => {
  await supabase.from('applicants').update({ stage: req.body.stage, updated_at: new Date() }).eq('id', req.params.id);
  res.redirect('/admin/applicants/' + req.params.id);
});

router.post('/applicants/:id/note', requireAdmin, async (req, res) => {
  const { data: a } = await supabase.from('applicants').select('stage').eq('id', req.params.id).single();
  await supabase.from('stage_notes').insert({ applicant_id: req.params.id, note: req.body.note, stage_at_time: a.stage });
  res.redirect('/admin/applicants/' + req.params.id);
});

router.post('/applicants/:id/not-proceeding', requireAdmin, async (req, res) => {
  await supabase.from('applicants').update({ status: 'not_proceeding', not_proceeding_reason: req.body.reason||null, updated_at: new Date() }).eq('id', req.params.id);
  res.redirect('/admin/applicants');
});

router.post('/applicants/:id/create-profile', requireAdmin, async (req, res) => {
  const { data: a } = await supabase.from('applicants').select('*').eq('id', req.params.id).eq('stage', 7).single();
  if (!a) return res.redirect('/admin/applicants/' + req.params.id);
  const { data: existing } = await supabase.from('teachers').select('id').eq('applicant_id', a.id).single();
  if (existing) return res.redirect('/admin/teachers/' + existing.id + '/edit');
  const { data: t } = await supabase.from('teachers').insert({
    applicant_id: a.id, name: a.name, email: a.email, photo_path: a.photo_path,
    qualifications: a.qualifications, experience: a.experience,
    categories: a.categories, languages: a.languages, is_published: false
  }).select().single();
  res.redirect('/admin/teachers/' + t.id + '/edit');
});

// Teachers
router.get('/teachers', requireAdmin, async (req, res) => {
  const { data: teachers } = await supabase.from('teachers').select('*').order('created_at', { ascending: false });
  res.render('admin/teachers', { teachers: teachers||[] });
});

router.get('/teachers/new', requireAdmin, (req, res) => {
  res.render('admin/teacher-form', { teacher: null, availability: [] });
});

router.post('/teachers', requireAdmin, upload.single('photo'), async (req, res) => {
  const { name, email, bio, qualifications, experience, laha_endorsement } = req.body;
  const categories = [].concat(req.body.categories||[]);
  const languages = [].concat(req.body.languages||[]);
  const photoPath = req.file ? '/uploads/' + req.file.filename : null;
  await supabase.from('teachers').insert({ name, email, photo_path: photoPath, bio, qualifications, experience, categories, languages, laha_endorsement, is_published: false });
  res.redirect('/admin/teachers');
});

router.get('/teachers/:id/edit', requireAdmin, async (req, res) => {
  const { data: teacher } = await supabase.from('teachers').select('*').eq('id', req.params.id).single();
  if (!teacher) return res.redirect('/admin/teachers');
  const { data: availability } = await supabase.from('teacher_availability').select('*').eq('teacher_id', teacher.id).order('day_of_week').order('start_time');
  res.render('admin/teacher-form', { teacher, availability: availability||[] });
});

router.post('/teachers/:id', requireAdmin, upload.single('photo'), async (req, res) => {
  const { name, email, bio, qualifications, experience, laha_endorsement } = req.body;
  const categories = [].concat(req.body.categories||[]);
  const languages = [].concat(req.body.languages||[]);
  const { data: t } = await supabase.from('teachers').select('photo_path').eq('id', req.params.id).single();
  const photoPath = req.file ? '/uploads/' + req.file.filename : t.photo_path;
  await supabase.from('teachers').update({ name, email, photo_path: photoPath, bio, qualifications, experience, categories, languages, laha_endorsement, updated_at: new Date() }).eq('id', req.params.id);
  res.redirect('/admin/teachers/' + req.params.id + '/edit');
});

router.post('/teachers/:id/publish', requireAdmin, async (req, res) => {
  const { data: t } = await supabase.from('teachers').select('is_published').eq('id', req.params.id).single();
  await supabase.from('teachers').update({ is_published: !t.is_published }).eq('id', req.params.id);
  res.redirect('/admin/teachers');
});

router.post('/teachers/:id/availability', requireAdmin, async (req, res) => {
  const days = [].concat(req.body.days||[]);
  const starts = [].concat(req.body.start_times||[]);
  const ends = [].concat(req.body.end_times||[]);
  await supabase.from('teacher_availability').delete().eq('teacher_id', req.params.id);
  const rows = days.map((d,i) => ({ teacher_id: req.params.id, day_of_week: d, start_time: starts[i], end_time: ends[i] })).filter(r => r.day_of_week !== '' && r.start_time && r.end_time);
  if (rows.length) await supabase.from('teacher_availability').insert(rows);
  res.redirect('/admin/teachers/' + req.params.id + '/edit');
});

// Bookings
router.get('/bookings', requireAdmin, async (req, res) => {
  const { data: bookings } = await supabase.from('bookings').select('*, teachers(name)').order('slot_date').order('slot_start_time');
  res.render('admin/bookings', { bookings: bookings||[] });
});

router.post('/bookings/:id/status', requireAdmin, async (req, res) => {
  await supabase.from('bookings').update({ status: req.body.status }).eq('id', req.params.id);
  res.redirect('/admin/bookings');
});

// Reviews
router.get('/reviews', requireAdmin, async (req, res) => {
  const { data: reviews } = await supabase.from('reviews').select('*, teachers(name)').order('created_at', { ascending: false });
  res.render('admin/reviews', { reviews: reviews||[] });
});

router.post('/reviews/:id/approve', requireAdmin, async (req, res) => {
  await supabase.from('reviews').update({ is_approved: true }).eq('id', req.params.id);
  res.redirect('/admin/reviews');
});

router.post('/reviews/:id/hide', requireAdmin, async (req, res) => {
  await supabase.from('reviews').update({ is_approved: false }).eq('id', req.params.id);
  res.redirect('/admin/reviews');
});

module.exports = router;
