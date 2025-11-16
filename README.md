# SSE Keeper

A lightweight, dependency-free Server-Sent Events (SSE) connection manager with automatic reconnection and subscription management.

## Features

- 🔄 **Automatic reconnection** with exponential backoff and jitter
- 📝 **TypeScript support** with full type definitions
- 🔧 **Zero dependencies** - pure native implementation
- 🎯 **Singleton pattern** - one connection per URL
- 📡 **Subscription management** - automatic restoration after reconnection
- 🛡️ **Error handling** - robust connection failure recovery
- 🔒 **Credential support** - works with authenticated endpoints

## Installation

```bash
npm install sse-keeper
```

## Quick Start

```ts
import { SSEKeeper } from 'sse-keeper';

// Create SSE instance with custom options
const sse = SSEKeeper.create('https://api.example.com/events', {
  withCredentials: true,
  maxReconnectAttempts: 10,
});

// Create SSE instance with default options
const sse = SSEKeeper.create('https://api.example.com/events');

// Subscribe to events
const unsubscribe = sse.subscribe('message', (data) => {
  console.log('Received:', data);
});

// Unsubscribe when done
unsubscribe();

// Completely clean up when no longer needed
sse.destroy();
```

## Multiple Event Types

```ts
// JSON events
sse.subscribe<{ user: string; message: string }>('chat', (data) => {
  console.log(`${data.user}: ${data.message}`);
});

// Plain text events
sse.subscribe<string>('logs', (data) => {
  console.log('Log:', data);
});

// Multiple subscriptions
sse.subscribe('notifications', (data: Notification) => {
  // Handle notifications
});
```

## Connection Management

```ts
// Check connection status
if (sse.isConnected()) {
  console.log('SSE connection is active');
}

// Manual connect (useful when autoConnection: false)
sse.connect();

// Temporarily disconnect (subscriptions are preserved)
sse.close();

// Reconnect automatically on next subscribe() or manual connect()
sse.subscribe('updates', callback);

// Permanent cleanup — removes instance from memory
sse.destroy();
```

## Manual Connection Control

```ts
// Disable auto-connect on creation
const sse = SSEKeeper.create('/events', { autoConnection: false });

// Connect when ready
sse.connect();

// Later, disconnect without losing subscriptions
sse.close();

// Reconnect manually
sse.connect();
```

## Options

```ts
import type { SSEKeeperOptions } from 'sse-keeper';

const options: SSEKeeperOptions = {
  withCredentials: true,
  autoConnection: false,
};
```

## Options Types

```ts
interface SSEKeeperOptions {
  withCredentials?: boolean; // default: false
  autoConnection?: boolean; // default: true
  maxReconnectAttempts?: number; // default: 5
  reconnectInterval?: number; // ms, default: 3000
  maxReconnectDelay?: number; // ms, default: 30000
  randomizationFactor?: number; // 0–1, default: 0.5
}
```

## Why SSE Keeper?

**SSE Keeper** stands out from the native `EventSource` with advanced features like **automatic reconnection** (with exponential backoff and jitter), **subscription restoration** after reconnects, **singleton pattern**, and **TypeScript generics** — all while maintaining **zero dependencies** and full support for `withCredentials`.

Authentication is handled securely via **cookies or server-side sessions** — simply enable `withCredentials: true` and let your backend manage auth (e.g., via `httpOnly` cookies). No tokens in URLs, no client-side token management. Ideal for secure, type-safe real-time applications.

## License

MIT