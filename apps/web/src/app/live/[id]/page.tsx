import { cn } from "@repo/ui";
import { TooltipWrapper } from "@repo/ui/tooltip";
import { CircleHelp } from "lucide-react";
import { VolumeRange } from "@/shared/volume-range";
import { ResultList } from "./_feature/list/container";
import { JotaiProvider } from "./_feature/store";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <JotaiProvider>
      <div className="mx-auto max-w-4xl space-y-3 ">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">リザルト一覧</h1>
            <ResultInfoTrigger />
          </div>
          <VolumeRange size="sm" />
        </header>

        <ResultList liveId={id} />
      </div>
    </JotaiProvider>
  );
}

function ResultInfoTrigger() {
  return (
    <TooltipWrapper
      label={
        "リザルトは曲終了時に自動で記録され、リアルタイムで更新されます。リザルトは12時間以上経過後に自動で削除されます。"
      }
      side="bottom"
      align="start"
      className="max-w-sm px-3 py-2"
      delayDuration={200}
      asChild
    >
      <button
        type="button"
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors",
          "hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <CircleHelp className="size-5" aria-hidden />
      </button>
    </TooltipWrapper>
  );
}
