import { expectedCodexObjective } from './goal-status.js';
export function buildCodexGoalInstruction({ plan, goal }) {
  return {
    json: { objective: expectedCodexObjective(plan, goal) },
    text: [
      `LazyTrae active goal: ${goal.id} — ${goal.title}`,
      `Objective: ${goal.objective}`,
      `Read ${plan.briefPath}, ${plan.goalsPath} and ${plan.ledgerPath}.`,
      'Follow the lazytrae:ulw-loop skill. Read status --json for currentAttemptDir.',
      'Record actual evidence for every criterion, then use checkpoint --print-template.',
      'The repository ledger works without a host goal tool. Create a host goal only when explicitly requested; preserve any user budget.',
      'Respect cancellation, pauses, tool availability and host delegation rules.',
      'Complete the ledger and all requested delivery work before marking a host goal complete.',
    ].join('\n'),
  };
}
