export const withTimeout = <T>(
  fn: () => T | PromiseLike<T>,
  timeout: number
) => {
  const timeoutFn = () =>
    new Promise<T>((_, rej) => {
      setTimeout(() => rej(new Error("Timed out")), timeout);
    });

  return () => {
    return Promise.race([fn(), timeoutFn()]);
  };
};

export const wait = async (timeout: number) => {
  return new Promise<void>((res) => {
    setTimeout(res, timeout);
  });
};
