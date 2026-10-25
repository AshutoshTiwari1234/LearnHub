import { ArrowLeft, BookOpen } from 'lucide-react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import AuthPage from './pages/AuthPage.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import CourseDetailPage from './pages/CourseDetailPage.jsx';
import ManageLessonsPage from './pages/ManageLessonsPage.jsx';
import { AdminDashboard, TeacherDashboard, StudentDashboard } from './pages/DashboardPage.jsx';
import { useAuth } from './auth/AuthContext.jsx';
import { Brand, Header, PageLoader, RequireRole } from './components/Global.jsx';

function AppRoutes() {
  const { user } = useAuth();
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Navigate to="/courses" replace />} />
        <Route path="/courses" element={<CatalogPage />} />
        <Route path="/courses/:id" element={<CourseDetailPage />} />
        <Route path="/login" element={user ? <Navigate to={user.role === 'student' ? '/dashboard' : '/teach'} replace /> : <AuthPage mode="login" />} />
        <Route path="/signup" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage mode="signup" />} />
        <Route path="/dashboard" element={<RequireRole roles={['student']}><StudentDashboard /></RequireRole>} />
        <Route path="/teach" element={<RequireRole roles={['teacher', 'admin']}>{user?.role === 'admin' ? <AdminDashboard /> : <TeacherDashboard />}</RequireRole>} />
        <Route path="/teach/courses/:id" element={<RequireRole roles={['teacher', 'admin']}><ManageLessonsPage /></RequireRole>} />
        <Route path="*" element={<main className="route-message"><span className="empty-icon"><BookOpen size={25} /></span><span className="eyebrow">404 · A SMALL DETOUR</span><h1>Looks like this page wandered off.</h1><p>No worries. Your learning path is still right here.</p><Link className="button button-primary" to="/courses"><ArrowLeft size={16} /> Back to courses</Link></main>} />
      </Routes>
      <Footer />
    </>
  );
}

function Footer() {
  return <footer className="site-footer"><div className="container footer-inner"><Brand /><span>Keep a little room for what’s next.</span><div className="footer-links"><Link to="/courses">Explore</Link><Link to="/signup">Join LearnHub</Link></div><small>© {new Date().getFullYear()} LearnHub</small></div></footer>;
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return <PageLoader label="Opening LearnHub…" />;
  return <AppRoutes />;
}
