import { orderBy, query, type Unsubscribe } from "firebase/firestore";
import { db } from "../client";
import { subscribeCollection } from "../firestore";
import type { ResultModel } from "./model";
import { liveRefs } from "./path";

type SubscribeLiveResultsOptions = {
  liveId: string;
  onError?: (error: Error) => void;
  onNext: (results: ResultModel[]) => void;
};

export const subscribeLiveResults = ({
  liveId,
  onError,
  onNext,
}: SubscribeLiveResultsOptions): Unsubscribe =>
  subscribeCollection(
    query(liveRefs.results(db, liveId), orderBy("createdAt", "desc")),
    onNext,
    onError,
  );
