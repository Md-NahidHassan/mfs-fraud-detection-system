"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <h1>Unable to open the workspace</h1>
      <p>
        Please retry. If the issue continues, check the database connection and
        environment variables.
      </p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
