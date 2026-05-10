"use client";

import { type ResultModel, subscribeLiveResults } from "@repo/firestore";
import { atom, useAtomValue } from "jotai";
import { useEffect, useState } from "react";
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
  const [selectedResultIndex, setSelectedResultIndex] = useState<number>(0);

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
      unsubscribe();
      setResultList([]);
      setSelectedResultIndex(0);
    };
  }, [liveId]);

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

  const selectedResult = results[selectedResultIndex];

  return (
    <div className="grid gap-2">
      {results.map((result, index) => (
        <ResultCard key={result.id} result={result} initialInView={index < 6} />
      ))}
      {selectedResult && (
        <ResultDialog
          result={selectedResult}
          onClose={setSelectedResultIndex}
        />
      )}
    </div>
  );
};
