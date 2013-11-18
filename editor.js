var N = 16;

// General

var tileStorage = {};
var undoStack = {};

// Base state

var selectedTool = {};
var cameraPosition = {};
var hoverPosition = {};
var modelData = {};
var colorMap = {};

// Derived state

var colorMapDisplay = {}; // depends on colorMap
var modelMesh = {};       // depends on modelData, colorMap
var hoveredFace = {};     // depends on hoverPosition, modelMesh, cameraPosition
var toolMesh = {};        // depends on selectedTool, hoveredFace
var renderedView = {};    // depends on cameraPosition, modelMesh, toolMesh

// Change handlers, derived from above dependencies

selectedTool.onChange = function () {
	toolMesh.update();
	renderedView.update();
}

cameraPosition.onChange = function() {
	hoveredFace.update();
	toolMesh.update();
	renderedView.update();
}

hoverPosition.onChange = function() {
	hoveredFace.update();
	toolMesh.update();
	renderedView.update();
}

modelData.onChange = function() {
	modelMesh.update();
	hoveredFace.update();
	toolMesh.update();
	renderedView.update();
}

colorMap.onChange = function() {
	colorMapDisplay.update();
	modelMesh.update();
	hoveredFace.update();
	toolMesh.update();
	renderedView.update();
}

function start() {
	tileStorage.initialize();
	undoStack.initialize();

	selectedTool.initialize();
	cameraPosition.initialize();
	hoverPosition.initialize();
	modelData.initialize();
	colorMap.initialize();

	colorMapDisplay.initialize();
	modelMesh.initialize();
	hoveredFace.initialize();
	toolMesh.initialize();
	renderedView.initialize();

	colorMapDisplay.update();
	modelMesh.update();
	hoveredFace.update();
	toolMesh.update();
	renderedView.update();
}

selectedTool.initialize = function() {
	this.value = "remove";
	var selectTool = function(newValue) {
		selectedTool.value = newValue;
		selectedTool.onChange();
	}
	document.getElementById("toolRemove").addEventListener("click", function(event) {
		selectTool("remove");
	});
	document.getElementById("toolAdd").addEventListener("click", function(event) {
		selectTool("add");
	});
	document.getElementById("toolColor").addEventListener("click", function(event) {
		selectTool("color");
	});
	document.body.addEventListener("keypress", function(event) {
		if (event.keyCode == 114) {
			document.getElementById("toolRemove").click();
		} else if (event.keyCode == 97) {
			document.getElementById("toolAdd").click();
		} else if (event.keyCode == 99) {
			document.getElementById("toolColor").click();
		} else if (event.keyCode == 119) {
			modelMesh.material.wireframe = !modelMesh.material.wireframe;
			modelData.onChange();
		}
	});
}

cameraPosition.initialize = function() {
	var isDragging = false;
	var lastX, lastY;
	var horizontalAngle = 0.4, verticalAngle = 0.3, distance = 4;
	document.getElementById("editWindow").addEventListener("mousedown", function(event) {
		lastX = event.clientX;
		lastY = event.clientY;
		isDragging = true;
	});
	document.getElementById("editWindow").addEventListener("mousemove", function(event) {
		if (!isDragging) {
			return;
		}
		horizontalAngle -= (event.clientX - lastX)/100;
		verticalAngle = Math.max(-1.57, Math.min(1.57,
			verticalAngle + (event.clientY - lastY) / 100)
		);
		lastX = event.clientX;
		lastY = event.clientY;
		recalculate();
		cameraPosition.onChange();
	});
	document.getElementById("editWindow").addEventListener("mouseup", function(event) {
		isDragging = false;
	});
	document.getElementById("editWindow").addEventListener("mousewheel", function(event) {
		distance = Math.max(2, Math.min(40, distance * Math.pow(2, -event.wheelDelta / 200)));
		recalculate();
		cameraPosition.onChange();
		return false;
	});
	var recalculate = function() {
		cameraPosition.value.position.y = -distance * Math.cos(horizontalAngle) * Math.cos(verticalAngle);
		cameraPosition.value.position.x = distance * Math.sin(horizontalAngle) * Math.cos(verticalAngle);
		cameraPosition.value.position.z = distance * Math.sin(verticalAngle);
		cameraPosition.value.up = new THREE.Vector3(0, 0, 1);
		cameraPosition.value.lookAt(new THREE.Vector3(0, 0, 0));
	}
	this.value = new THREE.PerspectiveCamera(
		30, window.innerWidth / window.innerHeight, 1, 1000
	);
	recalculate();	
}

