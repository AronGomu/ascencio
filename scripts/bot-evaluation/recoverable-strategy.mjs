// Shared strategic scoring policy, bundled into the untrusted bot VM. It never
// receives engine handles, hidden opponent state, validation or evaluator APIs.
// Automatic recovery may change this module; all protected machinery stays out.
export function adjustScore(score) {
  return score;
}
