import {
	type CollectionReference,
	collection,
	type DocumentData,
	doc,
	type Firestore,
	type FirestoreDataConverter,
	getDocs,
	onSnapshot,
	type Query,
	type Unsubscribe,
} from "firebase/firestore";

export const typedCollection = <AppModel, DbModel extends DocumentData>(
	db: Firestore,
	path: string,
	converter: FirestoreDataConverter<AppModel, DbModel>,
) => collection(db, path).withConverter<AppModel, DbModel>(converter);

export const typedDoc = <AppModel, DbModel extends DocumentData>(
	db: Firestore,
	path: string,
	converter: FirestoreDataConverter<AppModel, DbModel>,
) => doc(db, path).withConverter<AppModel, DbModel>(converter);

export const fetchCollection = <T>(
	ref: CollectionReference<T> | Query<T>,
): Promise<T[]> =>
	getDocs(ref).then((snapshot) =>
		snapshot.docs.map((document) => document.data()),
	);

export const subscribeCollection = <T>(
	ref: CollectionReference<T> | Query<T>,
	onNext: (items: T[]) => void,
	onError?: (error: Error) => void,
): Unsubscribe =>
	onSnapshot(
		ref,
		(snapshot) => {
			onNext(snapshot.docs.map((document) => document.data()));
		},
		onError,
	);
