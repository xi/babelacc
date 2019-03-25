var attributes = [
	['role',        ['', '__random__', 'application']],
	['class',       ['', '__random__']],
	['hidden',      ['', '__random__']],
	['aria-hidden', ['', '__random__', 'true', 'false']],
	['aria-label',  ['', '__random__']],
	['aria-labelledby',  ['__randint__']],
	['type',        ['', '__random__', 'hidden', 'checkbox', 'text', 'password', 'color']],
];

var tags = ['a', 'div', 'button', 'form', 'label', 'input'];

var randomInt = function(n) {
	return Math.floor(Math.random() * n);
};

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
		} else if (value === '__randint__') {
			value = randomInt(len);
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

function Element(len, ctx) {
	this.tag = randomChoice(tags);
	this.id = ctx.k;
	this.content = ctx.k;
	ctx.k += 1;
	this.attrs = new AttributeList(randomInt(len));
	this.children = new Children(randomInt(len), ctx);
}

Element.prototype.shrink = function() {
	var result = [];
	var tag = this.tag;
	var id = this.id;
	var attrsList = [this.attrs].concat(this.attrs.shrink());
	var childrenList = [this.children].concat(this.children.shrink());
	attrsList.forEach(function(attrs) {
		childrenList.forEach(function(children) {
			if (attrs !== this.attrs || children !== this.children) {
				var item = new Element(0, {});
				item.tag = tag;
				item.id = id;
				item.content = content;
				item.attrs = attrs;
				item.children = children;
				result.push(item);
			}
		});
	});
	return result;
};

Element.prototype.mutations = function() {
	return this.shrink();
};

Element.prototype.toString = function() {
	var s = '<' + this.tag + ' id="' + this.id + '"';
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

function Children(len, ctx) {
	this.value = [];
	for (var i = 0; i < len; i++) {
		this.value.push(new Element(randomInt(len), ctx));
	}
}

Children.prototype.shrink = function() {
	var result = [];
	for (var i = 0; i < this.value.length; i++) {
		var item = new Children(0, {});
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

var runWithCoverage = function(item, oracle) {
	var result = oracle(item);

	var path = 'node_modules/aria-api/lib/name.js';
	var coverage = window.__coverage__[path].b;
	result.fingerprint = Object.values(coverage).map(x => x.join(':')).join('-');
	for (var key in coverage) {
		for (var i = 0; i < coverage[key].length; i++) {
			coverage[key][i] = 0;
		}
	}

	return result;
};

var shrink = function(item, oracle) {
	var result = runWithCoverage(item, oracle);
	if (!result.error) {
		return;
	}
	var shrunken = item.shrink();
	for (var i = 0; i < shrunken.length; i++) {
		var x = shrink(shrunken[i], oracle);
		if (x && x.result.fingerprint === result.fingerprint) {
			return x;
		}
	}
	return {
		'item': item,
		'result': result,
	};
};

var fuzz = function(corpus, oracle) {
	var fingerprints = [];
	var queue = [];

	corpus.forEach(function(item) {
		var result = runWithCoverage(item, oracle);
		queue.push(item);
		fingerprints.push(result.fingerprint);
	});

	var handleMutation = function(mutation) {
		var result = runWithCoverage(mutation, oracle);

		if (result.error) {
			// var x = shrink(mutation, oracle);
			// console.log(x.item.toString(), x.result.error);
			console.log(mutation.toString(), result.error);
		}

		if (!fingerprints.includes(result.fingerprint)) {
			queue.push(mutation);
			fingerprints.push(result.fingerprint);
			console.log(fingerprints.length);
		}
	};

	while (queue.length) {
		var item = queue.shift();
		item.mutations().forEach(handleMutation);
	}
};


module.exports = {
	'test': function(len, oracle) {
		var corpus = [];
		for (var i = 0; i < len; i++) {
			corpus.push(new Element(len, {k: 0}));
		}
		return fuzz(corpus, oracle);
	},
};