hoverPosition.initialize = function() {
	var isMouseDown = false;
	document.getElementById("editWindow").addEventListener("mousedown", function(event) {
		isMouseDown = true;
	});
	document.getElementById("editWindow").addEventListener("mouseup", function(event) {
		isMouseDown = false;
	});
	document.getElementById("editWindow").addEventListener("mousemove", function(event) {
		if (!isMouseDown) {
			hoverPosition.value = [ event.clientX, event.clientY ];
		} else {
			hoverPosition.value = false;
		}
		hoverPosition.onChange();
	});
	document.getElementById("editWindow").addEventListener("mouseout", function(event) {
		hoverPosition.value = false;
		hoverPosition.onChange();
	});
	this.value = [ 0, 0 ];
}

modelData.setDefaultValue = function() {
	this.value = { cubes: [], colors: [] };
	for (var i = 0; i < N * N * N; i++) {
		this.value.cubes.push(true);
	}
	for (var i = 0; i < 6 * N * N * N; i++) {
		this.value.colors.push(0);
	}	
}

modelData.initialize = function() {
	if (tileStorage.initialModelDataValue) {
		this.value = tileStorage.initialModelDataValue;
	} else {
		this.setDefaultValue();
	}

	var lastX = -1;
	var lastY = -1;
	var lastZ = -1;
	document.getElementById("editWindow").addEventListener("click", function(event) {
		if (hoveredFace.value) {
			var x = hoveredFace.value[0];
			var y = hoveredFace.value[1];
			var z = hoveredFace.value[2];
			var dx = hoveredFace.value[3];
			var dy = hoveredFace.value[4];
			var dz = hoveredFace.value[5];
			var reverseDirections = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
			var checkedIndex = function(x, y, z) {
				if (x >= 0 && x < N && y >= 0 && y < N && z >= 0 && z < N) {
					return x * N * N + y * N + z;
				} else {
					return -1;
				}
			}
			var applyTool;
			if (selectedTool.value == "remove") {
				applyTool = function(x, y, z) {
					var i = checkedIndex(x, y, z);
					if (i != -1) {
						modelData.value.cubes[i] = false;
						for (var j = 0; j < 6; j++) {
							var tx = x + reverseDirections[j][0];
							var ty = y + reverseDirections[j][1];
							var tz = z + reverseDirections[j][2];
							var ti = checkedIndex(tx, ty, tz);
							if (ti != -1) {
								modelData.value.colors[6 * ti + j] = colorMap.value.selectedIndex;
							}
						}
					}
				}								
			} else if (selectedTool.value == "add") {
				x += dx;
				y += dy;
				z += dz;
				applyTool = function(x, y, z) {
					var i = checkedIndex(x, y, z);
					if (i != -1) {
						modelData.value.cubes[i] = true;
						for (var j = 0; j < 6; j++) {
							modelData.value.colors[6 * i + j] = colorMap.value.selectedIndex;
						}
					}
				}												
			} else if (selectedTool.value == "color") {
				var i = checkedIndex(x, y, z);
				if (i != -1) {
					var colorBias = (dx == -1) ? 0 :
									(dx == 1) ? 1 :
									(dy == -1) ? 2 :
									(dy == 1) ? 3 :
									(dz == -1) ? 4 :
									5;
					applyTool = function(x, y, z) {
						var i = checkedIndex(x, y, z);
						if (i != -1) {
							modelData.value.colors[6 * i + colorBias] = colorMap.value.selectedIndex;
						}
					}
				}
			}
			if (event.shiftKey && (lastX != -1)) {
				for (var tx = Math.min(x, lastX); tx <= Math.max(x, lastX); tx++){
					for (var ty = Math.min(y, lastY); ty <= Math.max(y, lastY); ty++){
						for (var tz = Math.min(z, lastZ); tz <= Math.max(z, lastZ); tz++){
							applyTool(tx, ty, tz);
						}
					}
				}
			} else {
				applyTool(x, y, z);
			}
			lastX = x;
			lastY = y;
			lastZ = z;
			modelData.onChange();
		}
	});	
}

colorMap.setDefaultValue = function() {
	var colors = [ 0xb0b0b0 ];
	for (var i = 0; i < 9; i++) {
		colors.push(0xffffff);
	}
	this.value = { colors: colors, selectedIndex: 0 };	
}

