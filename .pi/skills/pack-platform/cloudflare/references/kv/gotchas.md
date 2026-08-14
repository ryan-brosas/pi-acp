# KV Gotchas & Troubleshooting

## Eventual Consistency

```typescript
// [ ] BAD: Read immediately after write (may see stale globally)
await env.MY_KV.put("key", "value");
const value = await env.MY_KV.get("key"); // May be null in other regions

// [x] GOOD: Return confirmation without reading
await env.MY_KV.put("key", "value");
return new Response("Updated", { status: 200 });

// [x] GOOD: Use local value
const newValue = "updated";
await env.MY_KV.put("key", newValue);
return new Response(newValue);
```

**Propagation:** Writes visible immediately in same location, ≤60s globally.

## Concurrent Writes

```typescript
// [ ] BAD: Concurrent writes to same key (429 rate limit)
await Promise.all([
  env.MY_KV.put("counter", "1"),
  env.MY_KV.put("counter", "2")
]); // 429 error

// [x] GOOD: Sequential writes
await env.MY_KV.put("counter", "3");

// [x] GOOD: Unique keys for concurrent writes
await Promise.all([
  env.MY_KV.put("counter:1", "1"),
  env.MY_KV.put("counter:2", "2")
]);

// [x] GOOD: Retry with backoff
async function putWithRetry(kv: KVNamespace, key: string, value: string) {
  let delay = 1000;
  for (let i = 0; i < 5; i++) {
    try {
      await kv.put(key, value);
      return;
    } catch (err) {
      if (err.message.includes("429") && i < 4) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else throw err;
    }
  }
}
```

**Limit:** 1 write/second per key (all plans).

## Bulk Operations

```typescript
// [ ] BAD: Multiple individual gets (uses 3 operations)
const user1 = await env.USERS.get("user:1");
const user2 = await env.USERS.get("user:2");
const user3 = await env.USERS.get("user:3");

// [x] GOOD: Single bulk get (uses 1 operation)
const users = await env.USERS.get(["user:1", "user:2", "user:3"]);
```

**Note:** Bulk write NOT available in Workers (only via CLI/API).

## Null Handling

```typescript
// [ ] BAD: No null check
const value = await env.MY_KV.get("key");
const result = value.toUpperCase(); // Error if null

// [x] GOOD: Check for null
const value = await env.MY_KV.get("key");
if (value === null) return new Response("Not found", { status: 404 });
return new Response(value);

// [x] GOOD: Provide default
const value = (await env.MY_KV.get("config")) ?? "default-config";
```

## Value Limits

- Key size: 512 bytes max
- Value size: 25 MiB max
- Metadata: 1024 bytes max
- cacheTtl: 60s minimum

## Pricing

- **Reads:** $0.50 per 10M
- **Writes:** $5.00 per 1M
- **Deletes:** $5.00 per 1M
- **Storage:** $0.50 per GB-month

## When NOT to Use

- [ ] Strong consistency required → Durable Objects
- [ ] Write-heavy workloads → D1 or Durable Objects
- [ ] Relational queries → D1
- [ ] Large files (>25 MiB) → R2
- [ ] Atomic operations → Durable Objects

## When TO Use

- [x] Read-heavy workloads
- [x] Global distribution needed
- [x] Eventually consistent acceptable
- [x] Key-value access patterns
- [x] Low-latency reads critical
