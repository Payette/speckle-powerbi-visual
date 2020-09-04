/*
 *  Power BI Visualizations
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 */
"use strict";

import { dataViewObjectsParser } from "powerbi-visuals-utils-dataviewutils";
import DataViewObjectsParser = dataViewObjectsParser.DataViewObjectsParser;
import powerbi from 'powerbi-visuals-api';
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import IColorPalette = powerbi.extensibility.IColorPalette;

// To be honest I'm not 100% sure the difference between SpeckleSettings and ViewerSettings, but if you add something you pass down then make sure to add it in both

export class SpeckleSettings {
    public defaultRoomColor: string = "000000";
    public defaultOpacity: number = 0.75;
    public lineWeight: number = 1;
    public lineColor: string = "000000";
    public camera: string = "orthographic";
    public specklestreamurl: string = "";
    public getColor: (uniqueFICMs:any, obj: any) => any = undefined;
    public getUniqueProps?: (objs:any) => any;
    public getSelectionID: (obj: any) => any = undefined;
    public selectionManager: ISelectionManager = undefined;
    public colorPalette: IColorPalette = undefined;
    public hasHighlights?: any;
    public sortObjs?: any;
    public exportpdf: string = "WebGL";
    public exportsource: string = "Revit";
    public tooltipServiceWrapper: any;
    public events: any;
    public options: any;
    public storage: any;
}

export class VisualSettings extends DataViewObjectsParser {
    public speckle: SpeckleSettings = new SpeckleSettings();
    public meshOverrides: any;
    public edgesThreshold: number;
    public defaultRoomColor: string;
    public lineColor: string;
    // public exportpdf: string;
}

export const ViewerSettings = {
    camera: "orthographic",
    showEdges: true,
    edgesThreshold: 1 /* default Threejs thresholdAngle */,
    castShadows: true,
    meshMaterialOpacity: {
        meshOverrides: {}
    },
    meshMaterialSpecular: {
        meshOverrides: {}
    },
    meshOverrides: {
        opacity: 100,
        specular: 100
    },
    getColor: undefined,
    getSelectionID: undefined,
    selectionManager: undefined,
    getUniqueProps: undefined,
    defaultRoomColor: "000000",
    lineColor: "000000",
    defaultOpacity: 0.6,
    isHighlighted: undefined,
    colorPalette: undefined,
    hasHighlights: undefined,
    sortObjs: undefined,
    exportpdf: "WebGL",
    exportsource: "Revit",
    lineWeight: 1,
    tooltipServiceWrapper: undefined,
    events: undefined,
    options: undefined,
    storage: undefined
}