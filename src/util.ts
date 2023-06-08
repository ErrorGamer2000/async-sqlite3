export const resolver =
  <T extends any>(resolve: (v: T) => void, reject: (e: any) => void) =>
  (e: any, v: T) =>
    e ? reject(e) : resolve(v);

export type ResolverFn<T> = ReturnType<typeof resolver<T>>;

export const wrapper = <T extends any>(fn: (cb: ResolverFn<T>) => void) => new Promise<T>((resolve, reject) => fn(resolver<T>(resolve, reject)));
