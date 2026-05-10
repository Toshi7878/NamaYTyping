import type { SaveLiveResultRequest } from "@repo/functions";

const saveLiveResultEndpoint = "https://saveliveresult-qx5y7pofqa-an.a.run.app";

export const createResultWithUser = async (input: SaveLiveResultRequest) => {
  const response = await fetch(saveLiveResultEndpoint, {
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      body?.error ?? `Failed to save live result: ${response.status}`,
    );
  }
};
