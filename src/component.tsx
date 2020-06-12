/*
 *  Power BI Visualizations
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 */
import * as React from "react";
import SpeckleRenderer from './SpeckleRenderer.js'
import exampleobjects from './speckleshapes.js'
import { ViewerSettings } from "./settings";

export interface State {
    textLabel: string,
    speckleStreamURL: string,
    width: number,
    height: number,
    background?: string,
    borderWidth?: number,
    camera?: string
}

export const initialState: State = {
    textLabel: "",
    speckleStreamURL: "",
    width: 200,
    height: 200
}

export class ReactCircleCard extends React.Component<{}, State>{

    private static updateCallback: (data: object) => void = null;

    public static update(newState: State) {
        if(typeof ReactCircleCard.updateCallback === 'function'){
            ReactCircleCard.updateCallback(newState);
        }
    }

    public state: State = initialState;
    mount = null;
    renderer = null;

    constructor(props: any){
        super(props);
        this.state = initialState;
    }

    public componentWillMount() {
        ReactCircleCard.updateCallback = (newState: State): void => { this.setState(newState); };
    }

    public componentWillUnmount() {
        ReactCircleCard.updateCallback = null;
    }

    componentDidMount() {
        ViewerSettings.camera = this.state.camera
        this.renderer = new SpeckleRenderer( { domObject: this.mount }, ViewerSettings )
        this.renderer.animate( )
        this.grabSpeckleObjectsFromURLAndUpdate(this.state.speckleStreamURL)
    }

    componentDidUpdate(prevProps, prevState) {
        if(this.state.width !== prevState.width || this.state.height !== prevState.height) {
            this.renderer.resizeCanvas()
        }
        if(this.state.speckleStreamURL !== prevState.speckleStreamURL) {
            this.grabSpeckleObjectsFromURLAndUpdate(this.state.speckleStreamURL)
        }
        if(this.state.camera !== prevState.camera) {
            this.renderer.updateCamera(this.state.camera)
        }
    }

    grabSpeckleObjectsFromURLAndUpdate(url) {
        const self = this

        if(url) {
            fetch(url)
            .then(response => response.json())
            .then(data => {
                let objs = data.resources;
                self.renderer.unloadAllObjects()
                self.renderer.loadObjects( { objs: objs, zoomExtents: true } )               
            })
            .catch(error => {
                console.error("Unable to fetch from URL", error)
            })
        }
    }

    render(){
        const { textLabel, speckleStreamURL, width, height, background, borderWidth } = this.state;

        const style: React.CSSProperties = { width: width, height: height, background, borderWidth, backgroundColor: "pink" };

        return (
            <div className="circleCard" style={style} ref={ref => (this.mount = ref)} />
        )
    }
}

export default ReactCircleCard;