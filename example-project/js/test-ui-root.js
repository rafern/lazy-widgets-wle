import { Label, Margin, Column, Row, TextInput, TextButton, Alignment, FlexAlignment, ValidatedVariable, Background, RoundedCorners, ScrollableViewportWidget, AxisCoupling } from 'lazy-widgets';
import { WLRoot } from '../../dist/index.esm.js';
/*global WL*/

WL.registerComponent('test-ui-root', {
    /** Material to apply the canvas texture to */
    material: {type: WL.Type.Material},
}, {
    init() {
        const label = new Label('Hello world!');
        this.root = new WLRoot(this.object, this.material,
            new RoundedCorners(
                // new ScrollableViewportWidget(
                    new Background(
                        new Margin(
                            new Column([
                                label,
                                new TextInput(new ValidatedVariable('', null, value => {
                                    label.text = `Text input: ${value}`;
                                }, false)),
                                new Row([
                                    new TextButton('Button 1'),
                                    new TextButton('Button 2'),
                                ], {
                                    multiContainerAlignment: {
                                        main: FlexAlignment.Center,
                                        cross: Alignment.Stretch
                                    },
                                }).on('click', (ev) => label.text = `${ev.origin.child.text} clicked!`)
                            ])
                        ),
                    ),
                //     {
                //         minHeight: 32,
                //         widthCoupling: AxisCoupling.Bi
                //     }
                // ),
            ),
        );
    },
    update(_dt) {
        if(this.root) {
            this.root.update();
        }
    },
    onActivate() {
        if(this.root) {
            this.root.enabled = true;
        }
    },
    onDeactivate() {
        if(this.root) {
            this.root.enabled = false;
        }
    },
});
