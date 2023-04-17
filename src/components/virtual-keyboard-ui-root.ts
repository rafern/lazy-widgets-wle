import { Component, Material, Property } from '@wonderlandengine/api';
import { WLVirtualKeyboardRoot } from '../core/WLVirtualKeyboardRoot';

// TODO use decorators

export class VirtualKeyboardUIRootComponent extends Component {
    static override TypeName = 'virtual-keyboard-ui-root';
    static override Properties = {
        /** Material to apply the canvas texture to */
        material: Property.material(),
        /** (optional) Should the material be cloned? */
        cloneMaterial: Property.bool(),
    }

    material!: Material;
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
