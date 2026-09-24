# Current architecture and rollout notes

## System shape

The browser app is a Vite/React single page application. It uses Supabase Auth for sign-in, FastAPI for application reads and mutations, Supabase Postgres/PostGIS for persistent records, OpenStreetMap-based map tiles, and OpenRouteService for road distance and travel time. `shared/cities.json` is the source for the city selector and backend city directory.

The supported city IDs are `blr`, `mum`, `del`, `maa`, `hyd`, `pun`, `kol`, `amd`, `jai`, and `lko`. Selecting a city changes the network queried by the app. It does not create data or grant membership in that city.

## Request and authorization flow

1. Supabase Auth signs the user in and holds the browser session.
2. `src/api.ts` sends the access token to FastAPI as a bearer token.
3. FastAPI validates it with Supabase Auth, loads the caller's `profiles` row, and checks the server-side role for role-gated operations.
4. The PostgREST gateway sends that same caller token and the Supabase publishable/anon key. It does not use a service-role key, so database RLS remains active for reads and writes.
5. `supabase/schema.sql` scopes records to a city and associated account, and reserves role changes and dispatch transitions for protected database functions.

User signup only records a requested role. New accounts receive the donor role; a trusted administrator must approve/promote drivers, recipients, or coordinators. The frontend cannot grant itself a role or city membership.

## Data and map behavior

- With Supabase configured, dashboard data comes from the authenticated `/api/pilot-data` endpoint. Errors remain visible; the client does not replace failed live requests with demo records.
- Without Supabase configuration, only the Bengaluru preview uses bundled seed data. Other cities remain empty.
- Map pins come from database coordinates. The offline preview identifies its seeded records as synthetic. OSM/OpenFreeMap tiles and attribution are shown by the map.
- ORS Matrix requests provide donor-to-recipient road distance and duration for matching. Route comparison calls ORS Directions for road totals and arrival-time checks. It needs real city records and a configured ORS key.
- The app does not currently geocode a typed address or collect live driver GPS. Organizations and drivers must have valid latitude/longitude records provisioned in Supabase before they appear as real map locations.

## Settings and integrations

The settings page reads and updates the signed-in profile through `/api/me`, including display name, organization, phone, license, service area, and active city preference. The profile's assigned city membership and role are not editable there.

ORS credentials are read only by the backend. Telegram health reports whether a token and destination are configured; sending notifications is not wired into donation/dispatch events. A chat ID and an explicit notification flow are still required. No Telegram messages have been sent.

## Supabase rollout

1. Back up the current project database.
2. Review and apply the migration sequence with `supabase db push`, or apply `supabase/schema.sql` in the Supabase SQL editor. The follow-up migration upgrades the pilot tables, adds city/ownership columns and RLS, creates profile provisioning and protected dispatch functions, and defaults existing rows to Bengaluru.
3. Configure backend `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (or the legacy anon-key variable), `ORS_API_KEY`, and production `ALLOWED_ORIGINS`. Configure matching `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` for the browser build.
4. Provision each verified donor, recipient, and driver row with the correct `city_id`, coordinates, and `user_id`. Mark verified recipients approved. Promote coordinators using a trusted SQL/admin procedure after checking their identity. Keep service-role credentials out of the browser and ordinary API paths.
5. Start with Bengaluru records, verify the authenticated data path and ORS routing against the deployed project, then populate additional cities. The other nine city entries are directory options; their operational data is not included by this change.

The schema is present in the repository but has not been applied to a live Supabase project from this workspace. Runtime connectivity to Supabase and ORS has not been exercised here.

## Security and operations audit

The initial app mixed direct browser database access, API attempts, and local success fallbacks. The backend described itself as Supabase-backed but used process-local Bengaluru seed state. It had permissive wildcard CORS, public database policies, client-controlled handover codes, and role checks that were not grounded in authenticated profiles. The map also presented fixed-city and generated location data as if it were live.

The current implementation routes live reads and writes through FastAPI and RLS, removes fake success fallbacks, requires protected account roles for dispatch, generates food safety deadlines on the server, scopes city selection, and distinguishes demo seed records from database records. Remaining launch dependencies are applying/reviewing the SQL migration, provisioning account-linked city records, setting production CORS and secrets, validating against the actual Supabase/ORS deployment, and deciding the Telegram notification destination and event policy.
