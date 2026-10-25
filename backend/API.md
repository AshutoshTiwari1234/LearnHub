# LearnHub API

## Run locally

1. Make sure the Windows MongoDB service is running. In an Administrator PowerShell, start it with `Start-Service MongoDB` if needed.
2. Preserve any existing `backend/.env`. Configure `MONGO_URI` and a `JWT_SECRET` of at least 32 random bytes there. Generate a secret locally with `node -e "process.stdout.write(require('node:crypto').randomBytes(64).toString('hex'))"`; never commit `.env` or share the generated value. `.env.example` is a template, not a usable secret.
3. From `backend`, run `npm.cmd run dev` in PowerShell. The API listens on port 5000 by default (or the configured `PORT`). Startup checks the JWT secret and MongoDB connection.
4. Check the health endpoint at `GET http://localhost:5000/`.

Run all backend integration tests with `npm.cmd test`. They connect to local MongoDB, use uniquely named temporary records, exercise the HTTP APIs, and remove their records.

## Authentication

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create a student account from `name`, `email`, and `password` |
| POST | `/api/auth/login` | Verify credentials and return a bearer access token |
| GET | `/api/auth/me` | Return the current authenticated user |

Registration is public and always creates a student. It rejects extra fields, including `role`, so public clients cannot create teacher or admin accounts. Admins can provision/manage accounts through `/api/users`. Passwords are 8–72 UTF-8 bytes and are stored as bcrypt hashes. Access tokens use `JWT_SECRET` and expire after one hour by default (`JWT_EXPIRES_IN` can change the duration). Authenticated requests send `Authorization: Bearer <accessToken>`.

Example PowerShell flow:

```powershell
$registered = Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/auth/register -ContentType 'application/json' -Body '{"name":"A Student","email":"student@example.com","password":"a-long-password"}'
$token = $registered.accessToken
Invoke-RestMethod -Uri http://localhost:5000/api/auth/me -Headers @{ Authorization = "Bearer $token" }
$login = Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/auth/login -ContentType 'application/json' -Body '{"email":"student@example.com","password":"a-long-password"}'
```

## Course routes

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/courses` | Teacher or admin |
| GET | `/api/courses` | Public |
| GET | `/api/courses/:id` | Public |
| PUT | `/api/courses/:id` | Owning teacher or admin |
| DELETE | `/api/courses/:id` | Owning teacher or admin |

Course list query parameters: `page` (default 1), `limit` (default 20, max 100), `sort` (`title`, `-title`, `createdAt`, `-createdAt`, `updatedAt`, `-updatedAt`), `q` (case-insensitive substring search), `text` (MongoDB full-text search), `category`, `status`, and `instructor` (teacher ObjectId). A teacher's courses are assigned to them automatically; teachers cannot create or manage courses for other teachers. Admins must supply an existing teacher ID when creating a course. Course deletion also deletes its lessons and enrollments.

## Lesson routes

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/lessons` | Owning teacher or admin |
| GET | `/api/lessons/course/:courseId` | Owning teacher, admin, or enrolled student |
| GET | `/api/lessons/:id` | Owning teacher, admin, or enrolled student |
| PUT | `/api/lessons/:id` | Owning teacher or admin |
| DELETE | `/api/lessons/:id` | Owning teacher or admin |

Lessons can only be created or changed by the teacher who owns their course, or an admin. Lesson content is private to the owning teacher/admin and students with active or completed enrollments. Each lesson requires content or a resource URL.

## Enrollment routes

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/enrollments` | Student; `course` must be published |
| GET | `/api/enrollments` | Authenticated; results scoped to the current student or teacher's courses; admins can list all |
| GET | `/api/enrollments/:id` | The student, course teacher, or admin |
| PATCH | `/api/enrollments/:id` | Student owner may update progress; course teacher/admin may update progress or status |
| PATCH | `/api/enrollments/:id/cancel` | Enrollment owner, course teacher, or admin; marks it dropped |
| GET | `/api/enrollments/stats/courses` | Public aggregate counts |

Students are taken from the access token, not request data, and can update only their own progress. Duplicate student/course enrollments return 409. Populated User fields are limited to `name`, `email`, and `role`; password hashes and JWT secrets are never included in API responses.

Malformed values and validation failures return 400, missing resources return 404, missing/invalid tokens return 401, role/ownership violations return 403, and unique-key conflicts return 409. Error responses do not include internal server errors or credential material.

## MongoDB analytics endpoints

Analytics routes require a bearer token with the `teacher` or `admin` role. Teachers see analytics for their own courses; admins see all courses. `/api/analytics/platform-stats` is admin-only. Query parameters are rejected on these routes so unexpected inputs return 400.

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/analytics/enrollments-per-course` | Total, active, and completed enrollments for each course (including zero-enrollment courses) |
| GET | `/api/analytics/courses-per-instructor` | Course count per instructor; admins see instructors with zero courses too |
| GET | `/api/analytics/average-progress-per-course` | Average progress and enrollment count; average is `null` when there are no enrollments |
| GET | `/api/analytics/courses-by-category` | Course, published, draft, and archived counts grouped by category |
| GET | `/api/analytics/platform-stats` | Platform-wide counts and user-role counts; admin only |

## Admin user management

