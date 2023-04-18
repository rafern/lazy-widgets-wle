import { Component, Property } from '@wonderlandengine/api';
import { Label, Margin, Column, Row, TextInput, TextButton, Alignment, FlexAlignment, ValidatedVariable, Background, RoundedCorners } from 'lazy-widgets';
import { WLRoot } from '../../dist/index.js';

export class TestUIRoot extends Component {
    static TypeName = 'test-ui-root';
    static Properties = {
        /** Material to apply the canvas texture to */
        material: Property.material(),
    }

    init() {
        const label = new Label('Hello world!');
        this.root = new WLRoot(this.object, this.material,
            new RoundedCorners(
                new Background(
                    new Margin(
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
                        ])
                    ),
                ),
            ),
        );
    }

    update(_dt) {
        if(this.root) {
            this.root.update();
        }
    }

    onActivate() {
        if(this.root) {
            this.root.enabled = true;
        }
    }

    onDeactivate() {
        if(this.root) {
            this.root.enabled = false;
        }
    }
}
