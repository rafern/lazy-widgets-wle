import { BaseLazyWidgetsXMLComponent } from './BaseLazyWidgetsXMLComponent';
import { Property } from '@wonderlandengine/api';

import type { Widget, XMLUIParser, XMLUIParserConfig, XMLUIParserContext } from 'lazy-widgets';

export class BasicXMLUIRootComponent extends BaseLazyWidgetsXMLComponent {
    static override TypeName = 'basic-xml-ui-root';
    static override Properties = {
        ...BaseLazyWidgetsXMLComponent.Properties,
        xmlUrl: Property.string(),
        allowScripts: Property.bool(true),
    };

    /** URL to XML with UI */
    xmlUrl!: string;
    /** Should scripts in XML files be executed? */
    allowScripts!: boolean;

    protected override parseXML(xmlParser: XMLUIParser): Promise<[Map<string, Widget>, XMLUIParserContext]> {
        return xmlParser.parseFromURL(this.xmlUrl, this.getXMLParserConfig());
    }

    protected override getXMLParserConfig(): XMLUIParserConfig {
        return {
            allowScripts: this.allowScripts,
        }
    }
}
