# zk-calendar

Zero-knowledge calendar availability — prove a time slot is free without revealing your events.

Built on [OutLayer](https://github.com/Kampouse/near-outlayer) (NEAR Protocol). Calendar events are private input, only free slots come out. 179KB WASM, WASI P2, RFC 8984 compliant.

## How it works

```
Calendar events (private) → WASM execution → Free slots only (public)
```

Three actions:
- **`find_available`** — find all free slots in a time range
- **`verify`** — check if a specific slot is free
- **`prove`** — ZK proof (Noir circuit, WIP)

## Project structure

```
noir-circuit/     Noir ZK circuit (slot availability proof)
verifier-wasm/    Rust → WASI P2 WASM (RFC 8984 JSCalendar)
client/           Noir JS proof generation
```

## Build

```bash
# WASM verifier
cd verifier-wasm
cargo build --target wasm32-wasip2 --release
# → target/wasm32-wasip2/release/zk-calendar-tee.wasm
```

## Run locally

```bash
# Health check
echo '{"action":"health"}' | wasmtime run verifier-wasm/target/wasm32-wasip2/release/zk-calendar-tee.wasm

# Find free slots
echo '{"action":"find_available","range_start":"2026-05-19T08:00:00Z","range_end":"2026-05-19T22:00:00Z","slot_duration":"PT1H","events":[{"@type":"Event","uid":"1","start":"2026-05-19T09:00:00Z","duration":"PT1H","free_busy_status":"busy"},{"@type":"Event","uid":"2","start":"2026-05-19T12:00:00Z","duration":"PT2H","free_busy_status":"busy"}]}' | wasmtime run verifier-wasm/target/wasm32-wasip2/release/zk-calendar-tee.wasm
```

## Run on OutLayer (NEAR mainnet)

```js
await account.functionCall({
  contractId: 'outlayer.kampouse.near',
  methodName: 'request_execution',
  args: {
    source: { WasmUrl: {
      url: "https://github.com/Kampouse/zk-calendar/releases/download/v0.3.0/zk-calendar-tee.wasm",
      hash: "9c056bd74e5a479893d42595c92d283a66c0d4bb8fdfb3497d23886b5cc314f8",
      build_target: "wasm32-wasip2"
    }},
    resource_limits: { max_instructions: 100000000, max_memory_mb: 128, max_execution_seconds: 30 },
    input_data: JSON.stringify({
      action: "find_available",
      range_start: "2026-05-19T08:00:00Z",
      range_end: "2026-05-19T22:00:00Z",
      slot_duration: "PT1H",
      events: [/* JSCalendar events */]
    }),
    response_format: "Json"
  },
  gas: BigInt('100000000000000'),
  attachedDeposit: parseNearAmount('0.01')
});
```

## Live deployment

- **Contract:** `outlayer.kampouse.near`
- **Owner:** `kampouse.near`
- **WASM release:** [v0.3.0](https://github.com/Kampouse/zk-calendar/releases/tag/v0.3.0)
- **Repo:** [Kampouse/near-outlayer](https://github.com/Kampouse/near-outlayer)

## Input format (RFC 8984)

JSCalendar events with `free_busy_status`:

```json
{
  "@type": "Event",
  "uid": "1",
  "start": "2026-05-19T09:00:00Z",
  "duration": "PT1H",
  "free_busy_status": "busy"
}
```

Durations use ISO 8601: `PT1H`, `PT2H`, `PT1H30M`, etc.

## License

MIT
