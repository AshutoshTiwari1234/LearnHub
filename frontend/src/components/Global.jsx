import { Link, NavLink } from 'react-router-dom';
import { ArrowRight, BookOpen, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';

export function Brand({ compact = false }) {
  return (
    <Link className={`brand ${compact ? 'brand-compact' : ''}`} to="/" aria-label="LearnHub home">
      <span className="brand-mark"><BookOpen size={19} strokeWidth={2.4} /></span>
      {!compact && <span>learn<span className="brand-accent">hub</span></span>}
    </Link>
  );
}

export function Header() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = user?.name?.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <button className="mobile-menu-toggle icon-button" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <nav className={`main-nav ${menuOpen ? 'nav-open' : ''}`} aria-label="Main navigation">
          <NavLink to="/courses" onClick={closeMenu} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Explore</NavLink>
          {user?.role === 'student' && <NavLink to="/dashboard" onClick={closeMenu} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>My learning</NavLink>}
          {(user?.role === 'teacher' || user?.role === 'admin') && <NavLink to="/teach" onClick={closeMenu} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>{user.role === 'admin' ? 'Admin' : 'Teach'}</NavLink>}
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <Link to={user.role === 'student' ? '/dashboard' : '/teach'} className="user-chip">
                <span className="avatar avatar-small">{initials}</span>
                <span className="user-chip-name">{user.name.split(' ')[0]}</span>
              </Link>
              <button className="icon-button logout-button" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={18} /></button>
            </>
          ) : (
            <>
              <Link className="header-login" to="/login">Log in</Link>
              <Link className="button button-primary button-small" to="/signup">Get started <ArrowRight size={15} /></Link>
            </>
          )}
        </div>
      </div>
      {menuOpen && <button aria-label="Close navigation" className="mobile-menu-backdrop" onClick={closeMenu} />}
    </header>
  );
}

export function CourseArtwork({ category = 'Learning', variant = 0, large = false }) {
  const palettes = ['art-lilac', 'art-mint', 'art-peach', 'art-blue'];
  return (
    <div className={`course-art ${palettes[variant % palettes.length]} ${large ? 'course-art-large' : ''}`} aria-hidden="true">
      <span className="art-orbit orbit-one" /><span className="art-orbit orbit-two" />
      <span className="art-spark spark-one">✳</span><span className="art-spark spark-two">✦</span>
      <span className="art-course-icon"><BookOpen size={large ? 30 : 25} strokeWidth={1.8} /></span>
      <span className="art-label">{category}</span>
    </div>
  );
}

export function CourseCard({ course, index = 0 }) {
  return (
    <article className="course-card">
      <Link to={`/courses/${course._id}`} className="course-card-link" aria-label={`View ${course.title}`}>
        <CourseArtwork category={course.category} variant={index} />
        <div className="course-card-body">
          <div className="course-card-meta"><span className="eyebrow">{course.category}</span><span className={`status-pill status-${course.status}`}>{course.status}</span></div>
          <h3>{course.title}</h3>
          <p className="course-description">{course.description}</p>
          <div className="course-card-footer">
            <span className="instructor-mini"><span className="avatar avatar-tiny">{course.instructor?.name?.slice(0, 1) || 'L'}</span>{course.instructor?.name || 'LearnHub instructor'}</span>
            <span className="card-arrow"><ArrowRight size={17} /></span>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function PageLoader({ label = 'Loading your learning space' }) {
  return <div className="page-loader"><span className="spinner" /><span>{label}</span></div>;
}

export function InlineLoader({ label = 'Loading…' }) {
  return <span className="inline-loader"><span className="spinner spinner-small" />{label}</span>;
}

export function ErrorNotice({ message, onRetry }) {
  if (!message) return null;
  return <div className="notice notice-error" role="alert"><span>{message}</span>{onRetry && <button className="text-button" onClick={onRetry}>Try again</button>}</div>;
}

export function EmptyState({ icon: Icon = BookOpen, title, message, action }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={24} /></span><h3>{title}</h3><p>{message}</p>{action}</div>;
}

export function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <div className="route-message"><div className="empty-icon"><BookOpen size={25} /></div><h2>Sign in to continue</h2><p>This part of LearnHub is for registered learners and instructors.</p><Link className="button button-primary" to="/login">Log in <ArrowRight size={16} /></Link></div>;
  if (roles && !roles.includes(user.role)) return <div className="route-message"><h2>This space is for {roles.join(' or ')}s</h2><p>Your current account does not have permission to access this page.</p><Link className="button button-outline" to="/">Back to explore</Link></div>;
  return children;
}

export function PageTitle({ eyebrow, title, description, action }) {
  return <div className="page-title-row"><div><span className="eyebrow eyebrow-strong">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-title-action">{action}</div>}</div>;
}
