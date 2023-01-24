import { PointerHint } from 'lazy-widgets';
import { WLRoot } from '../core/WLRoot';

// TODO use proper WLE types when official typescript support is released
declare const WL: any;

interface CanvasUIInputGuardComponent {
    init(): void;
    start(): void;
    update(dt: number): void;
    onDeactivate(): void;

    pointer: number | null;
    pointerComponent: any /*WL.Component*/ | null;
    keyboardComponent: any /*WL.Component*/ | null;
    keyboardObject: any /*WL.Object*/;
    pointerObject: any /*WL.Object*/;
    cursorObject: any /*WL.Object*/;
    keyboardComponentName: string;
    pointerComponentName: string;
}

WL.registerComponent('lazy-widgets-input-guard', {
    /** (optional) Name of component to disable if keyboard is in use */
    keyboardComponentName: {type: WL.Type.String, default: ''},
    /** (optional) Object containing component to disable if keyboard is in use. Required if keyboardComponentName is set, else, ignored */
    keyboardObject: {type: WL.Type.Object, default: null},
    /** (optional) Name of component to disable if pointer is hovering a UI root is in use */
    pointerComponentName: {type: WL.Type.String, default: ''},
    /** (optional) Object containing component to disable if pointer is hovering a UI root. Required if pointerComponentName is set, else, ignored */
    pointerObject: {type: WL.Type.Object, default: null},
    /** (optional) Object which has a cursor component. Required if pointerObject is set, else, ignored */
    cursorObject: {type: WL.Type.Object, default:null},
}, <CanvasUIInputGuardComponent>{
    init() {
        this.pointer = null;
        this.pointerComponent = null;
        this.keyboardComponent = null;
    },
    start() {
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
                    const cursor = this.cursorObject.getComponent('cursor', 0);
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

    },
    update(_dt) {
        if(this.keyboardComponent !== null) {
            const enable = !WLRoot.keyboardDriver.needsInput;
            this.keyboardComponent.active = enable;
        }

        if(this.pointer !== null && this.pointerComponent !== null) {
            const enable = (WLRoot.pointerDriver.getPointerHint(this.pointer) === PointerHint.None);
            this.pointerComponent.active = enable;
        }
    },
    onDeactivate() {
        if(this.keyboardComponent !== null) {
            this.keyboardComponent.active = true;
        }

        if(this.pointerComponent !== null) {
            this.pointerComponent.active = true;
        }
    },
});
