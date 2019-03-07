var attributes = [
	['role',        ['', '__random__', 'application']],
	['class',       ['', '__random__']],
	['hidden',      ['', '__random__']],
	['aria-hidden', ['', '__random__', 'true', 'false']],
	['aria-label',  ['', '__random__']],
];

var tags = ['a', 'div', 'button', 'form', 'label'];

var randomInt = function(n) {
	return Math.floor(Math.random() * n);
}

var randomChoice = function(list) {
	return list[randomInt(list.length)];
};

var randomString = function(len) {
	var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -_.,#';
	var result = '';
	for (var i = 0; i < len; i++) {
		result += randomChoice(chars);
	}
	return result;
};

function AttributeList(len) {
	this.value = [];
	for (var i = 0; i < len; i++) {
		var attr = randomChoice(attributes);
		var value = randomChoice(attr[1]);
		if (value === '__random__') {
			// shortcut: always use fixed string length
			value = randomString(10);
		}
		this.value.push(attr[0] + '="' + value + '"');
	}
}

AttributeList.prototype.shrink = function() {
	var result = [];
	for (var i = 0; i < this.value.length; i++) {
		var item = new AttributeList(0);
		for (var j = 0; j < this.value.length; j++) {
			if (j !== i) {
				item.value.push(this.value[j]);
			}
		}
		result.push(item);
	}
	return result;
};

function Element(len) {
	this.tag = randomChoice(tags);
	if (this.tag) {
		this.attrs = new AttributeList(randomInt(len));
		this.children = new Children(randomInt(len));
		this.content = '';
	} else {
		this.attrs = new AttributeList(0);
		this.children = new Children(0);
		this.content = randomString(len);
	}
}

Element.prototype.shrink = function() {
	// shortcut: shrink attrs and children at the same time
	var result = [];
	var tag = this.tag;
	var attrsList = this.attrs.shrink();
	var childrenList = this.children.shrink();
	attrsList.forEach(function(attrs) {
		childrenList.forEach(function(children) {
			var item = new Element(0);
			item.tag = tag;
			item.attrs = attrs;
			item.children = children;
			result.push(item);
		});
	});
	return result;
};

Element.prototype.toString = function() {
	var s = '<' + this.tag;
	this.attrs.value.forEach(function(attr) {
		s += ' ' + attr;
	});
	s += '>' + this.content;
	this.children.value.forEach(function(child) {
		s += child.toString();
	});
	s += '</' + this.tag + '>';
	return s;
};

function Children(len) {
	this.value = [];
	for (var i = 0; i < len; i++) {
		this.value.push(new Element(randomInt(len)));
	}
}

Children.prototype.shrink = function() {
	var result = [];
	for (var i = 0; i < this.value.length; i++) {
		var item = new Children(0);
		for (var j = 0; j < this.value.length; j++) {
			if (j !== i) {
				// shortcut: pick random shrink result
				var shrunken = this.value[j].shrink();
				if (shrunken.length) {
					item.value.push(randomChoice(shrunken));
				}
			}
		}
		result.push(item);
	}
	return result;
};

var test = function(input, oracle) {
	var result = oracle(input);
	if (!result) {
		return null;
	}
	var shrunken = input.shrink();
	for (var i = 0; i < shrunken.length; i++) {
		var x = test(shrunken[i], oracle);
		if (x) {
			return x;
		}
	}
	return [input, result];
}
