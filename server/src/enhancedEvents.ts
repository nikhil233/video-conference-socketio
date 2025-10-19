import { EventEmitter } from 'events';

export class EnhancedEventEmitter<T = any> extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(Infinity);
  }

  safeEmit<K extends keyof T>(event: K, ...args: any[]): boolean {
    const numListeners = this.listenerCount(event as string);
    let error: Error | undefined;

    if (numListeners > 0) {
      try {
        this.emit(event as string, ...args);
      } catch (err) {
        error = err as Error;
      }
    }

    if (error) {
      throw error;
    }

    return numListeners > 0;
  }

  safeEmitAsPromise<K extends keyof T>(event: K, ...args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const numListeners = this.listenerCount(event as string);

      if (numListeners === 0) {
        resolve(undefined);
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error(`Event '${String(event)}' listener timeout`));
      }, 5000);

      this.once(event as string, (...args: any[]) => {
        clearTimeout(timeout);
        resolve(args[0]);
      });

      try {
        this.emit(event as string, ...args);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
}
