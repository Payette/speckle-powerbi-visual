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

export function createTooltipServiceWrapper(tooltipService: ITooltipService, rootElement: HTMLElement, handleTouchDelay: number = DefaultHandleTouchDelay, filterCategory: any, filterCategoryName: string, colorCategory: any, colorCategoryName: any, getColor: any, getRoomProperty: any): ITooltipServiceWrapper {
    return new TooltipServiceWrapper(tooltipService, rootElement, handleTouchDelay, filterCategory, filterCategoryName, colorCategory, colorCategoryName, getColor, getRoomProperty);
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
    private getRoomProperty: any;

    constructor(tooltipService: ITooltipService, rootElement: HTMLElement, handleTouchDelay: number, filterCategory: any, filterCategoryName: string, colorCategory: any, colorCategoryName: any, getColor: any, getRoomProperty: any) {
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
        this.getRoomProperty = getRoomProperty;
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

            // Don't touch this, i don't think it does anything but i'm not sure
            if (!this.mapHideTooltip[selectedObject.userData._id]) {
                    this.mapHideTooltip[selectedObject.userData._id] = (e) => {
                        // this.hide()
                    };
                }


                // Calculate tooltip position, get the canvas height/width + position, and then use that as offset with object position within the canvas
                var canvasHalfWidth = renderer.domElement.offsetWidth / 2;
                var canvasHalfHeight = renderer.domElement.offsetHeight / 2;

                var tooltipPosition = selectedPoint.project(camera);
                tooltipPosition.x = (tooltipPosition.x * canvasHalfWidth) + canvasHalfWidth + renderer.domElement.offsetLeft;
                tooltipPosition.y = -(tooltipPosition.y * canvasHalfHeight) + canvasHalfHeight + renderer.domElement.offsetTop;
                let tt = [tooltipPosition.x, tooltipPosition.y]

                //Get data to show
                let category = this.getRoomProperty(selectedObject.userData);
                let categoryIndex = this.filterCategory.indexOf(category);
                let attribute = this.colorCategory[categoryIndex];
                
                this.visualHostTooltipService.show({
                    coordinates: tt,
                    isTouchEvent: false,
                    dataItems: [{
                        displayName: this.filterCategoryName.trim(),
                        value: category,
                    }, 
                    // If we have attribute, then we show it else we only show name
                    !!attribute ? 
                    {
                        displayName: this.colorCategoryName.replace("First ", "").trim(),
                        value: attribute,
                        color: this.getColor({...selectedObject, properties:selectedObject.userData.properties}),
                    } : null],
                    identities: selectedObject.userData.selectionID ? [selectedObject.userData.selectionID] : [],
                });
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

}