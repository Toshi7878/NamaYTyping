import type { SaveLiveResultRequest } from "@repo/functions";
import type {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Timestamp,
  WithFieldValue,
} from "firebase/firestore";

export interface ResultModel {
  id: string;
  map: SaveLiveResultRequest["map"];
  createdAt: Timestamp;
  expireAt: Timestamp;
  userResults: SaveLiveResultRequest["userResults"];
}

type ResultDocument = Omit<ResultModel, "id">;

export const resultConverter: FirestoreDataConverter<
  ResultModel,
  ResultDocument
> = {
  toFirestore: ({ id: _id, ...data }: WithFieldValue<ResultModel>) => data,
  fromFirestore: (
    snapshot: QueryDocumentSnapshot<ResultDocument>,
    options: SnapshotOptions,
  ) => {
    const data = snapshot.data(options);
    return { id: snapshot.id, ...data };
  },
};
