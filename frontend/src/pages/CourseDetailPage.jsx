import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock3, LockKeyhole, PlayCircle, Save, Users } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiPatch, apiPost } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { CourseArtwork, EmptyState, ErrorNotice, InlineLoader, PageLoader } from '../components/Global.jsx';

export default function CourseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [enrollment, setEnrollment] = useState(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const courseResult = await apiGet(`/api/courses/${id}`);
      setCourse(courseResult);
      let canReadLessons = false;
      if (user?.role === 'student') {
        const enrollmentResult = await apiGet(`/api/enrollments?course=${id}&limit=100`, token);
        const mine = enrollmentResult.data[0] || null;
        setEnrollment(mine);
        setProgress(mine?.progress ?? 0);
        canReadLessons = Boolean(mine && ['active', 'completed'].includes(mine.status));
      } else {
        setEnrollment(null);
        canReadLessons = user?.role === 'teacher' || user?.role === 'admin';
      }
      setLessons(canReadLessons ? (await apiGet(`/api/lessons/course/${id}`, token)).data : []);
    } catch (requestError) {
      setError(requestError.message);
    } finally { setLoading(false); }
  }, [id, user?.role, user?.id, token]);

  useEffect(() => { load(); }, [load]);

  const enroll = async () => {
    if (!user) { navigate('/login', { state: { from: `/courses/${id}` } }); return; }
    setEnrolling(true); setError('');
    try {
      const result = await apiPost('/api/enrollments', { course: id }, token);
      setEnrollment(result);
      setProgress(result.progress || 0);
      setNotice('You’re in! This course is now in your learning space.');
    } catch (requestError) { setError(requestError.message); }
    finally { setEnrolling(false); }
  };

  const saveProgress = async (nextProgress = progress) => {
    if (!enrollment) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await apiPatch(`/api/enrollments/${enrollment._id}`, { progress: Number(nextProgress) }, token);
      setEnrollment(result); setProgress(result.progress); setNotice('Progress saved. Keep going — you’re doing great.');
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };

  const markLessonDone = (index) => {
    const next = Math.min(100, Math.round(((index + 1) / Math.max(lessons.length, 1)) * 100));
    setProgress((current) => Math.max(current, next));
    saveProgress(Math.max(progress, next));
  };

  if (loading) return <main className="container"><PageLoader label="Finding your course…" /></main>;
  if (error && !course) return <main className="container detail-error"><ErrorNotice message={error} onRetry={load} /><Link className="button button-outline" to="/courses"><ArrowLeft size={16} /> Browse courses</Link></main>;
  if (!course) return null;

  const instructorName = course.instructor?.name || 'LearnHub instructor';
  const progressLabel = enrollment?.status === 'completed' ? 'Course complete' : `${progress}% complete`;

  return (
    <main className="course-detail-page">
      <div className="container detail-container">
        <Link to="/courses" className="back-link"><ArrowLeft size={16} /> All courses</Link>
        <div className="detail-layout">
          <section className="detail-main">
            <CourseArtwork category={course.category} variant={course.title.length} large />
            <div className="detail-copy">
              <span className="eyebrow eyebrow-strong">{course.category} <span className="eyebrow-separator">/</span> {course.status}</span>
              <h1>{course.title}</h1>
              <p className="detail-description">{course.description}</p>
              <div className="detail-instructor"><span className="avatar avatar-medium">{instructorName.slice(0, 1)}</span><div><span className="detail-instructor-label">YOUR INSTRUCTOR</span><strong>{instructorName}</strong></div></div>
              <div className="detail-metrics"><span><BookOpen size={16} /> {lessons.length} lessons</span><span><Clock3 size={16} /> Learn at your pace</span><span><Users size={16} /> Learn together</span></div>
            </div>
            <section className="lesson-section">
              <div className="section-heading-inline"><div><span className="eyebrow">THE LEARNING PATH</span><h2>What you’ll explore</h2></div><span className="lesson-count">{lessons.length} lessons</span></div>
              {lessons.length ? <div className="lesson-list">{lessons.map((lesson, index) => (
                <article className="lesson-row" key={lesson._id} id={`lesson-${lesson._id}`}>
                  <span className="lesson-number">{String(index + 1).padStart(2, '0')}</span>
                  <div className="lesson-row-main"><h3>{lesson.title}</h3>{lesson.content && <p>{lesson.content}</p>}{lesson.resourceUrl && <a className="lesson-resource" href={lesson.resourceUrl} target="_blank" rel="noreferrer">Open lesson resource <ArrowRight size={14} /></a>}</div>
                  {enrollment ? <button className="lesson-complete" onClick={() => markLessonDone(index)} title="Save your progress"><CheckCircle2 size={20} /></button> : <span className="lesson-lock"><PlayCircle size={19} /></span>}
                </article>
              ))}</div> : user?.role === 'student' && !enrollment ? <EmptyState icon={LockKeyhole} title="Lessons unlock after enrollment" message="Join this published course to access its learning path." /> : !user ? <EmptyState icon={LockKeyhole} title="Sign in to view lessons" message="Enroll in this course to access its learning path." /> : <EmptyState icon={BookOpen} title="Lessons are on their way" message="The teacher is preparing the learning path for this course." />}
            </section>
          </section>

          <aside className="detail-sidebar">
            <div className="enroll-card">
              <span className="eyebrow">YOUR NEXT STEP</span>
              <h2>{enrollment ? 'Keep your momentum' : 'Make this yours'}</h2>
              <p>{enrollment ? 'Every lesson is a little progress worth celebrating.' : 'Join the course and start learning at your own pace.'}</p>
              {error && <ErrorNotice message={error} />}
              {notice && <div className="notice notice-success">{notice}</div>}
              {enrollment ? (
                <div className="progress-box"><div className="progress-label"><span>{progressLabel}</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><label className="progress-input-label">Update your progress<select value={progress} onChange={(event) => setProgress(Number(event.target.value))}>{[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => <option value={value} key={value}>{value}%</option>)}</select></label><button className="button button-dark button-full" disabled={saving} onClick={() => saveProgress()}>{saving ? <InlineLoader label="Saving…" /> : <><Save size={16} /> Save progress</>}</button></div>
              ) : user?.role === 'student' ? (
                <button className="button button-primary button-full" disabled={enrolling || course.status !== 'published'} onClick={enroll}>{enrolling ? <InlineLoader label="Joining…" /> : <>Enroll in this course <ArrowRight size={17} /></>}</button>
              ) : !user ? <Link className="button button-primary button-full" to="/login" state={{ from: `/courses/${id}` }}>Log in to enroll <ArrowRight size={17} /></Link>
                : <div className="role-note"><LockKeyhole size={17} /><span>Enrollment is available to student accounts.</span></div>}
              {!enrollment && <div className="enroll-footnote"><CheckCircle2 size={15} /> No deadlines. Learn at your own pace.</div>}
              {user?.role === 'teacher' && course.instructor?._id === user.id && <Link to={`/teach/courses/${id}`} className="sidebar-manage-link">Manage your course <ArrowRight size={15} /></Link>}
            </div>
            <div className="detail-side-note"><span className="side-note-icon">✳</span><div><strong>Keep showing up.</strong><p>Learning isn’t a race. Come back when it works for you.</p></div></div>
          </aside>
        </div>
      </div>
    </main>
  );
}
