"use client";

import {
  fetchLiveResultUsers,
  type ResultModel,
  subscribeLiveResults,
} from "@repo/firestore";
import { atom, useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { store } from "../store";
import { ResultCard } from "./card/card";
import { ResultDialog } from "./result-dialog";

const resultListAtom = atom<ResultModel[]>([]);
export const useResultList = () => useAtomValue(resultListAtom);
export const setResultList = (results: ResultModel[]) =>
  store.set(resultListAtom, results);

interface ResultListProps {
  liveId: string;
}

export const ResultList = ({ liveId }: ResultListProps) => {
  const results = useResultList();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState<ResultModel | null>(
    null,
  );
  const [loadingResultId, setLoadingResultId] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const selectRequestIdRef = useRef(0);

  useEffect(() => {
    setIsLoading(true);

    const unsubscribe = subscribeLiveResults({
      liveId,
      onNext: (nextResults) => {
        setResultList(nextResults);
        setIsLoading(false);
      },
    });

    return () => {
      selectRequestIdRef.current += 1;
      unsubscribe();
      setResultList([]);
      setSelectedResult(null);
      setLoadingResultId(null);
      setResultError(null);
    };
  }, [liveId]);

  const handleSelect = async (result: ResultModel) => {
    const requestId = selectRequestIdRef.current + 1;
    selectRequestIdRef.current = requestId;
    setLoadingResultId(result.id);
    setResultError(null);

    try {
      const userResults = await fetchLiveResultUsers(liveId, result.id);

      if (selectRequestIdRef.current === requestId) {
        setSelectedResult({ ...result, userResults });
      }
    } catch (error) {
      if (selectRequestIdRef.current === requestId) {
        setResultError(
          error instanceof Error ? error.message : "Failed to load results",
        );
      }
    } finally {
      if (selectRequestIdRef.current === requestId) {
        setLoadingResultId(null);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-md border border-border/60 px-4 py-3 text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="rounded-md border border-border/60 px-4 py-3 text-muted-foreground text-sm">
        No results
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {results.map((result, index) => (
        <ResultCard
          key={result.id}
          result={result}
          initialInView={index < 6}
          onSelect={() => {
            void handleSelect(result);
          }}
        />
      ))}
      {loadingResultId && (
        <div className="rounded-md border border-border/60 px-4 py-3 text-muted-foreground text-sm">
          Loading results...
        </div>
      )}
      {resultError && (
        <div className="rounded-md border border-destructive/60 px-4 py-3 text-destructive text-sm">
          {resultError}
        </div>
      )}
      {selectedResult && (
        <ResultDialog
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
        />
      )}
    </div>
  );
};
