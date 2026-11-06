# Contributing to Odyssey

Thanks for helping. This is a testnet prototype (Arkiv Rabdi, 0G Galileo): nothing here holds real money yet, and the contracts are not audited.

## Get it running

Full setup, env vars and faucets are in the [README](README.md#setup). The short version:

```bash
cd web-monorepo && npm install
cp apps/web/.env.example apps/web/.env    # fill every uncommented value
npm run dev                               # http://localhost:3000

cd contracts && git submodule update --init --recursive
```

Firmware lives in `firmware/odsy_glasses_camera` (Arduino, ESP32).

## Before you open a PR

Run these and make sure they pass:

```bash
cd web-monorepo && npm run lint && npm test && npm run build
cd contracts && forge test
```

If you changed a flow that needs a live network (ingest, subscriptions, rewards, bans), follow the matching part of [TESTING.md](TESTING.md) and say in the PR what you ran.

## How we work

- **Branch off `main`**, open a PR back into it. No direct pushes to `main`.
- **Small, focused commits.** Keep each commit under 1000 changed lines (lockfiles excepted); split big changes by area.
- **Commit messages:** a summary line with a type and area, then what changed and why. Types in use: `feat`, `fix`, `docs`, `chore`; areas: `web`, `contracts`, `firmware`, `skills`. Example: `fix(web): read only the recent blocks the Arkiv RPC serves`.
- **Keep it simple.** Build only what is needed now: no options, abstractions or files for hypothetical future needs. Known limits get a `shortcut: <the limit>, <when to upgrade>` comment. See [AGENTS.md](AGENTS.md).
- **Update the docs with the code.** New routes, env vars or scripts go in the README, `.env.example` and, if they change a test step, TESTING.md. Finished work goes in [MILESTONE.md](MILESTONE.md), open work in [PLAN.md](PLAN.md).
- **Solidity changes:** prefer audited OpenZeppelin components, add Foundry tests, and run the `solidity-auditor` skill before any deploy.

## Using AI assistants

AI coding tools are welcome. Agents follow [AGENTS.md](AGENTS.md) (Claude Code loads it through `CLAUDE.md`, Cursor through `.cursor/rules`). You are responsible for what you submit: read and test it.

## Security

- Never commit secrets. `.env` is git-ignored; only `.env.example` with empty values belongs in the repo.
- Use throwaway testnet wallets. Do not reuse a key that has ever held real funds.
- Found a vulnerability? Do not open a public issue. Contact the maintainers privately through [AnaSyLabs on GitHub](https://github.com/AnaSyLabs).

## License

By contributing you agree that your work is released under the [MIT License](LICENSE).
