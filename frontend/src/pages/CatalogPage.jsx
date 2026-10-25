import { useEffect, useMemo, useState } from 'react';
import { ArrowDownWideNarrow, Search, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiGet } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { CourseCard, EmptyState, ErrorNotice, InlineLoader, PageTitle } from '../components/Global.jsx';

const PAGE_SIZE = 9;

export default function CatalogPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [categories, setCategories] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('-createdAt');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    apiGet('/api/courses?status=published&page=1&limit=100&sort=title')
      .then((result) => active && setCategories([...new Set(result.data.map((course) => course.category))].sort()))
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ status: 'published', page: String(page), limit: String(PAGE_SIZE), sort });
    if (search) params.set('q', search);
    if (category) params.set('category', category);
    return params.toString();
  }, [page, search, category, sort]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    apiGet(`/api/courses?${query}`)
      .then((result) => {
        if (!active) return;
        setCourses(result.data);
        setPagination(result.pagination);
        setCategories((current) => [...new Set([...current, ...result.data.map((course) => course.category)])].sort());
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [query, refreshKey]);

  const clearFilters = () => {
    setSearchInput(''); setSearch(''); setCategory(''); setSort('-createdAt'); setPage(1);
  };

  return (
    <main>
      <section className="catalog-hero">
        <div className="container catalog-hero-inner">
          <div className="catalog-copy">
            <span className="hero-kicker"><span className="kicker-dot" /> YOUR NEXT CHAPTER STARTS HERE</span>
            <h1>Curiosity looks<br /><span>good on you.</span></h1>
            <p>Find a course that moves you forward. Learn from people who love what they do.</p>
            <div className="hero-proof"><div className="avatar-stack"><span className="avatar avatar-stack-a">M</span><span className="avatar avatar-stack-b">R</span><span className="avatar avatar-stack-c">A</span><span className="avatar avatar-stack-more">+</span></div><span><strong>Good things happen</strong><br />when we keep learning.</span></div>
          </div>
          <div className="hero-artwork" aria-hidden="true">
            <div className="hero-art-card hero-art-card-back"><span className="hero-art-doodle">✳</span><span className="hero-art-word">make<br />room</span></div>
            <div className="hero-art-card hero-art-card-front"><span className="hero-art-tag">A LITTLE PROGRESS</span><span className="hero-art-big">goes<br /><em>a long</em><br />way.</span><span className="hero-art-squiggle">↗</span></div>
            <span className="hero-orbit hero-orbit-one" /><span className="hero-orbit hero-orbit-two" />
            <span className="hero-float hero-float-one">✦</span><span className="hero-float hero-float-two">✳</span>
          </div>
        </div>
      </section>

      <section className="section-space catalog-section" id="courses">
        <div className="container">
          <PageTitle eyebrow="THE COURSE LIBRARY" title="Find your next favorite subject" description="Thoughtful courses for curious people. Pick a path and make it your own." action={user?.role === 'teacher' || user?.role === 'admin' ? <Link className="button button-dark" to="/teach">Create a course <span>↗</span></Link> : null} />
          <div className="catalog-toolbar">
            <label className="search-field"><Search size={18} /><input aria-label="Search courses" placeholder="Search a skill, topic, or idea..." value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /><kbd>⌘ K</kbd></label>
            <div className="toolbar-filters"><label className="select-field"><SlidersHorizontal size={17} /><select aria-label="Filter by category" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}><option value="">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="select-field sort-field"><ArrowDownWideNarrow size={17} /><select aria-label="Sort courses" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="-createdAt">Newest first</option><option value="title">Title A–Z</option><option value="-title">Title Z–A</option></select></label></div>
          </div>
          <ErrorNotice message={error} onRetry={() => setRefreshKey((key) => key + 1)} />
          {loading ? <div className="course-grid">{Array.from({ length: 6 }, (_, index) => <div className="course-skeleton" key={index}><span /><div /><div /><div /></div>)}</div> : courses.length ? (
            <>
              <div className="results-line"><span>{pagination.total} {pagination.total === 1 ? 'course' : 'courses'} to explore</span>{search && <button className="text-button" onClick={clearFilters}>Clear filters</button>}</div>
              <div className="course-grid">{courses.map((course, index) => <CourseCard key={course._id} course={course} index={index + (page - 1) * PAGE_SIZE} />)}</div>
              {pagination.pages > 1 && <div className="pagination-row"><span>Page {page} of {pagination.pages}</span><div><button className="page-button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>← <span>Previous</span></button><button className="page-button" disabled={page >= pagination.pages} onClick={() => setPage((current) => current + 1)}><span>Next</span> →</button></div></div>}
            </>
          ) : <EmptyState icon={Search} title="No courses found" message="Try a different search or loosen your filters. Your next big idea is still out there." action={<button className="button button-outline" onClick={clearFilters}>Reset filters</button>} />}
          {loading && <div className="sr-only"><InlineLoader /></div>}
        </div>
      </section>
      <section className="bottom-callout"><div className="container bottom-callout-inner"><span className="callout-spark">✳</span><div><span className="eyebrow">A PLACE TO BEGIN</span><h2>Small steps count.<br /><em>So does starting.</em></h2></div><a href="#courses" className="button button-light">Browse all courses <span>↗</span></a></div></section>
    </main>
  );
}
