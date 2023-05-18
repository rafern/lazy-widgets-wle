import { Component, Object as $Object, Property } from '@wonderlandengine/api';
import { PointerHint } from 'lazy-widgets';
import { WLRoot } from '../core/WLRoot.js';

import type { Cursor } from '@wonderlandengine/components';

// TODO use decorators

export class LazyWidgetsInputGuardComponent extends Component {
    /** (optional) Name of component to disable if keyboard is in use */
    keyboardComponentName!: string;
    /**
     * (optional) Object containing component to disable if keyboard is in use.
     * Required if keyboardComponentName is set, else, ignored
     */
    keyboardObject!: $Object | null;
    /**
     * (optional) Name of component to disable if pointer is hovering a UI root
     * is in use
     */
    pointerComponentName!: string;
    /**
     * (optional) Object containing component to disable if pointer is hovering
     * a UI root. Required if pointerComponentName is set, else, ignored
     */
    pointerObject!: $Object | null;
    /**
     * (optional) Object which has a cursor component. Required if pointerObject
     * is set, else, ignored
     */
    cursorObject!: $Object | null;
    /**
     * (optional) Name of cursor component. Shouldn't be changed if the official
     * cursor component is being used
     */
    cursorComponentName!: string;

    pointer!: number | null;
    pointerComponent!: Component | null;
    keyboardComponent!: Component | null;

    static override TypeName = 'lazy-widgets-input-guard';
    static override Properties = {
        keyboardComponentName: Property.string(),
        keyboardObject: Property.object(),
        pointerComponentName: Property.string(),
        pointerObject: Property.object(),
        cursorComponentName: Property.string('cursor'),
        cursorObject: Property.object(),
    };

    override init() {
        this.pointer = null;
        this.pointerComponent = null;
        this.keyboardComponent = null;
    }

    override start() {
        if(this.keyboardComponentName !== '') {
            if(this.keyboardObject !== null) {
                const keyboardComponents = this.keyboardObject.getComponents(this.keyboardComponentName);
                if(keyboardComponents.length === 0) {
                    this.warnComponentMissing('keyboardObject', this.keyboardComponentName);
                } else {
                    if (keyboardComponents.length !== 1) {
                        this.warnComponentClash('keyboardObject', this.keyboardComponentName);
                    }

                    this.keyboardComponent = keyboardComponents[0];
                }
            } else {
                this.warnObjectNotSet('keyboardObject', 'keyboardComponentName');
            }
        }

        if(this.pointerComponentName !== '') {
            if(this.pointerObject !== null) {
                const pointerComponents = this.pointerObject.getComponents(this.pointerComponentName);
                if(pointerComponents.length === 0) {
                    this.warnComponentMissing('pointerObject', this.pointerComponentName);
                    return;
                } else if (pointerComponents.length !== 1) {
                    this.warnComponentClash('pointerObject', this.pointerComponentName);
                }

                if(this.cursorObject !== null) {
                    const cursors: Array<Cursor> = this.cursorObject.getComponents(this.cursorComponentName);
                    if(cursors.length === 0) {
                        this.warnComponentMissing('cursorObject', this.cursorComponentName);
                    } else {
                        if (cursors.length !== 1) {
                            this.warnComponentClash('cursorObject', this.cursorComponentName);
                        }

                        this.pointer = WLRoot.getPointerID(cursors[0]);
                        this.pointerComponent = pointerComponents[0];
                    }
                } else {
                    console.warn(`Object in ${this.type} property "cursorObject" was not set, but the object property "pointerObject" was. Both need to be set. Did you forget to set the "cursorObject" property?`);
                }
            } else {
                this.warnObjectNotSet('pointerObject', 'pointerComponentName');
            }
        }
    }

    private warnObjectNotSet(objectPropName: string, componentPropName: string): void {
        console.warn(`Object in ${this.type} property "${objectPropName}" was not set, but the component name property "${componentPropName}" was. Did you forget to set the object?`);
    }

    private warnComponentMissing(objectPropName: string, componentName: string): void {
        console.warn(`Object in ${this.type} property "${objectPropName}" has no "${componentName}" component. Is the wrong object being used?`);
    }

    private warnComponentClash(objectPropName: string, componentName: string): void {
        console.warn(`Object in ${this.type} property "${objectPropName}" has multiple "${componentName}" components. First one will be used, which might be the wrong one. To fix this issue, split the components into multiple objects`);
    }

    override update(_dt: number) {
        if(this.keyboardComponent !== null) {
            const enable = !WLRoot.keyboardDriver.needsInput;
            this.keyboardComponent.active = enable;
        }

        if(this.pointer !== null && this.pointerComponent !== null) {
            const enable = (WLRoot.pointerDriver.getPointerHint(this.pointer) === PointerHint.None);
            this.pointerComponent.active = enable;
        }
    }

    override onDeactivate() {
        if(this.keyboardComponent !== null) {
            this.keyboardComponent.active = true;
        }

        if(this.pointerComponent !== null) {
            this.pointerComponent.active = true;
        }
    }
}