colorMap.initialize = function() {
	if (tileStorage.initialColorMapValue) {
		this.value = tileStorage.initialColorMapValue;
	} else {
		this.setDefaultValue();
	}
}

colorMapDisplay.initialize = function() {
	var selectIndex = function(i) {
		colorMap.value.selectedIndex = i;
		colorMap.onChange();
	}

	document.body.addEventListener("keypress", function(event) {
		var code = event.keyCode;
		if (code >= 49 && code <= 57) {
			selectIndex(code - 49);
		} else if (code == 48) {
			selectIndex(9);
		}
	});	
}

colorMapDisplay.update = function() {
	var toHTMLColor = function(color) {
		var s = color.toString(16);
		while(s.length < 6) {
			s = "0" + s;
		}
	    return "#" + s;
	}

	var div = document.getElementById("colors");
	div.innerHTML = "";
	for (var i = 0; i < colorMap.value.colors.length; i++) {
		var colorDiv = document.createElement("div");
		colorDiv.className = "color";
		if (i == colorMap.value.selectedIndex) {
			colorDiv.className += " selected";
		}
		colorDiv.onclick = (function(i) {
			return function() {
				if (colorMap.value.selectedIndex == i) {
					var colorInput = document.getElementById("colorInput");
					colorInput.value = toHTMLColor(colorMap.value.colors[i]);
					colorInput.onchange = function() {
						colorMap.value.colors[i] = parseInt(colorInput.value.substring(1), 16);
						colorMap.onChange();
					}
					colorInput.click();
				} else {
					colorMap.value.selectedIndex = i;
					colorMap.onChange();
				}
			}
		})(i);
		colorDiv.style.backgroundColor = toHTMLColor(colorMap.value.colors[i]);
		div.appendChild(colorDiv);
	}
}

modelMesh.initialize = function() {
	this.textureWidth = N * 16;
	this.textureHeight = N;
	this.textureData = new Uint8Array(this.textureWidth * this.textureHeight * 3);
	this.texture = new THREE.DataTexture(
		this.textureData,
		this.textureWidth,
		this.textureHeight,
		THREE.RGBFormat
	);
	this.texture.magFilter = THREE.NearestFilter;
	this.texture.minFilter = THREE.NearestFilter;
	this.material = new THREE.MeshLambertMaterial({ map: this.texture });
}

modelMesh.update = function() {
	var packer = new GeometryPacker(this.textureData, this.textureWidth, this.textureHeight);
	packer.add(modelData.value, colorMap.value);
	var geometry = packer.pack()[0];
	this.texture.needsUpdate = true;
	this.value = new THREE.Mesh(geometry, this.material);
}

hoveredFace.initialize = function() {
	this.projector = new THREE.Projector();	
}

hoveredFace.update = function() {
	this.value = false;
	if (!hoverPosition.value) {
		return;
	}
	var vector = new THREE.Vector3(
		(hoverPosition.value[0] / window.innerWidth) * 2 - 1,
		-(hoverPosition.value[1] / window.innerHeight) * 2 + 1,
		0.5
	);
	var camera = cameraPosition.value;
	this.projector.unprojectVector(vector, camera);
	var raycaster = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());
    var intersections = raycaster.intersectObject(modelMesh.value);
	if (intersections.length == 0) {
		return;
	}
	var residue = function(t) {
		var d = (t + 0.5) % (1 / N);
		return Math.min(d, 1 / N - d);
	}
	var toIndex = function(t) {
		return Math.max(0, Math.min(N - 1, Math.floor((t + 0.5) * N)));
	}
	var toEdge = function(t) {
		return Math.max(0, Math.min(N, Math.round((t + 0.5) * N)));			
	}
	var hasCube = function(x, y, z) {
		return modelData.value.cubes[x * N * N + y * N + z];
	}
	var point = intersections[0].point;
	var rx = residue(point.x);
	var ry = residue(point.y);
	var rz = residue(point.z);
	if (rx < ry && rx < rz) {
		var ix = toEdge(point.x);
		var iy = toIndex(point.y);
		var iz = toIndex(point.z);
		if (ix == 0 || !hasCube(ix - 1, iy, iz)) {
			this.value = [ix, iy, iz, -1, 0, 0];
		} else {
			this.value = [ix - 1, iy, iz, 1, 0, 0];
		}
	}
	if (ry < rx && ry < rz) {
		var ix = toIndex(point.x);
		var iy = toEdge(point.y);
		var iz = toIndex(point.z);
		if (iy == 0 || !hasCube(ix, iy - 1, iz)) {
			this.value = [ix, iy, iz, 0, -1, 0];
		} else {
			this.value = [ix, iy - 1, iz, 0, 1, 0];
		}
	}
	if (rz < rx && rz < ry) {
		var ix = toIndex(point.x);
		var iy = toIndex(point.y);
		var iz = toEdge(point.z);
		if (iz == 0 || !hasCube(ix, iy, iz - 1)) {
			this.value = [ix, iy, iz, 0, 0, -1];
		} else {
			this.value = [ix, iy, iz - 1, 0, 0, 1];
		}
	}
}

