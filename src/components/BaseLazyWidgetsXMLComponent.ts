import { BaseLazyWidgetsComponent } from './BaseLazyWidgetsComponent.js';
import { Property } from '@wonderlandengine/api';
import { XMLUIParser } from 'lazy-widgets';
import { makeLWWLEErrMsg } from '../core/makeLWWLEErrMsg.js';

import type { WLVirtualKeyboardRoot, WLVirtualKeyboardRootProperties } from '../core/WLVirtualKeyboardRoot.js';
import type { Widget, XMLUIParserContext, XMLUIParserConfig } from 'lazy-widgets';

export class BaseLazyWidgetsXMLComponent extends BaseLazyWidgetsComponent<WLVirtualKeyboardRoot, WLVirtualKeyboardRootProperties> {
    static override Properties = {
        ...BaseLazyWidgetsComponent.Properties,
        uiTreeName: Property.string('default'),
    };

    /** UI tree name in XML file. Defaults to 'default' */
    uiTreeName!: string;

    protected override async createWidget(_properties?: WLVirtualKeyboardRootProperties | undefined): Promise<Widget> {
        const xmlParser = this.createXMLParser();
        const parseXMLResult = await this.parseXML(xmlParser);

        if (!parseXMLResult || !Array.isArray(parseXMLResult) || parseXMLResult.length !== 2) {
            throw new Error(makeLWWLEErrMsg(this, 'returned no tuple with 2 elements on parseXML', "Make sure to return the parsed UI trees and the context as a 2-tuple in the parseXML method"));
        }

        const [uiTrees, context] = parseXMLResult;

        this.onXMLLoaded(uiTrees, context);

        const uiTree = uiTrees.get(this.uiTreeName);
        if (!uiTree) {
            throw new Error(makeLWWLEErrMsg(this, `loaded an XML UI successfully, but the wanted UI tree "${this.uiTreeName}" could not be found`, 'Make sure you are using the correct UI tree name. You can find this in the XML file being loaded.'));
        }

        this.onUITreePicked(uiTree, context);

        return uiTree;
    }

    /**
     * Parse the UI trees of an XML. Must be overridden.
     */
    protected parseXML(_xmlParser: XMLUIParser): Promise<[Map<string, Widget>, XMLUIParserContext]> {
        throw new Error(makeLWWLEErrMsg(this, 'does not implement the parseXML method', "Override the parseXML method to load an XML file's UI trees and context, and return them as a tuple in the format [uiTrees, context]"));
    }

    /**
     * Create an XML parser. Can be overridden, but creates a new XMLUIParser
     * with the default widgets already registered by default.
     */
    protected createXMLParser(): XMLUIParser {
        return new XMLUIParser();
    }

    /**
     * Get the properties to use for the XML parser. Can optionally be
     * implemented by child class. If not implemented, then the default options
     * are used.
     */
    protected getXMLParserConfig(): XMLUIParserConfig {
        return {};
    }

    /**
     * Called after the XML is loaded. Can optionally be implemented by child
     * class.
     */
    protected onXMLLoaded(_uiTrees: Map<string, Widget>, _context: XMLUIParserContext) {
        // does nothing by default
    }

    /**
     * Called after the wanted UI tree is loaded. Can optionally be implemented
     * by child class.
     */
    protected onUITreePicked(_uiTree: Widget, _context: XMLUIParserContext) {
        // does nothing by default
    }
}
