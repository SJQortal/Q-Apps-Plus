export const withTimeout = async <T>(ms: number, promise: Promise<T>): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
      timer = setTimeout(() => {
          reject(new Error(`Promise timed out after ${ms}ms`));
      }, ms);
  });

  try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timer);
      return result;
  } catch (error) {
      clearTimeout(timer);
      throw error;
  }
}