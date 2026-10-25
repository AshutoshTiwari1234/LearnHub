import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Edit3, ExternalLink, Plus, Save, Trash2, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { apiDelete, apiGet, apiPost, apiPut } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { EmptyState, ErrorNotice, InlineLoader, PageLoader } from '../components/Global.jsx';

const emptyForm = { title: '', content: '', resourceUrl: '', lessonOrder: 1 };

export default function ManageLessonsPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [courseResult, lessonResult] = await Promise.all([
        apiGet(`/api/courses/${id}`),
        apiGet(`/api/lessons/course/${id}`, token),
      ]);
      setCourse(courseResult); setLessons(lessonResult.data);
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, [id, token]);
  useEffect(() => { void load(); }, [load, refreshKey]);

  const openCreate = () => {
    const nextOrder = Math.max(0, ...lessons.map((lesson) => lesson.lessonOrder)) + 1;
    setEditing(null); setForm({ ...emptyForm, lessonOrder: nextOrder }); setError(''); setSuccess(''); setShowForm(true);
  };
  const openEdit = (lesson) => {
    setEditing(lesson); setForm({ title: lesson.title, content: lesson.content || '', resourceUrl: lesson.resourceUrl || '', lessonOrder: lesson.lessonOrder }); setError(''); setSuccess(''); setShowForm(true);
  };
  const submit = async (event) => {
    event.preventDefault(); setError(''); setSuccess('');
    if (!form.content.trim() && !form.resourceUrl.trim()) { setError('Add lesson content or a resource URL.'); return; }
    if (form.resourceUrl.trim() && !/^https?:\/\//i.test(form.resourceUrl.trim())) { setError('Resource links need to start with http:// or https://.'); return; }
    const values = { course: id, title: form.title.trim(), content: form.content.trim(), resourceUrl: form.resourceUrl.trim(), lessonOrder: Number(form.lessonOrder) };
    if (!values.title || values.lessonOrder < 1 || !Number.isInteger(values.lessonOrder)) { setError('Add a title and a whole-number lesson order of 1 or more.'); return; }
    setSaving(true);
    try {
      if (editing) await apiPut(`/api/lessons/${editing._id}`, values, token);
      else await apiPost('/api/lessons', values, token);
      setShowForm(false); setEditing(null); setSuccess(editing ? 'Lesson updated.' : 'Lesson added to your course.'); setRefreshKey((key) => key + 1);
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };
  const removeLesson = async (lesson) => {
    if (!window.confirm(`Delete “${lesson.title}”?`)) return;
    setError('');
    try { await apiDelete(`/api/lessons/${lesson._id}`, token); setSuccess('Lesson deleted.'); setRefreshKey((key) => key + 1); }
    catch (requestError) { setError(requestError.message); }
  };

  if (loading) return <main className="container"><PageLoader label="Opening your course studio…" /></main>;
  return (
    <main className="manage-page"><div className="container manage-container">
      <Link className="back-link" to="/teach"><ArrowLeft size={16} /> Instructor studio</Link>
      <div className="manage-heading"><div><span className="eyebrow eyebrow-strong">COURSE STUDIO</span><h1>{course?.title || 'Manage lessons'}</h1><p>Arrange the learning path one useful idea at a time.</p></div><button className="button button-primary" onClick={openCreate}><Plus size={17} /> Add a lesson</button></div>
      <ErrorNotice message={error && !showForm ? error : ''} onRetry={() => setRefreshKey((key) => key + 1)} />
      {success && <div className="notice notice-success">{success}</div>}
      {showForm && <section className="lesson-editor panel-card"><div className="modal-heading"><div><span className="eyebrow">LESSON {editing ? 'DETAILS' : 'BUILDER'}</span><h2>{editing ? 'Edit this lesson' : 'Add a new lesson'}</h2></div><button className="icon-button" onClick={() => setShowForm(false)} aria-label="Close editor"><X size={19} /></button></div>{error && <ErrorNotice message={error} />}<form className="form-stack" onSubmit={submit}><div className="form-row form-row-title"><label className="form-label">Lesson title<input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Getting started" required maxLength={200} /></label><label className="form-label">Order<input type="number" min="1" step="1" value={form.lessonOrder} onChange={(event) => setForm((current) => ({ ...current, lessonOrder: event.target.value }))} required /></label></div><label className="form-label">Lesson content<textarea rows={5} maxLength={50000} value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} placeholder="Write a short lesson, notes, or instructions…" /></label><label className="form-label">Resource URL <span className="optional-label">(optional if content is provided)</span><input type="url" value={form.resourceUrl} onChange={(event) => setForm((current) => ({ ...current, resourceUrl: event.target.value }))} placeholder="https://example.com/lesson" /></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setShowForm(false)}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? <InlineLoader label="Saving…" /> : <>{editing ? <Save size={16} /> : <Plus size={16} />}{editing ? 'Save lesson' : 'Add lesson'}</>}</button></div></form></section>}
      <div className="manage-section-label"><div><span className="eyebrow">LEARNING PATH</span><h2>{lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}</h2></div><Link to={`/courses/${id}`} className="quiet-link">Preview course <ArrowRight size={15} /></Link></div>
      {lessons.length ? <div className="manage-lesson-list">{lessons.map((lesson) => <article className="manage-lesson-row" key={lesson._id}><span className="lesson-number">{String(lesson.lessonOrder).padStart(2, '0')}</span><div className="manage-lesson-copy"><h3>{lesson.title}</h3><p>{lesson.content ? `${lesson.content.slice(0, 140)}${lesson.content.length > 140 ? '…' : ''}` : 'Resource-based lesson'}</p>{lesson.resourceUrl && <a href={lesson.resourceUrl} target="_blank" rel="noreferrer" className="lesson-resource">Open resource <ExternalLink size={13} /></a>}</div><div className="management-actions"><button className="icon-button" onClick={() => openEdit(lesson)} aria-label={`Edit ${lesson.title}`}><Edit3 size={17} /></button><button className="icon-button danger-icon" onClick={() => removeLesson(lesson)} aria-label={`Delete ${lesson.title}`}><Trash2 size={17} /></button></div></article>)}</div> : <EmptyState icon={BookOpen} title="Start with one good lesson" message="Add a short lesson or link a resource to begin building the course path." action={<button className="button button-primary" onClick={openCreate}><Plus size={16} /> Add first lesson</button>} />}
      {!course && !error && <div className="notice notice-error">Course not found.</div>}
    </div></main>
  );
}
