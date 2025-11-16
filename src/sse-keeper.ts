import type { SSEKeeperOptions } from './types';

/**
 * Singleton class for managing Server-Sent Events (SSE) connections
 * Provides automatic reconnection, subscription management and error handling
 *
 * Default configuration:
 * - withCredentials: false
 * - autoConnection: true
 * - maxReconnectAttempts: 5
 * - reconnectInterval: 3000
 * - maxReconnectDelay: 30000
 * - randomizationFactor: 0.5
 *
 * @example
 * ```typescript
 * const sse = SSEKeeper.create('https://api.example.com/events', {
 *   withCredentials: true,
 *   maxReconnectAttempts: 10
 * });
 *
 * const unsubscribe = sse.subscribe('message', (data) => {
 *   console.log('Received:', data);
 * });
 *
 * // Later...
 * unsubscribe();
 * sse.destroy(); // Call this to completely clean up memory and remove from static storage
 * ```
 */
export class SSEKeeper {
  private static instances = new Map<string, SSEKeeper>();

  private baseUrl: string;

  private withCredentials = false;
  private autoConnection = true;

  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private maxReconnectDelay = 30000;
  private randomizationFactor = 0.5;

  private sse: EventSource | null = null;
  private reconnectAttempts = 0;
  private subscriptions: Map<string, Array<(event: MessageEvent) => void>> =
    new Map();

  /**
   * Creates a new SSEKeeper instance
   * @param baseUrl - The SSE endpoint URL
   * @param options - Configuration options
   */
  private constructor(baseUrl: string, options?: SSEKeeperOptions) {
    this.baseUrl = baseUrl;

    if (options) {
      this.withCredentials = options.withCredentials ?? this.withCredentials;
      this.autoConnection = options.autoConnection ?? this.autoConnection;

      this.maxReconnectAttempts =
        options.maxReconnectAttempts ?? this.maxReconnectAttempts;
      this.reconnectInterval =
        options.reconnectInterval ?? this.reconnectInterval;
      this.maxReconnectDelay =
        options.maxReconnectDelay ?? this.maxReconnectDelay;
      this.randomizationFactor =
        options.randomizationFactor ?? this.randomizationFactor;
    }

    if (this.autoConnection) {
      this.connect();
    }
  }

  /**
   * Gets or creates a singleton instance of SSEKeeper for the given URL
   *
   * @param baseUrl - The SSE endpoint URL
   * @param options - Configuration options
   * @returns SSEKeeper instance
   *
   * @example
   * ```typescript
   * // With custom options
   * const sse = SSEKeeper.create('/api/events', {
   *   withCredentials: true,
   * });
   *
   * // With default options
   * const sse = SSEKeeper.create('/api/events');
   * ```
   */
  static create(baseUrl: string, options?: SSEKeeperOptions): SSEKeeper {
    if (!SSEKeeper.instances.has(baseUrl)) {
      SSEKeeper.instances.set(baseUrl, new SSEKeeper(baseUrl, options));
    }

    return SSEKeeper.instances.get(baseUrl)!;
  }

  /**
   * Subscribes to a specific SSE event
   * Automatically parses JSON data or returns raw string
   *
   * @template T - The expected data type for the event
   * @param event - The event name to subscribe to
   * @param callback - Callback function that receives parsed event data
   * @returns Unsubscribe function - call to remove the event listener
   *
   * @example
   * ```typescript
   * // For JSON data
   * const unsubscribe = sse.subscribe<{ message: string }>('notification', (data) => {
   *   console.log(data.message);
   * });
   *
   * // For plain text
   * const unsubscribe = sse.subscribe<string>('log', (data) => {
   *   console.log(data);
   * });
   *
   * // Later...
   * unsubscribe();
   * ```
   */
  subscribe<T>(event: string, callback: (data: T) => void) {
    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        callback(data);
      } catch {
        callback(event.data);
      }
    };

    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, []);
    }

    this.subscriptions.get(event)!.push(handler);

    this.connect();

    if (this.sse && this.sse.readyState === EventSource.OPEN) {
      this.sse.addEventListener(event, handler);
    }

    return () => {
      if (this.sse) {
        this.sse.removeEventListener(event, handler);
      }

      const handlers = this.subscriptions.get(event);
      if (handlers) {
        this.subscriptions.set(
          event,
          handlers.filter((h) => h !== handler)
        );
        if (this.subscriptions.get(event)!.length === 0) {
          this.subscriptions.delete(event);
        }
      }
    };
  }

  /**
   * Establishes or returns existing SSE connection manually (useful when autoConnection: false)
   *
   * @throws {Error} If EventSource creation fails
   * @returns void
   *
   * @example
   * ```typescript
   * const sse = SSEKeeper.create('/events', { autoConnection: false });
   *
   * // Later...
   * sse.connect();
   * ```
   *
   */
  connect() {
    if (!this.sse) {
      try {
        this.sse = new EventSource(this.baseUrl, {
          withCredentials: this.withCredentials,
        });

        this.sse.onopen = () => {
          this.reconnectAttempts = 0;
          this.restoreSubscriptions();
        };

        this.sse.onerror = () => {
          this.reconnect();
        };
      } catch (error) {
        throw new Error(`SSE connection failed: ${error}`);
      }
    }
  }

  /**
   * Checks if the SSE connection is currently open and active
   *
   * @returns True if connection is open
   *
   * @example
   * ```typescript
   * if (sse.isConnected()) {
   *   console.log('Connection is active');
   * }
   * ```
   */
  isConnected() {
    return this.sse?.readyState === EventSource.OPEN;
  }

  /**
   * Closes the SSE connection and cleans up resources
   * Can be reopened by calling subscribe again
   *
   * @example
   * ```typescript
   * sse.close();
   * // Connection can be restarted later
   * ```
   */
  close() {
    if (this.sse) {
      this.sse.close();
      this.sse = null;
    }
  }

  /**
   * Completely destroys this SSE instance and cleans up static resources
   * Instance cannot be reused after destruction
   * Use this when you want to completely remove the instance from memory
   *
   * @example
   * ```typescript
   * sse.destroy();
   * ```
   */
  destroy() {
    this.close();
    this.subscriptions.clear();
    SSEKeeper.instances.delete(this.baseUrl);
  }

  /**
   * Handles automatic reconnection with exponential backoff
   * @private
   */
  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;

    let delay = Math.min(
      this.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    const jitter = (Math.random() - 0.5) * this.randomizationFactor * 2;
    delay *= 1 + jitter;

    setTimeout(() => {
      this.close();
      this.connect();
    }, delay);
  }

  /**
   * Restores all active subscriptions after reconnection
   * @private
   */
  private restoreSubscriptions() {
    if (!this.sse || this.sse.readyState !== EventSource.OPEN) return;

    this.subscriptions.forEach((handlers, event) => {
      handlers.forEach((handler) => {
        this.sse!.addEventListener(event, handler);
      });
    });
  }
}
