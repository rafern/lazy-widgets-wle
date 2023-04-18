import { FocusType, TextPasteEvent } from 'lazy-widgets';
import { WLRoot } from './WLRoot.js';

const listeningRoots = new Map<HTMLElement, [roots: Set<WLRoot>, listener: (event: ClipboardEvent) => void]>();

/**
 * Track WLRoot and add a paste event listener if not yet added.
 *
 * @internal
 */
export function addPasteEventListener(boundTo: HTMLElement, root: WLRoot) {
    // get list of listening roots
    const rootsListener = listeningRoots.get(boundTo);
    if (rootsListener) {
        // add to list of listening roots
        rootsListener[0].add(root);
    } else {
        // add event listener
        const roots = new Set([root]);
        const listener = function(event: ClipboardEvent) {
            // get best candidate root (who has focus?)
            let keyboardFocus = null, tabFocus = null, pointerFocus = null;
            for (root of roots as Set<WLRoot>) {
                if (!root.enabled) {
                    continue;
                }

                if (keyboardFocus === null && root.getFocus(FocusType.Keyboard) !== null) {
                    keyboardFocus = root;
                    break;
                } else if (tabFocus === null && root.getFocus(FocusType.Tab) !== null) {
                    tabFocus = root;
                } else if (pointerFocus === null && root.getFocus(FocusType.Pointer) !== null) {
                    pointerFocus = root;
                }
            }

            let bestCandidate = null;
            if (keyboardFocus) {
                bestCandidate = keyboardFocus;
            } else if (tabFocus) {
                bestCandidate = tabFocus;
            } else if (pointerFocus) {
                bestCandidate = pointerFocus;
            }

            // dispatch to best candidate
            if (bestCandidate) {
                event.preventDefault();
                if(event.clipboardData !== null) {
                    bestCandidate.dispatchEvent(new TextPasteEvent(event.clipboardData.getData('text')));
                }
            }
        };

        listeningRoots.set(boundTo, [roots, listener]);
        boundTo.addEventListener('paste', listener);

        // setup CSS needed to paste text
        boundTo.contentEditable = 'true';
        // remove styles auto-added by contentEditable
        boundTo.style.outline = '0px solid transparent';
        boundTo.style.caretColor = 'transparent';
        boundTo.style.cursor = 'default';
    }
}

/**
 * Untrack WLRoot and remove the paste event listener associated with the given
 * element if no WLRoots are using the DOM element anymore.
 *
 * @internal
 */
export function removePasteEventListener(boundTo: HTMLElement, root: WLRoot) {
    // untrack root
    const rootsListener = listeningRoots.get(boundTo);
    if (rootsListener) {
        const roots = rootsListener[0];
        roots.delete(root);

        if (roots.size === 0) {
            // no roots being tracked by this dom elem. remove dom elem and
            // listener
            boundTo.removeEventListener('paste', rootsListener[1]);
            listeningRoots.delete(boundTo);
        }
    }
}
