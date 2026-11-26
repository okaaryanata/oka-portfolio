// Pure state transitions shared by the UI and unit tests.
export function applySnapshot(state, snapshot) {
  if (!Number.isInteger(snapshot.revision) || snapshot.revision < state.revision) return state;
  return {...state, revision:snapshot.revision, messages:snapshot.messages, conversation:snapshot.conversation ?? null};
}
export function visibleMessages(messages, filter) {
  return messages.filter(message=>filter==='starred'?message.starred:filter==='pinned'?message.pinned:true);
}
export function receipt(message) { return message.read?'Read':message.delivered?'Delivered':'Sent'; }
export function retryCommands(pending) { return [...pending.values()]; }
