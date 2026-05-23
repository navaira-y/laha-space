require('dotenv').config();
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const path = require('path');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true }
}));

app.use('/', require('./routes/public'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => res.status(404).send('Page not found'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌿 Laha Space running on port ${PORT}`));
