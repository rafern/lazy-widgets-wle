import { Label, Column, Row, TextInput, TextButton, Alignment, FlexAlignment, ValidatedVariable, Background, RoundedCorners, ScrollableViewportWidget, AxisCoupling, Icon } from 'lazy-widgets';
import { BaseLazyWidgetsComponent } from 'lazy-widgets-wle';

export class TestUIRootComponent extends BaseLazyWidgetsComponent {
    static TypeName = 'test-ui-root';

    #testBanana;

    createWidget() {
        const label = new Label('Hello world!');

        this.#testBanana = new Icon('banana.png', {
            minWidth: 512, maxWidth: 512, minHeight: 512, maxHeight: 512,
        });

        return new RoundedCorners(
            new Background(
                new Column([
                    this.#testBanana,
                    new ScrollableViewportWidget(
                        new Column([
                            label,
                            new TextInput(new ValidatedVariable('', null).watch(variable => {
                                label.text = `Text input: ${variable.value}`;
                            })),
                            new Row([
                                new TextButton('Button 1'),
                                new TextButton('Button 2'),
                            ], {
                                multiContainerAlignment: {
                                    main: FlexAlignment.Center,
                                    cross: Alignment.Stretch
                                },
                            }).on('click', (ev) => label.text = `${ev.origin.child.text} clicked!`)
                        ]),
                        {
                            widthCoupling: AxisCoupling.Bi,
                            minHeight: 48
                        }
                    ),
                ])
            ),
        );
    }

    beforeWidgetUpdate(root, dt) {
        this.#testBanana.rotation += dt * Math.PI * 2;
        super.beforeWidgetUpdate(root, dt);
    }
}
