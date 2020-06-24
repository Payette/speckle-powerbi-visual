import * as THREE from 'three'
import _ from 'lodash'
import OrbitControls from 'threejs-orbit-controls'
import CH from 'color-hash'
import TWEEN from '@tweenjs/tween.js'

import EE from 'event-emitter-es6'
import flatten from 'flat'
import debounce from 'lodash.debounce'

import { Converter } from './SpeckleConverter.js'
import SelectionBox from './SelectionBox.js'
import SelectionHelper from './SelectionHelper.js'
import {SVGRenderer} from './SVGRenderer.js'

export default class SpeckleRenderer extends EE {

  constructor({ domObject }, viewerSettings) {
    super() // event emitter init
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
    this.hemiLight = null
    this.flashLight = null
    this.shadowLight = null
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
    this.selectColor = new THREE.Color('#E3E439')

    this.sceneBoundingSphere = null

    this.colorHasher = new CH()

    this.isSettingColors = false
    this.currentColorByProp = null
    this.colorTable = {}

    this.edgesGroup = new THREE.Group()
    this.edgesGroup.name = 'displayEdgesGroup'
    this.edgesThreshold = null

    this.viewerSettings = viewerSettings
    this.exportpdf = this.viewerSettings.exportpdf
    this.webglrenderer = new THREE.WebGLRenderer( { alpha: true, antialias: true, logarithmicDepthBuffer: true } )
    this.webglrenderer.setSize(this.domObject.offsetWidth, this.domObject.offsetHeight)

    this.svgrenderer = new SVGRenderer();
    this.svgrenderer.setSize(this.domObject.offsetWidth, this.domObject.offsetHeight)
    console.log(this.exportpdf)
    console.log("Setting webGL")

    this.domObject.appendChild(this.webglrenderer.domElement);
    this.renderer = this.webglrenderer;
    this.initialise()
  }

  initialise() {

    this.scene = new THREE.Scene()

    let axesHelper = new THREE.AxesHelper(10)
    this.scene.add(axesHelper)

    let hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1)
    hemiLight.color = new THREE.Color('#FFFFFF')
    hemiLight.groundColor = new THREE.Color('#959595')
    hemiLight.position.set(0, 500, 0)
    hemiLight.isCurrent = true
    hemiLight.name = 'world lighting'
    hemiLight.up.set(0, 0, 1)
    this.scene.add(hemiLight)

    this.shadowLight = new THREE.DirectionalLight(0xffffff, .5)
    this.shadowLight.position.set(1, 1, 5)
    this.shadowLight.castShadow = true;
    this.shadowLight.visible = false
    this.scene.add(this.shadowLight)
    this.shadowLight.shadow.mapSize.width = 512; // default
    this.shadowLight.shadow.mapSize.height = 512; // default
    this.shadowLight.shadow.camera.near = 0.5; // default
    this.shadowLight.shadow.camera.far = 500;

    // Fake Ortho
    this.camera = new THREE.PerspectiveCamera(1, this.domObject.offsetWidth / this.domObject.offsetHeight, 0.1, 100000);
    this.resetCamera(false)
    this.camera.isCurrent = true

    let flashlight = new THREE.PointLight(new THREE.Color('#FFFFFF'), 0.32, 0, 1)
    flashlight.name = 'camera light'
    this.camera.add(flashlight)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enabled = true
    this.controls.screenSpacePanning = true
    this.controls.enableRotate = false
    this.edgesGroup.visible = false
    this.scene.add(this.edgesGroup)

    this.updateViewerSettings(this.viewerSettings)
    this.switchRenderer(this.viewerSettings.exportpdf)
    window.THREE = THREE
    window.Converter = Converter

    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()

    this.selectionBox = new SelectionBox(this.camera, this.scene)
    this.selectionHelper = new SelectionHelper(this.selectionBox, this.renderer, "selectBox", this.controls, this.mouse)

    window.addEventListener('resize', this.resizeCanvas.bind(this), false)
    this.renderer.domElement.addEventListener('mousemove', this.onTouchMove.bind(this))
    this.renderer.domElement.addEventListener('touchmove', this.onTouchMove.bind(this))

    this.renderer.domElement.addEventListener('mousedown', this.mouseDown.bind(this))
    this.renderer.domElement.addEventListener('mouseup', this.mouseUp.bind(this))

    this.domObject.addEventListener('mouseover', this.enableEvents.bind(this))
    this.domObject.addEventListener('mouseout', this.disableEvents.bind(this))

    this.computeSceneBoundingSphere()
    this.render()

