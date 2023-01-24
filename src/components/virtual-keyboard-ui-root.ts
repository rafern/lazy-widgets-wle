import { WLVirtualKeyboardRoot } from '../core/WLVirtualKeyboardRoot';

// TODO use proper WLE types when official typescript support is released
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const WL: any;

interface VirtualKeyboardUIRootComponent {
    init(): void;
    update(dt: number): void;
    onActivate(): void;
    onDeactivate(): void;

    root: WLVirtualKeyboardRoot;
    forceDisabled: boolean;
    object: any /*WL.Object*/;
    material: any /*WL.Material*/;
    active: boolean;
    cloneMaterial: boolean;
}

WL.registerComponent('virtual-keyboard-ui-root', {
    /** Material to apply the canvas texture to */
    material: {type: WL.Type.Material},
    /** Should the material be cloned? */
    cloneMaterial: {type: WL.Type.Bool, default: true},
}, <VirtualKeyboardUIRootComponent>{
    init() {
        this.root = new WLVirtualKeyboardRoot(
            this.object,
            this.material,
            { cloneMaterial: this.cloneMaterial }
        );
        this.forceDisabled = false;
    },
    update(_dt) {
        if(this.root && !this.forceDisabled) {
            this.root.updateVisibility();
            this.root.update();
        }
    },
    onActivate() {
        if(this.root) {
            this.forceDisabled = false;
            this.root.enabled = true;
        }
    },
    onDeactivate() {
        if(this.root) {
            this.forceDisabled = true;
            this.root.enabled = false;
        }
    },
});
