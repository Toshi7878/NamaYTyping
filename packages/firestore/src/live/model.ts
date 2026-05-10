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

export type UserResultModel = SaveLiveResultRequest["userResults"][number];

type ResultDocument = Omit<ResultModel, "id" | "userResults">;

export const resultConverter: FirestoreDataConverter<
  ResultModel,
  ResultDocument
> = {
  toFirestore: ({
    id: _id,
    userResults: _userResults,
    ...data
  }: WithFieldValue<ResultModel>) => data,
  fromFirestore: (
    snapshot: QueryDocumentSnapshot<ResultDocument>,
    options: SnapshotOptions,
  ) => {
    const data = snapshot.data(options);
    return { id: snapshot.id, ...data, userResults: [] };
  },
};

export const userResultConverter: FirestoreDataConverter<
  UserResultModel,
  UserResultModel
> = {
  toFirestore: (data: WithFieldValue<UserResultModel>) => data,
  fromFirestore: (
    snapshot: QueryDocumentSnapshot<UserResultModel>,
    options: SnapshotOptions,
  ) => snapshot.data(options),
};
