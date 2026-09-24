# AaharSetu (आहारसेतु) — End-to-End Implementation Plan

> **Track:** Track A (NGO / Social Impact) — AMIHACKS 1.0  
> **Tagline:** *"Turn a restaurant's unsold food into a shelter's next meal, before it hits the dumpster."*  
> **Version:** 1.0 (Production Roadmap)  
> **Repository:** [omprakashjaat1306/AMITY](https://github.com/omprakashjaat1306/AMITY)

---

## 1. Overview & Goal

AaharSetu is an intelligent real-time food rescue platform operating under strict food-safety countdowns (FSSAI/IFSA guidance). The goal of this implementation is to turn the partial frontend prototype into a complete, resilient, live end-to-end system with:
1. Active frontend data hydration with zero-blank-screen offline fallback.
2. FastAPI backend with dual-mode storage (Supabase PostgreSQL + PostGIS, with local SQLite fallback).
3. Automated safety engine calculating `safe_until` windows from preparation time, category, and temperature.
4. Gemini Flash-Lite structured NLP intake parsing informal messages (Hinglish/Hindi/English) into verified donations.
5. Explainable multi-factor recipient matching algorithm with visible score breakdowns for judges.
6. Joint VRP vehicle routing optimization compared against nearest-first baseline (live km saved and zero deadline breaches).
7. Trust & verification layer featuring QR/OTP handovers and auto-generated FSSAI compliance labels.

---

## 2. File Architecture Map

```
AaharSetu/
├── backend/
│   ├── main.py                  # FastAPI application entrypoint, CORS, exception handlers
│   ├── config.py                # Environment configuration (Supabase, Gemini, ORS)
│   ├── models.py                # SQLAlchemy DB models & Pydantic v2 schemas
│   ├── database.py              # Dual-mode DB adapter (Supabase Postgres / local SQLite)
│   ├── safety_engine.py         # FSSAI/IFSA safe window and temperature evaluation
│   ├── matching_engine.py       # Multi-factor score calculator (0.35/0.25/0.20/0.10/0.10)
│   ├── routing_engine.py        # VRP optimizer vs. greedy baseline comparator
│   ├── nlp_intake.py            # Gemini Flash-Lite structured output extractor
│   ├── requirements.txt         # FastAPI, Uvicorn, SQLAlchemy, google-genai, etc.
│   └── seed.py                  # Python Bengaluru pilot seed populator
├── src/
│   ├── main.tsx                 # [FIX] Hydrate App with usePilotData & useBackendHealth
│   ├── app.tsx                  # [FIX] Route active data into views, dialogs, and banners
│   ├── use-pilot-data.ts        # [FIX] Fix SWR fallback so seed data loads immediately
│   ├── api.ts                   # REST API client with live endpoints & offline mock fallback
│   ├── seed.ts                  # Bengaluru pilot dataset
│   ├── types.ts                 # Domain type definitions & status helpers
│   └── styles.css               # AaharSetu Earth & Rescue Design System tokens
├── components/
│   ├── app-sidebar.tsx          # AaharSetu branding, navigation, profile
│   ├── activity-feed.tsx        # Real-time ground dispatch timeline
│   ├── dispatch-view.tsx        # 4-stage kanban + Live Routing Comparison widget
│   ├── donation-dialog.tsx      # Rescue details, FSSAI label preview, countdown
│   ├── donation-form.tsx        # [UPGRADE] AI-powered free-text intake + FSSAI temp rules
│   ├── donations-table.tsx      # Active donations table with search and urgency flags
│   ├── handover-dialog.tsx      # [NEW] QR / OTP pickup & delivery verification modal
│   ├── impact-view.tsx          # Real-time kg rescued, meals (1.8x), CO2e (2.5x), CSV export
│   ├── network-views.tsx        # Shelter capacities & driver availability cards
│   ├── overview-metrics.tsx     # Stat cards with live computation
│   ├── rescue-map.tsx           # MapLibre GL map with OpenFreeMap & OSM raster tiles
│   └── settings-view.tsx        # Live integration health badges
├── supabase/
│   └── schema.sql               # [NEW] PostGIS extension, spatial tables, and RLS policies
└── vite.config.ts               # Proxy configuration, PWA manifest, and env injection
```

---

## 3. Phased Implementation Sequence

### Phase 1: Frontend Data Awakening & Dependencies (Immediate)
* **Goal:** Eliminate the blank "Awaiting pilot database setup" state; make the React dashboard instantly live, reactive, and resilient.
* **Tasks:**
  1. **Update [src/main.tsx](file:///e:/HIMANSHU/AaharSetu/src/main.tsx):**
     * Create a `Root` wrapper that invokes `usePilotData()` and `useBackendHealth()`.
     * Pass `{ data, source, refresh, backend }` to `<App />`.
  2. **Fix SWR Fallback in [src/use-pilot-data.ts](file:///e:/HIMANSHU/AaharSetu/src/use-pilot-data.ts):**
     * Ensure the SWR key is always active: `['pilot-data', isSupabaseConfigured ? 'supabase' : 'offline']`.
     * If Supabase query fails or returns empty, seamlessly return `{ data: buildSeed(), source: 'offline' }`.
  3. **Install Dependencies:**
     * Run `npm install` to populate `node_modules`.
     * Run `npm run check` (TypeScript verification) to ensure zero compilation errors.

### Phase 2: FastAPI Backend Core & Dual-Mode Data Layer
* **Goal:** Provide a resilient Python backend that runs concurrently with Vite, abstracting cloud Supabase and local SQLite.
* **Tasks:**
  1. **Scaffold `backend/requirements.txt`:**
     * `fastapi`, `uvicorn[standard]`, `pydantic`, `sqlalchemy`, `google-genai`, `httpx`, `python-dotenv`.
  2. **Implement `backend/database.py`:**
     * Connect to Supabase PostgreSQL when `SUPABASE_DATABASE_URL` is set.
     * Fall back automatically to SQLite (`backend/aaharsetu.db`) if cloud DB is unavailable.
  3. **Implement `backend/models.py`:**
     * Tables: `donors`, `recipients`, `drivers`, `donations`, `matches`, `dispatch_events`, `records`.
     * Pydantic schemas for input validation and API serialization.
  4. **Implement `backend/main.py`:**
     * Endpoints:
       * `GET /api/health`: Health status, routing engine type, Gemini availability.
       * `GET /api/pilot-data`: Returns full snapshot matching `PilotData` interface.
       * `POST /api/donations`: Persist new donation and trigger matching.
       * `POST /api/donations/{id}/match`: Transition to `matched`.
       * `POST /api/donations/{id}/pickup`: Transition to `picked_up`.
       * `POST /api/donations/{id}/deliver`: Transition to `delivered` & create `records` entry.

### Phase 3: FSSAI Safety Engine & Gemini Structured NLP Intake
* **Goal:** Automate food safety compliance and allow 30-second donor intake from messy messages.
* **Tasks:**
  1. **Implement `backend/safety_engine.py`:**
     * Rules engine:
       * `cooked_hot`: $\ge 60^\circ\text{C} \rightarrow 4\text{ hours}$; $<65^\circ\text{C} \rightarrow 2\text{ hours}$.
       * `cooked_cold`: $\le 5^\circ\text{C} \rightarrow 6\text{ hours}$ (cold chain).
       * `bakery`: 8–12 hours.
       * `produce`: 18–24 hours.
       * `packaged`: User input or default 24h.
     * Validation: Block any donation if current time $+ \text{transit buffer} > \text{safe\_until}$.
  2. **Implement `backend/nlp_intake.py`:**
     * Endpoint `POST /api/donations/intake-nlp`.
     * Uses `google-genai` with Gemini Flash-Lite and `response_schema` to parse Hindi/Hinglish/English into structured JSON with confidence score.
     * Rule-based regex fallback for offline environments.
  3. **Update [components/donation-form.tsx](file:///e:/HIMANSHU/AaharSetu/components/donation-form.tsx):**
     * Add "Extract with AI" button that calls `/api/donations/intake-nlp` and populates form fields with one click.
     * Display live safety window preview badge based on selected category and attested temperature.

### Phase 4: Multi-Factor Matching & Live Routing Optimization
* **Goal:** Deliver the two primary algorithm innovations required by the hackathon PS.
* **Tasks:**
  1. **Implement `backend/matching_engine.py`:**
     * Multi-factor scoring formula:
       $$\text{Score} = 0.35 \times \text{time\_slack} + 0.25 \times \text{proximity} + 0.20 \times \text{need} + 0.10 \times \text{capacity} + 0.10 \times \text{reliability}$$
     * Hard filters: Safe window > transit time + 45min handling; category accepted; recipient open & approved; capacity available.
     * Returns ranked recipients with detailed explanation JSON (`reasons`).
  2. **Implement `backend/routing_engine.py`:**
     * Solve multi-stop Vehicle Routing Problem (VRP) with time-window constraints.
     * Compare against naive greedy nearest-first baseline.
     * Output metrics:
       * Joint route total kilometers vs. Greedy baseline kilometers.
       * Missed deadlines in joint route ($0$) vs. Greedy baseline ($>0$).
       * Percentage travel time reduction.
  3. **Update [components/dispatch-view.tsx](file:///e:/HIMANSHU/AaharSetu/components/dispatch-view.tsx):**
     * Replace static routing banner with an interactive **Routing Optimization Benchmark Widget** showing live before/after numbers and savings.

### Phase 5: Trust Layer, Verification & Presentation Polish
* **Goal:** Complete the end-to-end trust trail and prepare the judge presentation deliverables.
* **Tasks:**
  1. **Create [components/handover-dialog.tsx](file:///e:/HIMANSHU/AaharSetu/components/handover-dialog.tsx):**
     * Interactive modal for Driver Pickup (Donor OTP / QR verification) and Shelter Delivery (Recipient verification).
  2. **Create FSSAI Rescue Label Preview:**
     * In [components/donation-dialog.tsx](file:///e:/HIMANSHU/AaharSetu/components/donation-dialog.tsx), generate an official-style FSSAI Surplus Food Recovery record displaying donor FSSAI license flag (*"Collected, not verified"*), batch timestamp, and consume-by deadline.
  3. **Create `supabase/schema.sql`:**
     * PostGIS tables, spatial indices (`USING GIST (location)`), and public read / authenticated write RLS policies.
  4. **Verification & Testing:**
     * Verify complete end-to-end demo flow: Post donation via NLP $\rightarrow$ Match calculated $\rightarrow$ Dispatch assigned $\rightarrow$ Route optimized $\rightarrow$ QR handover $\rightarrow$ Impact updated.
