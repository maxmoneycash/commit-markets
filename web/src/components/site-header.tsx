import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.6 8.21 11.16.6.11.82-.25.82-.57v-2c-3.34.71-4.04-1.58-4.04-1.58-.55-1.36-1.34-1.72-1.34-1.72-1.09-.73.08-.72.08-.72 1.2.08 1.84 1.21 1.84 1.21 1.07 1.8 2.81 1.28 3.49.98.11-.76.42-1.28.76-1.57-2.67-.3-5.47-1.3-5.47-5.8 0-1.28.47-2.33 1.24-3.15-.13-.3-.54-1.5.12-3.13 0 0 1.01-.32 3.3 1.2a11.6 11.6 0 0 1 6 0c2.29-1.52 3.3-1.2 3.3-1.2.66 1.63.25 2.83.12 3.13.77.82 1.23 1.87 1.23 3.15 0 4.51-2.8 5.5-5.48 5.79.43.36.81 1.08.81 2.18v3.23c0 .32.22.69.83.57A12.02 12.02 0 0 0 24 12.29C24 5.78 18.63.5 12 .5z" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 bg-background/80 px-2 backdrop-blur-sm">
      <div className="screen-line-bottom mx-auto flex h-(--header-height) max-w-3xl items-center justify-between border-x border-line px-4">
        <Link href="/" className="flex items-center gap-2 font-mono text-sm font-medium">
          <span className="inline-block size-2 rounded-[2px] bg-success" />
          <span className="tracking-tight">commit-markets</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/badges"
            className="rounded-md px-2 py-1 font-mono text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            badges
          </Link>
          <Link
            href="/waitlist"
            className="rounded-md px-2 py-1 font-mono text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            waitlist
          </Link>
          <a
            href="https://github.com/maxmoneycash/commit-markets"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <GitHubMark className="size-4" />
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
