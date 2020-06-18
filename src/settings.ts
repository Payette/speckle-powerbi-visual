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

export class CircleSettings {
    public defaultRoomColor: string = "000000";
    public defaultOpacity: number = 0.75;
    public lineWeight: number = 1;
    public camera: string = "perspective";
    public specklestreamurl: string = "";
    public getColor: (obj: any) => any = undefined;
    public getSelectionID: (obj: any) => any = undefined;
    public selectionManager: ISelectionManager = undefined;
}

export class VisualSettings extends DataViewObjectsParser {
    public speckle: CircleSettings = new CircleSettings();
    public meshOverrides: any;
    public edgesThreshold: number;
}

export const ViewerSettings = {
    camera: "perspective",
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
    defaultRoomColor: "000000",
    defaultOpacity: 0.6
}