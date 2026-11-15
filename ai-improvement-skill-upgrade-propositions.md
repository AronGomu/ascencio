# AI improvement skill upgrade propositions

Proposals for review; recording an idea here does not change the active skill or runner behavior.

## Start loss analysis when each slice finishes

Allow one analyst to start once all 250 matches in its assigned slice are finalized, reservations settled, and target-loss evidence verified. Continue evaluation concurrently with resource-aware admission. Keep one owner per slice and supply only allowlisted completed target-loss projections. Wait for the whole evaluation and all slice reports before global reason consolidation, replay, or candidate assembly.

Update the skill, reference protocol, controller gates and analysis tools together: the current preparer explicitly requires the entire evaluation to finish. Measure total evaluation-plus-analysis time and memory pressure to confirm the benefit.

## Report preparation progress and phase timings

Observed on 2026-11-15: preparation used roughly one CPU core for over 90 seconds while its redirected output remained empty and no slice was available. Emit bounded progress for receipt verification, queue discovery, projection, slice publication and remaining work. Record elapsed time, processed matches/losses, bytes and peak memory per phase. Follow-up observation: first-slice preparation ran for over three minutes at about one CPU core, reached roughly 698 MiB RSS, and accumulated 23.95 GB of logical reads before publishing the first slice; its output file stayed empty until completion. The full 2,500-job queue was produced before that first slice. Logical reads include cached reads and do not imply 23.95 GB of physical disk traffic. Distinguish active work from stalled work without repeatedly rescanning the whole run.

## Avoid a full-run discovery barrier before the first slice

The current analysis slice tool calls whole-evaluation discovery before publishing the first bounded slice. Investigate preparing and verifying one slice at a time, with immutable source hashes and resumable per-slice checkpoints. Reuse already verified evidence only when all source identities and hashes match. Measure redundant parsing and hashing before changing validation behavior.

## Initialize accounting before dispatch and retain lease ownership

This run exposed a cleanup failure when an ancestor storage budget appeared after calibration acquired a nested lease. Initialize the outer storage gate before calibration or any writer. Release leases using their acquisition root and token; never rediscover a different root during cleanup. Include a regression test for creating an ancestor budget during an active nested lease.

## Make calibration retry-and-exclude automatic

The designated calibration CLI stopped the entire invocation on an incomplete worker stage, requiring a separate recovery script. Persist attempts and successful measurements, retry a failed count once in a fresh evidence directory, then exclude that count and continue. Preserve integrity checks and diagnostic accounting. Reuse only measurements with matching runtime and workload identities.

## Distinguish wrapper exit from child-process completion

The shell reported exit 143 while the Node preparation child remained active. Track the owned process group and durable operation status so a wrapper exit cannot be mistaken for writer completion. Detect and report orphaned work; never launch a duplicate writer merely because its wrapper exited.

## Reduce review volume without dropping evidence

The first slice contains 236 loss-bearing match jobs. Its analyst reports 107 review pages for one game in the first job; even the smallest single-loss job supplies 294,015 bytes across 20 pages. Full ordered review remains mandatory. Measure page volume and tokens per loss, then investigate stronger lossless delta encoding, stable card/choice dictionaries, and compact navigation to decisions with full chronological context still available. Avoid fabricated unclear classifications or silent truncation. Persist page-level reading progress separately from completed-match findings so long reviews can resume without rereading every page; only fully reviewed matches should count toward coverage.

Follow-up serialization observation: the slice 2 analyst reports roughly 40,000 model tokens for even a smallest fully reviewed loss. Investigate dictionary encoding of repeated prompt/choice keys and null fields in the review format while preserving every event and exact choice ID. Use measured end-to-end review tokens and completed-loss throughput as acceptance metrics; do not substitute assumed coverage for review.

Measured throughput sample: slice 3 completed a 21-page, 300,760-byte loss review in 113,215 ms. A naive extrapolation over 5,019 losses with three analyst slots is about 52.6 hours, before other work; this is only a small early sample selected from short games, not a forecast. Add an early measured feasibility check against remaining wall time, with sampling provenance and an explicit path to improve lossless serialization. Never silently reduce review coverage or extend the budget.

