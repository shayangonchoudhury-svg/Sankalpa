# 🕉️ SANKALPA

### Make a promise. Keep it.

> A commitment and accountability platform that turns personal promises into visible, verifiable progress.

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" />
  <img src="https://img.shields.io/badge/Supabase-Storage-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/Gemini-AI-4285F4?style=for-the-badge&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/Vercel-Deployed-000000?style=for-the-badge&logo=vercel&logoColor=white" />
</p>

<p align="center">
  <strong>Commit → Check In → Evidence → Witness → Reflection → Trust</strong>
</p>

---

## 🌐 Live Demo

🚀 **Production:**  
https://sankalpa-ten.vercel.app

---

## 📖 Overview

**SANKALPA** is a commitment and accountability platform built around a simple idea:

> **A promise becomes meaningful when you consistently act on it.**

Traditional productivity applications focus on tasks, reminders, and completion percentages.

SANKALPA takes a different approach.

Users create meaningful commitments, check in on their progress, optionally provide evidence, and involve trusted witnesses who can independently review those check-ins.

The result is a lightweight accountability loop combining:

- Personal commitments
- Human witnessing
- Evidence-based check-ins
- Reflection
- Streaks
- Trust
- AI-assisted reflection

The system is designed so that **AI assists the experience without becoming the authority**.

---

# ✨ Features

## 🎯 Commitment Management

Create commitments around the things you genuinely want to maintain.

- Create commitments
- Define recurring cadence
- Add descriptions
- Choose visibility
- Edit commitments
- Archive commitments
- Real-time Firestore synchronization

## ✅ Check-ins

Turn intentions into actual actions.

Each commitment can receive regular check-ins containing:

- Reflection notes
- Optional photo evidence
- Optional video evidence
- Timestamped activity
- Check-in history
- Reflection timeline

Images are compressed client-side before upload to reduce bandwidth and storage usage.

## 👁️ Witnessing System

Accountability becomes stronger when another person can verify your progress.

Users can invite witnesses who can:

- Accept or decline invitations
- View authorized check-ins
- Review submitted evidence
- Approve a check-in
- Ask for more evidence
- Flag a check-in

Witness actions are designed to be **independent and immutable**.

Circle membership does not automatically grant witness authority.

## 🔥 Streaks & Trust

SANKALPA tracks consistency through verified activity.

The platform tracks:

- Current streak
- Longest streak
- Completed activity
- Witness-approved check-ins
- Trust score

### Trust Score

The trust score combines:

- **70% — Witness approval rate**
- **30% — Consistency score**

The resulting score is kept within a **0–100** range.

| Score | Label |
|---:|---|
| 90–100 | Highly consistent |
| 70–89 | Reliable |
| 40–69 | Building trust |
| 0–39 | Just starting |

## 👥 Circles

Create small accountability groups around shared goals.

- Create circles
- Invite members
- Accept invitations
- Member access control
- Circle-visible commitments
- Maximum member limits

Membership and witnessing remain separate permissions.

## 🏆 Challenges

Challenges provide a structured way for groups to work toward a shared objective.

When a challenge begins, SANKALPA creates the required participant records and challenge commitments atomically.

This keeps challenge initialization deterministic and secure.

## 🔔 Notifications

SANKALPA supports notifications for important accountability events:

- ⏰ Check-in due
- 👁️ Witness invited
- ✅ Witness responded
- 🏆 Challenge started

Users can control notification preferences.

---

# 🤖 AI-Powered Reflection

SANKALPA integrates **Firebase AI Logic + Gemini Developer API**.

### Reflection Assistant

During a check-in, AI can generate a short reflective prompt based on:

- Commitment title
- Commitment cadence

### Evidence Review

Witnesses can optionally use AI-assisted evidence review.

The system can identify potentially:

- Duplicate evidence
- Reused evidence
- Blank evidence
- Unusable evidence

### AI Is Advisory

AI does **not**:

