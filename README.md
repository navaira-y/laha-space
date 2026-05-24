# Laha Space

Platform for the Laha Space women's community connecting students with vetted Quran teachers. Teachers apply and pass through a structured 7-stage internal review process before any profile goes live. Students browse published teachers and book discovery sessions directly on the platform with real-time slot availability.

**Live:** https://lahaspace.com

## Stack

Node.js, Express, EJS, PostgreSQL (Supabase). Hosted on Hostinger Business.

Server-rendered throughout. No client-side framework — the public pages are lightweight and the admin panel stays simple and fast without the overhead of a SPA.

## Architecture

The platform has three distinct surfaces: a public listing and booking flow for students, a teacher application form, and a private admin panel for the Laha team to manage the full vetting pipeline, teacher profiles, bookings, and review moderation.

Teachers have no login in this version. The admin team manages profiles on their behalf and controls exactly what goes public and when.

Availability is handled with a custom slot system. Admins set weekly working hours per teacher, the platform generates slots and marks them taken as bookings come in. No third-party scheduling tool.

Sessions are persisted in PostgreSQL so they survive server restarts.

## Security

Uploaded documents are served through a protected route requiring admin authentication. File type validation runs on both client and server. Rate limiting is applied to all public APIs.

## Roadmap

Teacher logins and self-service profile editing, email notifications, payment integration, and a skills track separate from the Quran teaching track.
