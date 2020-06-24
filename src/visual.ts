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
            let exportpdf = _.get(object, 'exportpdf');
            // console.log(exportpdf);

            let measureIndex = dataView.metadata.columns.findIndex(c=>c.isMeasure);
            let categoryIndex = dataView.metadata.columns.findIndex(c=>!c.isMeasure);
            // console.log("measure",measureIndex," category", categoryIndex)
            let filterCategories = _.get(dataView, `categorical.categories[0].values`)
            let colorCategories = _.get(dataView, "categorical.values[0].values")
            let filterCategoryAttributeName = _.get(dataView, "metadata.columns["+categoryIndex+"].displayName")
            let colorCategoryAttributeName = _.get(dataView, "metadata.columns["+measureIndex+"].displayName")
            // console.log(dataView.categorical.categories[0])
            const measures: DataViewValueColumn = dataView.categorical.values[0];
            const measureValues = measures.values;
            const measureHighlights = measures.highlights;
            console.log(dataView);
            // console.log(this.selectionManager.getSelectionIds());
            const valuesToHighlight = filterCategories.filter((category: PrimitiveValue, index: number) => {
                const measureValue = measureValues[index];
                const measureHighlight = measureHighlights && measureHighlights[index] ? measureHighlights[index] : null;
                return measureValue === measureHighlight
            
            });

            // console.log(valuesToHighlight)
            let roomColorMap = {};
            colorCategories.forEach((item, index) => roomColorMap[item] = filterCategories[index]);

            let sortObjs = objs => {
                var sorted = objs.sort((a,b)=>{
                    if(_.get(a.properties,filterCategoryAttributeName) < _.get(b.properties, filterCategoryAttributeName)) return -1;
                    if(_.get(a.properties, filterCategoryAttributeName) > _.get(b.properties, filterCategoryAttributeName)) return 1;
                    return 0;
                });
                return sorted;
            }
// 
            console.log("has highlights", valuesToHighlight.length > 0)
            let isHighlighted = (obj) => {
                let objectProp = _.get(obj.properties, filterCategoryAttributeName);
                let idx = valuesToHighlight.indexOf(objectProp);
                return idx >= 0;
            }

            let hasHighlights = () => {
                return valuesToHighlight.length > 0;
            }
            // let uniqueFICMs = [...new Set(dataView.categorical.values[0].values)]
            console.log(defaultRoomColor);
            let getColor = obj => {
                // console.log(obj);
                let id = _.get(obj.properties, filterCategoryAttributeName)
                // console.log(id, obj.properties, filterCategoryAttributeName)
                if (id) {
                    let idx = filterCategories.indexOf(id);
                    // console.log(id, idx);
                    if (idx !== -1) return this.colorPalette.getColor(colorCategories[idx]).value.replace("#","");
                    else return defaultRoomColor.replace("#","");
                }
                console.log(obj, "Default color");
                return defaultRoomColor.replace("#","");
            }
            
            let getUniqueProps = objs =>{
                let bigList = objs.map(obj=> _.get(obj.properties, colorCategoryAttributeName));
                return [...new Set(bigList)]
            }

            let getSelectionID = obj =>{
                // console.log(dataView.categorical.values[0]);
                let propValue = _.get(obj.properties,filterCategoryAttributeName)
                // console.log(dataView.categorical.categories[0].values)
                let trueIndex = filterCategories.indexOf(propValue); 
                // console.log(propValue, trueIndex);
                return this.host.createSelectionIdBuilder().withCategory(dataView.categorical.categories[0],trueIndex).createSelectionId();
            }

            // console.log(colorCategories, colorValues, colorCategoryAttributeName)

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
                    getUniqueProps: getUniqueProps,
                    isHighlighted: isHighlighted,
                    hasHighlights: hasHighlights,
                    sortObjs: sortObjs,
                    exportpdf: exportpdf
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