- Approve check-ins
- Reject check-ins
- Change witness decisions
- Modify streaks
- Modify trust scores
- Override Firestore security rules
- Expose internal AI review results to the commitment owner

Human witnessing remains the core authority.

---

# 🔐 Security First

SANKALPA follows a **default-deny security model**.

### Authentication

Protected application functionality requires authentication.

### Firestore Security Rules

Rules enforce authorization for:

- Users
- Commitments
- Check-ins
- Witness invitations
- Witness actions
- Circles
- Circle members
- Challenges
- Challenge participants
- Notifications

### Deterministic Witness Actions

Witness actions use:

`{checkinId}_{witnessUid}`

as their document ID.

This allows Firestore rules to enforce one witness response per check-in.

### Identity Protection

Client users cannot arbitrarily modify protected identity or authorization fields.

### App Check

Production uses:

**Firebase App Check + reCAPTCHA Enterprise**

Firebase AI Logic App Check enforcement is enabled for the production application.

---

# 🧠 How It Works

```text
                 ┌───────────────────┐
                 │ Create Commitment │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │  Invite Witness   │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │ Witness Accepts   │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │    Check In       │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │ Submit Evidence   │
                 └─────────┬─────────┘
                           │
                           ▼
              ┌───────────────────────────┐
              │     Witness Review        │
              └─────────────┬─────────────┘
                            │
                ┌───────────┼───────────┐
                ▼           ▼           ▼
             Approve   Ask for more   Flag
                │           │           │
                └───────────┼───────────┘
                            ▼
                 ┌───────────────────┐
                 │ Verified Activity │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │ Streak / Trust    │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │ Reflection        │
                 │ Timeline          │
                 └───────────────────┘
```

---

# 🏗️ System Architecture

```text
                         SANKALPA
                            │
             ┌──────────────┼──────────────┐
             │              │              │
             ▼              ▼              ▼
       Firebase Auth   Firestore      Firebase AI Logic
       Google Login    Database       Gemini Developer API
             │              │              │
             │              │        Firebase App Check
             │              │
             │       ┌──────┴───────┐
             │       │              │
             │   Commitments     Check-ins
             │   Witnesses       Circles
             │   Challenges      Notifications
             │
             ▼
        User Identity


                   ┌────────────────────┐
                   │  Supabase Storage  │
                   ├────────────────────┤
                   │ Avatars            │
                   │ Check-in Evidence  │
                   └─────────┬──────────┘
                             │
                             ▼
                    Supabase Edge Function
                    Secure Upload Handling
```

---

# 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript |
| Build Tool | Vite |
| Authentication | Firebase Authentication |
| Database | Cloud Firestore |
| AI | Firebase AI Logic + Gemini Developer API |
| App Protection | Firebase App Check + reCAPTCHA Enterprise |
| File Storage | Supabase Storage |
| Secure Uploads | Supabase Edge Functions |
| Deployment | Vercel |
| Testing | Firebase Emulator + TypeScript |
| Styling | Custom Responsive CSS |

---

# 📂 Project Structure

```text
Sankalpa/
│
├── src/
│   ├── components/
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useCommitments.ts
│   │   ├── useCheckins.ts
│   │   ├── useWitnessActions.ts
│   │   └── ...
│   │
│   ├── lib/
│   │   ├── firebase.ts
│   │   ├── supabase.ts
│   │   └── ...
│   │
│   ├── pages/
│   │   ├── Landing.tsx
│   │   ├── Profile.tsx
│   │   ├── CommitmentDetail.tsx
│   │   ├── WitnessInbox.tsx
│   │   └── ...
│   │
│   ├── services/
│   ├── types/
│   └── App.tsx
│
├── scripts/
│   └── firestore_emulator_security_test.ts
│
├── firestore.rules
├── firebase.json
├── vercel.json
├── package.json
└── README.md
```

---

# 🌐 Deployment

## Vercel

SANKALPA is deployed as a Vite Single Page Application.

