import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Login</h1>
      <p className="text-sm text-black/70">Sign in with GitHub to continue to sessions.</p>
      <Link className="inline-block rounded bg-black px-4 py-2 text-white" href="/api/auth/signin">
        Continue with GitHub
      </Link>
    </main>
  );
}
