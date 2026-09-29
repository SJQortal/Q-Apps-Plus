declare module 'webworker:getBlogWorker' {
  const value: new () => Worker;
  export default value;
}

declare module 'webworker:decodeBase64' {
  const value: new () => Worker
  export default value
}