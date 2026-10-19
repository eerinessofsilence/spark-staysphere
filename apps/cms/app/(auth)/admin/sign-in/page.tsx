import { adminAuthConfig } from '@/lib/application/container';
import { SignInForm } from './sign-in-form';

export const dynamic = 'force-dynamic';
export default function SignInPage() {
  const config = adminAuthConfig();
  return <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-5 py-12">
    <p className="text-lg font-semibold">StaySphere CMS</p>
    <h1 className="text-display text-4xl">Manage your hotel content.</h1>
    <p className="text-muted-foreground">Rooms, photography and 360° tours in one place.</p>
    <SignInForm />
    {config.demo && <p className="text-sm text-muted-foreground">Local demo password: staysphere</p>}
  </main>;
}
