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

    constructor(options: VisualConstructorOptions) {
        this.reactRoot = React.createElement(SpeckleVisual, {});
        this.target = options.element;
        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();
        this.events = options.host.eventService;
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
            let colorCategories = _.get(dataView, "categorical.categories[0].values")
            let colorValues = _.get(dataView, "categorical.values[0].values")
            let colorCategoryAttributeName = _.get(dataView, "metadata.columns[0].displayName")
            let getColor = (obj) => {
                let category = _.get(obj, colorCategoryAttributeName)
                if (category) {
                    let idx = colorCategories.indexOf(parseInt(category))
                    if (idx >= 0) return colorValues[idx].trim();
                }
                return defaultRoomColor;
            }
            
            let getSelectionID = index =>{
                return this.host.createSelectionIdBuilder().withCategory(dataView.categorical.categories[0], index).createSelectionId();
            }

            console.log(colorCategories, colorValues, colorCategoryAttributeName)

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
                    defaultRoomColor: object && object.defaultRoomColor ? object.defaultRoomColor : undefined,
                    camera: object && object.camera ? object.camera : undefined,
                    speckleStreamURL: speckleStreamURL,
                    getColor: getColor,
                    getSelectionID: getSelectionID,
                    selectionManager: this.selectionManager
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