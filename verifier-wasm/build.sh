#!/bin/bash
set -e

echo "Building zk-calendar-tee for wasm32-wasip2..."

# Add wasip2 target if not present
rustup target add wasm32-wasip2 2>/dev/null || true

# Build
cargo build --target wasm32-wasip2 --release

echo "Build complete!"
echo "WASM file: target/wasm32-wasip2/release/zk_calendar_tee.wasm"
echo ""
echo "File size:"
ls -lh target/wasm32-wasip2/release/zk_calendar_tee.wasm
