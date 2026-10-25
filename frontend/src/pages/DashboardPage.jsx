import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, BookOpen, ChartNoAxesCombined, CheckCircle2, Clock3, Edit3, GraduationCap, Plus, Sparkles, Trash2, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { CourseArtwork, EmptyState, ErrorNotice, InlineLoader, PageLoader, PageTitle } from '../components/Global.jsx';

function ProgressBar({ value = 0 }) {
  return <div className="progress-track"><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export function StudentDashboard() {
  const { user, token } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const load = useCallback(() => {
    setLoading(true); setError('');
    apiGet('/api/enrollments?page=1&limit=100', token)
      .then((result) => setEnrollments(result.data))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [token]);
  useEffect(() => { void load(); }, [load, refreshKey]);

  const activeCount = enrollments.filter((item) => item.status === 'active').length;
  const completedCount = enrollments.filter((item) => item.status === 'completed').length;
  const average = enrollments.length ? Math.round(enrollments.reduce((sum, item) => sum + item.progress, 0) / enrollments.length) : 0;

  return (
    <main className="dashboard-page">
      <section className="dashboard-welcome"><div className="container welcome-inner"><div><span className="eyebrow eyebrow-light">YOUR LEARNING SPACE</span><h1>Hey, {user.name.split(' ')[0]} <span className="welcome-wave">✳</span></h1><p>Every little bit of progress adds up. Let’s see where you are.</p></div><div className="welcome-decoration"><span>keep</span><em>growing</em><b>↗</b></div></div></section>
      <section className="container dashboard-content">
        <ErrorNotice message={error} onRetry={() => setRefreshKey((value) => value + 1)} />
        <div className="stat-grid"><div className="stat-card"><span className="stat-icon stat-violet"><BookOpen size={20} /></span><div><span>Courses in progress</span><strong>{loading ? '—' : activeCount}</strong></div></div><div className="stat-card"><span className="stat-icon stat-mint"><CheckCircle2 size={20} /></span><div><span>Completed courses</span><strong>{loading ? '—' : completedCount}</strong></div></div><div className="stat-card"><span className="stat-icon stat-peach"><Activity size={20} /></span><div><span>Average progress</span><strong>{loading ? '—' : `${average}%`}</strong></div></div></div>
        <div className="dashboard-section-head"><div><span className="eyebrow">YOUR CURRENT CHAPTERS</span><h2>My learning</h2></div><Link className="quiet-link" to="/courses">Find something new <ArrowRight size={16} /></Link></div>
        {loading ? <div className="learning-list">{[1, 2, 3].map((item) => <div className="learning-skeleton" key={item} />)}</div> : enrollments.length ? <div className="learning-list">{enrollments.map((enrollment, index) => (
          <article className="learning-card" key={enrollment._id}>
            <CourseArtwork category={enrollment.course?.category || 'Learning'} variant={index} />
            <div className="learning-card-copy"><div className="learning-card-top"><span className="eyebrow">{enrollment.course?.category || 'Course'}</span><span className={`status-pill status-${enrollment.status}`}>{enrollment.status}</span></div><h3>{enrollment.course?.title || 'Course unavailable'}</h3><p>with {enrollment.course?.instructor?.name || 'your instructor'}</p><div className="learning-progress"><ProgressBar value={enrollment.progress} /><span>{enrollment.progress}%</span></div></div>
            <Link className="learning-open" to={enrollment.course?._id ? `/courses/${enrollment.course._id}` : '/courses'} aria-label="Continue course"><ArrowRight size={19} /></Link>
          </article>
        ))}</div> : <EmptyState icon={GraduationCap} title="Your next chapter is waiting" message="You haven’t enrolled in a course yet. Browse the library and find something you’d love to learn." action={<Link className="button button-primary" to="/courses">Explore courses <ArrowRight size={16} /></Link>} />}
        <div className="dashboard-footnote"><Sparkles size={17} /><span>There’s no perfect pace. Just yours.</span></div>
      </section>
    </main>
  );
}

function CourseEditor({ course, onClose, onSave, saving, error, teachers = [], isAdmin = false }) {
  const [form, setForm] = useState({ title: course?.title || '', description: course?.description || '', category: course?.category || '', status: course?.status || 'draft', instructor: course?.instructor?._id || course?.instructor || '' });
  const [validation, setValidation] = useState('');
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = (event) => {
    event.preventDefault(); setValidation('');
    if (form.title.trim().length < 3) return setValidation('Course titles need at least 3 characters.');
    if (!form.description.trim() || !form.category.trim()) return setValidation('Add a description and category before saving.');
    if (isAdmin && !form.instructor) return setValidation('Choose a teacher to own this course.');
    onSave({ ...form, title: form.title.trim(), description: form.description.trim(), category: form.category.trim() });
  };
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="course-form-title">
        <div className="modal-heading"><div><span className="eyebrow">COURSE STUDIO</span><h2 id="course-form-title">{course ? 'Shape your course' : 'Create a course'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
        {(error || validation) && <ErrorNotice message={validation || error} />}
        <form className="form-stack" onSubmit={submit}>
          <label className="form-label">Course title<input value={form.title} onChange={set('title')} placeholder="A good title makes people curious" required minLength={3} maxLength={200} /></label>
          <label className="form-label">Description<textarea value={form.description} onChange={set('description')} placeholder="What will learners take away?" required rows={4} maxLength={5000} /></label>
          <div className="form-row"><label className="form-label">Category<input value={form.category} onChange={set('category')} placeholder="e.g. Databases" required maxLength={100} /></label><label className="form-label">Visibility<select value={form.status} onChange={set('status')}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label></div>
          {isAdmin && <label className="form-label">Course teacher<select value={form.instructor} onChange={set('instructor')} required><option value="">Choose a teacher</option>{teachers.map((teacher) => <option value={teacher._id} key={teacher._id}>{teacher.name} · {teacher.email}</option>)}</select></label>}
          <div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? <InlineLoader label="Saving…" /> : <>{course ? 'Save changes' : 'Create course'} <ArrowRight size={16} /></>}</button></div>
        </form>
      </section>
    </div>
  );
}

export function TeacherDashboard() {
  const { user, token } = useAuth();
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [enrollmentStats, setEnrollmentStats] = useState([]);
  const [progressStats, setProgressStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [courseResult, enrollmentsResult, progressResult, learnerResult] = await Promise.all([
        apiGet(`/api/courses?instructor=${encodeURIComponent(user.id)}&page=1&limit=100&sort=-createdAt`),
        apiGet('/api/analytics/enrollments-per-course', token),
        apiGet('/api/analytics/average-progress-per-course', token),
        apiGet('/api/enrollments?page=1&limit=100', token),
      ]);
      setCourses(courseResult.data); setEnrollmentStats(enrollmentsResult.data); setProgressStats(progressResult.data);
      setEnrollments(learnerResult.data);
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, [user.id, token]);
  useEffect(() => { void load(); }, [load, refreshKey]);

  const learnerCount = enrollmentStats.reduce((sum, item) => sum + item.enrollmentCount, 0);
  const averageProgress = useMemo(() => {
    const values = progressStats.filter((item) => item.averageProgress != null);
    return values.length ? Math.round(values.reduce((sum, item) => sum + item.averageProgress, 0) / values.length) : 0;
  }, [progressStats]);

  const saveCourse = async (values) => {
    setSaving(true); setError('');
    try {
      if (editing) await apiPut(`/api/courses/${editing._id}`, values, token);
      else await apiPost('/api/courses', values, token);
      setModalOpen(false); setEditing(null); setRefreshKey((value) => value + 1);
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };

  const deleteCourse = async (course) => {
    if (!window.confirm(`Delete “${course.title}” and its lessons and enrollments?`)) return;
    setError('');
    try { await apiDelete(`/api/courses/${course._id}`, token); setRefreshKey((value) => value + 1); }
    catch (requestError) { setError(requestError.message); }
  };

  return (
    <main className="dashboard-page instructor-dashboard">
      <section className="dashboard-welcome instructor-welcome"><div className="container welcome-inner"><div><span className="eyebrow eyebrow-light">TEACHER STUDIO</span><h1>Make room for <em>good ideas.</em></h1><p>Your classroom is a collection of little lightbulb moments.</p></div><button className="button button-light" onClick={() => { setEditing(null); setError(''); setModalOpen(true); }}><Plus size={17} /> Create a course</button></div></section>
      <section className="container dashboard-content">
        <ErrorNotice message={error} onRetry={() => setRefreshKey((value) => value + 1)} />
        <div className="stat-grid"><div className="stat-card"><span className="stat-icon stat-violet"><BookOpen size={20} /></span><div><span>Your courses</span><strong>{loading ? '—' : courses.length}</strong></div></div><div className="stat-card"><span className="stat-icon stat-mint"><Users size={20} /></span><div><span>Student enrollments</span><strong>{loading ? '—' : learnerCount}</strong></div></div><div className="stat-card"><span className="stat-icon stat-peach"><ChartNoAxesCombined size={20} /></span><div><span>Average progress</span><strong>{loading ? '—' : `${averageProgress}%`}</strong></div></div></div>
        <div className="dashboard-section-head"><div><span className="eyebrow">YOUR CLASSROOM</span><h2>Courses you teach</h2></div><span className="subtle-count">{courses.length} total</span></div>
        {loading ? <div className="management-list">{[1, 2].map((item) => <div className="management-skeleton" key={item} />)}</div> : courses.length ? <div className="management-list">{courses.map((course, index) => {
          const stats = enrollmentStats.find((item) => item._id === course._id);
          const courseLearners = enrollments.filter((item) => item.course?._id === course._id);
          return <article className="management-course" key={course._id}><CourseArtwork category={course.category} variant={index} /><div className="management-course-copy"><div className="course-card-meta"><span className="eyebrow">{course.category}</span><span className={`status-pill status-${course.status}`}>{course.status}</span></div><h3>{course.title}</h3><p>{course.description}</p><div className="management-meta"><span><Users size={15} /> {stats?.enrollmentCount || 0} learners</span><span><Clock3 size={15} /> {course.status === 'published' ? 'Live course' : 'Not published'}</span></div><div className="management-meta"><span>Enrolled students: {courseLearners.length ? courseLearners.map((item) => `${item.student?.name || 'Student'} (${item.student?.email || ''})`).join(', ') : 'None yet'}</span></div></div><div className="management-actions"><button className="icon-button" title="Edit course" aria-label="Edit course" onClick={() => { setEditing(course); setError(''); setModalOpen(true); }}><Edit3 size={17} /></button><Link className="icon-button" title="Manage lessons" aria-label="Manage lessons" to={`/teach/courses/${course._id}`}><BookOpen size={17} /></Link><button className="icon-button danger-icon" title="Delete course" aria-label="Delete course" onClick={() => deleteCourse(course)}><Trash2 size={17} /></button></div></article>;
        })}</div> : <EmptyState icon={GraduationCap} title="Your classroom is ready" message="Create your first course and invite learners to join you." action={<button className="button button-primary" onClick={() => setModalOpen(true)}><Plus size={16} /> Create your first course</button>} />}
        <div className="dashboard-footnote"><Sparkles size={17} /><span>Good teaching starts with a question someone can’t wait to answer.</span></div>
      </section>
      {modalOpen && <CourseEditor course={editing} onClose={() => { setModalOpen(false); setEditing(null); setError(''); }} onSave={saveCourse} saving={saving} error={error} />}
    </main>
  );
}

export function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([
      apiGet('/api/analytics/courses-per-instructor', token),
      apiGet('/api/analytics/courses-by-category', token),
      apiGet('/api/analytics/enrollments-per-course', token),
      apiGet('/api/analytics/platform-stats', token),
    ]).then(([instructors, categories, enrollments, platform]) => setStats({ instructors: instructors.data, categories: categories.data, enrollments: enrollments.data, platform: platform.data }))
      .catch((requestError) => setError(requestError.message));
  }, [token]);
  if (error) return <main className="container section-space"><ErrorNotice message={error} /></main>;
  if (!stats) return <main className="container"><PageLoader label="Loading your overview…" /></main>;
  const courseTotal = stats.categories.reduce((sum, item) => sum + item.courseCount, 0);
  const enrollmentTotal = stats.enrollments.reduce((sum, item) => sum + item.enrollmentCount, 0);
  return <main className="dashboard-page"><section className="dashboard-welcome"><div className="container welcome-inner"><div><span className="eyebrow eyebrow-light">LEARNHUB OVERVIEW</span><h1>A little progress,<br /><em>everywhere.</em></h1><p>Here’s a snapshot of the learning community.</p></div><div className="welcome-decoration"><span>learn</span><em>together</em><b>✳</b></div></div></section><section className="container dashboard-content"><PageTitle eyebrow="COMMUNITY SNAPSHOT" title="Learning at a glance" description="Aggregated course and enrollment activity across LearnHub." /><AdminPlatformCounts stats={stats.platform} /><div className="stat-grid"><div className="stat-card"><span className="stat-icon stat-violet"><BookOpen size={20} /></span><div><span>Courses</span><strong>{courseTotal}</strong></div></div><div className="stat-card"><span className="stat-icon stat-mint"><Users size={20} /></span><div><span>Teachers</span><strong>{stats.instructors.length}</strong></div></div><div className="stat-card"><span className="stat-icon stat-peach"><CheckCircle2 size={20} /></span><div><span>Enrollments</span><strong>{enrollmentTotal}</strong></div></div></div><div className="admin-analytics-grid"><section className="analytics-panel"><span className="eyebrow">COURSES BY CATEGORY</span>{stats.categories.length ? stats.categories.map((item) => <div className="analytics-row" key={item.category}><span>{item.category}</span><strong>{item.courseCount}</strong></div>) : <p className="muted">No courses yet.</p>}</section><section className="analytics-panel"><span className="eyebrow">COURSES PER TEACHER</span>{stats.instructors.length ? stats.instructors.map((item) => <div className="analytics-row" key={item.email}><span>{item.name}</span><strong>{item.courseCount}</strong></div>) : <p className="muted">No teachers yet.</p>}</section></div><AdminCourseManagement token={token} /><AdminEnrollmentManagement token={token} /><AdminUserManagement token={token} /></section></main>;
}