All `/api/users` endpoints require an admin bearer token. `GET /api/users` supports `page`, `limit`, `role` (`admin`, `teacher`, `student`), `q` (name/email search), and `sort`. `GET /api/users/:id` reads one safe user profile. `POST /api/users/teachers` accepts `{ "name", "email", "password" }` and always creates a teacher with a bcrypt hash. `POST /api/users` remains an admin-only general account operation accepting `{ "name", "email", "password", "role" }`. `PATCH /api/users/:id` accepts only `name` and/or `role`. `DELETE /api/users/:id` rejects deleting yourself, the last admin, or a user with courses/enrollments so references are not orphaned. Password hashes are never returned.

The local database currently has no admin account. To bootstrap the first one, run this from `backend` in an interactive PowerShell window. The script prompts for name and email, then asks for the password twice with terminal echo disabled. It requires local `learnhub`, hashes the password, refuses if an admin or matching email already exists, and does not change existing users. Public registration remains student-only.

```powershell
npm.cmd run admin:create
```

After creating the initial account, start the frontend from `frontend` with `npm.cmd run dev`, open `http://127.0.0.1:5173/login`, and enter the same email and password in the form (the password is not shown by the terminal bootstrap script). Successful admin login uses `POST http://localhost:5000/api/auth/login` and sends the admin to `/teach` in the frontend. Do not put credentials in a URL or source file.

Example request and response:

```powershell
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri http://localhost:5000/api/analytics/enrollments-per-course -Headers $headers
```

```json
{
  "data": [
    {
      "title": "MongoDB Fundamentals",
      "category": "Databases",
      "enrollmentCount": 3,
      "activeEnrollmentCount": 2,
      "completedEnrollmentCount": 1
    }
  ]
}
```

Other response rows use these fields: `name`, `email`, `courseCount` for courses per instructor; `title`, `category`, `averageProgress`, `enrollmentCount` for progress; and `category`, `courseCount`, `publishedCount`, `draftCount`, `archivedCount` for category statistics. Aggregations return counts and averages only, not student records.

## Insert-only demo data

From `backend`, provide a temporary password in the current PowerShell session and run the seed command. Every created demo account receives a separately salted bcrypt hash. The plaintext is not written to `.env` or MongoDB.

```powershell
$secureSeedPassword = Read-Host 'Temporary password for demo accounts (8-72 bytes)' -AsSecureString
$env:SEED_PASSWORD = [System.Net.NetworkCredential]::new('', $secureSeedPassword).Password
try { npm.cmd run seed } finally { Remove-Item Env:SEED_PASSWORD -ErrorAction SilentlyContinue; Remove-Variable secureSeedPassword -ErrorAction SilentlyContinue }
```

The seed script refuses non-local MongoDB hosts and only targets database `learnhub`. It inserts two teachers, four students, four published courses, ten lessons, and six enrollments. On reruns it reuses matching demo records and reports them as skipped; it never updates or deletes existing documents. If a seed email or course title is already used by an unrelated record, it stops rather than changing or duplicating that record. Existing demo users keep the password they had when first inserted.

## Indexes and references

- `User.email` is unique and supports case-normalized login lookups; `User.role` is restricted to exactly `admin`, `teacher`, and `student` and supports role-scoped access and filtering.
- The `Course` text index covers `title`, `description`, and `category` (with more weight on title/category) and supports the `text` full-text search. The original `q` substring search is retained for compatibility and uses regex matching. `{ status, category }` supports combined course filters. `{ instructor, status, createdAt }` supports instructor course lists and newest-first ordering.
- `Lesson` has a unique `{ course, lessonOrder }` index, which both prevents duplicate lesson positions in a course and serves ordered lesson lists.
- `Enrollment` has a unique `{ student, course }` index to reject duplicate enrollments; `{ course, status }` supports per-course status counts; `{ student, enrollmentDate }` supports newest-first student enrollment lists; `{ course, enrollmentDate }` supports instructor course enrollment lists.

Mongoose references store ObjectIds: `Course.instructor -> User`, `Lesson.course -> Course`, and `Enrollment.student -> User` plus `Enrollment.course -> Course`. API responses use `.populate()` to resolve these references for readable responses, selecting only safe User fields. Aggregation `$lookup` is used for cross-collection analytics.

## MongoDB Compass and mongosh

In Compass, connect to `mongodb://127.0.0.1:27017`, open the `learnhub` database, and inspect the `users`, `courses`, `lessons`, and `enrollments` collections. The Indexes tab shows each collection's indexes. Passwords appear only as bcrypt hashes in `users`; never export or share them.

In PowerShell, open the local database with `mongosh "mongodb://127.0.0.1:27017/learnhub"`, then try:

```javascript
show collections
db.courses.find({ status: "published" }, { title: 1, category: 1, instructor: 1 })
db.courses.getIndexes()
db.enrollments.getIndexes()
db.enrollments.aggregate([
  { $group: { _id: "$course", enrollmentCount: { $sum: 1 }, averageProgress: { $avg: "$progress" } } },
  { $lookup: { from: "courses", localField: "_id", foreignField: "_id", as: "course" } },
  { $unwind: "$course" },
  { $project: { _id: 0, course: "$course.title", enrollmentCount: 1, averageProgress: 1 } }
])
db.courses.aggregate([
  { $group: { _id: "$category", courseCount: { $sum: 1 } } },
  { $sort: { courseCount: -1 } }
])
```

In Compass, the same aggregation stages can be entered in the Aggregations tab. For query plans, run `.explain("executionStats")` on a `find()` or aggregation in `mongosh` and compare `totalKeysExamined` and `totalDocsExamined` before and after an index-backed filter.