## Validate card-instance labels across control changes

Two analysts independently reported contradictory visible identities for the same card instance after Creature Swap (slice 1 match-0063 and slice 2 match-0415). These are observations, not a confirmed projection bug. Preserve exact source/event references, compare prompt labels with visible target/move records, and test entity reconciliation across control changes. Do not infer tactical errors from ambiguous labels. Add a diagnostic integrity check if the source of the inconsistency can be established; ensure human-readable review labels never override authoritative IDs or reveal hidden information.

Verification of the Swap observation: the allowlisted loss log itself contains Kycoo code 88240808 in event 480 (decision) and Sheep Token code 73915052 in event 481 (target observation) for the reported same instance. The readable page formatter is therefore not the sole origin. Investigate recorded visible-state identity reconciliation upstream; this check does not establish engine-state corruption or replay invalidity.

Updated feasibility measurement (2026-11-15 14:05 UTC): canonical slice checkpoints contain 110 fully reviewed losses (46+33+31) after approximately 1.98 hours since the first claim, or 55.5 losses/hour across three analysts. Constant-rate remaining analysis is approximately 88.4 hours for 4,909 losses, excluding replay/assembly; early shortest-job selection makes this optimistic. This materially exceeds the remaining original wall budget. Use this as evidence for optimizing review representation and capacity planning, not as permission to reduce coverage or extend limits.

# Synthèse priorisée après arrêt demandé par le propriétaire

Statut : propositions uniquement, sauf correction du nettoyage de lease déjà appliquée. Aucun gain chiffré n'est garanti sans mesure. Le goulet dominant observé est la lecture par les analystes, pas l'exécution des parties.

