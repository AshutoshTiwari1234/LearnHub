import { useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function AuthPage({ mode = 'login' }) {
  const isSignup = mode === 'signup';
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState('');

  const submit = async (event) => {
    event.preventDefault(); setError(''); setFieldError('');
    if (isSignup && name.trim().length < 2) { setFieldError('Add your name so we know what to call you.'); return; }
    if (!email.includes('@')) { setFieldError('Enter a valid email address.'); return; }
    if (isSignup && (new TextEncoder().encode(password).length < 8 || new TextEncoder().encode(password).length > 72)) { setFieldError('Use a password between 8 and 72 bytes.'); return; }
    setBusy(true);
    try {
      const user = isSignup ? await register(name.trim(), email.trim(), password) : await login(email.trim(), password);
      const fallback = user.role === 'student' ? '/dashboard' : '/teach';
      navigate(location.state?.from || fallback, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally { setBusy(false); }
  };

  return (
    <main className="auth-page">
      <section className="auth-aside">
        <Link to="/" className="auth-back"><ArrowLeft size={17} /> Back to LearnHub</Link>
        <div className="auth-aside-content"><span className="auth-aside-mark"><BookOpen size={25} /></span><span className="eyebrow">A LITTLE SPACE TO GROW</span><h1>Make learning<br /><em>feel like yours.</em></h1><p>Follow your curiosity, build a new skill, and see how far a small step can take you.</p><div className="auth-quote"><span>“</span><p>You don’t have to see the whole staircase.<br />Just take the first step.</p><small>— A good reminder</small></div></div>
        <span className="auth-aside-bottom">LEARN SOMETHING. KEEP SOMETHING.</span>
      </section>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand"><Link className="brand" to="/"><span className="brand-mark"><BookOpen size={19} /></span><span>learn<span className="brand-accent">hub</span></span></Link></div>
          <div className="auth-heading"><span className="eyebrow eyebrow-strong">{isSignup ? 'YOUR JOURNEY STARTS HERE' : 'GOOD TO HAVE YOU BACK'}</span><h2>{isSignup ? 'Create your account' : 'Welcome back'}</h2><p>{isSignup ? 'Join a community of curious minds.' : 'Pick up right where you left off.'}</p></div>
          {error && <div className="notice notice-error" role="alert">{error}</div>}
          {fieldError && <div className="notice notice-error" role="alert">{fieldError}</div>}
          <form className="auth-form" onSubmit={submit}>
            {isSignup && <label className="form-label">Your name<span className="input-wrap"><UserRound size={18} /><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Alex Morgan" required minLength={2} maxLength={100} /></span></label>}
            <label className="form-label">Email address<span className="input-wrap"><Mail size={18} /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required maxLength={254} /></span></label>
            <label className="form-label">Password<span className="input-wrap"><LockKeyhole size={18} /><input type={showPassword ? 'text' : 'password'} autoComplete={isSignup ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isSignup ? 'At least 8 characters' : 'Enter your password'} required minLength={isSignup ? 8 : undefined} /><button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>{isSignup && <small className="field-hint"><Check size={13} /> 8–72 bytes, just for you</small>}</label>
            <button className="button button-primary auth-submit" disabled={busy}>{busy ? <><span className="spinner spinner-small spinner-light" /> One moment…</> : <>{isSignup ? 'Create account' : 'Log in'} <ArrowRight size={17} /></>}</button>
          </form>
          <p className="auth-switch">{isSignup ? 'Already have an account?' : 'New to LearnHub?'} <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Log in' : 'Create an account'}</Link></p>
          {isSignup && <p className="student-signup-note">New accounts start as students. Teacher access is provided by your LearnHub administrator.</p>}
          <p className="auth-legal">By continuing, you agree to learn with kindness and curiosity.</p>
        </div>
      </section>
    </main>
  );
}
