// P1-025: persistence + authorization + concurrency-enforcement
// repository layer. HTTP handlers wiring these to the frozen OpenAPI
// operations land in P1-026.
export * from "./db/pool.js";
export * as repositories from "./repositories/index.js";
