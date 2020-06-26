/*
 *  Power BI Visualizations
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 */
"use strict";
import "@babel/polyfill";
import * as React from "react";
import * as ReactDOM from "react-dom";
import powerbi from "powerbi-visuals-api";
import _ from 'lodash';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import DataView = powerbi.DataView;
import IViewport = powerbi.IViewport;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;

import VisualObjectInstance = powerbi.VisualObjectInstance;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import DataViewCategorical = powerbi.DataViewCategorical;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import PrimitiveValue = powerbi.PrimitiveValue;
import DataViewValueColumn = powerbi.DataViewValueColumn;
import IColorPalette = powerbi.extensibility.IColorPalette;

import { SpeckleVisual, initialState } from "./component";
import { VisualSettings } from "./settings";
import "./../style/visual.less";

export class Visual implements IVisual {
    private target: HTMLElement;
    private reactRoot: React.ComponentElement<any, any>;
    private settings: VisualSettings;
    private viewport: IViewport;
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private events: IVisualEventService;
    private colorPalette: IColorPalette;

    constructor(options: VisualConstructorOptions) {
        this.reactRoot = React.createElement(SpeckleVisual, {});
        this.target = options.element;
        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();
        this.events = options.host.eventService;
        this.colorPalette = this.host.colorPalette;
        ReactDOM.render(this.reactRoot, this.target);
    }

    public update(options: VisualUpdateOptions) {
        this.events.renderingStarted(options);
        if (options.dataViews && options.dataViews.length > 0) {
            const dataView: DataView = options.dataViews[0];
            this.viewport = options.viewport;
            const { width, height } = this.viewport;

            this.settings = VisualSettings.parse(dataView) as VisualSettings;
            const object = this.settings.speckle;

            let defaultRoomColor = _.get(object, "defaultRoomColor");
            let lineColor = _.get(object, 'lineColor');
            let exportpdf = _.get(object, 'exportpdf');

            let measureIndex = dataView.metadata.columns.findIndex(c=>c.isMeasure);
            let categoryIndex = dataView.metadata.columns.findIndex(c=>!c.isMeasure);
            let filterCategories = _.get(dataView, `categorical.categories[0].values`)
            let colorCategories = _.get(dataView, "categorical.values[0].values")
            let filterCategoryAttributeName = _.get(dataView, "metadata.columns["+categoryIndex+"].displayName")
            let colorCategoryAttributeName = _.get(dataView, "metadata.columns["+measureIndex+"].displayName")
            const measures: DataViewValueColumn = dataView.categorical.values[0];
            const measureValues = measures.values;
            const measureHighlights = measures.highlights;
            const valuesToHighlight = filterCategories.filter((category: PrimitiveValue, index: number) => {
                const measureValue = measureValues[index];
                const measureHighlight = measureHighlights && measureHighlights[index] ? measureHighlights[index] : null;
                return measureValue === measureHighlight
            });

            let isHighlighted = (obj) => {
                let objectProp = _.get(obj.properties, filterCategoryAttributeName);
                let idx = valuesToHighlight.indexOf(objectProp);
                return idx >= 0;
            }

            let hasHighlights = () =>  valuesToHighlight.length > 0;
            let getColor = obj => {
                let id = _.get(obj.properties, filterCategoryAttributeName)
                if (id) {
                    let idx = filterCategories.indexOf(id);
                    if (idx !== -1) return this.colorPalette.getColor(colorCategories[idx]).value.replace("#","");
                    else return defaultRoomColor.replace("#","");
                }
                return defaultRoomColor.replace("#","");
            }
            

            let getSelectionID = obj =>{
                let propValue = _.get(obj.properties,filterCategoryAttributeName)
                let trueIndex = filterCategories.indexOf(propValue); 
                return this.host.createSelectionIdBuilder().withCategory(dataView.categorical.categories[0],trueIndex).createSelectionId();
            }

            var speckleStreamURL = undefined
            try {
                if (object && object.specklestreamurl) {
                    const url = new URL(object.specklestreamurl)
                    speckleStreamURL = url.toString()
                }
            } catch (error) {
                this.events.renderingFailed(options);
                console.error("Invalid URL for Speckle Stream", error)
            }

            if (speckleStreamURL) {
                SpeckleVisual.update({
                    width,
                    height,
                    lineWeight: object && object.lineWeight ? object.lineWeight : undefined,
                    defaultRoomColor: defaultRoomColor,
                    camera: object && object.camera ? object.camera : undefined,
                    speckleStreamURL: speckleStreamURL,
                    getColor: getColor,
                    getSelectionID: getSelectionID,
                    selectionManager: this.selectionManager,
                    colorPalette: this.colorPalette,
                    isHighlighted: isHighlighted,
                    hasHighlights: hasHighlights,
                    exportpdf: exportpdf,
                    lineColor: lineColor,
                });
            }
        } else {
            this.clear();
        }
        this.events.renderingFinished(options);
    }

    private clear() {
        SpeckleVisual.update(initialState);
    }

    public enumerateObjectInstances(
        options: EnumerateVisualObjectInstancesOptions
    ): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {

        return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);
    }
}