function AdminUserManagement({ token }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { apiGet('/api/users?page=1&limit=100&sort=name', token).then((result) => setUsers(result.data)).catch((err) => setError(err.message)); }, [token, refresh]);
  const create = async (event) => { event.preventDefault(); setError(''); try { await apiPost('/api/users/teachers', form, token); setForm({ name: '', email: '', password: '' }); setRefresh((n) => n + 1); } catch (err) { setError(err.message); } };
  const updateRole = async (id, role) => { setError(''); try { await apiPatch(`/api/users/${id}`, { role }, token); setRefresh((n) => n + 1); } catch (err) { setError(err.message); } };
  const remove = async (person) => { if (!window.confirm(`Delete ${person.name}? Linked users cannot be deleted.`)) return; try { await apiDelete(`/api/users/${person._id}`, token); setRefresh((n) => n + 1); } catch (err) { setError(err.message); } };
  return <section className="analytics-panel" style={{ marginTop: 28 }}><PageTitle eyebrow="ADMINISTRATION" title="Manage users" description="Add teacher accounts or manage existing user roles. Public signups remain students." />{error && <ErrorNotice message={error} />}<h3>Add Teacher</h3><form className="form-stack" onSubmit={create}><div className="form-row"><input aria-label="Teacher name" placeholder="Teacher name" required minLength="2" maxLength="100" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><input aria-label="Teacher email" type="email" placeholder="Teacher email" required maxLength="254" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><input aria-label="Teacher password" type="password" placeholder="Teacher password" required minLength="8" maxLength="72" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div><button className="button button-primary">Add Teacher</button></form><div style={{ marginTop: 20 }}>{users.map((person) => <div className="analytics-row" key={person._id}><span>{person.name} · {person.email}</span><select aria-label={`Role for ${person.name}`} value={person.role} onChange={(e) => updateRole(person._id, e.target.value)}><option value="admin">Admin</option><option value="teacher">Teacher</option><option value="student">Student</option></select><button className="button button-outline" onClick={() => remove(person)}>Delete</button></div>)}</div></section>;
}

