export class RateLimiter {
  private requestsPerUser: Map<
    string,
    { requests: number; timestamp: number; rateLimit: RateLimit }
  > = new Map();

  constructor(
    records?: IterableIterator<[string, { period: number; requests: number }]>
  ) {
    if (records) {
      for (const [username, { period, requests }] of records) {
        this.requestsPerUser.set(username, {
          rateLimit: { period, requests },
          requests: 0,
          timestamp: Date.now(),
        });
      }
    }
  }

  public canRequest(username: string) {
    if (this.requestsPerUser.has(username)) {
      const {
        requests,
        timestamp,
        rateLimit: { period, requests: max },
      } = this.requestsPerUser.get(username)!;

      const timestampInt = Math.floor(timestamp / period);
      const nowInt = Math.floor(Date.now() / period);

      if (timestampInt < nowInt) {
        this.requestsPerUser.get(username)!.timestamp = Date.now();
        this.requestsPerUser.get(username)!.requests = 0;
        return true;
      }

      if (requests >= max) {
        return false;
      }
    }

    return true;
  }

  public addRequest(username: string) {
    if (this.requestsPerUser.has(username)) {
      this.requestsPerUser.get(username)!.requests++;
    }
  }

  public setRecord(username: string, rateLimit: RateLimit) {
    this.requestsPerUser.set(username, {
      requests: 0,
      timestamp: Date.now(),
      rateLimit,
    });
  }

  public removeRecord(username: string) {
    this.requestsPerUser.delete(username);
  }
}

export type RateLimit = {
  requests: number;
  period: number;
};
