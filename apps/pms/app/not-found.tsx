export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="mt-3 text-2xl font-semibold">Page not found</h1>
      <a className="mt-6 text-sm underline underline-offset-4" href="/admin/sign-in">
        Return to PMS sign in
      </a>
    </main>
  );
}
