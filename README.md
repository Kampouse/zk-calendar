# zk-calendar

ZK Calendar Availability Proof — prove a time slot is free without revealing your calendar.

Runs on **OutLayer** (NEAR Protocol) via WASI P2 WASM execution. Calendar events go in as private input, only free slots come out.

## What it does

- **`find_available`** — Find free 1-hour slots in a time range, given busy events
- **`verify`** — Verify a specific slot is free (no conflicts)
- **`prove`** — Generate a ZK proof that a slot is free (Noir circuit, coming soon)

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Noir ZK Circuit │────▶│  WASM Verifier   │────▶│   OutLayer  │
│  (src/main.nr)   │     │  (verifier-wasm)  │     │  NEAR mainnet│
└─────────────────┘     └──────────────────┘     └─────────────┘
```

### noir-circuit/

Noir ZK circuit proving calendar slot availability without revealing events.

- Up to 32 busy slots (private input)
- Claimed free slot is public output
- Proves no overlap via range checks

### verifier-wasm/

Rust → WASI P2 WASM. RFC 8984 (JSCalendar) compliant input/output.

- `find_available` — slot detection across any range
- `verify` — conflict check for a specific slot
- ISO 8601 duration parsing (PT1H, PT2H, PT1H30M)
- UTCDateTime parsing/formatting
- 179KB WASM running in WASI P2

### client/

Noir JS + UltraHonk backend for proof generation.

## Usage

### Local (wasmtime)

```bash
# Build
cd verifier-wasm && cargo build --target wasm32-wasip2 --release

# Health check
echo '{"action":"health"}' | wasmtime run target/wasm32-wasip2/release/zk-calendar-tee.wasm

# Find free slots
echo '{"action":"find_available","range_start":"2026-05-19T08:00:00Z","range_end":"2026-05-19T22:00:00Z","slot_duration":"PT1H","events":[{"@type":"Event","uid":"1","start":"2026-05-19T09:00:00Z","duration":"PT1H","free_busy_status":"busy"}]}' | wasmtime run target/wasm32-wasip2/release/zk-calendar-tee.wasm
```

### OutLayer (NEAR mainnet)

```js
const result = await account.functionCall({
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
      events: [/* your JSCalendar events */]
    }),
    response_format: "Json"
  },
  gas: BigInt('100000000000000'),
  attachedDeposit: parseNearAmount('0.01')
});
```

## Live on NEAR

- **Contract:** `outlayer.kampouse.near`
- **Operator:** `outlayer.kampouse.near`
- **Owner:** `kampouse.near`
- **WASM release:** [v0.3.0](https://github.com/Kampouse/zk-calendar/releases/tag/v0.3.0)

## License

MIT
