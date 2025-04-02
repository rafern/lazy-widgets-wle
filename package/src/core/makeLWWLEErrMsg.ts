import type { Component } from '@wonderlandengine/api';

/**
 * Make an error message for a WLE integration error.
 *
 * @internal
 */
export function makeLWWLEErrMsg(component: Component, shortError: string, suggestion: string): string {
    const pathParts = ['"', component.object.name, '"'];
    let objFocus = component.object.parent;

    while (objFocus) {
        pathParts.push('"/', objFocus.name, '"');
        objFocus = objFocus.parent;
    }

    return `lazy-widgets component "${component.type}" ${shortError} in object "${pathParts.reverse().join('')}". ${suggestion}`;
}
