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

/** What an agent's row shows for where it stands (`agentLinks`, agent/connect.rs): the mark beside
 * its name, the button and whether it connects, or why only Copy settings is offered. Before the
 * backend answered it shows nothing. */
export function linkView(link) {
  switch (link) {
    case 'off':
      return { button: 'settings.connect', connect: true };
    case 'on':
      return { mark: 'settings.linked', button: 'settings.disconnect', connect: false };
    case 'outdated':
      return { mark: 'settings.link_outdated', button: 'settings.reconnect', connect: true };
    case 'unreadable':
      return { problem: 'settings.link_unreadable' };
    case 'taken':
      return { problem: 'settings.link_taken' };
    default:
      return {};
  }
}

/** The coding agents a person uses, in `kinds` order: linked (even with an older setting), with a
 * problem the row explains, or reporting to a friend still in the yard (a tool set up by copying has
 * no link to read). With none of those, the first one, which the list recommends. */
export function agentsInUse(kinds, links, chosen, petIds) {
  const used = kinds.filter(
    kind => ['on', 'outdated', 'taken', 'unreadable'].includes(links[kind]) || petIds.includes(chosen[kind]),
  );
  return used.length ? used : kinds.slice(0, 1);
}
