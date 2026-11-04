---
"svgreel": minor
---

Faster builds: `svgreel build` compiles variants in parallel worker threads and renders frames with React's production build, and the compiler parses frames and holds them in memory more efficiently. A composition with many variants builds many times faster (svgreel's 40-file promo: 100 s → 7 s on 16 cores), with identical output. `--jobs <n>` (`-j`) caps the number of workers (default: one per CPU; `--jobs 1` compiles in the main thread, as before). Because React now runs in production mode, its development warnings (such as unknown props) no longer show; set `NODE_ENV=development` to get them back.
