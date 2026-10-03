import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

/**
 * The form reads `?next=` with useSearchParams, which opts a route out of
 * prerendering unless it sits behind a Suspense boundary.
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={<main className="flex min-h-dvh items-center justify-center bg-canvas" />}
    >
      <LoginForm />
    </Suspense>
  );
}
