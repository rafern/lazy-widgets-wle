import { type Material } from '@wonderlandengine/api';
import { type WLRootProperties } from '../core/WLRoot.js';
import { WLVirtualKeyboardRoot, WLVirtualKeyboardRootProperties } from '../core/WLVirtualKeyboardRoot.js';
import { NoDriverPropsBaseLazyWidgetsComponent } from './NoDriverPropsBaseLazyWidgetsComponent.js';

// TODO when dadouvic updates the api, use the @merge decorator on the class to
//      inherit properties from the parent component class. in this case in
//      particular, properties will be missing for this component, because the
//      current auto-inheritance behaviour is actually a bug

export class VirtualKeyboardUIRootComponent extends NoDriverPropsBaseLazyWidgetsComponent<WLVirtualKeyboardRoot, WLVirtualKeyboardRootProperties> {
    static override TypeName = 'virtual-keyboard-ui-root';

    forceDisabled!: boolean;

    override init() {
        this.forceDisabled = false;
        super.init();
    }

    override async createWLRoot(material: Material, properties: WLRootProperties): Promise<WLVirtualKeyboardRoot> {
        return new WLVirtualKeyboardRoot(this.object, material, properties);
    }

    override beforeWidgetUpdate(root: WLVirtualKeyboardRoot, _dt: number) {
        if (this.forceDisabled) {
            return false;
        }

        root.updateVisibility();
        return true;
    }

    override onActivate() {
        this.forceDisabled = false;
        super.onActivate();
    }

    override onDeactivate() {
        this.forceDisabled = true;
        super.onDeactivate();
    }
}
