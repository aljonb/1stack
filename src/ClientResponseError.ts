/**
 * ClientResponseError is a custom Error class that normalizes errors
 * from the PocketBase API response.
 */
export class ClientResponseError extends Error {
  url: string = '';
  status: number = 0;
  response: Record<string, unknown> = {};
  isAbort: boolean = false;
  originalError: Error | null = null;

  constructor(errData?: unknown) {
    super('');

    // Set the prototype explicitly for proper instanceof checks
    Object.setPrototypeOf(this, ClientResponseError.prototype);

    this.name = 'ClientResponseError';

    if (errData !== null && typeof errData === 'object') {
      this.initFromObject(errData as Record<string, unknown>);
    } else if (errData !== null && errData !== undefined) {
      this.message = String(errData);
    }

    // Ensure message fallback
    if (!this.message) {
      if (this.isAbort) {
        this.message = 'The request was autocancelled.';
      } else if (this.status !== 0) {
        this.message = `Response status: ${this.status}`;
      } else {
        this.message = 'Something went wrong while processing your request.';
      }
    }
  }

  private initFromObject(data: Record<string, unknown>): void {
    this.url = typeof data.url === 'string' ? data.url : '';
    this.status = typeof data.status === 'number' ? data.status : 0;
    this.isAbort = !!data.isAbort;

    if (data.response !== null && typeof data.response === 'object') {
      this.response = data.response as Record<string, unknown>;
    } else if (data.data !== null && typeof data.data === 'object') {
      this.response = data.data as Record<string, unknown>;
    }

    if (typeof data.message === 'string') {
      this.message = data.message;
    } else if (typeof this.response?.message === 'string') {
      this.message = this.response.message;
    }

    if (data.originalError instanceof Error) {
      this.originalError = data.originalError;
    }
  }

  /**
   * Creates a new ClientResponseError from the given error.
   */
  static fromError(err: unknown): ClientResponseError {
    if (err instanceof ClientResponseError) {
      return err;
    }
    return new ClientResponseError(err);
  }

  /**
   * Converts the error to a plain object.
   */
  toJSON(): Record<string, unknown> {
    return {
      url: this.url,
      status: this.status,
      response: this.response,
      isAbort: this.isAbort,
      originalError: this.originalError,
    };
  }
}
