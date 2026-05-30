require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const methodOverride = require('method-override');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { requireAdmin } = require('./middleware/auth');

const app = express();

// Hostinger runs behind a reverse proxy
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
      styleSrc:    ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
      fontSrc:     ["'self'", "fonts.gstatic.com", "data:"],
      imgSrc:      ["'self'", "data:", "blob:", "https:"],
      connectSrc:  ["'self'"],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
      baseUri:     ["'self'"],
    }
  }
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Public photos are fine to serve publicly (teacher profile photos)
// Documents are NOT served publicly - protected route in admin.js handles those
app.use('/uploads/photos', express.static(path.join(__dirname, 'uploads', 'photos')));
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));

// Supabase-backed session store so sessions survive server restarts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(session({
  store: new pgSession({ pool, tableName: 'sessions', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
}));

// Rate limiting - public APIs only
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many booking attempts, please try again later.' }
});

const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many review submissions, please try again later.' }
});

app.use('/api/', apiLimiter);
app.use('/api/bookings', bookingLimiter);
app.use('/api/reviews', reviewLimiter);

app.use('/', require('./routes/public'));
app.use('/admin', require('./routes/admin'));

// Protected uploads - only admins can access documents
app.use('/uploads', requireAdmin, express.static(path.join(__dirname, 'uploads')));

app.use((req, res) => res.status(404).send('Page not found'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌿 Laha Space running on port ${PORT}`));
