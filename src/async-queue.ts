type AsyncQueueEOS = typeof EOS;

const EOS: unique symbol = Symbol("end-of-stream");

export type QueueEntry = {
  messageIndex: number;
  segmentIndex: number;
};

export class AsyncQueue<T extends QueueEntry> implements AsyncIterator<T> {
  values: T[];
  closed: boolean;
  resolvers: Array<(value: T | AsyncQueueEOS) => void>;

  constructor() {
    this.resolvers = [];
    this.values = [];
    this.closed = false;
  }

  enqueue(value: T) {
    if (this.closed) {
      throw new Error("queue is closed");
    }

    const resolve = this.resolvers.shift();

    if (resolve) {
      resolve(value);
    } else {
      this.values.push(value);
    }
  }

  async dequeue(): Promise<T | AsyncQueueEOS> {
    const value = this.values.shift();

    if (value) {
      return Promise.resolve(value);
    }

    if (this.closed) {
      return Promise.resolve(EOS);
    }

    return new Promise<T | AsyncQueueEOS>((resolve) => {
      this.resolvers.push(resolve);
    });
  }

  close() {
    while (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift();

      if (resolve) {
        resolve(EOS);
      }
    }
    this.closed = true;
  }

  [Symbol.asyncIterator]() {
    return this;
  }

  async next(): Promise<IteratorResult<T>> {
    const value = await this.dequeue();

    if (value == EOS) {
      return { value: undefined, done: true };
    }

    return { value, done: false };
  }

  clear() {
    this.close();
    this.values.length = 0;
  }
}
