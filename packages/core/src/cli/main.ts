#!/usr/bin/env node

// svgreel CLI entry (see run.ts). React picks its development or production build when it is
// first loaded, so NODE_ENV is set before anything imports it: the production build renders
// frames several times faster. Set NODE_ENV=development to get React's warnings back.
process.env.NODE_ENV ??= "production";

await import("./run.js");

export {};
