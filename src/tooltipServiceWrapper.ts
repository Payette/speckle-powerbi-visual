import powerbiVisualsApi from "powerbi-visuals-api";
import ISelectionId = powerbiVisualsApi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbiVisualsApi.extensibility.VisualTooltipDataItem;
import ITooltipService = powerbiVisualsApi.extensibility.ITooltipService;
import * as THREE from 'three';
export interface TooltipEventArgs<TData> {
    data: TData;
    coordinates: number[];
    isTouchEvent: boolean;
}

export interface ITooltipServiceWrapper {
    showTooltip<T>(
        selectedObject,
        selectedPoint,
        camera,
        renderer,
        tooltips,
        getTooltipInfoDelegate: (args: TooltipEventArgs<T>) => VisualTooltipDataItem[],
        reloadTooltipDataOnMouseMove?: boolean): void;
    hide(immediately?: boolean): void;
}

const DefaultHandleTouchDelay = 1000;

export function createTooltipServiceWrapper(tooltipService: ITooltipService, rootElement: HTMLElement, handleTouchDelay: number = DefaultHandleTouchDelay, filterCategory: any, filterCategoryName: string, colorCategory: any, colorCategoryName: any, getColor: any): ITooltipServiceWrapper {
    return new TooltipServiceWrapper(tooltipService, rootElement, handleTouchDelay, filterCategory, filterCategoryName, colorCategory, colorCategoryName, getColor);
}

class TooltipServiceWrapper implements ITooltipServiceWrapper {
    private handleTouchTimeoutId: number;
    private visualHostTooltipService: ITooltipService;
    private rootElement: HTMLElement;
    private handleTouchDelay: number;

    // Store the registered showTooltip and hideTooltip handler functions, so that
    // we can unregister them successfully
    private mapShowTooltip: any;
    private mapHideTooltip: any;
    private filterCategory: any;
    private colorCategory: any;
    private filterCategoryName: string;
    private colorCategoryName: string;
    private getColor: any;

    constructor(tooltipService: ITooltipService, rootElement: HTMLElement, handleTouchDelay: number, filterCategory: any, filterCategoryName: string, colorCategory: any, colorCategoryName: any, getColor: any) {
        this.visualHostTooltipService = tooltipService;
        this.handleTouchDelay = handleTouchDelay;
        this.rootElement = rootElement;
        this.mapShowTooltip = {}
        this.mapHideTooltip = {}
        this.filterCategory = filterCategory;
        this.colorCategory = colorCategory;
        this.filterCategoryName = filterCategoryName;
        this.colorCategoryName = colorCategoryName;
        this.getColor = getColor;
    }

    public showTooltip<T>(
        selectedObject: THREE.Object3D,
        selectedPoint: any,
        camera: THREE.PerspectiveCamera,
        renderer: any,
        getTooltips: () => any,
        getTooltipInfoDelegate: (args: TooltipEventArgs<T>) => VisualTooltipDataItem[],
        reloadTooltipDataOnMouseMove?: boolean): void {

            if (!selectedObject || !this.visualHostTooltipService.enabled()) {
                return;
            }

            let rootNode = this.rootElement;

            // Multiple following assignments are because browsers only
            // pick up assigments if they understand the assigned value
            // and ignore all other case.

            if (!this.mapHideTooltip[selectedObject.userData._id]) {
                    this.mapHideTooltip[selectedObject.userData._id] = (e) => {
                        // this.hide()
                    };
                }
                var canvasHalfWidth = renderer.domElement.offsetWidth / 2;
                var canvasHalfHeight = renderer.domElement.offsetHeight / 2;

                var tooltipPosition = selectedPoint.project(camera);
                tooltipPosition.x = (tooltipPosition.x * canvasHalfWidth) + canvasHalfWidth + renderer.domElement.offsetLeft;
                tooltipPosition.y = -(tooltipPosition.y * canvasHalfHeight) + canvasHalfHeight + renderer.domElement.offsetTop;
                let tt = [tooltipPosition.x, tooltipPosition.y]

                let category = selectedObject.userData.properties[this.filterCategoryName];
                let categoryIndex = this.filterCategory.indexOf(category);
                let attribute = this.colorCategory[categoryIndex];
                console.log(this.getColor({...selectedObject, properties:selectedObject.userData.properties}))
                
                this.visualHostTooltipService.show({
                    coordinates: tt,
                    isTouchEvent: false,
                    dataItems: [{
                        displayName: this.filterCategoryName.trim(),
                        value: category,
                        // color: 'test color',
                        // header: 'Room'
                    }, !!attribute ? 
                    {
                        displayName: this.colorCategoryName.replace("First ", "").trim(),
                        value: attribute,
                        color: this.getColor({...selectedObject, properties:selectedObject.userData.properties}),
                        // header: 'Room'
                    } : null],
                    identities: selectedObject.userData.selectionID ? [selectedObject.userData.selectionID] : [],
                });
            }

    private getDisplayNameMap(metadata) {
        let ret = {}
        metadata.columns.map(column => {
            Object.keys(column.roles).map(role => {
                ret[role] = column.displayName
            });
        });
        return ret;
    }

    public hide(immediately = false): void {
        const rootNode = this.rootElement;

        rootNode.style.cursor = '-webkit-grab';
        rootNode.style.cursor = 'grab';
        this.visualHostTooltipService.hide({
            isTouchEvent: false,
            immediately
        });
    }

    private makeTooltipEventArgs<T>(e: any, getTooltips: () => any): TooltipEventArgs<T> {

        let tooltipEventArgs : TooltipEventArgs<T> = null;
        try {
            if (e.features && e.features.length > 0) {
                tooltipEventArgs = {
                    // Take only the first three element until we figure out how
                    // to add pager to powerbi native tooltips
                    data: e.features.slice(0, 3).map(feature => {
                        return Object.keys(feature.properties).map(prop => {
                            return {
                                key: prop,
                                value: feature.properties[prop]
                            }
                        });
                    }),
                    coordinates: [e.point.x, e.point.y],
                    isTouchEvent: false
                };

            }
        } finally {
            return tooltipEventArgs;
        }
    }
}