| Priorité | Amélioration | Effet attendu / validation |
| --- | --- | --- |
| P0 | Encoder les valeurs par défaut, champs nuls et structures répétées une seule fois | Réduire les tokens tout en permettant une reconstruction exacte des événements et choix. |
| P0 | Remplacer les longs préfixes d'identifiants par un dictionnaire stable et réversible | Garder les identifiants exacts pour validation/replay, diminuer les répétitions. |
| P0 | Afficher les états par différences, avec état initial et références explicites | Réduire les cartes et observations répétées ; vérifier la reconstruction sans perte. |
| P0 | Compacter JSON et scaffolding des prompts à choix forcé | Préserver ordre, événement et choix unique ; ne supprimer aucune décision de la couverture requise. |
| P0 | Paginer selon le volume réel de sortie/tokens, avec limites et hash | Éviter les sorties tronquées et les relectures constatées chez les trois analystes. |
| P0 | Checkpoint de lecture au niveau page, standardisé et vérifiable | Reprendre exactement au prochain événement ; distinguer lecture partielle et verdict complet. |
| P0 | Contrôler tôt la faisabilité avec échantillon représentatif | Estimer coût par perte, pages/tokens, concurrence et délai restant avant de lancer une campagne trop grande. |
| P0 | Vérifier la continuité d'identité sur transfert de contrôle | Résoudre les contradictions après Swap et éviter les diagnostics inutilisables ou relectures de désambiguïsation. |
| P1 | Démarrer chaque analyste dès finalisation de sa tranche | Recouvrir évaluation et analyse ; budget CPU/RAM/stockage partagé, consolidation finale après barrière complète. |
| P1 | Découvrir/projeter une tranche sans découvrir préalablement tout le run | Réduire la latence avant le premier analyste ; conserver vérification de la tranche et preuve globale finale. |
| P1 | Réutiliser les reçus vérifiés et parseurs décodés lorsque les identités sont inchangées | Éviter lectures/hachages/parses répétés ; invalider exactement sur changement. |
| P1 | Ne construire les vues que pour les pertes, à la demande de la tranche | Réduire stockage et préparation inutile ; garder les logs source autoritaires. |
| P1 | Index compact événement/décision/carte avec références vers la chronologie complète | Accélérer navigation et mise en correspondance sans remplacer la lecture intégrale exigée. |
| P1 | Réduire les doublons source/vue/page et employer des références immuables | Diminuer les 30,62 Go observés ; conserver preuves requises et portée de comptage explicite. |
| P1 | Capacité d'analystes explicitement compatible avec le runtime | Trois slots enfants réels ici contre dix tranches ; mesurer débit et coût avant d'augmenter les slots. Aucun contournement des limites. |
| P1 | Prévoir le coût des tranches et des parties longues | Éviter une ETA basée uniquement sur les plus courtes pertes ; inclure nombre de pages et tokens. |
| P1 | Concurrence de préparation bornée et mesurée | Tester pipeline projection/publication pendant lecture, sans writers concurrents sur une même portée. |
| P1 | Protocole de calibration reprenable dans le CLI officiel | Retry unique puis exclusion, journal durable, pas de scripts de secours ad hoc nécessaires. |
| P1 | Réutiliser calibration seulement avec identité complète compatible | Éviter recalibration inutile ; inclure machine, runtime, fixture, workload et batch. |
| P1 | Préflight mémoire pour limiter les essais de workers voués à l'échec | Estimer mémoire par worker et préserver une réserve ; conserver les mesures et exclusions requises par la politique. |
| P1 | Initialiser comptabilité et stockage avant tout dispatch | Éviter le changement de racine qui a cassé le nettoyage de lease. |
| P1 | Libérer toute lease via sa racine et son token d'acquisition | Correction commencée sur le runner natif ; tester aussi les autres appelants et la création d'un budget parent pendant exécution. |
| P1 | État durable du groupe de processus, pas seulement du shell | Détecter le vrai writer actif après exit143, éviter doublons et fausses annonces d'arrêt. |
| P2 | Télémétrie bornée par phase avec heartbeat | Donner progression, débit, RSS, octets et temps ; ne pas rescanner tous les logs pour chaque statut. |
| P2 | Surveillance événementielle avec contrôle périodique léger | Remplacer le réveil modèle chaque minute quand rien ne change ; notifier publication, checkpoint significatif, erreur ou limite. |
| P2 | Tableau de bord de métadonnées de couverture | Montrer pertes réellement lues, sans confondre jobs sans pertes déjà complets avec analyses effectuées. |
| P2 | Vocabulaire partagé des raisons et fusion explicite | Réduire doublons de catégories entre analystes ; ne jamais appliquer automatiquement un verdict à une perte non lue. |
| P2 | Validation incrémentale des findings et cache de contexte figé | Réduire coût de soumission/relecture du contexte ; garder les hashes et validation des choix. |
| P2 | État courant et rapport synchronisés à chaque transition | Éviter qu'un ancien rapport d'incident reste la seule synthèse pendant une exécution reprise. |
| P2 | Benchmark séparé de préparation, lecture et replay | Mesurer pertes/heure, tokens/perte, premiers résultats, temps total et mémoire avant/après chaque changement. |

## Changements de politique possibles, nécessitant une décision explicite

- Autoriser une analyse en deux passes : triage automatique puis lecture approfondie ciblée. C'est potentiellement un gain majeur, mais incompatible avec l'exigence actuelle de lecture complète de chaque perte ; ne pas l'activer implicitement.
- Autoriser échantillonnage ou campagne initiale plus petite, puis expansion. Cela change la couverture ou la taille d'évaluation ; une comparaison et ses identités doivent rester cohérentes.
- Autoriser des lots de travail plus petits ou un équilibrage dynamique des analystes. Cela change la règle actuelle d'un propriétaire par tranche indivisible de 250 matchs ; prévoir une migration et l'absence de doublons.
- Autoriser une recherche des causes/correctifs avant analyse complète de toutes les tranches. Cela change la barrière globale actuelle ; éviter biais et promotion basée seulement sur un sous-ensemble favorable.
- Augmenter explicitement la capacité de modèles, le budget temporel ou les ressources. Cela peut augmenter le débit ou permettre de finir, mais ne réduit pas le travail par perte et n'est pas une optimisation en soi.

Ordre recommandé : format de lecture compact et reconstruction vérifiée ; checkpoints anti-troncature ; benchmark de débit ; correction des identités ; pipeline par tranche ; ensuite seulement dimensionnement et évolution éventuelle de politique.
