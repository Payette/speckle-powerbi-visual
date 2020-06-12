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
    public circleColor: string = "white";
    public circleThickness: number = 2;
}

export class VisualSettings extends DataViewObjectsParser {
    public circle: CircleSettings = new CircleSettings();
}

export const ViewerSettings = {
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