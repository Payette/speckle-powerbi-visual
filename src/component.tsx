/*
 *  Power BI Visualizations
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 */
import * as React from "react";
import SpeckleRenderer from './SpeckleRenderer.js'
import { ViewerSettings } from "./settings";
import powerbi from 'powerbi-visuals-api';
import ISelectionManager = powerbi.extensibility.ISelectionManager;

export interface State {
    speckleStreamURL: string,
    width: number,
    height: number,
    defaultRoomColor?: string,
    lineWeight?: number,
    camera?: string,
    getColor?: (obj: any) => any,
    getSelectionID?: (index: any) => any,
    selectionManager?: ISelectionManager
}

export const initialState: State = {
    speckleStreamURL: "",
    width: 200,
    height: 200
}

export class SpeckleVisual extends React.Component<{}, State>{

    private static updateCallback: (data: object) => void = null;

    public static update(newState: State) {
        if (typeof SpeckleVisual.updateCallback === 'function') {
            SpeckleVisual.updateCallback(newState);
        }
    }

    public state: State = initialState;
    mount = null;
    renderer = null;

    constructor(props: any) {
        super(props);
        this.state = initialState;
    }

    public componentWillMount() {
        SpeckleVisual.updateCallback = (newState: State): void => { this.setState(newState); };
    }

    public componentWillUnmount() {
        SpeckleVisual.updateCallback = null;
    }

    componentDidMount() {
        ViewerSettings.camera = this.state.camera
        ViewerSettings.getColor = this.state.getColor;
        ViewerSettings.getSelectionID = this.state.getSelectionID;
        ViewerSettings.selectionManager = this.state.selectionManager;
        this.renderer = new SpeckleRenderer({ domObject: this.mount }, ViewerSettings)
        this.renderer.animate()
        this.grabSpeckleObjectsFromURLAndUpdate(this.state.speckleStreamURL)
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.width !== prevState.width || this.state.height !== prevState.height) {
            this.renderer.resizeCanvas()
        }
        if (this.state.speckleStreamURL !== prevState.speckleStreamURL) {
            this.grabSpeckleObjectsFromURLAndUpdate(this.state.speckleStreamURL)
        }
        if (this.state.camera !== prevState.camera) {
            this.renderer.updateCamera(this.state.camera)
        }
        ViewerSettings.getColor = this.state.getColor;
        ViewerSettings.getSelectionID = this.state.getSelectionID;
        ViewerSettings.selectionManager = this.state.selectionManager;
        ViewerSettings.defaultRoomColor = this.state.defaultRoomColor;
        this.renderer.updateViewerSettings(ViewerSettings)
        this.renderer.reloadObjects()
    }

    grabSpeckleObjectsFromURLAndUpdate(url) {
        if (url) {
            fetch(url)
                .then(response => response.json())
                .then(data => {
                    let objs = data.resources;
                    this.renderer.unloadAllObjects()
                    this.renderer.loadObjects({ objs: objs, zoomExtents: true })
                })
                .catch(error => {
                    console.error("Unable to fetch from URL", error)
                })
        }
    }

    render() {
        const { width, height } = this.state;
        const style: React.CSSProperties = { width: width, height: height };
        return <div className="circleCard" style={style} ref={ref => (this.mount = ref)} />
    }
}

export default SpeckleVisual;