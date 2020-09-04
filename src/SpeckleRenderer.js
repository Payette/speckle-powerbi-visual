import * as THREE from 'three'
import _ from 'lodash'
import OrbitControls from 'threejs-orbit-controls'
import TWEEN from '@tweenjs/tween.js'
import { Converter } from './SpeckleConverter.js'
import { SVGRenderer } from './SVGRenderer.ts'

export default class SpeckleRenderer {

  constructor({ domObject }, viewerSettings) {
    this.domObject = domObject;

    this.exportpdf = viewerSettings.exportpdf; //Want this immediately as it determines what is rendering

    this.objs = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;

    this.getColor = null;
    this.webglrenderer = null;
    this.svgrenderer = null;
    this.getSelectionID = null;
    this.getUniqueProps = null;
    this.colorPalette = null;
    this.selectionManager = null;
    this.isHighlighted = null;
    this.sortObjs = null;
    this.hasHighlights = null;

    this.controls = null
    this.orbitControls = null
    this.dragControls = null;
    this.threeObjs = [];
    this.lineColor = "";
    this.raycaster = null;
    this.mouse = null;
    this.count = 0;
    this.mouseDownTime = null;
    this.enableKeyboardEvents = false;

    this.hoveredObject = null;
    this.hoveredPoint = null;
    this.selectedObjects = [];
    this.highlightedObjects = [];

    this.hoverColor = new THREE.Color('#EEF58F');

    this.sceneBoundingSphere = null;

    this.edgesThreshold = null;

    this.viewerSettings = viewerSettings;
    this.storage = this.viewerSettings.storage;

    // Initialize webglrenderer
    this.webglrenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, logarithmicDepthBuffer: true });
    this.webglrenderer.setSize(this.domObject.offsetWidth, this.domObject.offsetHeight);

    // Initialize svgrenderer
    this.svgrenderer = new SVGRenderer();
    this.svgrenderer.setSize(this.domObject.offsetWidth, this.domObject.offsetHeight);

    // Tooltips
    this.tooltipServiceWrapper = this.viewerSettings.tooltipServiceWrapper;

    // We default to webgl renderer, but then it gets checked / switched if it isnt very soon after
    this.domObject.appendChild(this.webglrenderer.domElement);
    this.renderer = this.webglrenderer;

    this.initialise();
  }

  initialise() {

    this.scene = new THREE.Scene();

    // Isn't necessary but is nice to give info on orientation
    let axesHelper = new THREE.AxesHelper(10);
    this.scene.add(axesHelper);

    // Fake Ortho
    this.camera = new THREE.PerspectiveCamera(1, this.domObject.offsetWidth / this.domObject.offsetHeight, 0.1, 100000);
    this.resetCamera(false);
    this.camera.isCurrent = true;

    // We don't want them to be able to rotate, and disabling screenSpacePanning just makes zooming a bit smoother/predictable (perspective zoom is notoriously bad)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enabled = true;
    this.controls.screenSpacePanning = false;
    this.controls.enableRotate = false;

    this.updateViewerSettings(this.viewerSettings);

    // Initialize event listeners for both renderers
    this.webglrenderer.domElement.addEventListener('mousemove', this.onTouchMove.bind(this));
    this.webglrenderer.domElement.addEventListener('touchmove', this.onTouchMove.bind(this));

    this.webglrenderer.domElement.addEventListener('mousedown', this.mouseDown.bind(this));
    this.webglrenderer.domElement.addEventListener('mouseup', this.mouseUp.bind(this));

    this.svgrenderer.domElement.addEventListener('mousemove', this.onTouchMove.bind(this));
    this.svgrenderer.domElement.addEventListener('touchmove', this.onTouchMove.bind(this));

    this.svgrenderer.domElement.addEventListener('mousedown', this.mouseDown.bind(this));
    this.svgrenderer.domElement.addEventListener('mouseup', this.mouseUp.bind(this));

    // Add mouseover event listener to the container div
    this.domObject.addEventListener('mouseover', this.enableEvents.bind(this));
    this.domObject.addEventListener('mouseout', this.disableEvents.bind(this));

    // Initial check for what renderer to use
    this.switchRenderer(this.viewerSettings.exportpdf);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    window.addEventListener('resize', this.resizeCanvas.bind(this), false);

    // After load, figure out what zoom/position to be at
    this.computeSceneBoundingSphere();
    this.render();
  }

  // Iterates over all the objects and makes sure they match the current scenario: if highlights, make it transparent if not selected
  updateObjectMaterials() {
    this.threeObjs.forEach(threeObj => { //We iterate over the threeObjs and not objs for visual updates
      if (this.selectedObjects.length > 0) {
        //This one is not one of the selected
        if (this.selectedObjects.findIndex(x => x.userData && x.userData._id === threeObj.userData._id) === -1) {
          threeObj.material.transparent = true;
          threeObj.material.opacity = 0.1;
        }
        //It is selected
        else {
          threeObj.material.opacity = 1;
          threeObj.material.transparent = false
        }

      }
      else { //No highlights/selections
        threeObj.material.opacity = 1;
        threeObj.material.transparent = false;
      }
    });
  }

  resetCamera(zoomExtents = true) {
    console.log(this.camera)
    if (this.viewerSettings.camera === "orthographic") {
      // Fake Ortho
      this.camera.fov = 1;
      this.camera.aspect = this.domObject.offsetWidth / this.domObject.offsetHeight;
      this.camera.near = 0.1;
      this.camera.far = 100000;
    } else {
      // Perspective
      this.camera.fov = 75;
      this.camera.aspect = this.domObject.offsetWidth / this.domObject.offsetHeight;
      this.camera.near = 0.1;
      this.camera.far = 100000;
    }

    this.camera.up.set(0, 0, 1);
    this.camera.position.z = 20;
    this.camera.position.y = -20;
    this.camera.position.x = -20;
    if (this.controls) this.controls.reset(); //If this.controls is set, that means the scene has already been loaded and the initial render state (perfect zoom/orientation) has been saved within the controls, so we can reset to that with this
    if (zoomExtents) { //Zoom to fit all the rooms
      this.computeSceneBoundingSphere();
      this.zoomExtents();
    }
  }

  updateCamera(camera) {
    this.viewerSettings.camera = camera;
    this.resetCamera(false);
  }

  animate() {
    //I still don't understand what this does / whether its managed by the browser or not, and attempts to setTimeout() or delay it have not increased performance at all so do this at your own risk
    requestAnimationFrame(this.animate.bind(this));
    TWEEN.update()
    this.setFar()
    this.controls.update()
    this.render()
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  resizeCanvas() {
    this.camera.aspect = this.domObject.offsetWidth / this.domObject.offsetHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(this.domObject.offsetWidth, this.domObject.offsetHeight)
  }

  // called on mouseover the render div - tells us we can actually enable interactions
  // in the threejs window
  enableEvents(e) {
    this.enableKeyboardEvents = true
  }

  // called on mouseout of the render div - will stop interactions, such as spacebar
  // for zoom extents, etc. in the threejs window
  disableEvents(e) {
    this.enableKeyboardEvents = false
  }

  //if it's a doubleclick, and we have a hovered object, zoom to it
  mouseDown(event) {
    this.isSpinning = true
    // if it's a double click
    if (Date.now() - this.mouseDownTime < 300 && this.hoveredObject !== null) this.zoomToObject(this.hoveredObject)

    this.mouseDownTime = Date.now()
  }

  mouseUp(event) {
    this.isSpinning = false
    // check if it's a single short click (as opposed to a longer difference caused by moving the orbit controls
    if (Date.now() - this.mouseDownTime < 300) {
              //If clicked and it was already selected, deselect in both three and powerbi

      if (this.hoveredObject && this.selectedObjects.findIndex(x => x.userData._id === this.hoveredObject.userData._id) !== -1) {
        this.selectedObjects = [];
        this.selectionManager.clear();
        this.updateObjectMaterials(true);

      } 
      // Not already selected
      else if (this.hoveredObject) {  

        //If shift, you multi-select and add it to anything already selected
        if (event.shiftKey) {
          this.addToSelection([this.hoveredObject])
          this.selectionManager.select(_.get(this.hoveredObject, "userData.selectionID"), true)
        }

        // If control, you unselect
        else if (event.ctrlKey) {
          this.removeFromSelection([this.hoveredObject])
          this.updateObjectMaterials(true)
        }

        // Else you select it on both powerbi and threejs
        else {
          let o = this.hoveredObject;
          this.selectedObjects = [o];
          this.updateObjectMaterials(true);
          let selectedID = _.get(o, 'userData.selectionID');
          if (selectedID) this.selectionManager.select(selectedID)

        }
      } else this.clearSelection()
    }
  }


  // Haven't done anything with touch so this probably is not needed
  onTouchMove(event) {
    let x, y
    if (event.changedTouches) {
      x = event.changedTouches[0].pageX
      y = event.changedTouches[0].pageY
    } else {
      x = event.clientX
      y = event.clientY
    }
    let rect = this.domObject.getBoundingClientRect()
    x -= rect.left
    y -= rect.top
    this.mouse.x = (x / this.domObject.offsetWidth) * 2 - 1
    this.mouse.y = -(y / this.domObject.offsetHeight) * 2 + 1

    // check if we're dragging a box selection
    // if not, highlight a selected object
    if (!this.isSpinning) this.highlightMouseOverObject();
  }


  // Highlights an object + sets it as hoveredObject 
  highlightMouseOverObject() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    let intersects = this.raycaster.intersectObjects([this.scene], true); //All the objects that intersect with the cursor
    
    if (intersects.length > 0) { //If there are intersects

      if (intersects[0].object !== this.hoveredObject) { //If the one we hover over isn't the one we selected

        if (intersects[0].object.userData.hasOwnProperty('_id')) {
          this.domObject.style.cursor = 'pointer';
          // if there was a pre-exsiting hovered object, unhover it first
          if (this.hoveredObject) {
            this.hoveredObject.material.color.copy(this.hoveredObject.material.__preHoverColor);
            this.hoveredObject.userData.hovered = false;
          }

          // Set metadata of new hovered object
          this.hoveredObject = intersects[0].object;
          this.hoveredPoint = intersects[0].point;
          this.hoveredObject.userData.hovered = true;
          this.hoveredObject.material.__preHoverColor = this.hoveredObject.material.color.clone(); //Save color from before so that on unhover we can restore it 

          this.hoveredObject.material.color.copy(this.hoverColor);

          //The arguments to this function are dubious but they work so try not to refactor it
          this.tooltipServiceWrapper.showTooltip(this.hoveredObject, this.hoveredPoint, this.camera, this.renderer, [], () => { }, tooltipEvent => tooltipEvent); 
        }
      }
    } 
    // No intersects
    else {
      this.domObject.style.cursor = 'default';
      if (this.hoveredObject) {
        // Unhovering the previous hovered object
        this.hoveredObject.material.color.copy(this.hoveredObject.material.__preHoverColor); //Restore old
        this.hoveredObject.userData.hovered = false;
        this.hoveredObject = null;
      }
    }
  }

  // Add multiple objects to the selected list
  addToSelection(objects) {
    let added = []
    objects.forEach(obj => {
      if (this.selectedObjects.findIndex(x => x.userData._id === obj.userData._id) === -1) {
        obj.userData.selected = true
        this.selectedObjects.push(obj)
        added.push(obj.userData._id)
      }
    })
    this.updateObjectMaterials(true)
  }

  // Remove multiple objects from the selected list
  removeFromSelection(objects) {
    let removed = []
    objects.forEach(obj => {
      let myIndex = this.selectedObjects.findIndex(x => x.userData._id === obj.userData._id)
      if (myIndex !== -1) {
        obj.userData.selected = false
        removed.push(obj.userData._id)
        this.selectedObjects.splice(myIndex, 1)
      }
    })
  }

  clearSelection() {
    this.selectedObjects = [];
  }

  // Reload the objects with materials
  reloadObjects() {
    if (this.objs) {
      this.unloadAllObjects();
      this.loadObjects({ objs: this.objs, zoomExtents: false });
    }
  }

  // adds a bunch of speckle objects to the scene. handles conversion and
  // computes each objects's bounding sphere for faster zoom extents calculation
  // of the scene bounding sphere.
  loadObjects({ objs, zoomExtents }) {
    //For some reason I think we need to sort by room first 
    let sorted = this.sortObjs(objs);
    //On reload clear selections
    if (this.hasHighlights()) this.clearSelection();

    // Not 100% sure what happens in here, most of it is taken from the Speckle project code
    sorted.forEach((obj, index) => {
      try {
        let splitType = obj.type.split("/");
        let convertType = splitType.pop()
        while (splitType.length > 0 & !Converter.hasOwnProperty(convertType)) convertType = splitType.pop();
        if (Converter.hasOwnProperty(convertType)) {
          let myColor = undefined;
          let objColor = undefined;
          if (obj && obj.properties && this.colorPalette) {
            objColor = this.getColor(obj);
            if (objColor) {
              myColor = new THREE.Color();
              myColor.setHex("0x" + objColor);
            }
          }
          Converter[convertType]({ obj: obj }, (err, threeObj) => {
            if (myColor) threeObj.material = new THREE.MeshBasicMaterial({ color: myColor, side: THREE.DoubleSide });
            if ((!this.isHighlighted(obj) && this.hasHighlights()) || (this.selectedObjects.length > 0 && this.selectedObjects.findIndex(x => x.userData && x.userData._id === obj._id) === -1)) {
              threeObj.material.transparent = true;
              threeObj.material.opacity = 0.1;
            }
            else if (this.isHighlighted(obj)) threeObj.material.transparent = false;
            threeObj.userData._id = obj._id;
            threeObj.userData.selectionID = this.getSelectionID(obj);
            threeObj.userData.properties = obj.properties;
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
      if (!this.objs)  this.controls.saveState(); //Only true on first render, save initial state
      this.objs = objs;

      if (this.objs.filter(this.isHighlighted).length > 0) this.zoomHighlightExtents();

      else if (zoomExtents && (index === objs.length - 1)) {
        this.computeSceneBoundingSphere();
        if (this.selectedObjects.length > 0) this.zoomHighlightExtents()
      }
    });
  }

  // removes all objects from the scene and recalculates the scene bounding sphere
  unloadAllObjects() {
    let toRemove = [];

    // Removes all 
    this.scene.traverse(obj => { //Essentially flattens the scene so that all objects and their children and their children etc are in one arr
      if (obj.userData._id) toRemove.push(obj);
    })

    toRemove.forEach((object, index) => {
      object.parent.remove(object)
      if (index === toRemove.length - 1) {
        //If last one, rezoom scene
        this.computeSceneBoundingSphere();
      }
    })
  }


  zoomToObject(obj) {
    if (typeof obj === 'string')  obj = this.scene.children.find(o => o.userData._id === obj); //If we are passed a string it's the id of an object we want to zoom to
    if (!obj) return;

    let bsphere = obj.geometry.boundingSphere;
    if (bsphere.radius < 1) bsphere.radius = 2; //We would rather be slightly zoomed out than too zoomed in, so we have this min

    let offset = bsphere.radius / Math.tan(Math.PI / 180.0 * this.controls.object.fov * 0.5); //Taken from three.js, i dont know how 3d graphics works
    let vector = new THREE.Vector3(0, 0, 1);
    let dir = vector.applyQuaternion(this.controls.object.quaternion);
    let newPos = new THREE.Vector3();
    dir.multiplyScalar(offset);
    newPos.addVectors(bsphere.center, dir);
    this.setCamera({
      position: [newPos.x, newPos.y, newPos.z],
      rotation: [this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z],
      target: [bsphere.center.x, bsphere.center.y, bsphere.center.z]
    }, 600)
  }

  zoomExtents() {
    this.computeSceneBoundingSphere(); //Computes the bounding sphere for the whole scene

    //Zooms/orients camera for the bounding sphere
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
    }, 450)
  }

  zoomHighlightExtents() {
    // Only zooms to the highlighted objects in the scene
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
    }, 450)
  }


  computeHighlightBoundingSphere() {
    let filter = obj => {
      if (!obj.userData._id) return false;
      if (!obj.geometry) return false;
      if (obj.material.transparent) return false;
      return true;
    }

    this.sceneBoundingSphere = this.computeBoundingSphere(filter);
  }

  computeBoundingSphere(filter) {
    let max = new THREE.Vector3(0, 0, 0);
    let min = new THREE.Vector3(0, 0, 0);
    let radius = 0;
    let k = 0;

    // Not 100% sure how this owrks (although i did at one point), but if you give it a filter for which objects you want to consider, it makes a good boundign sphere
    for (let obj of this.scene.children) {
      if (!filter(obj)) continue;

      if (k === 0) {
        max = new THREE.Vector3(obj.geometry.boundingSphere.center.x + obj.geometry.boundingSphere.radius, obj.geometry.boundingSphere.center.y + obj.geometry.boundingSphere.radius, obj.geometry.boundingSphere.center.z + obj.geometry.boundingSphere.radius);
        min = new THREE.Vector3(obj.geometry.boundingSphere.center.x - obj.geometry.boundingSphere.radius, obj.geometry.boundingSphere.center.y - obj.geometry.boundingSphere.radius, obj.geometry.boundingSphere.center.z - obj.geometry.boundingSphere.radius);
        radius = obj.geometry.boundingSphere.radius;
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

    let center = new THREE.Vector3((max.x + min.x) / 2, (max.y + min.y) / 2, (max.z + min.z) / 2);
    return { center: center ? center : new THREE.Vector3(), radius: bigRadius * 1.6 }; //Rather underzoom
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

  computeSceneBoundingSphere() {
    let filter = obj => {
      if (!obj.userData._id) return false;
      if (!obj.geometry) return false;
      if (this.RGBToHex(obj.material.color) === this.viewerSettings.defaultRoomColor) return false;
      return true;
    }

    this.sceneBoundingSphere = this.computeBoundingSphere(filter);
  }

  setFar() {
    let camDistance = this.camera.position.distanceTo(this.sceneBoundingSphere.center);
    this.camera.far = 3 * this.sceneBoundingSphere.radius + camDistance * 3 // 3 is lucky
    this.camera.updateProjectionMatrix();
  }

  setCamera(where, time) {
    let self = this; //We have to do a copy for scoped stuff with the Tween, not sure why but it doesnt work with just 'this'
    let duration = time ? time : 350;
    //position
    new TWEEN.Tween(self.camera.position).to({ x: where.position[0], y: where.position[1], z: where.position[2] }, duration).easing(TWEEN.Easing.Quadratic.InOut).start();
    // rotation
    new TWEEN.Tween(self.camera.rotation).to({ x: where.rotation[0], y: where.rotation[1], z: where.rotation[2] }, duration).easing(TWEEN.Easing.Quadratic.InOut).start();
    // controls center
    new TWEEN.Tween(self.controls.target).to({ x: where.target[0], y: where.target[1], z: where.target[2] }, duration).onUpdate(() => {
      self.controls.update();
    }).easing(TWEEN.Easing.Quadratic.InOut).start();
  }

  updateViewerSettings(viewerSettings) {
    this.viewerSettings = viewerSettings;
    this.setDefaultMeshMaterial();
    this.edgesThreshold = viewerSettings.edgesThreshold;
    this.getColor = viewerSettings.getColor;
    this.isHighlighted = viewerSettings.isHighlighted;
    this.hasHighlights = viewerSettings.hasHighlights;
    this.getUniqueProps = viewerSettings.getUniqueProps;
    this.colorPalette = viewerSettings.colorPalette;
    this.getSelectionID = viewerSettings.getSelectionID;
    this.sortObjs = viewerSettings.sortObjs;
    this.selectionManager = viewerSettings.selectionManager;
    this.events = viewerSettings.events;
    this.storage = viewerSettings.storage;
    this.options = viewerSettings.options;
    if (this.lineWeight && viewerSettings.lineWeight !== this.lineWeight) this.svgrenderer.lineWeight = viewerSettings.lineWeight;
    if (this.lineColor && viewerSettings.lineColor !== this.lineColor) this.svgrenderer.lineColor = viewerSettings.lineColor;
    this.tooltipServiceWrapper = viewerSettings.tooltipServiceWrapper;

    this.lineWeight = viewerSettings.lineWeight;
    this.lineColor = viewerSettings.lineColor;
    //If changed, we update the renderer
    if (this.exportpdf && viewerSettings.exportpdf !== this.exportpdf) this.switchRenderer(viewerSettings.exportpdf);
    this.exportpdf = viewerSettings.exportpdf;
  }

  switchRenderer(renderer) {
    if (this.domObject) this.domObject.removeChild(this.domObject.childNodes[0]);

    if (renderer === "SVG") {
      this.domObject.appendChild(this.svgrenderer.domElement);
      this.svgrenderer.lineWeight = this.viewerSettings.lineWeight;
      this.svgrenderer.lineColor = this.viewerSettings.lineColor;
      this.svgrenderer.setSize(this.domObject.offsetWidth, this.domObject.offsetHeight)
      this.renderer = this.svgrenderer;
    }
    else {
      this.domObject.appendChild(this.webglrenderer.domElement);
      this.webglrenderer.setSize(this.domObject.offsetWidth, this.domObject.offsetHeight)
      this.renderer = this.webglrenderer;
    }

    // Reset the controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enabled = true;
    this.controls.screenSpacePanning = true;
    this.controls.enableRotate = false;
  }

  setDefaultMeshMaterial() {
    // Set the default mesh material
    for (let obj of this.scene.children) if (obj.type === 'Mesh' && obj.material) {
      obj.material.opacity = this.viewerSettings.meshOverrides.opacity / 100;
      obj.material.needsUpdate = true;
    }
  }
}