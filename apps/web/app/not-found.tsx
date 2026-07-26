import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ padding: '3rem 1.5rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Page not found</h1>
      <p style={{ marginBottom: '1.5rem', color: '#555' }}>
        The page you requested does not exist.
      </p>
      <Link href="/admin/login">Go to admin login</Link>
    </main>
  );
}
