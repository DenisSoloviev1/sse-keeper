export interface SSEKeeperOptions {
  /**
   * Whether to send credentials (cookies) with the request
   * @default false
   */
  withCredentials?: boolean;

  /**
   * Whether to automatically connect on instance creation
   * @default true
   */
  autoConnection?: boolean;

  /**
   * Maximum number of reconnection attempts before giving up
   * @default 5
   */
  maxReconnectAttempts?: number;

  /**
   * Base reconnection interval in milliseconds
   * @default 3000
   */
  reconnectInterval?: number;

  /**
   * Maximum reconnection delay in milliseconds
   * @default 30000
   */
  maxReconnectDelay?: number;

  /**
   * Randomization factor for reconnection delay jitter (0-1)
   * @default 0.5
   */
  randomizationFactor?: number;
}