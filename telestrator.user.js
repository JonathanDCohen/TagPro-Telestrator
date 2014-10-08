// ==UserScript==
// @name            TagPro Telestrator
// @version         0.1.2
// @description     Use a telestrator while spectating TagPro!
// @include         http://tagpro-*.koalabeast.com:*
// @include         http://tangent.jukejuice.com:*
// @include         http://maptest.newcompte.fr:*
// @author          BBQchicken
// ==/UserScript==

tagpro.ready(function() {
	if (tagpro.spectator !== "watching") { return false; }

	var curves = [];
	var drawing = false;

// ---------- HELPER METHODS ---------- \\
	function canvasMousePosition(click) {
		var boundBox = viewPort.getBoundingClientRect();
		return {
			x: click.clientX - boundBox.left,
			y: click.clientY - boundBox.top
		};
	}

	//converts canvas coordinates to the corresponding in-game coordinates
	function canvasToTagpro(click) {
		//canvas coordinates of mouse click
		var canvasCoords = canvasMousePosition(click);

		//canvas coordinates of camera target
		var srcCoords = {x: viewPort.width / 2 - 20 / tagpro.zoom, y: viewPort.height / 2 - 20 / tagpro.zoom};

		//vector from camera target to mouse click in canvas pixels
		var canvasDiff = {x: canvasCoords.x - srcCoords.x, y: canvasCoords.y - srcCoords.y};

		//vector from camera target to mouse click in in-game pixels
		var tpDiff = {x: canvasDiff.x * tagpro.zoom, y: canvasDiff.y * tagpro.zoom}; 

		return {
			x: tagpro.viewPort.source.x + tpDiff.x, 
			y: tagpro.viewPort.source.y + tpDiff.y
		};
	}

// ---------- POINT CLASS ---------- \\

	//represents a point in the game's coordinates.
	//constructor takes a pair of canvas coordinates, i.e. from a click event.
	var Point = function(click) {
		var coords = canvasToTagpro(click);
	
		this.x = coords.x;
		this.y = coords.y;

		//the inverse operation of canvasToTagpro
		this.toCanvas = function() {
			//in-game coordinates of camera target
			var tpSrcCoords = {x: tagpro.viewPort.source.x, y: tagpro.viewPort.source.y};

			//canvas coordinates of camera target
			var canvasSrcCoords = {x: viewPort.width / 2 - 20 / tagpro.zoom, y: viewPort.height / 2 - 20 / tagpro.zoom};

			//vector from camera target to click in in-game pixels
			var tpDiff = {x: this.x - tpSrcCoords.x, y: this.y - tpSrcCoords.y};

			//vector from camera target to click in canvas pixels
			var canvasDiff = {x: tpDiff.x / tagpro.zoom, y: tpDiff.y / tagpro.zoom};

			return {
				x: canvasSrcCoords.x + canvasDiff.x,
				y: canvasSrcCoords.y + canvasDiff.y
			};
		}
	}

// ---------- CURVE CLASS ---------- \\
 
	var Curve = function(start) {
		var points = [new Point(start)];

		this.addPoint = function(point) { 
			points.push(new Point(point));
		}

		function drawSmooth(context, points) {
			context.beginPath();

			context.strokeStyle = 'rgba(245, 221, 0, 0.6)';
			context.lineWidth = 5;

			//http://stackoverflow.com/questions/7054272/how-to-draw-smooth-curve-through-n-points-using-javascript-html5-canvas
			context.moveTo(points[0].x, points[0].y);
			var i = 1;
			for(var control = {x: 0, y: 0}; i < points.length - 2; i++) {
				control.x = (points[i].x + points[i + 1].x) / 2;
				control.y = (points[i].y + points[i + 1].y) / 2;
				context.quadraticCurveTo(points[i].x, points[i].y, control.x, control.y);
			}
			context.quadraticCurveTo(points[i].x, points[i].y, points[i+1].x, points[i+1].y);

			context.stroke();
		}

		this.draw = function(context) {
			if(points.length < 3) { return false; }

			context.save();
			drawSmooth(context, points.map(function(point) { return point.toCanvas(); }));
			context.restore();
		}
	}

// ---------- ARROW CLASS ---------- \\
var Arrow() = function(_start) {
	var start = canvasToTagpro(_start), end = start;
	var angle = 0;

	//if the arrow is horizontal and points to the center of a tile
	//the points of the head should be about the corners of that tile
	var headAngle = .4;  // ~22.5 degrees in radians
	var headLength = 45; // ~sqrt(40^2 + 20^2) 

	this.End = function(_end) {
		end = canvasToTagpro(_end);
		angle = Math.atan2(end.y - start.y, end.x - start.x);
	}

	//takes a context and canvas coordinates
	function drawLine(context, start, end) {
		context.beginPath();

		context.strokeStyle = 'rgba(200, 0, 250, 0.6)';
		context.lineWidth = 5;
		context.lineCap = 'round';		

		context.moveTo(start.x, start.y);
		context.lineTo(end.x, end.y);

		context.stroke();
	}

	function drawHead(context) {
		context.beginPath();

		var arrowPoint = end.toCanvas();
		
		//black magic, a.k.a. high school geometry
		//see repo for explanation
		var phiRight = Math.PI / 2 - angle - headAngle;
		var rightEnd = {
			x: arrowPoint.x - headLength * Math.cos(phiRight),
			y: arrowPoint.y - headLength * Math.sin(phiRight)
		};

		var phiLeft = headAngle - angle;
		var leftEnd = {
			x: arrowPoint.x - headLength * Math.cos(phiLeft) / tagpro.zoom,
			y: arrowPoint.y - headLength * Math.sin(phiLeft) / tagpro.zoom
		};

		drawLine(context, arrowPoint, rightEnd);
		drawLine(context, arrowPoint, leftEnd);
	}

	this.draw = function(context) {
		context.save();
		drawLine(context, start.toCanvas(), end.toCanvas());
		drawHead(context);
		context.restore();
	}
}

// ---------- HIGH LEVEL LOGIC ----------\\

	var tpUiDraw = tagpro.ui.draw;
	tagpro.ui.draw = function(context) {
		curves.forEach(function(element) {
			element.draw(context);
		});
		tpUiDraw(context);
	};

	$("canvas#viewPort").mousedown(function(click) {
		console.log("telestrator mousedown");
		drawing = true;
		curves.push(new Curve(click));
	});

	$("canvas#viewPort").mousemove(function(event) {
		if (!drawing) { return; }
		console.log("telestrator mousemove");
		curves[curves.length - 1].addPoint(event);
	});

	$("canvas#viewPort").mouseup(function(event) {
		console.log("telestrator mouseup");
		drawing = false;
	});

	$("canvas#viewPort").dblclick(function(event) {
		console.log("telestrator dblclick");
		curves = [];
	});

});