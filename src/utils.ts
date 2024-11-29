export const withTimeout = <T>(
  fn: () => T | PromiseLike<T>,
  timeout: number
) => {
  const timeoutFn = () => {
    return new Promise<T>((_, rej) => {
      setTimeout(() => rej(new Error("Timed out")), timeout);
    });
  };

  return () => {
    return Promise.race([fn(), timeoutFn()]);
  };
};

export const withRetry =
  <T>(fn: () => T | PromiseLike<T>, delay: number, max: number) =>
  async () => {
    let attempts = 0;

    while (max === -1 || attempts++ < max) {
      try {
        return Promise.resolve(await fn());
      } catch (error) {
        console.error("Error trying: ", error);
      }

      await wait(delay);
    }

    return Promise.reject(new Error("Failed with retry"));
  };

export const wait = async (timeout: number) => {
  return new Promise<void>((res) => {
    setTimeout(res, timeout);
  });
};