toolMesh.initialize = function() {
	this.material = new THREE.MeshBasicMaterial();	
}

toolMesh.update = function() {
	if (!hoveredFace.value) {
		this.value = false;
		return;
	}
	var size = 1 / (N - 1);
	var geom;
	var x = hoveredFace.value[0];
	var y = hoveredFace.value[1];
	var z = hoveredFace.value[2];
	var dx = hoveredFace.value[3];
	var dy = hoveredFace.value[4];
	var dz = hoveredFace.value[5];
	if (selectedTool.value == "color") {
		var thickness = 1 / (N * N);
		geom = new THREE.CubeGeometry(
			dx == 0 ? size : thickness,
			dy == 0 ? size : thickness,
			dz == 0 ? size : thickness
		);
	} else {
		geom = new THREE.CubeGeometry(size, size, size);
	}
	var coef = (selectedTool.value == "add") ? 1 : (selectedTool.value == "color") ? 0.5 : 0;
	var toWorld = function(n) {
		return ((n + 0.5) / N) - 0.5;
	}
	geom.applyMatrix(new THREE.Matrix4().makeTranslation(
		toWorld(x + coef * dx),
		toWorld(y + coef * dy),
		toWorld(z + coef * dz)
	));
	this.material.color = new THREE.Color(colorMap.value.colors[colorMap.value.selectedIndex]);;
	this.value = new THREE.Mesh(geom, this.material);
}

renderedView.initialize = function() {
	this.scene = new THREE.Scene();
	this.scene.add(cameraPosition.value);
	var renderer = new THREE.WebGLRenderer({ antialias: false });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setClearColor(0xffffff, 1);
	document.getElementById("editWindow").appendChild(renderer.domElement);
	this.scene.add(new THREE.AmbientLight(0xc0c0c0));
	var directionalLight = new THREE.DirectionalLight(0x404040);
	this.scene.add(directionalLight);
	this.modelMesh = false;
	this.toolMesh = false;
	
	var renderModel = new THREE.RenderPass(this.scene, cameraPosition.value);
	var fxaa = new THREE.ShaderPass(THREE.FXAAShader);
	fxaa.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
	fxaa.renderToScreen = true;
	var composer = new THREE.EffectComposer(renderer);
	composer.addPass(renderModel);
	composer.addPass(fxaa);
	
	var animate = function() {
		cameraPosition.value.updateMatrixWorld();
		directionalLight.position = (new THREE.Vector3(1, 1, -cameraPosition.value.position.length() + 0.5))
		    .applyMatrix4(cameraPosition.value.matrixWorld).normalize();

		requestAnimationFrame(animate);
		//renderer.render(renderedView.scene, cameraPosition.value);
		composer.render();
	}
	requestAnimationFrame(animate);
}

renderedView.update = function() {
	if (this.modelMesh != modelMesh.value) {
		if (this.modelMesh) {
			this.scene.remove(this.modelMesh);
			this.modelMesh.geometry.dispose();
		}
		this.modelMesh = modelMesh.value;
		if (this.modelMesh) {
			this.scene.add(this.modelMesh);
		}
	}

	if (this.toolMesh != toolMesh.value) {
		if (this.toolMesh) {
			this.scene.remove(this.toolMesh);
			this.toolMesh.geometry.dispose();
		}
		this.toolMesh = toolMesh.value;
		if (this.toolMesh) {
			this.scene.add(this.toolMesh);
		}
	}
}

