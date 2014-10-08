// ==UserScript==
// @name            TagPro Telestrator
// @version         1.0.0
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
		var canvasCoords = canvasMousePosition(click);
		var srcCoords = {x: viewPort.width / 2 - 20 / tagpro.zoom, y: viewPort.height / 2 - 20 / tagpro.zoom};
		var diff = {x: canvasCoords.x - srcCoords.x, y: canvasCoords.y - srcCoords.y};
		return {
			x: tagpro.viewPort.source.x + diff.x * tagpro.zoom,
			y: tagpro.viewPort.source.y + diff.y * tagpro.zoom
		};
	}


// ---------- POINT CLASS ---------- \\

	//represents a point in the game's coordinates.
	//constructor takes a pair of canvas coordinates, i.e. from a click event.
	var Point = function(click) {
		var coords = canvasToTagpro(click);
		
		var pub = {x: coords.x, y: coords.y};
		//converts the game coordinates to coordinates on the canvas
		pub.toCanvas = function() {
			var tpSrcCoords = {x: tagpro.viewPort.source.x, y: tagpro.viewPort.source.y};
			var canvasSrcCoords = {x: viewPort.width / 2 - 20 / tagpro.zoom, y: viewPort.height / 2 - 20 / tagpro.zoom};
			var tpDiff = {x: this.x - tpSrcCoords.x, y: this.y - tpSrcCoords.y};
			var canvasDiff = {x: tpDiff.x / tagpro.zoom, y: tpDiff.y / tagpro.zoom};
			return {
				x: canvasSrcCoords.x + canvasDiff.x,
				y: canvasSrcCoords.y + canvasDiff.y
			};
		}

		return pub;
	}

// ---------- CURVE CLASS ---------- \\
 
	var Curve = function(start) {
		var points = [new Point(start)];

		this.addPoint = function(point) { 
			points.push(new Point(point));
		}

		this.draw = function(context) {
			if(points.length < 3) { return false; }

			var canvasPoints = points.map(function(point) {
				return point.toCanvas();
			})

			context.save();

			context.beginPath();

			context.strokeStyle = 'rgba(245, 221, 0, 0.6)';
			context.lineWidth = 5;

			//http://stackoverflow.com/questions/7054272/how-to-draw-smooth-curve-through-n-points-using-javascript-html5-canvas
			context.moveTo(canvasPoints[0].x, canvasPoints[0].y);
			var i = 1;
			for(var control = {x: 0, y: 0}; i < canvasPoints.length - 2; i++) {
				control.x = (canvasPoints[i].x + canvasPoints[i + 1].x) / 2;
				control.y = (canvasPoints[i].y + canvasPoints[i + 1].y) / 2;
				context.quadraticCurveTo(canvasPoints[i].x, canvasPoints[i].y, control.x, control.y);
			}
			context.quadraticCurveTo(canvasPoints[i].x, canvasPoints[i].y, canvasPoints[i+1].x, canvasPoints[i+1].y);

			context.stroke();

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