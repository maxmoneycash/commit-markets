import Link from "next/link";

export default function NotFound() {
  return (
    <main className="px-2">
      <div className="mx-auto flex min-h-[calc(100svh-var(--header-height))] max-w-3xl flex-col items-center justify-center border-x border-line px-6 text-center">
        <div className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-destructive">
          delisted
        </div>
        <h1 className="font-mono text-3xl font-bold tracking-tight text-foreground">
          ticker not found
        </h1>
        <p className="mt-3 max-w-md font-mono text-sm text-muted-foreground">
          That GitHub handle or repo doesn&apos;t exist, is private, or has no public
          commit history to chart.
        </p>
        <Link
          href="/"
          className="mt-8 rounded-md bg-primary px-5 py-3 font-mono text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          list another ticker
        </Link>
      </div>
    </main>
  );
}
