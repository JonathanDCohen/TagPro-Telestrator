// ==UserScript==
// @name            TagPro Telestrator
// @version         1.2.0
// @description     Use a telestrator while spectating TagPro!
// @include         http://tagpro-*.koalabeast.com:*
// @include         http://tangent.jukejuice.com:*
// @include         http://maptest.newcompte.fr:*
// @author          BBQchicken
// ==/UserScript==

tagpro.ready(function() {

// ---------- OPTIONS ---------- \\

	var kickClick = false;
	var traceLength = 300;

// ---------- HELPER METHODS ---------- \\

	function canvasMousePosition(click) {
		var boundBox = viewPort.getBoundingClientRect();
		return {
			x: click.pageX - 6 - boundBox.left,
			y: click.pageY - 9 - boundBox.top
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
	};

	function findPlayer(click) {
		var coords = canvasToTagpro(click);

		var found = false;
		for (var idx in tagpro.players) {
			var player = tagpro.players[idx];
			if ((coords.x >= player.x) && (coords.x <= player.x + 40 / tagpro.zoom)
			 && (coords.y >= player.y) && (coords.y <= player.y + 40 / tagpro.zoom)) 
			{
				found = idx;
				console.log("found player " + found);
				break;
			}
		}
		return found;
	}

// ---------- POINT CLASS ---------- \\

	//represents a point in the game's coordinates.
	//constructor takes a pair of canvas coordinates, i.e. from a click event.
	//if tpCoords is true, it instead takes a pair of tagpro coordinates
	var Point = function(click, tpCoords) {
		if (tpCoords) {
			var coords = click;
		} else {
			var coords = canvasToTagpro(click);
		}
	
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

		this.minus = function(other) {
			var out = new Point({});
			out.x = this.x - other.x;
			out.y = this.y - other.y;
			return out;
		}

		this.plus = function(other) {
			var out = new Point(this, true);
			out.x += other.x;
			out.y += other.y;
			return out;
		}

		this.distance = function(other) {
			var diff = this.minus(other);
			return Math.sqrt(diff.x * diff.x + diff.y * diff.y);
		}
	};

// ---------- CURVE CLASS ---------- \\
 
	var Curve = function(start, tpCoords) {
		var points = [new Point(start, tpCoords)];

		this.update = function(point, tpCoords) { 
			points.push(new Point(point, tpCoords));
		}

		function drawSmooth(context, points, endPoint) {
			if (endPoint) { points.push(endPoint); }

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

		this.draw = function(context, endPoint) {
			if(points.length < 3) { return false; }

			context.save();
			if (endPoint) {
				drawSmooth(context, points.map(function(point) { return point.toCanvas(); }), endPoint.toCanvas());
			} else {
				drawSmooth(context, points.map(function(point) { return point.toCanvas(); }));
			}
			context.restore();
		}

		this.trim = function() {
			points.splice(0, 1);
		}
	};

// ---------- TRACE CLASS --------- \\

	var Trace = function(playerId) {
		var current = (new Point(tagpro.players[playerId], true)).plus({x: 20, y: 20});
		var path = new Curve(current, true);

		var active = true;
		var pointCount = 1;

		function update() {
			path.update(current, true);
			current = (new Point(tagpro.players[playerId], true)).plus({x: 20, y: 20});
			if (pointCount < traceLength) {
				++pointCount;
			} else {
				path.trim();
			}
		}

		this.draw = function(context) {
			update();
			if (active) { path.draw(context, current) };
		}

		this.stop = function() {
			active = false;
		}
	}

// ---------- ARROW CLASS ---------- \\

	var Arrow = function(_start) {
		var headAngle = .4;  // ~22.5 degrees in radians
		var wingLength = 45; //length in TagPro pixels


		var start = new Point(_start), end = new Point(_start), rightWing = new Point(_start), leftWing = new Point(_start);
		var angle = 0;

		function rotateHead() {
			var phiRight = angle + headAngle;
			rightWing.x = end.x - wingLength * Math.cos(phiRight);
			rightWing.y = end.y - wingLength * Math.sin(phiRight);

			var phiLeft = angle - headAngle;
			leftWing.x = end.x - wingLength * Math.cos(phiLeft);
			leftWing.y = end.y - wingLength * Math.sin(phiLeft);
		}

		this.update = function(_end) {
			end = new Point(_end);
			angle = Math.atan2(end.y - start.y, end.x - start.x);
			rotateHead();
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

		this.draw = function(context) {
			context.save();
			drawLine(context, end.toCanvas(), start.toCanvas());
			drawLine(context, end.toCanvas(), rightWing.toCanvas());
			drawLine(context, end.toCanvas(), leftWing.toCanvas());
			context.restore();
		}
	};

// ---------- CIRCLE CLASS ---------- \\

	var Circle = function(_center) {
		var center = new Point(_center), radius = 0;

		this.update = function(event) {
			radius = center.distance(new Point(event));
		};

		function drawCircle(context) {
			context.beginPath();

			context.strokeStyle = 'rgba(245, 221, 0, 0.6)';
			context.lineWidth = 5;

			var canvasCenter = center.toCanvas();
			context.arc(canvasCenter.x, canvasCenter.y, radius / tagpro.zoom, 0, 2 * Math.PI);

			context.stroke();
		} 

		this.draw = function(context) {
			context.save();
			drawCircle(context);
			context.restore();
		}
	}

// ---------- HIGH LEVEL LOGIC ----------\\

	var traces = [], drawings = [];
	var drawing = false, shift = false, alt = false;

	var tpUiDraw = tagpro.ui.draw;
	tagpro.ui.draw = function(context) {
		traces.forEach(function(element) {
			element.draw(context);
		})
		
		drawings.forEach(function(element) {
			element.draw(context);
		});

		tpUiDraw(context);
	};

	$(document).on("keydown keyup", function (event) { 
		shift = event.shiftKey;
		alt   = event.altKey; 
	});

	tpkick = tagpro.kick.player;
	tagpro.kick.player = function(player) {
		var shift_alt = (alt && shift);

		if (kickClick || !tagpro.spectator && !shift_alt) { tpkick(player); } 
		
		if (!shift_alt) { return false; }
		traces.push(new Trace(player.id));
	}

	$("canvas#viewPort").mousedown(function(click) {
		if (tagpro.spectator !== "watching") { return false; }
		drawing = true;
		if (shift && alt) {
			//handled in the tagpro.kick.player method
			drawing = false;
		} else if (shift) {
			drawings.push(new Arrow(click));
		} else if(alt) {
			drawings.push(new Circle(click));
		} else {
			drawings.push(new Curve(click));
		}
	});

	$("canvas#viewPort").mousemove(function(event) {
		if (drawing) {
			drawings[drawings.length - 1].update(event);
		}
	});

	$("canvas#viewPort").mouseup(function(event) {
		drawing = false;
	});

	$("canvas#viewPort").dblclick(function(event) {
		//clear the selection on the donate button which sometimes keeps you from redrawing.
		window.getSelection().removeAllRanges();

		drawings = [];
		traces.forEach(function(element) {
			element.stop();
		})
		traces = [];
	});
});