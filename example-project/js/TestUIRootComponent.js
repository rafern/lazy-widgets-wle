import { Label, Column, Row, TextInput, TextButton, Alignment, FlexAlignment, ValidatedVariable, Background, RoundedCorners, ScrollableViewportWidget, AxisCoupling } from 'lazy-widgets';
import { BaseLazyWidgetsComponent } from 'lazy-widgets-wle';

export class TestUIRootComponent extends BaseLazyWidgetsComponent {
    static TypeName = 'test-ui-root';

    createWidget() {
        const label = new Label('Hello world!');
        return new RoundedCorners(
            new ScrollableViewportWidget(
                new Background(
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
                ),
                {
                    widthCoupling: AxisCoupling.Bi,
                    minHeight: 48
                }
            ),
        );
    }
}
