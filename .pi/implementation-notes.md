# Implementation notes

## Schema enforce activation

- Global: /home/utopia/.pi/agent/fabric.json -> schema.mode enforce (prewalk removed).
- Project: .pi/fabric.json -> schema.mode enforce + trustedCommands.canonical-check = node scripts/check.mjs.
- Live session: schema.status() reports mode enforce; pi.bash / pi.edit / pi.write are gated; the hypothesize -> verify -> commit loop is the only mutation path.
- This file was written by the first schema.commit in this repository - the enforce loop is operational.
