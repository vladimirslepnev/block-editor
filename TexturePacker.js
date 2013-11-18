function TexturePacker(rgbArray, width, height) {
	this.topNode = {
		x: 0,
		y: 0,
		width: width,
		height: height,
		children: false
	};
	this.rgbArray = rgbArray;
	this.textures = [];
}

TexturePacker.prototype.add = function(colors, width, height) {
	var isSingleColor = true;
	for (var i = 1; i < width * height; i++) {
		if (colors[i] != colors[0]) {
			isSingleColor = false;
			break;
		}
	}
	if (isSingleColor) {
		this.textures.push({
			colors: [colors[0]],
			width: 1,
			height: 1,
			index: this.textures.length
		});
	} else {
		this.textures.push({
			colors: colors,
			width: width,
			height: height,
			index: this.textures.length
		});
	}
}

TexturePacker.prototype.pack = function() {
	this.textures.sort(function(t1, t2) {
		return Math.max(t2.width, t2.height) - Math.max(t1.width, t1.height);
	});
	var uvs = [];
	var singleColorUvs = {};
	for (var i = 0; i < this.textures.length; i++) {
		var texture = this.textures[i];
		if ((texture.width == 1) && (texture.height == 1)) {
			var color = texture.colors[0];
			if (!singleColorUvs[color]) {
				singleColorUvs[color] = this.place(this.topNode, texture);
			}
			uvs[texture.index] = singleColorUvs[color];
		} else {
			uvs[texture.index] = this.place(this.topNode, texture);
		}
	}
	return uvs;
}

TexturePacker.prototype.place = function(node, texture) {
	if ((node.width < texture.width) || (node.height < texture.height)) {
		return false;
	}
	if (!node.children) {
		for (var y = 0; y < texture.height; y++) {
			for (var x = 0; x < texture.width; x++) {
				var color = texture.colors[y * texture.width + x];
				var index = 3 * (this.topNode.width * (y + node.y) + x + node.x);
				this.rgbArray[index] = (0xff0000 & color) >> 16;
				this.rgbArray[index + 1] = (0xff00 & color) >> 8;
				this.rgbArray[index + 2] = (0xff & color);
			}
		}
		node.children = [];
		if (node.height > texture.height) {
			node.children.push({
				x: node.x,
				y: node.y + texture.height,
				width: texture.width,
				height: node.height - texture.height,
				children: false
			});
		}
		if (node.width > texture.width) {
			node.children.push({
				x: node.x + texture.width,
				y: node.y,
				width: node.width - texture.width,
				height: node.height,
				children: false
			})
		}
		return [node.x, node.y, node.x + texture.width, node.y + texture.height];
	} else {
		for (var i = 0; i < node.children.length; i++) {
			var placement = this.place(node.children[i], texture);
			if (placement) {
				return placement;
			}
		}
		return false;
	}
}