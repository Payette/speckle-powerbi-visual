import * as THREE from 'three';
import _ from 'lodash';
import OrbitControls from 'threejs-orbit-controls';
import TWEEN from '@tweenjs/tween.js';
import flatten from 'flat';
import { Converter } from './SpeckleConverter.js';
import { SVGRenderer } from './SVGRenderer';
import powerbi from 'powerbi-visuals-api';

import IColorPalette = powerbi.extensibility.IColorPalette;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.extensibility.ISelectionId;

export default class SpeckleRenderer {
  domObject: HTMLElement = null;

  objs: any[] = [];
  selectedObjects: THREE.Object3D[] = [];
  highlightedObjects: THREE.Object3D[] = [];
  scene: any = null;
  camera: THREE.PerspectiveCamera = null;
  webglrenderer: THREE.WebGLRenderer = null;
  raycaster: THREE.Raycaster = null;
  mouse: THREE.Vector2 = null;
  controls: OrbitControls = null;
  hoverColor: THREE.Color = new THREE.Color('#EEF58F');

  colorPalette: IColorPalette = null;
  selectionManager: ISelectionManager = null;

  renderer: any = null;
  exportpdf: string = "";
  lineColor: string = "";

  getColor: (obj: THREE.Object3D) => string = null;
  getSelectionID: (obj: THREE.Object3D) => ISelectionId = null;

  svgrenderer: any = null;
  isHighlighted: any = null;
  hasHighlights: any = null;
  threeObjs: THREE.Object3D[] = [];
  mouseDownTime: number = null;
  enableKeyboardEvents: Boolean = false;

  hoveredObject: any = null;
  sceneBoundingSphere: any = null;
  viewerSettings: any = null;
  isSpinning: Boolean = false;
  lineWeight: any = null;

