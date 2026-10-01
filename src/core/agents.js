// The coding agents a friend can report for come from the backend (`data.agents`: kind, label,
// settings file), as does which friend each one reports to (`data.agentPets`: kind → pet id).
export const agentOf = (data, kind) => (data.agents || []).find(a => a.kind === kind);
export const agentLabel = (data, kind) => agentOf(data, kind)?.label || kind;

/** The agents that report to this friend, as display names. */
export function agentsOf(data, petId) {
  return Object.entries(data.agentPets || {})
    .filter(([, id]) => id === petId)
    .map(([kind]) => agentLabel(data, kind));
}
