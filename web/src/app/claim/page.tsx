import type { Metadata } from "next";
import { Panel } from "@/components/panel";
import { ClaimForm } from "./claim-form";

export const metadata: Metadata = {
  title: "Claim your $TICKER — commits.sh",
  description: "Prove you own your GitHub account and put a verified ✓ on your commits.sh ticker.",
};

export default async function ClaimPage({ searchParams }: { searchParams: Promise<{ handle?: string }> }) {
  const { handle } = await searchParams;
  return (
    <main className="px-2">
      <div className="mx-auto max-w-xl">
        <Panel>
          <ClaimForm initialHandle={handle ?? ""} />
        </Panel>
      </div>
    </main>
  );
}
