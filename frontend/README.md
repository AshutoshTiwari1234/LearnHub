# LearnHub frontend

React and Vite single-page app for the existing LearnHub Express API.

## Start locally

1. Start the local MongoDB service and the backend first. In PowerShell, from `backend`, run `npm.cmd run dev`.
2. From `frontend`, install packages once with `npm.cmd install`.
3. For local development, set `VITE_API_BASE_URL=http://localhost:5000` in `frontend/.env`. The production build defaults to the hosted Render API (`https://learnhub-backend-ufkr.onrender.com`) when the variable is omitted.
4. Run `npm.cmd run dev` from `frontend` and open `http://127.0.0.1:5173`.

The backend already enables CORS for browser requests. The frontend sends the JWT as an `Authorization: Bearer ...` header and does not contain the JWT signing secret or database URI. The token is kept in `sessionStorage` and cleared when the user signs out or the token is rejected.

## Frontend checks

- `npm.cmd run build` creates the production bundle in `dist/`.
- `npm.cmd run dev` serves the app with Vite hot reload.

## Main screens

- `/courses`: published course catalog with search, category filter, sorting, and pagination.
- `/courses/:id`: course information and lessons, with student enrollment and progress actions.
- `/login` and `/signup`: login and student registration using `/api/auth/login` and `/api/auth/register`.
- `/dashboard`: student enrollment and progress overview.
- `/teach`: instructor course studio; admin accounts get an aggregate overview.
- `/teach/courses/:id`: instructor lesson creation, editing, and deletion.

New public accounts are students, matching backend rules. Instructor accounts must be provisioned by a trusted administrator before an instructor can sign in.
