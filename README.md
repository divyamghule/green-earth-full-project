# GreenEarn - AI-Based Environmental Reward System

GreenEarn rewards users for verified real-world environmental activities.

## Latest Update (March 2026)

- Added wallet and withdrawal module
- Conversion rule: `1 point = Rs 1`
- Minimum withdrawal threshold: `1000 points`
- Added withdrawal APIs and dashboard UI for request/history tracking

## What This Project Includes

- Secure login/register with JWT
- Activity selection (Garbage Cleaning, Tree Plantation, River Cleaning, Pothole Fixing)
- Live camera before/after proof capture (no gallery upload)
- GPS location capture and anti-fraud checks
- TensorFlow.js-based before/after AI verification (`Garbage` / `Clean` / `Plant`)
- Reward points and streak system
- Withdrawal system (`1 point = Rs 1`, minimum `1000` points)
- Dashboard with submission history
- JSON-based database for hackathon speed

## Folder Structure

```txt
green earth app/
  frontend/
    index.html
    login.html
    register.html
    activity.html
    dashboard.html
    css/
    js/
  backend/
    server.js
    routes/
    controllers/
    middleware/
    services/
    db/
      withdrawals.json
    models/tfjs/
    uploads/
```

## Technologies

- HTML, CSS, JavaScript (frontend)
- Node.js + Express (backend)
- JSON files as lightweight database
- TensorFlow.js (`@tensorflow/tfjs`) for AI classification

## Environment

Create a `.env` file in `backend/` (or copy `.env.example`) and set:

- `JWT_SECRET=your-secret`
- `PORT=5000`
- `GPS_MAX_ACCURACY_METERS=120`
- `GPS_MAX_BEFORE_AFTER_DISTANCE_METERS=300`
- `AI_MIN_CONFIDENCE=0.72`
- `AI_MIN_CHANGE_SCORE=0.045`
- `AI_CLEANUP_FALLBACK_MIN_CHANGE=0.08`
- `AI_CLEANUP_HIGH_CHANGE_OVERRIDE=0.15`
- `AI_CLEANUP_MIN_BRIGHTNESS_GAIN=0.02`
- `AI_CLEANUP_MIN_VARIANCE_DROP=0.002`
- `POINT_TO_RUPEE_RATE=1`
- `MIN_WITHDRAW_POINTS=1000`

## Quick Start

1. Open terminal in project root:

```bash
cd "c:\Users\kiran ghule\OneDrive\Desktop\green earth app"
```

2. Install backend dependencies:

```bash
cd backend
npm install
```

3. Start backend server:

```bash
npm run dev
```

4. Open in browser:

```txt
http://localhost:5000
```

## Demo Flow

1. Register/Login
2. Open `Submit Activity`
3. Select activity
4. Start camera and capture `Before` image
5. Perform the activity and capture `After` image
6. GPS auto-captures on both `Before` and `After` capture clicks
7. Submit activity for AI before/after verification
8. Open dashboard and request withdrawal when points >= 1000
9. Track withdrawal history/status

## API Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/activities/types`
- `POST /api/activities/capture-session`
- `POST /api/activities/submit`
- `GET /api/activities/history`
- `GET /api/dashboard/summary`
- `GET /api/withdrawals/wallet`
- `GET /api/withdrawals/history`
- `POST /api/withdrawals/request`

`POST /api/activities/submit` payload includes:
- `beforeImageData`, `afterImageData`
- `beforeCaptureTimestamp`, `afterCaptureTimestamp`
- `beforeLocation`, `afterLocation`
- `activityType`, `captureSessionId`, `source=live_camera`

## AI Model Notes

- Current backend uses TensorFlow.js tensor operations with a heuristic classifier (Node 24 safe, no native build required).
- Verification checks both class transition and visual difference score between before/after images.
- For cleanup activities, if `After=Clean` is not detected but visual improvement is strong, fallback verification can still pass.
- Class output remains: `Garbage`, `Clean`, `Plant`.

## Security and Anti-Fraud

- Gallery uploads are blocked at frontend and backend.
- Live capture session token is required.
- GPS accuracy threshold check is applied.
- Before/after GPS distance threshold check is applied.
- Duplicate proof images are blocked by SHA-256 hash.
- Expired or reused capture sessions are rejected.

## Future Improvements

- Replace JSON DB with MongoDB/PostgreSQL
- Add admin panel for manual moderation
- Add map-based impact visualization
- Add before/after dual-image validation per activity
- Train domain-specific classification model