The project uses a SPA rewrite so direct navigation to React routes works correctly.

### Production

https://sankalpa-ten.vercel.app

## Firebase

Firebase provides:

- Authentication
- Firestore
- Firebase AI Logic
- App Check

Deploy Firestore rules using:

```bash
firebase deploy --only firestore:rules --project sankalpa-app-5303s
```

## Supabase

Supabase provides:

- Avatar storage
- Check-in evidence storage
- Secure upload Edge Functions

Firebase Storage is intentionally **not used**.

---

# 💰 Free-Tier Architecture

SANKALPA is designed to operate without Firebase Blaze billing.

The architecture intentionally avoids:

- Firebase Cloud Functions
- Firebase Storage
- Cloud Run
- FCM
- MongoDB
- DynamoDB
- Additional paid backend infrastructure

The core application uses:

```text
Firebase Spark
      +
Supabase
      +
Vercel
      +
Gemini Developer API
```

---

# 🎨 Design Philosophy

SANKALPA is designed to feel more like a **digital journal than a productivity dashboard**.

### Visual Principles

- Dark editorial interface
- Premium typography
- Subtle borders
- Glass-inspired surfaces
- Minimal elevation
- Calm empty states
- Skeleton loading
- Responsive layouts
- Mobile-first interaction
- 44px minimum interaction targets
- Small micro-interactions

### Brand Statement

> **Make a promise. Keep it.**

---

# 🗺️ Roadmap

### Completed

- [x] Firebase Authentication
- [x] User Profiles
- [x] Supabase Avatar System
- [x] Commitments
- [x] Check-ins
- [x] Evidence Uploads
- [x] Witness Invitations
- [x] Witness Actions
- [x] Deterministic Witness Action Security
- [x] Streak System
- [x] Trust Score
- [x] Circles
- [x] Challenges
- [x] Notifications
- [x] Firebase AI Logic
- [x] Gemini Integration
- [x] Firebase App Check
- [x] Production Firestore Rules
- [x] Responsive UI
- [x] Dark Mode
- [x] Vercel Deployment

### Future Improvements

- [ ] Additional accountability analytics
- [ ] More challenge formats
- [ ] Richer reflection experiences
- [ ] Additional AI-assisted reflection tools
- [ ] Expanded accessibility
- [ ] More advanced notification scheduling

---

# 💡 Why I Built SANKALPA

Most productivity applications ask:

> **"What do you need to do?"**

SANKALPA asks:

> **"What did you promise yourself you would keep doing?"**

The project explores how software can encourage consistency without turning personal growth into a collection of meaningless numbers.

The core idea is simple:

**Make a commitment.  
Show up.  
Be accountable.  
Reflect.  
Keep going.**

---

# 🔒 Security & Privacy

SANKALPA follows several security principles:

- Authentication before protected operations
- Default-deny Firestore rules
- Owner-scoped data access
- Deterministic witness authorization
- Immutable witness actions
- Protected identity fields
- Secure media uploads
- Firebase App Check
- Server-side verification for sensitive upload operations
- No private API keys in frontend code
- No localStorage-based authoritative persistence

Firestore remains the authoritative source of application state.

---

# 👨‍💻 Author

**Shayan Gon Choudhury**
Computer Science & Engineering Student

* 💼 **LinkedIn:** [linkedin.com/in/shayan-gon-choudhury](https://www.linkedin.com/in/shayan-gon-choudhury-37a842315)
* 🐙 **GitHub:** [@shayangonchoudhury-svg](https://github.com/shayangonchoudhury-svg)
* 📧 **Email:** [shayangonchoudhuryskms@gmail.com](mailto:shayangonchoudhuryskms@gmail.com)

---

# 📄 License

This project is currently maintained as a personal/academic project.

A formal open-source license can be added when the project is released under one.

---

<p align="center">

### 🕉️ SANKALPA

**Make a promise. Keep it.**

Built with ❤️, React, Firebase, Supabase & Gemini.

</p>
