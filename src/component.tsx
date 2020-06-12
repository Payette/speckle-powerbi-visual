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
    textValue: string,
    width: number,
    height: number,
    background?: string,
    borderWidth?: number
}

export const initialState: State = {
    textLabel: "",
    textValue: "",
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
        this.renderer = new SpeckleRenderer( { domObject: this.mount }, ViewerSettings )
        this.renderer.animate( )
        let objs = exampleobjects.resources;
        this.renderer.loadObjects( { objs: objs, zoomExtents: true } )
    }

    componentDidUpdate(prevProps, prevState) {
        if(this.state.width !== prevState.width || this.state.height !== prevState.height) {
            this.renderer.resizeCanvas()
        }
    }

    render(){
        const { textLabel, textValue, width, height, background, borderWidth } = this.state;

        const style: React.CSSProperties = { width: width, height: height, background, borderWidth, backgroundColor: "pink" };

        return (
            <div className="circleCard" style={style} ref={ref => (this.mount = ref)} />
        )
    }
}

export default ReactCircleCard;