function AdminCourseManagement({ token }) {
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    Promise.all([apiGet('/api/courses?page=1&limit=100&sort=title'), apiGet('/api/users?role=teacher&page=1&limit=100', token)])
      .then(([courseResult, userResult]) => { setCourses(courseResult.data); setTeachers(userResult.data); })
      .catch((err) => setError(err.message));
  }, [token, refresh]);
  const save = async (values) => {
    setSaving(true); setError('');
    try {
      if (editing) await apiPut(`/api/courses/${editing._id}`, values, token);
      else await apiPost('/api/courses', values, token);
      setModalOpen(false); setEditing(null); setRefresh((value) => value + 1);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };
  const remove = async (course) => {
    if (!window.confirm(`Delete “${course.title}” and its lessons and enrollments?`)) return;
    try { await apiDelete(`/api/courses/${course._id}`, token); setRefresh((value) => value + 1); }
    catch (err) { setError(err.message); }
  };
  return <section className="analytics-panel" style={{ marginTop: 28 }}><div className="dashboard-section-head"><div><span className="eyebrow">PLATFORM CONTENT</span><h2>Manage all courses</h2></div><button className="button button-primary" onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} /> Create course</button></div>{error && <ErrorNotice message={error} />}{courses.map((course) => <div className="analytics-row" key={course._id}><span>{course.title} · {course.instructor?.name || 'Teacher unavailable'} · {course.status}</span><div className="management-actions"><button className="icon-button" aria-label={`Edit ${course.title}`} onClick={() => { setEditing(course); setModalOpen(true); }}><Edit3 size={17} /></button><Link className="icon-button" aria-label={`Manage lessons for ${course.title}`} to={`/teach/courses/${course._id}`}><BookOpen size={17} /></Link><button className="icon-button danger-icon" aria-label={`Delete ${course.title}`} onClick={() => remove(course)}><Trash2 size={17} /></button></div></div>)}{modalOpen && <CourseEditor course={editing} teachers={teachers} isAdmin onClose={() => { setModalOpen(false); setEditing(null); }} onSave={save} saving={saving} error={error} />}</section>;
}

