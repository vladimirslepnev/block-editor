function GeometryPacker(rgbArray, width, height) {
	this.texturePacker = new TexturePacker(rgbArray, width, height);
	this.textureWidth = width;
	this.textureHeight = height;
	this.quads = [];
}

GeometryPacker.prototype.add = function(modelDataValue, colorMapValue) {
	var directions = [
		[[0, 1, 0], [0, 0, 1], [1, 0, 0], [0, 0, 0]],
		[[0, 0, 1], [0, 1, 0], [-1, 0, 0], [15, 0, 0]],
		[[0, 0, 1], [1, 0, 0], [0, 1, 0], [0, 0, 0]],
		[[1, 0, 0], [0, 0, 1], [0, -1, 0], [0, 15, 0]],
		[[1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, 0]],
		[[0, 1, 0], [1, 0, 0], [0, 0, -1], [0, 0, 15]]
	];
	var getVector = function(direction, x, y, z) {
		var dir = directions[direction];
		return [
			dir[0][0] * x + dir[1][0] * y + dir[2][0] * z + dir[3][0],
			dir[0][1] * x + dir[1][1] * y + dir[2][1] * z + dir[3][1],
			dir[0][2] * x + dir[1][2] * y + dir[2][2] * z + dir[3][2]
		];
	}
	var getIndex = function(direction, x, y, z) {
		var v = getVector(direction, x, y, z);
		return v[0] * N * N + v[1] * N + v[2];
	}
	var getCube = function(direction, x, y, z) {
		return modelDataValue.cubes[getIndex(direction, x, y, z)];
	}
	var quads = [];
	for (var direction = 0; direction < 6; direction++) {
		var dir = directions[direction];
		var delta = [
			0.5 * (dir[0][0] + dir[1][0] + dir[2][0] - 1),
			0.5 * (dir[0][1] + dir[1][1] + dir[2][1] - 1),
			0.5 * (dir[0][2] + dir[1][2] + dir[2][2] - 1)
		];
		var getCorrectedVector = function(x, y, z) {
			var v = getVector(direction, x, y, z);
			return [v[0] - delta[0], v[1] - delta[1], v[2] - delta[2]];
		}
		for (var z = 0; z < N; z++) {
			var layer = [];
			for (var y = 0; y < N; y++) {
				for (var x = 0; x < N; x++) {
					layer.push(
						getCube(direction, x, y, z) &&
						((z == 0) || !getCube(direction, x, y, z - 1)));
				}
			}
			for (var y1 = 0; y1 < N; y1++) {
				for (var x1 = 0; x1 < N; x1++) {
					if (!layer[y1 * N + x1]) {
						continue;
					}
					var x2;
					for (x2 = x1 + 1; x2 < N; x2++) {
						if (!layer[y1 * N + x2]) {
							break;
						}
					}
					var y2;
					for (y2 = y1 + 1; y2 < N; y2++) {
						var x3;
						for (x3 = x1; x3 < x2; x3++) {
							if (!layer[y2 * N + x3]) {
								break;
							}
						}
						if (x3 != x2) {
							break;
						}
					}
					var colors = [];
					for (var y3 = y1; y3 < y2; y3++) {
						for (var x3 = x1; x3 < x2; x3++) {
							layer[y3 * N + x3] = false;
							colors.push(colorMapValue.colors[
								modelDataValue.colors[
									6 * getIndex(direction, x3, y3, z) + direction
								]
							]);
						}
					}
					this.texturePacker.add(colors, x2 - x1, y2 - y1);
					quads.push([
						getCorrectedVector(x1, y1, z),
						getCorrectedVector(x2, y1, z),
						getCorrectedVector(x2, y2, z),
						getCorrectedVector(x1, y2, z)
					]);
				}
			}
		}
	}
	this.quads.push(quads);
}

GeometryPacker.prototype.pack = function() {
	var uvs = this.texturePacker.pack();
	var quadOffset = 0;
	var maxU = 0;
	var maxV = 0;
	var nVertices = 0;
	var nTriangles = 0;
	var geometries = [];
	for (var k = 0; k < this.quads.length; k++) {
		var geom = new THREE.Geometry();
		var quads = this.quads[k];
		var vertexIndices = {};
		for (var i = 0; i < quads.length; i++) {
			var quad = quads[i];
			var vi = [];
			for (var j = 0; j < 4; j++) {
				var x = quad[j][0];
				var y = quad[j][1];
				var z = quad[j][2];
				var vertexKey = x * 10000 + y * 100 + z;
				if (vertexIndices[vertexKey] == undefined) {
					vertexIndices[vertexKey] = geom.vertices.length;
					geom.vertices.push(new THREE.Vector3(x / N - 0.5, y / N - 0.5, z / N - 0.5));
				}
				vi.push(vertexIndices[vertexKey]);
			}
			geom.faces.push(new THREE.Face3(vi[0], vi[2], vi[1]));
			geom.faces.push(new THREE.Face3(vi[3], vi[2], vi[0]));
			var uv = uvs[i + quadOffset];
			maxU = Math.max(maxU, uv[2]);
			maxV = Math.max(maxV, uv[3]);
			var u1 = uv[0] / this.textureWidth;
			var v1 = 1 - uv[1] / this.textureHeight;
			var u2 = uv[2] / this.textureWidth;
			var v2 = 1 - uv[3] / this.textureHeight;
			var u1v1 = new THREE.Vector2(u1, v1);
			var u1v2 = new THREE.Vector2(u1, v2);
			var u2v1 = new THREE.Vector2(u2, v1);
			var u2v2 = new THREE.Vector2(u2, v2);
			geom.faceVertexUvs[0].push([u1v1, u2v2, u2v1]);
			geom.faceVertexUvs[0].push([u1v2, u2v2, u1v1]);
		}
		quadOffset += quads.length;
		geom.computeFaceNormals();
		geometries.push(geom);
		nVertices += geom.vertices.length;
		nTriangles += quads.length * 2;
	}
	console.log(
		"GeometryPacker: " +
		nVertices + " vertices, " +
		nTriangles + " triangles, " +
		maxU + "x" + maxV + " texture"
	);
	return geometries;
}