    this.controls.addEventListener('change', debounce(function () {
      this.emit('camera-pos', {
        target: [this.controls.target.x, this.controls.target.y, this.controls.target.z],
        position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
        rotation: [this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z]
      })
      this.setFar()
    }.bind(this), 200))
  }

  updateCamera(camera) {
    this.viewerSettings.camera = camera
    this.resetCamera()
  }

  loadRenderer(renderer){
    if(this.renderer) this.renderer.dispose();
    this.renderer = renderer === "SVG"? new SVGRenderer() : new THREE.WebGLRenderer( { alpha: true, antialias: true, logarithmicDepthBuffer: true } )
    this.scene = new THREE.Scene()
    this.domObject.appendChild(this.renderer.domElement)

    this.renderer.domElement.addEventListener('mousemove', this.onTouchMove.bind(this))
    this.renderer.domElement.addEventListener('touchmove', this.onTouchMove.bind(this))

    this.renderer.domElement.addEventListener('mousedown', this.mouseDown.bind(this))
    this.renderer.domElement.addEventListener('mouseup', this.mouseUp.bind(this))

    this.render();
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
    this.camera.position.z = 250
    this.camera.position.y = 250
    this.camera.position.x = 250

    if (zoomExtents) {
      this.computeSceneBoundingSphere()
      this.zoomExtents()
    }
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
    if (Date.now() - this.mouseDownTime < 300 && this.hoveredObject !== null)
      this.zoomToObject(this.hoveredObject)

    if (this.controls.enabled === false)
      this.selectionBox.startPoint.set(this.mouse.x, this.mouse.y, 0.5)

    this.mouseDownTime = Date.now()
  }

  mouseUp(event) {
    this.isSpinning = false
    // check if it's a single short click (as opposed to a longer difference caused by moving the orbit controls
    // or dragging the selection box)
    if (Date.now() - this.mouseDownTime < 300) {
      // console.log(this.hoveredObject);
      // this.getColor(this.hoveredObject)
      // console.log(this.hoveredObject)
      if(this.hoveredObject.userData.selected) {
        console.log("Should be removing")
        if(this.selectedObjects.length === 1) this.clearSelection();
        else this.removeFromSelection([this.hoveredObject]);
      }
      else if (this.hoveredObject && this.selectedObjects.findIndex(x => x.userData._id === this.hoveredObject.userData._id) !== -1) {
        // Inside the selection -> check if it's a single object deselect
        if (event.ctrlKey) {
          this.removeFromSelection([this.hoveredObject]);
        }
      } else if (this.hoveredObject) { // if there is a hovered object...
        //If the hoveredObject is already selected, then unselect it
        // if(this.hoveredObject.userData.selected) this.removeFromSelection([this.hoveredObject]);

        if (event.shiftKey) {
          console.log('should add to selection')
          this.addToSelection([this.hoveredObject])
          this.selectionManager.select(_.get(this.hoveredObject, "userData.selectionID"), true)
        } else if (event.ctrlKey) {
          console.log('should remove from selection')
          this.removeFromSelection([this.hoveredObject])
        } else {
          console.log('single selection')
          let o = this.hoveredObject;
          this.clearSelection()
          this.addToSelection([o])
          let selectedID = _.get(o, 'userData.selectionID');
          //https://discourse.threejs.org/t/changing-opacity-of-a-object-group/8783/2

          if(selectedID) this.selectionManager.select(selectedID).then(ids =>{
            setOpacity(this.scene, ids.length > 0 ? 0.1 : 1);
            o.material.transparent = false;
            o.material.opacity = 1;
          })
          console.log(o);

        }
      } else { // there is no hoverefd object, so clear selection!?
        this.clearSelection()
      }
    } else {
      // if the controls were disabled, it means we've been selecting objects with the selection box
      if (!this.controls.enabled) {
        this.emit('select-objects', this.selectionBox.collection.map(o => o.userData._id))
      }
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

    // disallow interactions on color sets
    if (this.isSettingColors) return

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
    objects.forEach((obj, index) => {
      if (this.selectedObjects.findIndex(x => x.userData._id === obj.userData._id) === -1) {
        obj.userData.selected = true
        // obj.material.color.copy(this.selectColor)
        this.selectedObjects.push(obj)
        added.push(obj.userData._id)
      }
    })
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
      if (index === objects.length - 1) {
        // TODO: emit removed from selection event
        this.emit('select-remove-objects', removed)
      }
    })
  }

  clearSelection() {
    this.threeObjs.forEach(obj => {
      obj.userData.selected = false
      obj.material.transparent = false;
      obj.material.opacity = 1;
      this.drawEdges(obj, obj._id)
      if(obj.material.__preHoverColor) obj.material.color.copy(obj.material.__preHoverColor)
    })
    // this.selectionManager.clear();
    this.emit('select-objects', [])
    this.selectedObjects = []
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
  loadObjects({ objs, zoomExtents }) {
    this.objs = objs
    var uniqueProps = this.getUniqueProps(objs);
    //For some reason I think we need to sort by room first 
    let sorted = this.sortObjs(objs); 
    // this.renderer = this.exportpdf === "SVG"? new SVGRenderer() : new THREE.WebGLRenderer( { alpha: true, antialias: true, logarithmicDepthBuffer: true } )
    // this.render();
    // console.log(sorted);
    sorted.forEach((obj, index) => {
      try {
        let splitType = obj.type.split("/")
        let convertType = splitType.pop()
        while (splitType.length > 0 & !Converter.hasOwnProperty(convertType)) convertType = splitType.pop()
        if (Converter.hasOwnProperty(convertType)) {
          let myColor = undefined
          let objColor = undefined;
          if (obj && obj.properties && this.colorPalette) {
            // console.log(this.isHighlighted(obj))
            objColor = this.getColor(obj)
            // console.log(objColor);
            if (objColor) {
              myColor = new THREE.Color()
              myColor.setHex("0x" + objColor);
            }
          }
          Converter[convertType]({ obj: obj }, (err, threeObj) => {
            if (myColor) threeObj.material = new THREE.MeshBasicMaterial({ color: myColor, side: THREE.DoubleSide })
            if (!this.isHighlighted(obj) && this.hasHighlights()){
              threeObj.material.transparent = true;
              threeObj.material.opacity = 0.1; 
            }
            else if(this.isHighlighted(obj)) threeObj.material.transparent = false;
            threeObj.userData._id = obj._id
            threeObj.userData.selectionID = this.getSelectionID(obj);
            threeObj.userData.properties = obj.properties ? flatten(obj.properties, { safe: true }) : null
            threeObj.userData.originalColor = threeObj.material.color.clone()
            threeObj.geometry.computeBoundingSphere()
            threeObj.castShadow = true
            threeObj.receiveShadow = true
            this.drawEdges(threeObj, obj._id)
            this.scene.add(threeObj)
            this.threeObjs.push(threeObj);
          })
        }
      } catch (e) {
        console.warn(`Something went wrong in the conversion of ${obj._id} (${obj.type})`)
        console.log(obj)
        console.log(e)
        return
      }

      if(this.objs.filter(this.isHighlighted).length > 0){
        let highlighted = this.objs.filter(this.isHighlighted)
        // console.log(highlighted)
        console.log("Zooming to highlights")
        this.zoomHighlightExtents();
      }

      else if (zoomExtents && (index === objs.length - 1)) {
        console.log("Zooming to filtered")
        this.computeSceneBoundingSphere()
        this.zoomExtents()
      }
      
    })
  }

  drawEdges(threeObj, id) {
    if (threeObj.type !== 'Mesh') return
    // var objEdges = new THREE.EdgesGeometry(threeObj.geometry, this.viewerSettings.edgesThreshold)
    // var edgeLines = new THREE.LineSegments(objEdges, new THREE.LineBasicMaterial({ color: 0x000000 }))
    // edgeLines.material.userData._id = id;
    // edgeLines.userData._id = id
    // this.edgesGroup.add(edgeLines);
  }

  updateEdges() {
    this.processLargeArray(this.edgesGroup.children, (obj) => {
      this.edgesGroup.remove(obj)
    })
    this.processLargeArray(this.scene.children, (obj) => {
      if (obj.type !== 'Mesh') return
      this.drawEdges(obj, obj.userData._id)
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
    dir.multiplyScalar(offset * 1.5)
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
    dir.multiplyScalar(offset * 1.25)
    newPos.addVectors(this.sceneBoundingSphere.center, dir)
    this.setCamera({
      position: [newPos.x, newPos.y, newPos.z],
      rotation: [this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z],
      target: [this.sceneBoundingSphere.center.x, this.sceneBoundingSphere.center.y, this.sceneBoundingSphere.center.z]
    }, 450)
  }

  zoomHighlightExtents(){
    this.computeHighlightBoundingSphere()
    let offset = this.sceneHighlightBoundingSphere.radius / Math.tan(Math.PI / 180.0 * this.controls.object.fov * 0.5)
    let vector = new THREE.Vector3(0, 0, 1)
    let dir = vector.applyQuaternion(this.controls.object.quaternion);
    let newPos = new THREE.Vector3()
    dir.multiplyScalar(offset * 1.4)
    newPos.addVectors(this.sceneHighlightBoundingSphere.center, dir)
    this.setCamera({
      position: [newPos.x, newPos.y, newPos.z],
      rotation: [this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z],
      target: [this.sceneHighlightBoundingSphere.center.x, this.sceneHighlightBoundingSphere.center.y, this.sceneHighlightBoundingSphere.center.z]
    }, 450)
  }
  

  computeHighlightBoundingSphere(){
    let center = null,
    radius = 0,
    k = 0

    for (let obj of this.scene.children) {
      if (!obj.userData._id) continue
      if (!obj.geometry) continue
      if (obj.material.transparent) continue;

      if (k === 0) {
        center = new THREE.Vector3(obj.geometry.boundingSphere.center.x, obj.geometry.boundingSphere.center.y, obj.geometry.boundingSphere.center.z)
        radius = obj.geometry.boundingSphere.radius
        k++
        continue
      }

      let otherDist = obj.geometry.boundingSphere.radius + center.distanceTo(obj.geometry.boundingSphere.center)
      if (radius < otherDist)
        radius = otherDist

      center.x += obj.geometry.boundingSphere.center.x
      center.y += obj.geometry.boundingSphere.center.y
      center.z += obj.geometry.boundingSphere.center.z
      center.divideScalar(2)

      k++
    }

    if (!center) {
      center = new THREE.Vector3(0, 0, 0)
    }

    this.sceneHighlightBoundingSphere = { center: center ? center : new THREE.Vector3(), radius: radius > 1 ? radius * 1.1 : 100 }
    // console.log(this.sceneHighlightBoundingSphere)
  }

  RGBToHex(color) {
    let r = (color.r*255).toString(16);
    let g = (color.g*255).toString(16);
    let b = (color.b*255).toString(16);
  
    if (r.length == 1)
      r = "0" + r;
    if (g.length == 1)
      g = "0" + g;
    if (b.length == 1)
      b = "0" + b;
  
    return r + g + b;
  }

  computeSceneBoundingSphere() {
    let center = null,
      radius = 0,
      k = 0

    for (let obj of this.scene.children) {
      if (!obj.userData._id) continue
      if (!obj.geometry) continue
      if(this.RGBToHex(obj.material.color) === this.viewerSettings.defaultRoomColor) continue;
      // console.log(obj)

      if (k === 0) {
        center = new THREE.Vector3(obj.geometry.boundingSphere.center.x, obj.geometry.boundingSphere.center.y, obj.geometry.boundingSphere.center.z)
        radius = obj.geometry.boundingSphere.radius
        k++
        continue
      }

      let otherDist = obj.geometry.boundingSphere.radius + center.distanceTo(obj.geometry.boundingSphere.center)
      if (radius < otherDist)
        radius = otherDist

      center.x += obj.geometry.boundingSphere.center.x
      center.y += obj.geometry.boundingSphere.center.y
      center.z += obj.geometry.boundingSphere.center.z
      center.divideScalar(2)

      k++
    }

    if (!center) {
      center = new THREE.Vector3(0, 0, 0)
    }

    this.sceneBoundingSphere = { center: center ? center : new THREE.Vector3(), radius: radius > 1 ? radius * 1.1  : 100 }
    console.log(this.sceneBoundingSphere)
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
      if (this.x === where.target[0])
        console.log('camera finished stuff')
    }).easing(TWEEN.Easing.Quadratic.InOut).start()
  }

  //Generic helpers
  processLargeArray(array, fn, chunk, context) {
    context = context || window
    chunk = chunk || 500 // 100 elems at a time
    let index = 0

    function doChunk() {
      let count = chunk
      while (count-- && index < array.length) {
        fn.call(context, array[index], index, array)
        ++index
      }
      if (index < array.length)
        setTimeout(doChunk, 1)
    }
    doChunk()
  }

  processLargeArrayAsync(array, fn, maxTimePerChunk, context) {
    context = context || window
    maxTimePerChunk = maxTimePerChunk || 200
    let index = 0

    function doChunk() {
      let startTime = Date.now()
      while (index < array.length && (Date.now() - startTime) <= maxTimePerChunk) {
        // callback called with args (value, index, array)
        fn.call(context, array[index], index, array)
        ++index
      }
      if (index < array.length) setTimeout(doChunk, 1)
    }
    doChunk()
  }

  updateViewerSettings(viewerSettings) {
    this.viewerSettings = viewerSettings;
    this.setDefaultMeshMaterial()
    this.shadowLight.visible = viewerSettings.castShadows
    this.edgesGroup.visible = viewerSettings.showEdges
    if (this.edgesThreshold != viewerSettings.edgesThreshold) this.updateEdges()
    this.edgesThreshold = viewerSettings.edgesThreshold;
    this.getColor = viewerSettings.getColor;
    this.isHighlighted = viewerSettings.isHighlighted;
    this.hasHighlights = viewerSettings.hasHighlights;
    this.getUniqueProps = viewerSettings.getUniqueProps;
    this.colorPalette = viewerSettings.colorPalette;
    this.getSelectionID = viewerSettings.getSelectionID;
    this.sortObjs = viewerSettings.sortObjs;
    this.selectionManager = viewerSettings.selectionManager;
    if(this.lineWeight && viewerSettings.lineWeight !== this.lineWeight) this.svgrenderer.lineWeight = viewerSettings.lineWeight;
    if(this.lineColor && viewerSettings.lineColor !== this.lineColor) this.svgrenderer.lineColor = viewerSettings.lineColor;

    this.lineWeight = viewerSettings.lineWeight;
    this.lineColor = viewerSettings.lineColor;
    if(this.exportpdf && viewerSettings.exportpdf !== this.exportpdf) this.switchRenderer(viewerSettings.exportpdf)
    this.exportpdf = viewerSettings.exportpdf;
    this.resetCamera(true);
  }
  
  switchRenderer(renderer){
    if(this.domObject) this.domObject.removeChild(this.domObject.childNodes[0]);
    console.log("Setting ", renderer)
    this.renderer.domElement.removeEventListener('mousemove', this.onTouchMove.bind(this))
    this.renderer.domElement.removeEventListener('touchmove', this.onTouchMove.bind(this))

    this.renderer.domElement.removeEventListener('mousedown', this.mouseDown.bind(this))
    this.renderer.domElement.removeEventListener('mouseup', this.mouseUp.bind(this))

    this.domObject.removeEventListener('mouseover', this.enableEvents.bind(this))
    this.domObject.removeEventListener('mouseout', this.disableEvents.bind(this))

    if(renderer === "SVG"){
      this.domObject.appendChild(this.svgrenderer.domElement);
      this.svgrenderer.setQuality('high');
      this.svgrenderer.lineWeight = this.viewerSettings.lineWeight;
      this.svgrenderer.lineColor = this.viewerSettings.lineColor;
      this.svgrenderer.setSize(this.domObject.offsetWidth, this.domObject.offsetHeight)
      this.renderer = this.svgrenderer;
    }
    else {
      this.domObject.appendChild(this.webglrenderer.domElement);
      // this.webglrenderer.setQuality('low');
      this.webglrenderer.setSize(this.domObject.offsetWidth, this.domObject.offsetHeight)
      this.renderer = this.webglrenderer;
    }    

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enabled = true
    this.controls.screenSpacePanning = true
    this.controls.enableRotate = false
    this.resetCamera();

    this.renderer.domElement.addEventListener('mousemove', this.onTouchMove.bind(this))
    this.renderer.domElement.addEventListener('touchmove', this.onTouchMove.bind(this))

    this.renderer.domElement.addEventListener('mousedown', this.mouseDown.bind(this))
    this.renderer.domElement.addEventListener('mouseup', this.mouseUp.bind(this))

    this.domObject.addEventListener('mouseover', this.enableEvents.bind(this))
    this.domObject.addEventListener('mouseout', this.disableEvents.bind(this))

  }

  setDefaultMeshMaterial() {
    for (let obj of this.scene.children) {
      if (obj.type === 'Mesh') {
        if (obj.material) {
          this.setMaterialOverrides(obj)
        }
      }
    }
  }

  setMaterialOverrides(obj) {
    obj.material.opacity = this.viewerSettings.meshOverrides.opacity / 100
    let specColor = new THREE.Color()
    specColor.setHSL(0, 0, this.viewerSettings.meshOverrides.specular / 100)
    obj.material.specular = specColor
    obj.material.needsUpdate = true
  }
}
function setOpacity(obj, opacity ) {
  obj.children.forEach((child)=>{
    setOpacity(child, opacity)
  });
  if(obj.material) {
    obj.material.transparent = true;  
    obj.material.opacity = opacity;
  };
};