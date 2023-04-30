import { Component, Material, Property } from '@wonderlandengine/api';
import { WLVirtualKeyboardRoot } from '../core/WLVirtualKeyboardRoot.js';

// TODO use decorators

export class VirtualKeyboardUIRootComponent extends Component {
    static override TypeName = 'virtual-keyboard-ui-root';
    static override Properties = {
        material: Property.material(),
        cloneMaterial: Property.bool(),
    };

    /** Material to apply the canvas texture to */
    material!: Material;
    /** (optional) Should the material be cloned? */
    cloneMaterial!: boolean;
    root!: WLVirtualKeyboardRoot;
    forceDisabled!: boolean;

    override init() {
        this.root = new WLVirtualKeyboardRoot(
            this.object,
            this.material,
            { cloneMaterial: this.cloneMaterial }
        );
        this.forceDisabled = false;
    }

    override update(_dt: number) {
        if(this.root && !this.forceDisabled) {
            this.root.updateVisibility();
            this.root.update();
        }
    }

    override onActivate() {
        if(this.root) {
            this.forceDisabled = false;
            this.root.enabled = true;
        }
    }

    override onDeactivate() {
        if(this.root) {
            this.forceDisabled = true;
            this.root.enabled = false;
        }
    }
}
