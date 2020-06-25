import * as THREE from 'three'
import _ from 'lodash'
import OrbitControls from 'threejs-orbit-controls'
import TWEEN from '@tweenjs/tween.js'
import flatten from 'flat'

import { Converter } from './SpeckleConverter.js'
import SelectionBox from './SelectionBox.js'
import SelectionHelper from './SelectionHelper.js'
import { SVGRenderer } from './SVGRenderer.ts'

export default class SpeckleRenderer {

  constructor({ domObject }, viewerSettings) {
    // super() // event emitter init
    this.domObject = domObject
    this.objs = null
    this.renderer = null
    this.scene = null
    this.camera = null
    this.exportpdf = viewerSettings.exportpdf;
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
    this.raycaster = null
    this.mouse = null
    this.mouseDownTime = null
    this.enableKeyboardEvents = false

    this.selectionBox = null
    this.selectionHelper = null

    this.hoveredObject = null
    this.selectedObjects = []
    this.highlightedObjects = []

    this.hoverColor = new THREE.Color('#EEF58F')

    this.sceneBoundingSphere = null

    this.edgesThreshold = null

    this.viewerSettings = viewerSettings
    this.exportpdf = this.viewerSettings.exportpdf
    this.webglrenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, logarithmicDepthBuffer: true })
    this.webglrenderer.setSize(this.domObject.offsetWidth, this.domObject.offsetHeight)

    this.svgrenderer = new SVGRenderer();
    this.svgrenderer.setSize(this.domObject.offsetWidth, this.domObject.offsetHeight)
    // console.log(this.exportpdf)
    // console.log("Setting webGL")

    this.domObject.appendChild(this.webglrenderer.domElement);
    this.renderer = this.webglrenderer;
    this.initialise()
  }

  initialise() {

    this.scene = new THREE.Scene()

    let axesHelper = new THREE.AxesHelper(10)
    this.scene.add(axesHelper)
    // Fake Ortho
      this.camera = new THREE.PerspectiveCamera(1, this.domObject.offsetWidth / this.domObject.offsetHeight, 0.1, 100000);
      this.resetCamera(false)
      this.camera.isCurrent = true

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enabled = true
    this.controls.screenSpacePanning = true
    this.controls.enableRotate = false

    this.updateViewerSettings(this.viewerSettings)
    this.webglrenderer.domElement.addEventListener('mousemove', this.onTouchMove.bind(this))
    this.webglrenderer.domElement.addEventListener('touchmove', this.onTouchMove.bind(this))

    this.webglrenderer.domElement.addEventListener('mousedown', this.mouseDown.bind(this))
    this.webglrenderer.domElement.addEventListener('mouseup', this.mouseUp.bind(this))

    this.svgrenderer.domElement.addEventListener('mousemove', this.onTouchMove.bind(this))
    this.svgrenderer.domElement.addEventListener('touchmove', this.onTouchMove.bind(this))

    this.svgrenderer.domElement.addEventListener('mousedown', this.mouseDown.bind(this))
    this.svgrenderer.domElement.addEventListener('mouseup', this.mouseUp.bind(this))

    this.domObject.addEventListener('mouseover', this.enableEvents.bind(this))
    this.domObject.addEventListener('mouseout', this.disableEvents.bind(this))
    this.switchRenderer(this.viewerSettings.exportpdf)
    // this.resetCamera(true)

    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()

    this.selectionBox = new SelectionBox(this.camera, this.scene)
    this.selectionHelper = new SelectionHelper(this.selectionBox, this.renderer, "selectBox", this.controls, this.mouse)

    window.addEventListener('resize', this.resizeCanvas.bind(this), false)

    this.computeSceneBoundingSphere()
    this.render()
  }


  updateObjectMaterials(isSingleClick) {
    console.log(this.objs.filter(this.isHighlighted).length)
    this.threeObjs.forEach(threeObj => {
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
      else if (this.selectedObjects.length > 0) {
        // console.log(threeObj)

        //There are selected ones
        if (this.selectedObjects.findIndex(x => x.userData && x.userData._id === threeObj.userData._id) === -1) {
          threeObj.material.transparent = true;
          threeObj.material.opacity = 0.1;
        }
        else {
          threeObj.material.opacity = 1;
          threeObj.material.transparent = false
        }

      }
      else { //Neither
        threeObj.material.opacity = 1;
        threeObj.material.transparent = false;
      }
    })
  }

  resetCamera(zoomExtents = true) {
    if (this.viewerSettings.camera === "orthographic") {
      // Fake Ortho
      this.camera.fov = 1
      this.camera.aspect = this.domObject.offsetWidth / this.domObject.offsetHeight
      this.camera.near = 0.1
      this.camera.far = 100000
    } else {
      // Perspective
      this.camera.fov = 75
      this.camera.aspect = this.domObject.offsetWidth / this.domObject.offsetHeight
      this.camera.near = 0.1
      this.camera.far = 100000
    }

    this.camera.up.set(0, 0, -1)
    this.camera.position.z = 20
    this.camera.position.y = 20
    this.camera.position.x = 20
    if (this.controls) this.controls.target = new THREE.Vector3(0, 0, 0);
    if (zoomExtents) {
      this.computeSceneBoundingSphere()
      this.zoomExtents()
    }
  }

  updateCamera(camera) {
    this.viewerSettings.camera = camera
    this.resetCamera(false)
  }

  animate() {
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
  // we dont' do much on mouse down:
  // 1) if it's a doubleclick, and we have a hovered object, zoom to it
  // 2) if the orbit controls are disabled (meaning we're holding down shift for a multiple selection)
  // then start the selection box point
  mouseDown(event) {
    this.isSpinning = true
    // if it's a double click
    if (Date.now() - this.mouseDownTime < 300 && this.hoveredObject !== null) this.zoomToObject(this.hoveredObject)

    if (this.controls.enabled === false) this.selectionBox.startPoint.set(this.mouse.x, this.mouse.y, 0.5)

    this.mouseDownTime = Date.now()
  }

  mouseUp(event) {
    this.isSpinning = false
    // check if it's a single short click (as opposed to a longer difference caused by moving the orbit controls
    // or dragging the selection box)
    if (Date.now() - this.mouseDownTime < 300) {
      console.log(this.selectedObjects);
      if (this.hoveredObject && this.selectedObjects.findIndex(x => x.userData._id === this.hoveredObject.userData._id) !== -1) {
        // Inside the selection -> check if it's a single object deselect
        console.log("Should remove")
        this.selectedObjects = [];
        // else this.removeFromSelection([this.hoveredObject]);
        this.selectionManager.clear()
        // this.resetCamera(false);
        this.updateObjectMaterials(true)

      } else if (this.hoveredObject) {  //If the hoveredObject is already selected, then unselect it

        if (event.shiftKey) {
          // console.log('should add to selection')
          this.addToSelection([this.hoveredObject])
          this.selectionManager.select(_.get(this.hoveredObject, "userData.selectionID"), true)
        } else if (event.ctrlKey) {
          // console.log('should remove from selection')
          this.removeFromSelection([this.hoveredObject])
          this.updateObjectMaterials(true)

        } else {
          // console.log('single selection')
          let o = this.hoveredObject;
          console.log(o);
          this.selectedObjects = [o];
          this.updateObjectMaterials(true);
          let selectedID = _.get(o, 'userData.selectionID');
          //https://discourse.threejs.org/t/changing-opacity-of-a-object-group/8783/2

          if(selectedID) this.selectionManager.select(selectedID)

        }
      } else this.clearSelection()
    }
  }

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
    if (this.selectionHelper.isDown && !this.controls.enabled) {
      this.selectionBox.endPoint.set(this.mouse.x, this.mouse.y, 0.5);
      var allSelected = this.selectionBox.select()
      this.addToSelection(allSelected)
    }
    // if not, highlight a selected object
    else if (!this.isSpinning) {
      this.highlightMouseOverObject()
    }
  }

  highlightMouseOverObject() {
    this.raycaster.setFromCamera(this.mouse, this.camera)
    let intersects = this.raycaster.intersectObjects([this.scene], true)
    if (intersects.length > 0) {
      if (intersects[0].object !== this.hoveredObject) {
        if (intersects[0].object.userData.hasOwnProperty('_id')) {
          this.domObject.style.cursor = 'pointer'
          // if there was a pre-exsiting hovered object
          // unhover it first
          if (this.hoveredObject) {
            this.hoveredObject.material.color.copy(this.hoveredObject.material.__preHoverColor)
            this.hoveredObject.userData.hovered = false
          }
          this.hoveredObject = intersects[0].object
          this.hoveredObject.userData.hovered = true
          this.hoveredObject.material.__preHoverColor = this.hoveredObject.material.color.clone()
          this.hoveredObject.material.color.copy(this.hoverColor)
        }
      }
    } else {
      this.domObject.style.cursor = 'default'
      if (this.hoveredObject) {
        this.hoveredObject.material.color.copy(this.hoveredObject.material.__preHoverColor)
        this.hoveredObject.userData.hovered = false
        this.hoveredObject = null
      }
    }
  }

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

  removeFromSelection(objects) {
    let removed = []
    objects.forEach((obj, index) => {
      let myIndex = this.selectedObjects.findIndex(x => x.userData._id === obj.userData._id)
      if (myIndex !== -1) {
        obj.userData.selected = false
        removed.push(obj.userData._id)
        this.selectedObjects.splice(myIndex, 1)
      }
    })
    // this.updateObjectMaterials()

  }

  clearSelection() {
    // this.threeObjs.forEach(obj => {
    //   obj.userData.selected = false
    //   obj.material.transparent = false;
    //   obj.material.opacity = 1;
    //   if(obj.material.__preHoverColor) obj.material.color.copy(obj.material.__preHoverColor)
    // })
    this.selectedObjects = []
    // this.updateObjectMaterials()
  }

  reloadObjects() {
    if (this.objs) {
      this.unloadAllObjects()
      this.loadObjects({ objs: this.objs, zoomExtents: true })
    }
  }

  // adds a bunch of speckle objects to the scene. handles conversion and
  // computes each objects's bounding sphere for faster zoom extents calculation
  // of the scene bounding sphere.
  loadObjects({ objs, zoomExtents, firstLoad }) {
    this.objs = objs
    //For some reason I think we need to sort by room first 
    let sorted = this.sortObjs(objs);
    if (this.hasHighlights()) this.clearSelection();
    sorted.forEach((obj, index) => {
      try {
        let splitType = obj.type.split("/")
        let convertType = splitType.pop()
        while (splitType.length > 0 & !Converter.hasOwnProperty(convertType)) convertType = splitType.pop()
        if (Converter.hasOwnProperty(convertType)) {
          let myColor = undefined
          let objColor = undefined;
          if (obj && obj.properties && this.colorPalette) {
            objColor = this.getColor(obj)
            if (objColor) {
              myColor = new THREE.Color()
              myColor.setHex("0x" + objColor);
            }
          }
          Converter[convertType]({ obj: obj }, (err, threeObj) => {
            if (myColor) threeObj.material = new THREE.MeshBasicMaterial({ color: myColor, side: THREE.DoubleSide })
            // console.log(this.selectedObjects)
            if ((!this.isHighlighted(obj) && this.hasHighlights()) || (this.selectedObjects.length > 0 && this.selectedObjects.findIndex(x => x.userData && x.userData._id === obj._id) === -1)) {
              threeObj.material.transparent = true;
              threeObj.material.opacity = 0.1;
            }
            else if (this.isHighlighted(obj)) threeObj.material.transparent = false;
            threeObj.userData._id = obj._id
            threeObj.userData.selectionID = this.getSelectionID(obj);
            threeObj.userData.properties = obj.properties ? flatten(obj.properties, { safe: true }) : null
            threeObj.userData.originalColor = threeObj.material.color.clone()
            threeObj.geometry.computeBoundingSphere()
            threeObj.castShadow = true
            threeObj.receiveShadow = true
            this.scene.add(threeObj)
            this.threeObjs.push(threeObj);
          })
        }
      } catch (e) {
        console.warn(`Something went wrong in the conversion of ${obj._id} (${obj.type})`)
        // console.log(obj)
        // console.log(e)
        return
      }

      if (this.objs.filter(this.isHighlighted).length > 0) {
        // console.log("Zooming to highlights")
        this.zoomHighlightExtents();
      }

      else if (zoomExtents && (index === objs.length - 1)) {
        // console.log("Zooming to filtered")
        this.computeSceneBoundingSphere()
        this.resetCamera(true)
        this.zoomHighlightExtents()
        // if(this.selectedObjects.length > 0) this.zoomToObject(this.selectedObjects[0])
      }

    })
  }

  // removes all objects from the scene and recalculates the scene bounding sphere
  unloadAllObjects() {
    let toRemove = []

    this.scene.traverse(obj => {
      if (obj.userData._id) {
        toRemove.push(obj)
      }
    })

    toRemove.forEach((object, index) => {
      object.parent.remove(object)
      if (index === toRemove.length - 1) {
        this.computeSceneBoundingSphere()
        this.zoomExtents()
      }
    })
  }


  zoomToObject(obj) {
    if (typeof obj === 'string') {
      obj = this.scene.children.find(o => o.userData._id === obj)
    }
    if (!obj) return
    let bsphere = obj.geometry.boundingSphere
    if (bsphere.radius < 1) bsphere.radius = 2

    let offset = bsphere.radius / Math.tan(Math.PI / 180.0 * this.controls.object.fov * 0.5)
    let vector = new THREE.Vector3(0, 0, 1)
    let dir = vector.applyQuaternion(this.controls.object.quaternion);
    let newPos = new THREE.Vector3()
    dir.multiplyScalar(offset)
    newPos.addVectors(bsphere.center, dir)
    this.setCamera({
      position: [newPos.x, newPos.y, newPos.z],
      rotation: [this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z],
      target: [bsphere.center.x, bsphere.center.y, bsphere.center.z]
    }, 600)
  }

  zoomExtents() {
    this.computeSceneBoundingSphere()
    let offset = this.sceneBoundingSphere.radius / Math.tan(Math.PI / 180.0 * this.controls.object.fov * 0.5)
    let vector = new THREE.Vector3(0, 0, 1)
    let dir = vector.applyQuaternion(this.controls.object.quaternion);
    let newPos = new THREE.Vector3()
    dir.multiplyScalar(offset)
    newPos.addVectors(this.sceneBoundingSphere.center, dir)
    this.setCamera({
      position: [newPos.x, newPos.y, newPos.z],
      rotation: [this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z],
      target: [this.sceneBoundingSphere.center.x, this.sceneBoundingSphere.center.y, this.sceneBoundingSphere.center.z]
    }, 450)
  }

  zoomHighlightExtents() {
    this.computeHighlightBoundingSphere()
    let offset = this.sceneBoundingSphere.radius / Math.tan(Math.PI / 180.0 * this.controls.object.fov * 0.5)
    let vector = new THREE.Vector3(0, 0, 1)
    let dir = vector.applyQuaternion(this.controls.object.quaternion);
    let newPos = new THREE.Vector3()
    dir.multiplyScalar(offset)
    newPos.addVectors(this.sceneBoundingSphere.center, dir)
    // newPos.x -= 10000;
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
    let center = null,
      radius = 0,
      k = 0

    for (let obj of this.scene.children) {
      if (!filter(obj)) continue;

      if (k === 0) {
        center = new THREE.Vector3(obj.geometry.boundingSphere.center.x, obj.geometry.boundingSphere.center.y, obj.geometry.boundingSphere.center.z)
        radius = obj.geometry.boundingSphere.radius
        k++
        continue
      }

      let otherDist = obj.geometry.boundingSphere.radius + center.distanceTo(obj.geometry.boundingSphere.center)
      if (radius < otherDist) radius = otherDist

      center.x += obj.geometry.boundingSphere.center.x
      center.y += obj.geometry.boundingSphere.center.y
      center.z += obj.geometry.boundingSphere.center.z
      center.divideScalar(2)

      k++
    }

    if (!center) center = new THREE.Vector3(0, 0, 0)
    return { center: center ? center : new THREE.Vector3(), radius: radius > 1 ? radius * 1.2 : 100 }
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
    let camDistance = this.camera.position.distanceTo(this.sceneBoundingSphere.center)
    this.camera.far = 3 * this.sceneBoundingSphere.radius + camDistance * 3 // 3 is lucky
    this.camera.updateProjectionMatrix()
  }

  setCamera(where, time) {
    let self = this
    let duration = time ? time : 350
    //position
    new TWEEN.Tween(self.camera.position).to({ x: where.position[0], y: where.position[1], z: where.position[2] }, duration).easing(TWEEN.Easing.Quadratic.InOut).start()
    // rotation
    new TWEEN.Tween(self.camera.rotation).to({ x: where.rotation[0], y: where.rotation[1], z: where.rotation[2] }, duration).easing(TWEEN.Easing.Quadratic.InOut).start()
    // controls center
    new TWEEN.Tween(self.controls.target).to({ x: where.target[0], y: where.target[1], z: where.target[2] }, duration).onUpdate(() => {
      self.controls.update();
      // if (this.x === where.target[0])
      // console.log('camera finished stuff')
    }).easing(TWEEN.Easing.Quadratic.InOut).start()
  }

  updateViewerSettings(viewerSettings) {
    this.viewerSettings = viewerSettings;
    this.setDefaultMeshMaterial()
    this.edgesThreshold = viewerSettings.edgesThreshold;
    this.getColor = viewerSettings.getColor;
    this.isHighlighted = viewerSettings.isHighlighted;
    this.hasHighlights = viewerSettings.hasHighlights;
    this.getUniqueProps = viewerSettings.getUniqueProps;
    this.colorPalette = viewerSettings.colorPalette;
    this.getSelectionID = viewerSettings.getSelectionID;
    this.sortObjs = viewerSettings.sortObjs;
    this.selectionManager = viewerSettings.selectionManager;
    if (this.lineWeight && viewerSettings.lineWeight !== this.lineWeight) this.svgrenderer.lineWeight = viewerSettings.lineWeight;
    if (this.lineColor && viewerSettings.lineColor !== this.lineColor) this.svgrenderer.lineColor = viewerSettings.lineColor;

    this.lineWeight = viewerSettings.lineWeight;
    this.lineColor = viewerSettings.lineColor;
    if (this.exportpdf && viewerSettings.exportpdf !== this.exportpdf) this.switchRenderer(viewerSettings.exportpdf)
    this.exportpdf = viewerSettings.exportpdf;
    // this.resetCamera(true);
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

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enabled = true
    this.controls.screenSpacePanning = true
    this.controls.enableRotate = false
  }

  setDefaultMeshMaterial() {
    for (let obj of this.scene.children) if (obj.type === 'Mesh' && obj.material) this.setMaterialOverrides(obj)
  }

  setMaterialOverrides(obj) {
    obj.material.opacity = this.viewerSettings.meshOverrides.opacity / 100
    let specColor = new THREE.Color()
    specColor.setHSL(0, 0, this.viewerSettings.meshOverrides.specular / 100)
    obj.material.specular = specColor
    obj.material.needsUpdate = true
  }
}