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
import ILocalVisualStorageService = powerbi.extensibility.ILocalVisualStorageService;
import { createTooltipServiceWrapper, TooltipEventArgs, ITooltipServiceWrapper } from "./tooltipServiceWrapper";
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import PrimitiveValue = powerbi.PrimitiveValue;
import DataViewValueColumn = powerbi.DataViewValueColumn;
import IColorPalette = powerbi.extensibility.IColorPalette;

import { SpeckleVisual, initialState } from "./component";
import { VisualSettings } from "./settings";
import "./../style/visual.less";

export class Visual implements IVisual {
    // Give the visual access to Custom Visual Services (palette, events, tooltips)
    private target: HTMLElement;
    private reactRoot: React.ComponentElement<any, any>;
    private settings: VisualSettings;
    private viewport: IViewport;
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private events: IVisualEventService;
    private colorPalette: IColorPalette;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private storage: ILocalVisualStorageService;

    constructor(options: VisualConstructorOptions) {
        // Initial setup
        this.reactRoot = React.createElement(SpeckleVisual, {});
        this.target = options.element;
        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();
        this.events = options.host.eventService;
        this.colorPalette = this.host.colorPalette;
        this.storage = options.host.storageService;
        ReactDOM.render(this.reactRoot, this.target);
    }

    public update(options: VisualUpdateOptions) {
        // It looks like the desktop client just ignores renderingStarted/renderingFinished? right now we have it but it might be useless
        this.events.renderingStarted(options);
        this.colorPalette = this.host.colorPalette;

        if (options.dataViews && options.dataViews.length > 0) { //If we actually have data show the visual
            const dataView: DataView = options.dataViews[0];
            this.viewport = options.viewport;
            const { width, height } = this.viewport;

            this.settings = VisualSettings.parse(dataView) as VisualSettings;
            const object = this.settings.speckle;

            let defaultRoomColor = _.get(object, "defaultRoomColor");
            let lineColor = _.get(object, 'lineColor');
            let exportpdf = _.get(object, 'exportpdf');
            let exportSource = _.get(object, 'exportsource');


            // Power BI input information - the schema is absurdly confusing so please try to keep this the way it i
            let measureIndex = dataView.metadata.columns.findIndex(c=>c.isMeasure);
            let categoryIndex = dataView.metadata.columns.findIndex(c=>!c.isMeasure);
            let filterCategories = _.get(dataView, `categorical.categories[0].values`)
            let colorCategories = _.get(dataView, "categorical.values[0].values")
            let filterCategoryAttributeName = _.get(dataView, "metadata.columns["+categoryIndex+"].displayName")
            let colorCategoryAttributeName = _.get(dataView, "metadata.columns["+measureIndex+"].displayName")


            // One function to handle if either rhino or revit, where the properties are stored in different ways
            function getRoomProperty(obj){
                if(exportSource === 'Rhino') return _.get(obj, 'properties.Room');
                else if (exportSource === 'Revit') return _.get(obj, 'properties.parameters.Comments');
                else return null;
            }

            const measures: DataViewValueColumn = dataView.categorical.values[0];
            const measureValues = measures.values;
            const measureHighlights = measures.highlights;

            // Returns a list of values that should be highlighted in the visual
            const valuesToHighlight = filterCategories.filter((category: PrimitiveValue, index: number) => {
                const measureValue = measureValues[index];
                const measureHighlight = measureHighlights && measureHighlights[index] ? measureHighlights[index] : null;
                return measureValue === measureHighlight
            });

            // I think this isnt needed? but not sure
            let roomColorMap = {};
            colorCategories.forEach((item, index) => roomColorMap[item] = filterCategories[index]);

            let sortObjs = objs => {
                var sorted = objs.sort((a,b)=>{
                    if(getRoomProperty(a) < getRoomProperty(b)) return -1;
                    if(getRoomProperty(a) > getRoomProperty(b)) return 1;
                    return 0;
                });
                return sorted;
            }

            // Simple just checks if the object is highlighted
            let isHighlighted = (obj) => {
                let objectProp = getRoomProperty(obj)
                let idx = valuesToHighlight.indexOf(objectProp);
                return idx >= 0;
            }
            
            // For some reason this doesn't really work when passed down, so use objs.filter(isHighlighted).length > 0 probably
            let hasHighlights = () => {
                return valuesToHighlight.length > 0;
            }

            // Dedups the properties so that when passed to paletteManager it is more consistent (to be honest i dont see why this works but it does)
            let getUniqueProps = objs =>{
                let bigList = objs.map(obj=> _.get(obj.properties, colorCategoryAttributeName));
                return [...new Set(bigList)]
            }

            let colorMap = {};
            let colorList = [... new Set(colorCategories)];
            colorList.sort();
            colorList.forEach((item, index) => colorMap[index] = this.colorPalette.getColor(JSON.stringify(item)));

            // I literally don't know why this works and using the direct color doesn't but I think it has something to do with the way that power BI pallettes generate using the whole list + index rather than the value
            let getColor = obj => {
                let id = getRoomProperty(obj)
                if (id) {
                    let idx = filterCategories.indexOf(id);
                    if (idx !== -1){
                        let colorValue = colorList.indexOf(colorCategories[idx])
                        return colorMap[colorValue].value.replace("#","");
                    }
                    
                    else return defaultRoomColor.replace("#","");
                }
                return defaultRoomColor.replace("#","");
            }
            // Again please don't play with the arguments
            this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, this.target, 0, filterCategories, filterCategoryAttributeName, colorCategories, colorCategoryAttributeName, getColor, getRoomProperty);

            // Sets power BI selection ID of a given object based off of its room number
            let getSelectionID = obj =>{
                let propValue = getRoomProperty(obj)
                let trueIndex = filterCategories.indexOf(propValue); 
                return this.host.createSelectionIdBuilder().withCategory(dataView.categorical.categories[0],trueIndex).createSelectionId();
            }

            var speckleStreamURL = undefined
            try {
                if (object && object.specklestreamurl) {
                    const url = new URL(object.specklestreamurl); //Checks to see if its a real URL
                    speckleStreamURL = url.toString();
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
                    exportpdf: exportpdf,
                    lineColor: lineColor,
                    tooltipServiceWrapper: this.tooltipServiceWrapper,
                    events: this.events,
                    options: options,
                    storage: this.storage
                });
            }
            //This was an attempt to get PDF exporting to just wait a bit before exporting but it seems like it ignores it entirely
            if(_.get(this.settings.speckle, 'exportpdf') === 'SVG'){
                setTimeout(() => {
                    this.events.renderingFinished(options);
                    console.log('finished')
                }, 60000)
            }
        } else {
            this.clear();
        }
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