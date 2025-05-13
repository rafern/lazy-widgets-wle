import { Background, RoundedCorners, Icon } from 'lazy-widgets';
import { BaseLazyWidgetsComponent } from 'lazy-widgets-wle';

export class TestAnimatedUIRootComponent extends BaseLazyWidgetsComponent {
    static TypeName = 'test-animated-ui-root';

    #testBanana;

    createWidget() {
        this.#testBanana = new Icon('banana.png', {
            minWidth: 512, maxWidth: 512, minHeight: 512, maxHeight: 512,
        });

        return new RoundedCorners(new Background(this.#testBanana));
    }

    beforeWidgetUpdate(root, dt) {
        this.#testBanana.rotation += dt * Math.PI * 2;
        super.beforeWidgetUpdate(root, dt);
    }
}