  constructor({ domObject }, viewerSettings) {

    this.domObject = domObject;
    this.exportpdf = viewerSettings.exportpdf;

    this.viewerSettings = viewerSettings;
    this.exportpdf = this.viewerSettings.exportpdf;
    this.webglrenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, logarithmicDepthBuffer: true });
    this.webglrenderer.setSize(this.domObject.offsetWidth, this.domObject.offsetHeight);

    this.svgrenderer = new SVGRenderer();
    this.svgrenderer.setSize(this.domObject.offsetWidth, this.domObject.offsetHeight);

    this.domObject.appendChild(this.webglrenderer.domElement);
    this.renderer = this.webglrenderer;
    this.initialise();
  }

  initialise() {
    this.scene = new THREE.Scene();
    let axesHelper = new THREE.AxesHelper(10);
    this.scene.add(axesHelper);
    this.camera = new THREE.PerspectiveCamera(1, this.domObject.offsetWidth / this.domObject.offsetHeight, 0.1, 100000);
    this.resetCamera(false);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enabled = true;
    this.controls.screenSpacePanning = true;
    this.controls.enableRotate = false;

    this.updateViewerSettings(this.viewerSettings);

    this.webglrenderer.domElement.addEventListener('mousemove', this.onTouchMove.bind(this));
    this.webglrenderer.domElement.addEventListener('touchmove', this.onTouchMove.bind(this));

    this.webglrenderer.domElement.addEventListener('mousedown', this.mouseDown.bind(this));
    this.webglrenderer.domElement.addEventListener('mouseup', this.mouseUp.bind(this));

    this.svgrenderer.domElement.addEventListener('mousemove', this.onTouchMove.bind(this));
    this.svgrenderer.domElement.addEventListener('touchmove', this.onTouchMove.bind(this));

    this.svgrenderer.domElement.addEventListener('mousedown', this.mouseDown.bind(this));
    this.svgrenderer.domElement.addEventListener('mouseup', this.mouseUp.bind(this));

    this.domObject.addEventListener('mouseover', this.enableEvents.bind(this));
    this.domObject.addEventListener('mouseout', this.disableEvents.bind(this));
    this.switchRenderer(this.viewerSettings.exportpdf);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    window.addEventListener('resize', this.resizeCanvas.bind(this), false);

    this.computeSceneBoundingSphere();
    this.render();
  }

  updateObjectMaterials(isSingleClick: Boolean) {
    this.threeObjs.forEach((threeObj:any) => {
      //If it isn't a single click, then we are working with highlights/filtered data, so we should check that first
      if (!isSingleClick && this.objs.filter(this.isHighlighted).length > 0) {
        if (!this.isHighlighted(threeObj)) {
          this.selectedObjects = [];
          threeObj.material.transparent = true;
          threeObj.material.opacity = 0.1;
        }
        else {
          threeObj.material.opacity = 1;
          threeObj.material.transparent = false;
        }
      }

      else if (this.selectedObjects.length > 0) {//There are selected objects
        if (this.selectedObjects.findIndex((x:any) => x.userData && x.userData._id === threeObj.userData._id) === -1) {
          threeObj.material.transparent = true;
          threeObj.material.opacity = 0.1;
        }
        else {
          threeObj.material.opacity = 1;
          threeObj.material.transparent = false;
        }
      }
      else { //Neither, so just make it transparent
        threeObj.material.opacity = 1;
        threeObj.material.transparent = false;
      }
    });
  }

  resetCamera(zoomExtents = true) {
    if (this.viewerSettings.camera === "orthographic") { //Fake Ortho
      this.camera.fov = 1;
      this.camera.aspect = this.domObject.offsetWidth / this.domObject.offsetHeight;
      this.camera.near = 0.1;
      this.camera.far = 100000;
    } else { //Perspective
      this.camera.fov = 75;
      this.camera.aspect = this.domObject.offsetWidth / this.domObject.offsetHeight;
      this.camera.near = 0.1;
      this.camera.far = 100000;
    }

    this.camera.up.set(0, 0, -1);
    this.camera.position.z = 20;
    this.camera.position.y = 20;
    this.camera.position.x = 20;

    if (this.controls) this.controls.target = new THREE.Vector3(0, 0, 0);

    if (zoomExtents) {
      this.computeSceneBoundingSphere();
      this.zoomExtents();
    }
  }

  updateCamera(camera) {
    this.viewerSettings.camera = camera;
    this.resetCamera(false);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    TWEEN.update();
    this.setFar();
    this.controls.update();
    this.render();
  }

  render = () => this.renderer.render(this.scene, this.camera);

  resizeCanvas() {
    this.camera.aspect = this.domObject.offsetWidth / this.domObject.offsetHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.domObject.offsetWidth, this.domObject.offsetHeight);
  }

  enableEvents = (e)  => this.enableKeyboardEvents = true;

  disableEvents = (e)  => this.enableKeyboardEvents = false;

  mouseDown(event) {
    this.isSpinning = true;
    // if it's a double click
    if (Date.now() - this.mouseDownTime < 300 && this.hoveredObject !== null) this.zoomToObject(this.hoveredObject);

    this.mouseDownTime = Date.now();
  }

  mouseUp(event) {
    this.isSpinning = false;
    // check if it's a single short click (as opposed to a longer difference caused by moving the orbit controls or dragging the selection box)
    if (Date.now() - this.mouseDownTime < 300) {

      //If the object is already selected, deselect it both in visual and powerBI
      if (this.hoveredObject && this.selectedObjects.findIndex((x: any) => x.userData._id === this.hoveredObject.userData._id) !== -1) {
        this.selectedObjects = [];
        this.selectionManager.clear();
        this.updateObjectMaterials(true);
      } else if (this.hoveredObject) {  //If not selected, then add
        if (event.shiftKey) {
          this.selectedObjects = [this.hoveredObject];
          this.updateObjectMaterials(true);
          this.selectionManager.select(_.get(this.hoveredObject, "userData.selectionID"), true);
        } else if (event.ctrlKey) {
          this.selectedObjects = [];
          this.updateObjectMaterials(true);
        } else {
          let o = this.hoveredObject; //To prevent race conditions where you hover a new object before  
          this.selectedObjects = [o];
          this.updateObjectMaterials(true);
          let selectedID = _.get(o, 'userData.selectionID');
          if(selectedID) this.selectionManager.select(selectedID);
        }
      } else this.selectedObjects = [];
    }
  }

  onTouchMove(event) {
    let x, y;
    if (event.changedTouches) {
      x = event.changedTouches[0].pageX;
      y = event.changedTouches[0].pageY;
    } else {
      x = event.clientX;
      y = event.clientY;
    }
    let rect = this.domObject.getBoundingClientRect();
    x -= rect.left;
    y -= rect.top;
    this.mouse.x = (x / this.domObject.offsetWidth) * 2 - 1;
    this.mouse.y = -(y / this.domObject.offsetHeight) * 2 + 1;

    if (!this.isSpinning) this.highlightMouseOverObject();
  }

  highlightMouseOverObject() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    let intersects = this.raycaster.intersectObjects([this.scene], true);
    
    if (intersects.length > 0) {
      if (intersects[0].object !== this.hoveredObject) {
        if (intersects[0].object.userData.hasOwnProperty('_id')) {
          this.domObject.style.cursor = 'pointer';
          // if there was a pre-exsiting hovered object unhover it first
          if (this.hoveredObject) {
            this.hoveredObject.material.color.copy(this.hoveredObject.material.__preHoverColor);
            this.hoveredObject.userData.hovered = false;
          }
          this.hoveredObject = intersects[0].object;
          this.hoveredObject.userData.hovered = true;
          this.hoveredObject.material.__preHoverColor = this.hoveredObject.material.color.clone();
          this.hoveredObject.material.color.copy(this.hoverColor);
        }
      }
    } else {
      this.domObject.style.cursor = 'default';
      if (this.hoveredObject) {
        this.hoveredObject.material.color.copy(this.hoveredObject.material.__preHoverColor);
        this.hoveredObject.userData.hovered = false;
        this.hoveredObject = null;
      }
    }
  }

  reloadObjects() {
    if (this.objs) {
      this.unloadAllObjects();
      this.loadObjects({ objs: this.objs, zoomExtents: true });
    }
  }

  loadObjects({ objs, zoomExtents }) {
    this.objs = objs;
    if (this.hasHighlights()) this.selectedObjects = [];
    this.objs.forEach((obj, index) => {
      try {
        let splitType = obj.type.split("/");
        let convertType = splitType.pop();
        while (splitType.length > 0 && !Converter.hasOwnProperty(convertType)) convertType = splitType.pop();
        if (Converter.hasOwnProperty(convertType)) {
          let myColor = undefined;
          if (obj && obj.properties && this.colorPalette) myColor = new THREE.Color('#'+this.getColor(obj));
          Converter[convertType]({ obj: obj }, (err, threeObj) => {
            if (myColor) threeObj.material = new THREE.MeshBasicMaterial({ color: myColor, side: THREE.DoubleSide });
            if ((!this.isHighlighted(obj) && this.hasHighlights()) || (this.selectedObjects.length > 0 && this.selectedObjects.findIndex(x => x.userData && x.userData._id === obj._id) === -1)) {
              threeObj.material.transparent = true;
              threeObj.material.opacity = 0.1;
            }
            else if (this.isHighlighted(obj)) threeObj.material.transparent = false;
            threeObj.userData._id = obj._id;
            threeObj.userData.selectionID = this.getSelectionID(obj);
            threeObj.userData.properties = obj.properties ? flatten(obj.properties, { safe: true }) : null
            threeObj.userData.originalColor = threeObj.material.color.clone();
            threeObj.geometry.computeBoundingSphere();
            threeObj.castShadow = true;
            threeObj.receiveShadow = true;
            this.scene.add(threeObj);
            this.threeObjs.push(threeObj);
          })
        }
      } catch (e) {
        console.warn(`Something went wrong in the conversion of ${obj._id} (${obj.type})`);
        return;
      }

      if (this.objs.filter(this.isHighlighted).length > 0)  this.zoomHighlightExtents();

      else if (zoomExtents && (index === objs.length - 1)) {
        this.computeSceneBoundingSphere();
        this.resetCamera(true);
        if(this.selectedObjects.length > 0) this.zoomHighlightExtents();
      }
    })
  }

  unloadAllObjects() {
    let toRemove = [];
    this.scene.traverse(obj => {
      if (obj.userData._id)  toRemove.push(obj);
    });

    toRemove.forEach((object, index) => {
      object.parent.remove(object);
      if (index === toRemove.length - 1) {
        this.computeSceneBoundingSphere();
        this.zoomExtents();
      }
    });
  }

  zoomToObject(obj) {
    if (typeof obj === 'string')  obj = this.scene.children.find(o => o.userData._id === obj);
    if (!obj) return;
    let bsphere = obj.geometry.boundingSphere;
    if (bsphere.radius < 1) bsphere.radius = 2;

    let offset = bsphere.radius / Math.tan(Math.PI / 180.0 * this.controls.object.fov * 0.5);
    let vector = new THREE.Vector3(0, 0, 1);
    let dir = vector.applyQuaternion(this.controls.object.quaternion);
    let newPos = new THREE.Vector3();
    dir.multiplyScalar(offset);
    newPos.addVectors(bsphere.center, dir);
    this.setCamera({
      position: [newPos.x, newPos.y, newPos.z],
      rotation: [this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z],
      target: [bsphere.center.x, bsphere.center.y, bsphere.center.z]
    }, 600);
  }

  zoomExtents() {
    this.computeSceneBoundingSphere();
    let offset = this.sceneBoundingSphere.radius / Math.tan(Math.PI / 180.0 * this.controls.object.fov * 0.5);
    let vector = new THREE.Vector3(0, 0, 1);
    let dir = vector.applyQuaternion(this.controls.object.quaternion);
    let newPos = new THREE.Vector3();
    dir.multiplyScalar(offset);
    newPos.addVectors(this.sceneBoundingSphere.center, dir);
    this.setCamera({
      position: [newPos.x, newPos.y, newPos.z],
      rotation: [this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z],
      target: [this.sceneBoundingSphere.center.x, this.sceneBoundingSphere.center.y, this.sceneBoundingSphere.center.z]
    }, 450);
  }

  zoomHighlightExtents() {
    this.computeHighlightBoundingSphere();
    let offset = this.sceneBoundingSphere.radius / Math.tan(Math.PI / 180.0 * this.controls.object.fov * 0.5);
    let vector = new THREE.Vector3(0, 0, 1);
    let dir = vector.applyQuaternion(this.controls.object.quaternion);
    let newPos = new THREE.Vector3();
    dir.multiplyScalar(offset);
    newPos.addVectors(this.sceneBoundingSphere.center, dir);
    this.setCamera({
      position: [newPos.x, newPos.y, newPos.z],
      rotation: [this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z],
      target: [this.sceneBoundingSphere.center.x, this.sceneBoundingSphere.center.y, this.sceneBoundingSphere.center.z]
    }, 450);
  }

  computeHighlightBoundingSphere() {
    let filter = obj => {
      if (!obj.userData._id) return false;
      if (!obj.geometry) return false;
      if (obj.material.transparent) return false;
      return true;
    };
    this.sceneBoundingSphere = this.computeBoundingSphere(filter);
  }
  
  computeSceneBoundingSphere() {
    let filter = obj => {
      if (!obj.userData._id) return false;
      if (!obj.geometry) return false;
      if (this.RGBToHex(obj.material.color) === this.viewerSettings.defaultRoomColor) return false;
      return true;
    }
    this.sceneBoundingSphere = this.computeBoundingSphere(filter);
  }

  computeBoundingSphere(filter) {
    let max = new THREE.Vector3(0,0,0),
      min = new THREE.Vector3(0,0,0),
      k = 0;

    for (let obj of this.scene.children) {
      if (!filter(obj)) continue;

      if (k === 0) {
        max = new THREE.Vector3(obj.geometry.boundingSphere.center.x + obj.geometry.boundingSphere.radius, obj.geometry.boundingSphere.center.y + obj.geometry.boundingSphere.radius, obj.geometry.boundingSphere.center.z + obj.geometry.boundingSphere.radius);
        min = new THREE.Vector3(obj.geometry.boundingSphere.center.x - obj.geometry.boundingSphere.radius, obj.geometry.boundingSphere.center.y - obj.geometry.boundingSphere.radius, obj.geometry.boundingSphere.center.z - obj.geometry.boundingSphere.radius);
        k++;
        continue;
      }

      max.x = Math.max(max.x, obj.geometry.boundingSphere.center.x + obj.geometry.boundingSphere.radius);
      max.y = Math.max(max.y, obj.geometry.boundingSphere.center.y + obj.geometry.boundingSphere.radius);
      max.z = Math.max(max.z, obj.geometry.boundingSphere.center.z + obj.geometry.boundingSphere.radius);

      min.x = Math.min(min.x, obj.geometry.boundingSphere.center.x - obj.geometry.boundingSphere.radius);
      min.y = Math.min(min.y, obj.geometry.boundingSphere.center.y - obj.geometry.boundingSphere.radius);
      min.z = Math.min(min.z, obj.geometry.boundingSphere.center.z - obj.geometry.boundingSphere.radius);
      k++;
    }
    let bigRadius = Math.max(max.x - min.x, max.y - min.y, max.z - min.z) / 2;
    
    let center = new THREE.Vector3((max.x + min.x)/2, (max.y + min.y)/2, (max.z + min.z) /2);
    return { center: center ? center : new THREE.Vector3(), radius: bigRadius * 1.6 };
  }

  RGBToHex(color) {
    let r = (color.r * 255).toString(16);
    let g = (color.g * 255).toString(16);
    let b = (color.b * 255).toString(16);

    if (r.length == 1) r = "0" + r;
    if (g.length == 1) g = "0" + g;
    if (b.length == 1) b = "0" + b;

    return r + g + b;
  }

  setFar() {
    let camDistance = this.camera.position.distanceTo(this.sceneBoundingSphere.center);
    this.camera.far = 3 * this.sceneBoundingSphere.radius + camDistance * 3; // 3 is lucky
    this.camera.updateProjectionMatrix();
  }

  setCamera(where, time) {
    new TWEEN.Tween(this.camera.position).to({ x: where.position[0], y: where.position[1], z: where.position[2] }, time).easing(TWEEN.Easing.Quadratic.InOut).start();
    new TWEEN.Tween(this.camera.rotation).to({ x: where.rotation[0], y: where.rotation[1], z: where.rotation[2] }, time).easing(TWEEN.Easing.Quadratic.InOut).start();
    new TWEEN.Tween(this.controls.target).to({ x: where.target[0], y: where.target[1], z: where.target[2] }, time).onUpdate(() => this.controls.update()).easing(TWEEN.Easing.Quadratic.InOut).start();
  }

  updateViewerSettings(viewerSettings) {
    this.viewerSettings = viewerSettings;
    this.getColor = viewerSettings.getColor;
    this.isHighlighted = viewerSettings.isHighlighted;
    this.hasHighlights = viewerSettings.hasHighlights;
    this.colorPalette = viewerSettings.colorPalette;
    this.getSelectionID = viewerSettings.getSelectionID;
    this.selectionManager = viewerSettings.selectionManager;
    if (this.lineWeight && viewerSettings.lineWeight !== this.lineWeight) this.svgrenderer.lineWeight = viewerSettings.lineWeight;
    if (this.lineColor && viewerSettings.lineColor !== this.lineColor) this.svgrenderer.lineColor = viewerSettings.lineColor;

    this.lineWeight = viewerSettings.lineWeight;
    this.lineColor = viewerSettings.lineColor;
    if (this.exportpdf && viewerSettings.exportpdf !== this.exportpdf) this.switchRenderer(viewerSettings.exportpdf);
    this.exportpdf = viewerSettings.exportpdf;
  }

  switchRenderer(renderer) {
    if (this.domObject) this.domObject.removeChild(this.domObject.childNodes[0]);
    if (renderer === "SVG") {
      this.domObject.appendChild(this.svgrenderer.domElement);
      this.svgrenderer.lineWeight = this.viewerSettings.lineWeight;
      this.svgrenderer.lineColor = this.viewerSettings.lineColor;
      this.svgrenderer.setSize(this.domObject.offsetWidth, this.domObject.offsetHeight);
      this.renderer = this.svgrenderer;
    }
    else {
      this.domObject.appendChild(this.webglrenderer.domElement);
      this.webglrenderer.setSize(this.domObject.offsetWidth, this.domObject.offsetHeight);
      this.renderer = this.webglrenderer;
    }
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enabled = true;
    this.controls.screenSpacePanning = true;
    this.controls.enableRotate = false;
  }
}