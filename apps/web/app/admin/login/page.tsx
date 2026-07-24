import { Suspense } from 'react';

import { LoginForm } from '@/features/auth/components/LoginForm';

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