tileStorage.initialize = function() {
	var currentTileName = false;
	var getTileNames = function() {
		var tileNames = [];
		if (localStorage["tileNames"]) {
			tileNames = JSON.parse(localStorage["tileNames"]);
		}
		return tileNames;
	}
	var loadTile = function(tileName) {
		currentTileName = tileName;
		var tileState = JSON.parse(localStorage["tile:" + tileName]);
		if (!tileState) {
			return;
		}
		modelData.value = tileState.modelDataValue;
		colorMap.value = tileState.colorMapValue;
		colorMap.onChange();
		updateDom();
	}
	var saveTile = function() {
		var tileName = prompt("Enter name:", currentTileName ? currentTileName : "");
		if (!tileName || tileName.length == 0) {
			return;
		}
		localStorage["tile:" + tileName] = JSON.stringify({
			modelDataValue: modelData.value,
			colorMapValue: colorMap.value
		});
		var tileNames = getTileNames();
		if (tileNames.indexOf(tileName) == -1) {
			tileNames.push(tileName);
			localStorage["tileNames"] = JSON.stringify(tileNames);
		}
		currentTileName = tileName;
		updateDom();
	}
	var renameTile = function() {
		var tileName = prompt("Enter name:", currentTileName ? currentTileName : "");
		if (!tileName || tileName.length == 0 || tileName == currentTileName) {
			return;
		}
		var tileNames = getTileNames();
		if (tileNames.indexOf(tileName) != -1) {
			alert("This name already exists!");
			return;
		}
		while (tileNames.indexOf(currentTileName) !== -1) {
		  tileNames[tileNames.indexOf(currentTileName)] = tileName;
		}
		localStorage["tileNames"] = JSON.stringify(tileNames);
		delete localStorage["tile:" + currentTileName];
		localStorage["tile:" + tileName] = JSON.stringify({
			modelDataValue: modelData.value,
			colorMapValue: colorMap.value
		});
		currentTileName = tileName;
		updateDom();
	}
	var deleteTile = function() {
		if (!confirm("Are you sure?")) {
			return;
		}
		delete localStorage["tile:" + currentTileName];
		var tileNames = getTileNames();
		while (tileNames.indexOf(currentTileName) !== -1) {
		  tileNames.splice(tileNames.indexOf(currentTileName), 1);
		}
		localStorage["tileNames"] = JSON.stringify(tileNames);
		currentTileName = false;
		modelData.setDefaultValue();
		colorMap.setDefaultValue();
		colorMap.onChange();
		updateDom();
	}
	var newTile = function() {
		currentTileName = false;
		modelData.setDefaultValue();
		colorMap.setDefaultValue();
		colorMap.onChange();
		updateDom();
	}
	document.getElementById("actionNew").onclick = newTile;
	document.getElementById("actionSave").onclick = saveTile;
	document.getElementById("actionRename").onclick = renameTile;
	document.getElementById("actionDelete").onclick = deleteTile;
	var updateDom = function() {
		var tileNames = [];
		if (localStorage["tileNames"]) {
			tileNames = JSON.parse(localStorage["tileNames"]);
		}
		var div = document.getElementById("tileLinks");
		div.innerHTML = "";
		for (var i = 0; i < tileNames.length; i++) {
			if (tileNames[i] == currentTileName) {
				var tileNameDiv = document.createElement("div");
				tileNameDiv.innerHTML = tileNames[i];
				tileNameDiv.className = "selected";
				div.appendChild(tileNameDiv);
			} else {
				var a = document.createElement("a");
				a.href = "#";
				a.innerHTML = tileNames[i];
				a.onclick = (function(tileName) {
					return function() {
						loadTile(tileName);
						return false;
					}
				})(tileNames[i]);
				div.appendChild(a);
			}
		}
		if (!currentTileName) {
			var tileNameDiv = document.createElement("div");
			tileNameDiv.innerHTML = "(unnamed)";
			tileNameDiv.className = "selected";
			div.appendChild(tileNameDiv);
		}
		document.getElementById("actionRename").disabled = !currentTileName;
		document.getElementById("actionDelete").disabled = !currentTileName;
		window.location.hash = currentTileName ? ("#" + currentTileName) : "";
	}
	if (window.location.hash.length > 1) {
		currentTileName = window.location.hash.substring(1);
		var tileState = JSON.parse(localStorage["tile:" + currentTileName]);
		if (!tileState) {
			return;
		}
		this.initialModelDataValue = tileState.modelDataValue;
		this.initialColorMapValue = tileState.colorMapValue;
	}
	updateDom();
}

undoStack.initialize = function() {
	// TODO
}