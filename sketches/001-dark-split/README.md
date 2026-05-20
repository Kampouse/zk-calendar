## Variant: Dark Split

### Design stance
High-contrast dark theme with emerald accent — privacy-first UI where calendar events are visually obfuscated (blur/glass) and only free slots glow.

### Key choices
- Layout: 3/2 split — calendar timeline on left, proof/results on right
- Typography: Inter for body, JetBrains Mono for hex values and timestamps
- Color: Dark base (#0a0c10–#232838), emerald accent (#10b981/#34d399), frosted glass for busy events
- Interaction: Three tabs (Calendar / Find Free / Prove) + Verify overlay modal. All wired to real JS logic.
- Privacy UX: Event titles are CSS `blur-sm`, busy blocks show only colored bars, "Not Revealed" section makes the zero-knowledge guarantee explicit

### Trade-offs
- Strong at: privacy trust-building (the "🛡 Not Revealed" section), three distinct user flows, dark theme readability
- Weak at: mobile layout (desktop-optimized split view), no real WASM/Noir integration (mock only)

### Best for
- Desktop users who want to prove availability without revealing calendar contents
- Demo/investor presentation of zk-calendar concept