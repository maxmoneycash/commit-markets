// Panel primitive — composition adapted from chanhdai.com (ncdai), MIT.
import { cn } from "@/lib/utils";

export function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="panel"
      className={cn("screen-line-top screen-line-bottom border-x border-line", className)}
      {...props}
    />
  );
}

export function PanelHeader({ className, ...props }: React.ComponentProps<"header">) {
  return <header data-slot="panel-header" className={cn("screen-line-bottom px-4 py-3", className)} {...props} />;
}

export function PanelTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="panel-title"
      className={cn("font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground", className)}
      {...props}
    />
  );
}

export function PanelContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="panel-body" className={cn("p-4", className)} {...props} />;
}