function AdminPlatformCounts({ stats }) {
  return <div className="stat-grid"><div className="stat-card"><span className="stat-icon stat-violet"><Users size={20} /></span><div><span>Platform users</span><strong>{stats.users}</strong></div></div><div className="stat-card"><span className="stat-icon stat-mint"><BookOpen size={20} /></span><div><span>Lessons</span><strong>{stats.lessons}</strong></div></div></div>;
}

function AdminEnrollmentManagement({ token }) {
  const [enrollments, setEnrollments] = useState([]);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { apiGet('/api/enrollments?page=1&limit=100', token).then((result) => setEnrollments(result.data)).catch((err) => setError(err.message)); }, [token, refresh]);
  const save = async (item, changes) => {
    setError('');
    try { await apiPatch(`/api/enrollments/${item._id}`, changes, token); setRefresh((value) => value + 1); }
    catch (err) { setError(err.message); }
  };
  return <section className="analytics-panel" style={{ marginTop: 28 }}><PageTitle eyebrow="PLATFORM LEARNING" title="Manage enrollments" description="Review enrollment progress and update status across all courses." />{error && <ErrorNotice message={error} />}{enrollments.map((item) => <div className="analytics-row" key={item._id}><span>{item.student?.name} · {item.course?.title}</span><label>Progress <select aria-label={`Progress for ${item.student?.name}`} value={item.progress} onChange={(event) => save(item, { progress: Number(event.target.value) })}>{[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => <option key={value} value={value}>{value}%</option>)}</select></label><label>Status <select aria-label={`Status for ${item.student?.name}`} value={item.status} onChange={(event) => save(item, { status: event.target.value })}><option value="active">Active</option><option value="completed">Completed</option><option value="dropped">Dropped</option></select></label></div>)}</section>;
}
