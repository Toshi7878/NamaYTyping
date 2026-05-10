import { db } from "../client";
import { fetchCollection } from "../firestore";
import type { UserResultModel } from "./model";
import { liveRefs } from "./path";

export const fetchLiveResultUsers = (
  liveId: string,
  resultId: string,
): Promise<UserResultModel[]> =>
  fetchCollection(liveRefs.resultUsers(db, liveId, resultId));
