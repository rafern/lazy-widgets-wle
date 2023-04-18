import { Component, Object as $Object } from '@wonderlandengine/api';
import { property } from '@wonderlandengine/api/decorators.js';
import { Cursor } from '@wonderlandengine/components';
import { PointerHint } from 'lazy-widgets';
import { WLRoot } from '../core/WLRoot.js';

// TODO use decorators

export class CanvasUIInputGuardComponent extends Component {
    /** (optional) Name of component to disable if keyboard is in use */
    @property.string()
    keyboardComponentName!: string;
    /**
     * (optional) Object containing component to disable if keyboard is in use.
     * Required if keyboardComponentName is set, else, ignored
     */
    @property.object()
    keyboardObject!: $Object | null;
    /**
     * (optional) Name of component to disable if pointer is hovering a UI root
     * is in use
     */
    @property.string()
    pointerComponentName!: string;
    /**
     * (optional) Object containing component to disable if pointer is hovering
     * a UI root. Required if pointerComponentName is set, else, ignored
     */
    @property.object()
    pointerObject!: $Object | null;
    /**
     * (optional) Object which has a cursor component. Required if pointerObject
     * is set, else, ignored
     */
    @property.object()
    cursorObject!: $Object | null;

    pointer!: number | null;
    pointerComponent!: Component | null;
    keyboardComponent!: Component | null;

    static override TypeName = 'lazy-widgets-input-guard';

    override init() {
        this.pointer = null;
        this.pointerComponent = null;
        this.keyboardComponent = null;
    }

    override start() {
        if(this.keyboardComponentName !== '') {
            if(this.keyboardObject !== null) {
                const keyboardComponent = this.keyboardObject.getComponent(this.keyboardComponentName, 0);
                if(keyboardComponent === null) {
                    console.warn('keyboardObject has no component with name', this.keyboardComponentName);
                } else {
                    this.keyboardComponent = keyboardComponent;
                }
            } else {
                console.warn('keyboardComponentName set in lazy-widgets-keyboard-guard, but keyboardObject was not');
            }
        }

        if(this.pointerComponentName !== '') {
            if(this.pointerObject !== null) {
                const pointerComponent = this.pointerObject.getComponent(this.pointerComponentName, 0);
                if(pointerComponent === null) {
                    console.warn('pointerObject has no component with name', this.pointerComponentName);
                    return;
                }

                if(this.cursorObject !== null) {
                    const cursor = this.cursorObject.getComponent(Cursor, 0);
                    if(cursor === null) {
                        console.warn('cursorObject set in lazy-widgets-keyboard-guard, but cursorObject has no cursor component');
                    } else {
                        this.pointer = WLRoot.getPointerID(cursor);
                        this.pointerComponent = pointerComponent;
                    }
                } else {
                    console.warn('pointerObject set in lazy-widgets-keyboard-guard, but cursorObject was not');
                }
            } else {
                console.warn('pointerComponentName set in lazy-widgets-keyboard-guard, but pointerObject was not');
            }
        }
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
