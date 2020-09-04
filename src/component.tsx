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
import IColorPalette = powerbi.extensibility.IColorPalette;

// Any property that you want to pass down to the Renderer/Visual you have to define in State, VisualSettings, and make sure to set it on every update
export interface State {
    speckleStreamURL: string,
    width: number,
    height: number,
    defaultRoomColor?: string,
    lineWeight?: number,
    camera?: string,
    getColor?: (obj: any) => any,
    getSelectionID?: (index: any) => any,
    getUniqueProps?: (objs: any) => any,
    selectionManager?: ISelectionManager,
    isHighlighted?: (obj: any, property: string) => Boolean
    highlighted?: any,
    colorPalette?: IColorPalette,
    hasHighlights?: any,
    sortObjs?: any,
    exportpdf?: string,
    exportsource?: string,
    lineColor?: string,
    cameraState?: any,
    tooltipServiceWrapper?: any,
    events?: any,
    options?: any,
    storage?: any,
}

export const initialState: State = {
    speckleStreamURL: "",
    width: 200,
    height: 200,
    exportpdf: "WebGL",
    exportsource: 'Revit'
}

export class SpeckleVisual extends React.Component<{}, State>{

    private static updateCallback: (data: object) => void = null;

    public static update(newState: State) {
        if (typeof SpeckleVisual.updateCallback === 'function') SpeckleVisual.updateCallback(newState);
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
        // Since TypeScript is a little weird and treats ViewerSettings as not a variable, we need to set these properties individually
        ViewerSettings.camera = this.state.camera;
        ViewerSettings.getColor = this.state.getColor;
        ViewerSettings.getUniqueProps = this.state.getUniqueProps;
        ViewerSettings.getSelectionID = this.state.getSelectionID;
        ViewerSettings.selectionManager = this.state.selectionManager;
        ViewerSettings.isHighlighted = this.state.isHighlighted;
        ViewerSettings.colorPalette = this.state.colorPalette;
        ViewerSettings.hasHighlights = this.state.hasHighlights;
        ViewerSettings.sortObjs = this.state.sortObjs;
        ViewerSettings.exportpdf = this.state.exportpdf;
        ViewerSettings.exportsource = this.state.exportsource;
        ViewerSettings.defaultRoomColor = this.state.defaultRoomColor;
        ViewerSettings.lineWeight = this.state.lineWeight;
        ViewerSettings.lineColor = this.state.lineColor;
        ViewerSettings.tooltipServiceWrapper = this.state.tooltipServiceWrapper;
        ViewerSettings.events = this.state.events;
        ViewerSettings.options = this.state.options;
        ViewerSettings.storage = this.state.storage;
        this.renderer = new SpeckleRenderer({ domObject: this.mount }, ViewerSettings);
        this.renderer.animate();
        this.grabSpeckleObjectsFromURLAndUpdate(this.state.speckleStreamURL);
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
        ViewerSettings.getUniqueProps = this.state.getUniqueProps;
        ViewerSettings.getSelectionID = this.state.getSelectionID;
        ViewerSettings.selectionManager = this.state.selectionManager;
        ViewerSettings.defaultRoomColor = this.state.defaultRoomColor;
        ViewerSettings.sortObjs = this.state.sortObjs;
        ViewerSettings.isHighlighted = this.state.isHighlighted;
        ViewerSettings.colorPalette = this.state.colorPalette;
        ViewerSettings.hasHighlights = this.state.hasHighlights;
        ViewerSettings.exportpdf = this.state.exportpdf;
        ViewerSettings.exportsource = this.state.exportsource;
        ViewerSettings.lineWeight = this.state.lineWeight;
        ViewerSettings.defaultRoomColor = this.state.defaultRoomColor;
        ViewerSettings.lineColor = this.state.lineColor;
        ViewerSettings.tooltipServiceWrapper = this.state.tooltipServiceWrapper;
        ViewerSettings.events = this.state.events;
        ViewerSettings.options = this.state.options;
        ViewerSettings.storage = this.state.storage;
        this.renderer.updateViewerSettings(ViewerSettings);
        // Now we cache objects in grabSpeckleObjects, which speeds this up significantly
        this.renderer.reloadObjects()
    }

    grabSpeckleObjectsFromURLAndUpdate(url) {
        // Usually first render / URL hasn't been set, but we try anyway
        if (!this.state.storage) {
            if (url) {
                fetch(url)
                    .then(response => response.json())
                    .then(data => {
                        let objs = data.resources;
                        this.state.storage.set(url.split('streams/')[1].split('/objects')[0], objs);
                        this.renderer.unloadAllObjects()
                        this.renderer.loadObjects({ objs: objs, zoomExtents: true, firstLoad: true })
                        this.renderer.zoomExtents(true);
                    })
                    .catch(error => {
                        console.error("Unable to fetch from URL", error)
                    })
            }
        }
        // If storage is defined, we try getting the cached objects first
        else this.state.storage.get(url.split('streams/')[1].split('/objects')[0]).then(objs => {

            // If it exists and its more than 1, we just reload off of that
            if (objs && Object.keys(objs).length > 0) {
                this.renderer.unloadAllObjects()
                this.renderer.loadObjects({ objs: objs, zoomExtents: true, firstLoad: true })
                this.renderer.zoomExtents(true);
            }

            // If it doesn't exist/is a blank object we just fetch and set
            else if (url) {
                fetch(url)
                    .then(response => response.json())
                    .then(data => {
                        let objs = data.resources;
                        this.state.storage.set(url.split('streams/')[1].split('/objects')[0], objs);
                        this.renderer.unloadAllObjects()
                        this.renderer.loadObjects({ objs: objs, zoomExtents: true, firstLoad: true })
                        this.renderer.zoomExtents(true);
                    })
                    .catch(error => {
                        console.error("Unable to fetch from URL", error)
                    })
            }
            // Identical to the else if above, the catch() is for when it returns undefined
        }).catch(() => {
            if (url) {
                fetch(url)
                    .then(response => response.json())
                    .then(data => {
                        let objs = data.resources;
                        this.state.storage.set(url.split('streams/')[1].split('/objects')[0], objs);
                        this.renderer.unloadAllObjects()
                        this.renderer.loadObjects({ objs: objs, zoomExtents: true, firstLoad: true })
                        this.renderer.zoomExtents(true);
                    })
                    .catch(error => {
                        console.error("Unable to fetch from URL", error)
                    })
            }
        })

    }

    render() {
        const { width, height } = this.state;
        const style: React.CSSProperties = { width: width, height: height };
        // We add a div on the layer above the rendering one so that when we add/remove renderers it preserves the button
        return <div style={style}>
            {/* We only show the "reset" button if it's not SVG, because if its there it will show in the exported PDF */}
            {this.state.exportpdf === 'SVG' ? null : <button style={{ position: 'absolute', zIndex: 1300 }} onClick={() => this.renderer.resetCamera()}>Reset Camera</button>}
            <div style={style} className="speckleVisual" ref={ref => (this.mount = ref)}>
            </div>
        </div>
    }
}

export default SpeckleVisual;