// Shared by the sync sources (Tasks 30–32). Task 32's run log records the
// message of whatever a sync throws; these two name the failures it can't retry.

/** Sent on every sync request: a polite, identifiable client. */
export const SYNC_USER_AGENT = "zaidmadanat.com sync (+https://zaidmadanat.com)";

/** The source answered, but not in the shape we expect. Nothing was written. */
export class SyncShapeError extends Error {
  constructor(source: string, detail: string) {
    super(`${source} sent an unexpected response: ${detail}`);
    this.name = "SyncShapeError";
  }
}

/** The source refused our credentials (revoked or expired grant). Nothing was written. */
export class SyncAuthError extends Error {
  constructor(source: string, detail: string) {
    super(`${source} refused the credentials: ${detail}`);
    this.name = "SyncAuthError";
  }
}
