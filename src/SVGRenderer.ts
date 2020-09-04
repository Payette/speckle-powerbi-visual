/**
 * @author mrdoob / http://mrdoob.com/
 */

import { Box2, Camera, Matrix4 } from "three";
import { Projector } from "./Projector.js";
import { RenderableFace } from "./Projector.js";
import * as _ from 'lodash';
import * as PolygonClipping from 'polygon-clipping';

var SVGRenderer = function () {

	var _renderData, _elements,
		_projector = new Projector(),
		_svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
		_svgWidth, _svgHeight, _svgWidthHalf, _svgHeightHalf,

		_viewMatrix = new Matrix4(),
		_viewProjectionMatrix = new Matrix4(),

		_svgPathPool = [],
		_pathCount = 0,

		_precision = null;

	this.domElement = _svg;

	this.autoClear = true;
	this.sortObjects = true;
	this.sortElements = true;

	this.overdraw = 0.5;
	this.lineWeight = 1;
	this.lineColor = "#000000";

	this.setSize = function (width, height) {
		// Set size of viewbox
		_svgWidth = width; 
		_svgHeight = height;
		_svgWidthHalf = _svgWidth / 2; 
		_svgHeightHalf = _svgHeight / 2;

		_svg.setAttribute('viewBox', (-_svgWidthHalf) + ' ' + (-_svgHeightHalf) + ' ' + _svgWidth + ' ' + _svgHeight);
		_svg.setAttribute('width', _svgWidth);
		_svg.setAttribute('height', _svgHeight);

	};

	// We keep precision high for this because the models have high precision but are small (not sure why but the Speckle process)
	this.setPrecision = precision => _precision = precision;

	function removeChildNodes() {
		_pathCount = 0;
		while (_svg.childNodes.length > 0) _svg.removeChild(_svg.childNodes[0]);
	}

	let convert = c => _precision !== null ? c.toFixed(_precision) : c;

	this.clear = () => removeChildNodes();


	// We group the elements by material, since material is essentially equivalent of object, so this lets us group particularly faces
	function groupByColor(elements) {
		var grouped = _.groupBy(elements, 'material.uuid');
		grouped = Object.keys(grouped).map(group => {
			var polygons = [];
			for (var face of grouped[group]) {
				// Convert Three.js mesh into closed polygon: v1 -> v2 -> v3 -> v4
				var p = {
					coordinates: [
						[
							[face.v1.positionScreen.x * _svgWidthHalf, face.v1.positionScreen.y * - _svgHeightHalf],
							[face.v2.positionScreen.x * _svgWidthHalf, face.v2.positionScreen.y * - _svgHeightHalf],
							[face.v3.positionScreen.x * _svgWidthHalf, face.v3.positionScreen.y * - _svgHeightHalf],
							[face.v1.positionScreen.x * _svgWidthHalf, face.v1.positionScreen.y * - _svgHeightHalf]
						]
					],
					inverted: false
				}
				polygons.push(p);
			}
			if (polygons.length > 0) {
				try {
					// We then union the polygons (faces) so that instead of getting a tesselated face of triangles, we get one flat face that looks good in SVG
					return {
						// @ts-ignore
						verts: PolygonClipping.union(...polygons.map(e => e.coordinates)),
						material: grouped[group][0].material
					}
				}
				catch (e) {
					return {
						verts: polygons,
						material: grouped[group][0].material

					};
				}

			}
			return null;
		});
		return grouped;
	}

	function pathFromVerts(points) {
		// We then convert the list of points (facE) into a path that we fill by closing and adding a z at the end
		var pathString = "M";
		pathString += points[0][0] + ", " + points[0][1] + " ";

		for (var i = 1; i < points.length; i++) pathString += "L" + convert(points[i][0]) + "," + convert(points[i][1]) + " ";

		pathString += "L" + convert(points[0][0]) + "," + convert(points[0][1]) + " ";
		pathString += "z";
		return pathString;
	}

	this.render = function (scene, camera) {

		if (camera instanceof Camera === false) {

			console.error('THREE.SVGRenderer.render: camera is not an instance of Camera.');
			return;

		}

		var background = scene.background;

		if (background && background.isColor) {

			removeChildNodes();
			_svg.style.backgroundColor = background.getStyle();

		} else if (this.autoClear === true) this.clear();

		_viewMatrix.copy(camera.matrixWorldInverse);
		_viewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, _viewMatrix);

		_renderData = _projector.projectScene(scene, camera, this.sortObjects, this.sortElements);
		_elements = _renderData.elements;

		var faces = _elements.filter(e => e instanceof RenderableFace);
		var grouped = groupByColor(faces).filter(e => !!e);

		for (var face of grouped) {
			let path = pathFromVerts(face.verts);
			
			//Since the material carries the color prop, we then set the fill to that color 
			let style = 'fill:' + face.material.color.getStyle() + ';fill-opacity:' + face.material.opacity + ';';
			if (this.lineWeight > 0) style += 'stroke:' + this.lineColor + ';' + 'stroke-width:' + this.lineWeight;

			// Add the path to the general SVG node
			let _svgNode = getPathNode(_pathCount++);
			_svgNode.setAttribute('d', path);
			_svgNode.setAttribute('style', style);
			_svg.appendChild(_svgNode);
		}

	};

	function getPathNode(id) {

		if (_svgPathPool[id] == null) {
			_svgPathPool[id] = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			return _svgPathPool[id];
		}

		return _svgPathPool[id];
	}
};

export { SVGRenderer };