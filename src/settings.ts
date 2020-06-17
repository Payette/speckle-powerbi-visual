/*
 *  Power BI Visualizations
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 */
"use strict";

import { dataViewObjectsParser } from "powerbi-visuals-utils-dataviewutils";
import DataViewObjectsParser = dataViewObjectsParser.DataViewObjectsParser;

export class CircleSettings {
    public defaultRoomColor: string = "white";
    public lineWeight: number = 1;
    public camera: string = "perspective";
    public specklestreamurl: string = "";
    public getColor: (obj: any) => any = undefined;
}

export class VisualSettings extends DataViewObjectsParser {
    public speckle: CircleSettings = new CircleSettings();
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
    }
}