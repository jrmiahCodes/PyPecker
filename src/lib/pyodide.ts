import type { ExecutionResult, ValidationResult } from './types';

export type PyodideStatus = 'idle' | 'loading' | 'ready' | 'error';

const EXECUTION_TIMEOUT_MS = 10_000;
const WORKER_PATH = '/pyodide-worker.js';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timeoutHandle?: ReturnType<typeof setTimeout>;
}

interface WorkerMessage {
  type: 'ready' | 'result' | 'validation' | 'error';
  id: string;
  [key: string]: unknown;
}

class PyodideClient {
  private worker: Worker | null = null;
  private status: PyodideStatus = 'idle';
  private statusListeners = new Set<(s: PyodideStatus) => void>();
  private pending = new Map<string, PendingRequest>();
  private initPromise: Promise<void> | null = null;
  private nextId = 0;

  getStatus(): PyodideStatus {
    return this.status;
  }

  onStatusChange(listener: (s: PyodideStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private setStatus(status: PyodideStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach((l) => l(status));
  }

  async init(): Promise<void> {
    if (this.status === 'ready') return;
    if (this.initPromise) return this.initPromise;
    if (typeof window === 'undefined') {
      throw new Error('Pyodide can only be initialized in the browser');
    }
    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    this.setStatus('loading');
    try {
      const worker = new Worker(WORKER_PATH);
      worker.onmessage = this.handleMessage.bind(this);
      worker.onerror = (event) => {
        console.error('[pypecker] pyodide worker error', event.message || event);
        this.setStatus('error');
        this.rejectAllPending(new Error(event.message || 'Pyodide worker error'));
      };
      this.worker = worker;
      await this.sendRequest('init', {});
      this.setStatus('ready');
    } catch (err) {
      this.setStatus('error');
      this.initPromise = null;
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
      throw err;
    }
  }

  private handleMessage(event: MessageEvent<WorkerMessage>): void {
    const { type, id, ...data } = event.data;
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    if (pending.timeoutHandle) clearTimeout(pending.timeoutHandle);

    if (type === 'error') {
      pending.reject(new Error(String(data.message ?? 'unknown worker error')));
      return;
    }
    pending.resolve(data);
  }

  private sendRequest(
    type: string,
    payload: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<Record<string, unknown>> {
    if (!this.worker) {
      return Promise.reject(new Error('Pyodide worker not initialized'));
    }
    const id = String(++this.nextId);
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const request: PendingRequest = {
        resolve: resolve as (value: unknown) => void,
        reject,
      };
      if (timeoutMs) {
        request.timeoutHandle = setTimeout(() => {
          this.pending.delete(id);
          this.handleTimeout();
          reject(new Error(`Execution timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }
      this.pending.set(id, request);
      this.worker!.postMessage({ type, id, ...payload });
    });
  }

  private handleTimeout(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.rejectAllPending(new Error('Worker terminated due to timeout'));
    this.setStatus('idle');
    this.initPromise = null;
  }

  private rejectAllPending(err: Error): void {
    this.pending.forEach((p) => {
      if (p.timeoutHandle) clearTimeout(p.timeoutHandle);
      p.reject(err);
    });
    this.pending.clear();
  }

  async executePython(code: string): Promise<ExecutionResult> {
    try {
      await this.init();
      const result = (await this.sendRequest(
        'execute',
        { code },
        EXECUTION_TIMEOUT_MS,
      )) as { success: boolean; output: unknown; error?: string };
      return {
        success: result.success,
        output: result.output,
        error: result.error,
      };
    } catch (err) {
      return {
        success: false,
        output: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async validateAnswer(
    givenVariables: string,
    givenCode: string,
    userCode: string,
    expectedOutput: string,
    expectedType: string,
  ): Promise<ValidationResult> {
    try {
      await this.init();
      const result = (await this.sendRequest(
        'validate',
        { givenVariables, givenCode, userCode, expectedOutput, expectedType },
        EXECUTION_TIMEOUT_MS,
      )) as {
        correct: boolean;
        actualOutput: unknown;
        actualSerialized: string;
        expectedSerialized: string;
        error?: string;
      };
      return result;
    } catch (err) {
      return {
        correct: false,
        actualOutput: null,
        actualSerialized: '',
        expectedSerialized: expectedOutput,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

const pyodideClient = new PyodideClient();

export const initPyodide = (): Promise<void> => pyodideClient.init();

export const executePython = (code: string): Promise<ExecutionResult> =>
  pyodideClient.executePython(code);

export const validateAnswer = (
  givenVariables: string,
  givenCode: string,
  userCode: string,
  expectedOutput: string,
  expectedType: string,
): Promise<ValidationResult> =>
  pyodideClient.validateAnswer(
    givenVariables,
    givenCode,
    userCode,
    expectedOutput,
    expectedType,
  );

export const getPyodideStatus = (): PyodideStatus => pyodideClient.getStatus();

export const onPyodideStatusChange = (
  listener: (s: PyodideStatus) => void,
): (() => void) => pyodideClient.onStatusChange(listener);
