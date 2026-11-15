# Default values

Read during Prepare; resolve owner limits into the existing setup schema. This table is not that schema. Times below are milliseconds with readable equivalents; byte limits use decimal units.

| Configuration value | Default |
| --- | --- |
| `maxDecisions` | 50 |
| `matches` | 250 total matches (1,000 games) |
| `stop.maxWallMs` | `86400000` ms (24 hours) |
| `stop.maxBytes` | `50000000000` bytes (50 GB) |
| `timeoutsMs.evaluation` | `18000000` ms (5 hours) |
| `timeoutsMs.candidatePreparation` | `600000` ms (10 minutes) |
| `timeoutsMs.validation` | `300000` ms (5 minutes) |
| `timeoutsMs.replayBranchIncludingPrefix` | `300000` ms (5 minutes) |
| `timeoutsMs.ownedShutdownGrace` | `60000` ms (60 seconds) |

Contract constants, not overridable defaults: four games per match and `controlReserveBytes = 16000000` bytes (16 MB) protected inside the storage cap.
