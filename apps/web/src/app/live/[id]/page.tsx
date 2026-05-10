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
      <div className="mx-auto max-w-7xl space-y-3 lg:px-24">
        <h1>Live</h1>
        <ResultList liveId={id} />
      </div>
    </JotaiProvider>
  );
}
