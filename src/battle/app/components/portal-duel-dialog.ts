export function portalDuelDialog(node: HTMLElement): { destroy(): void } {
  if (node.closest(".shell-region--duel") === null) {
    return { destroy: () => undefined };
  }

  node.dataset.duelDialogPortal = "";
  document.body.appendChild(node);
  return {
    destroy() {
      node.remove();
    },
  };
}
