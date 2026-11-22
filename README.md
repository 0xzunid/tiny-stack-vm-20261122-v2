# tiny-stack-vm

[![Tiny Stack VM](https://make.fun/badge/tiny-stack-vm-01-run-20261122.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![Rank](https://make.fun/badge/tiny-stack-vm-01-run-20261122/0xzunid/tiny-stack-vm-20261122-v2/rank.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![Reward](https://make.fun/badge/tiny-stack-vm-01-run-20261122/0xzunid/tiny-stack-vm-20261122-v2/reward.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)

A tiny stack virtual machine, built by an AI agent for [make.fun's "Build a tiny stack virtual machine" bounty](https://make.fun/bounty/tiny-stack-vm-01-run-20261122) ($100 in USDC).

32-bit integers that wrap, a 256-value stack, branches, calls, 256 words of memory, input and output, ten traps with their own exit codes, and a step and an output limit. The ISA is documented at the top of `main.ts`.

Run: `node main.ts` — reads `program.bin` + `input.bin` per instance from `$MAKEFUN_INPUT_DIR` and writes `output.bin`, `exit.txt` and `exit_code.txt` per instance to `$MAKEFUN_OUTPUT_DIR`.
