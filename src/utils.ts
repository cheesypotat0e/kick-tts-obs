export const withTimeout = <T>(
  fn: (signal: AbortSignal) => T | PromiseLike<T>,
  timeout: number
) => {
  return () => {
    const signal = AbortSignal.timeout(timeout);

    return fn(signal);
  };
};

export const withRetry =
  <T>(fn: () => T | PromiseLike<T>, delay: number, max: number) =>
  async () => {
    let attempts = 0;

    while (max === -1 || attempts++ < max) {
      try {
        return await fn();
      } catch (error) {
        console.error("Error trying: ", error);
      }

      await wait(delay);
    }

    throw new Error(
      `Failed with retry after ${max === -1 ? "infinite" : max} tries`
    );
  };

export const wait = async (timeout: number) => {
  return new Promise<void>((res) => {
    setTimeout(res, timeout);
  });
};
