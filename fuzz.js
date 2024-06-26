(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var getFingerprint = function(covPath) {
	var coverage = window.__coverage__[covPath].b;
	var fingerprint = Object.values(coverage).map(x => x.join(':')).join('-');
	for (var key in coverage) {
		for (var i = 0; i < coverage[key].length; i++) {
			coverage[key][i] = 0;
		}
	}
	return fingerprint;
};

var run = function(corpus, oracle, covPath, onFingerprint, onReport, done) {
	var fingerprints = [];
	var queue = [];
	var count = 0;
	var batchSize = 10;

	corpus.forEach(function(item) {
		queue.push(item);
	});

	var step = function() {
		for (var i = 0; i < batchSize && queue.length; i++) {
			var item = queue.shift();
			var report = oracle(item);
			var fingerprint = getFingerprint(covPath);

			if (!fingerprints.includes(fingerprint)) {
				fingerprints.push(fingerprint);
				item.mutate().forEach(mutation => queue.push(mutation));
				onFingerprint(fingerprint, fingerprints.length);

				if (report) {
					onReport(report);
				}
			}
		}

		if (queue.length) {
			setTimeout(step);
		} else {
			done();
		}
	};

	step();
};

module.exports = {
	'run': run,
};

},{}],2:[function(require,module,exports){
var constants = require('aria-api/lib/constants');

var attributes = [
	['role',             Object.keys(constants.roles)],
	['hidden',           ['']],
	['aria-hidden',      ['', 'true', 'false']],
	['aria-label',       ['', '__random__']],
	['title',            ['', '__random__']],
	['value',            ['', '__random__']],
	['placeholder',      ['', '__random__']],
	['alt',              ['', '__random__']],
	['aria-valuenow',    ['', '__random__']],
	['aria-valuetext',   ['', '__random__']],
	['aria-labelledby',  ['__randint__']],
	['aria-owns',        ['__randint__']],
	['list',             ['__randint__']],
	['for',              ['__randint__']],
	['type',             ['', '__random__', 'hidden', 'checkbox', 'text', 'password', 'color', 'reset']],
	['style',            ['', '__random__', 'display: none', 'display: block', 'display: inline-block', 'display: inline', 'visibility: hidden']],
];

var tags = ['a', 'button', 'form', 'label', 'input', 'article', 'table', 'td', 'tr', 'th', 'pre', 'legend', 'h1', 'div', 'span', 'fieldset', 'img', 'abbr', 'strong', 'br', 'hr', 'select', 'option'];

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
	ctx = ctx || {k: 0};
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
	var content = this.content;
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

Element.prototype.mutate = function() {
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

module.exports = {
	'Element': Element,
};

},{"aria-api/lib/constants":7}],3:[function(require,module,exports){
var ariaApi = require('aria-api/instrumented.js');
var accdc = require('w3c-alternative-text-computation');

var fuzzer = require('./fuzzer');
var html = require('./html');

var preview = document.querySelector('#ba-preview');
var fingerprints = document.querySelector('#ba-fingerprints');
var errors = document.querySelector('#ba-errors');
var reports = document.querySelector('#ba-reports');

var oracle = function(input) {
	preview.innerHTML = input.toString();
	var el = preview.querySelector('#test') || preview.children[0] || preview;
	var v1, v2;

	try {
		v1 = accdc.calcNames(el).name;
	} catch (error) {
		v1 = error;
	}

	try {
		v2 = ariaApi.getName(el);
	} catch (error) {
		v2 = error;
	}

	if (v1 !== v2) {
		return {
			'html': preview.innerHTML,
			'v1': v1,
			'v2': v2,
		};
	}
};

var renderReport = function(report) {
	var tr = document.createElement('tr');
	var td1 = document.createElement('td');
	td1.textContent = report.html;
	tr.append(td1);
	var td2 = document.createElement('td');
	td2.textContent = report.v1;
	tr.append(td2);
	var td3 = document.createElement('td');
	td3.textContent = report.v2;
	tr.append(td3);
	return tr;
};

document.addEventListener('DOMContentLoaded', function() {
	var covPath = 'node_modules/aria-api/lib/name.js';
	var corpus = [];
	for (var i = 0; i < 10; i++) {
		corpus.push(new html.Element(10));
	}
	fuzzer.run(corpus, oracle, covPath, function(fingerprint, c) {
		fingerprints.textContent = c;
	}, function(report) {
		reports.append(renderReport(report));
		errors.textContent = reports.children.length;
	}, function() {
		preview.innerHTML = 'DONE';
	});
});

},{"./fuzzer":1,"./html":2,"aria-api/instrumented.js":4,"w3c-alternative-text-computation":10}],4:[function(require,module,exports){
var query = require('./lib/query.js');
var name = require('./lib/name-inst.js');
var atree = require('./lib/atree.js');

module.exports = {
	getRole: query.getRole,
	getAttribute: query.getAttribute,
	getName: name.getName,
	getDescription: name.getDescription,

	matches: query.matches,
	querySelector: query.querySelector,
	querySelectorAll: query.querySelectorAll,
	closest: query.closest,

	getParentNode: atree.getParentNode,
	getChildNodes: atree.getChildNodes,
};

},{"./lib/atree.js":5,"./lib/name-inst.js":8,"./lib/query.js":9}],5:[function(require,module,exports){
const attrs = require('./attrs');

const _getOwner = function(node, owners) {
	if (node.nodeType === node.ELEMENT_NODE && node.id) {
		const selector = '[aria-owns~="' + CSS.escape(node.id) + '"]';
		if (owners) {
			for (const owner of owners) {
				if (owner.matches(selector)) {
					return owner;
				}
			}
		} else {
			return document.querySelector(selector);
		}
	}
};

const _getParentNode = function(node, owners) {
	return _getOwner(node, owners) || node.parentNode;
};

const detectLoop = function(node, owners) {
	const seen = [node];
	while ((node = _getParentNode(node, owners))) {
		if (seen.includes(node)) {
			return true;
		}
		seen.push(node);
	}
};

const getOwner = function(node, owners) {
	const owner = _getOwner(node, owners);
	if (owner && !detectLoop(node, owners)) {
		return owner;
	}
};

const getParentNode = function(node, owners) {
	return getOwner(node, owners) || node.parentNode;
};

const isHidden = function(node) {
	return node.nodeType === node.ELEMENT_NODE && attrs.getAttribute(node, 'hidden');
};

const getChildNodes = function(node, owners) {
	const childNodes = [];

	for (let i = 0; i < node.childNodes.length; i++) {
		const child = node.childNodes[i];
		if (!getOwner(child, owners) && !isHidden(child)) {
			childNodes.push(child);
		}
	}

	if (node.nodeType === node.ELEMENT_NODE) {
		const owns = attrs.getAttribute(node, 'owns') || [];
		for (let i = 0; i < owns.length; i++) {
			const child = document.getElementById(owns[i]);
			// double check with getOwner for consistency
			if (child && getOwner(child, owners) === node && !isHidden(child)) {
				childNodes.push(child);
			}
		}
	}

	return childNodes;
};

const walk = function(root, fn) {
	const owners = document.querySelectorAll('[aria-owns]');
	let queue = [root];
	while (queue.length) {
		const item = queue.shift();
		fn(item);
		queue = getChildNodes(item, owners).concat(queue);
	}
};

const searchUp = function(node, test) {
	const candidate = getParentNode(node);
	if (candidate) {
		if (test(candidate)) {
			return candidate;
		} else {
			return searchUp(candidate, test);
		}
	}
};

module.exports = {
	'getParentNode': getParentNode,
	'getChildNodes': getChildNodes,
	'walk': walk,
	'searchUp': searchUp,
};

},{"./attrs":6}],6:[function(require,module,exports){
const constants = require('./constants.js');

var unique = function(arr) {
	return arr.filter((a, i) => arr.indexOf(a) === i);
};

var flatten = function(arr) {
	return [].concat.apply([], arr);
};

var normalizeRoles = function(roles, includeAbstract) {
	return unique(roles
		.map(r => constants.aliases[r] || r)
		.filter(r => constants.roles[r])
		.filter(r => includeAbstract || !constants.roles[r].abstract)
	);
};

// candidates can be passed for performance optimization
const getRole = function(el, candidates) {
	// TODO: filter out any invalid roles (e.g. name or context required)
	const roles = normalizeRoles(
		(el.getAttribute('role') || '').toLowerCase().split(/\s+/)
	);

	if (roles.length > 1 && candidates) {
		return [roles, candidates];
	} else if (roles.length) {
		for (const role of roles) {
			if (!candidates || candidates.includes(role)) {
				return role;
			}
		}
	} else {
		for (const role of (candidates || Object.keys(constants.roles))) {
			const r = constants.roles[role];
			if (!r.abstract && r.selectors && el.matches(r.selectors.join(','))) {
				return role;
			}
		}
	}
};

const hasRole = function(el, roles) {
	const subRoles = normalizeRoles(roles, true).map(role => {
		return constants.roles[role].subRoles || [role];
	});
	return !!getRole(el, unique(flatten(subRoles)));
};

const getAttribute = function(el, key) {
	if (constants.attributeStrongMapping.hasOwnProperty(key)) {
		const value = el[constants.attributeStrongMapping[key]];
		if (value) {
			return value;
		}
	}
	if (key === 'readonly' && el.contentEditable) {
		return false;
	} else if (key === 'invalid' && el.checkValidity) {
		return !el.checkValidity();
	} else if (key === 'hidden') {
		// workaround for chromium
		if (el.matches('noscript')) {
			return true;
		}
		if (el.matches('details:not([open]) > :not(summary)')) {
			return true;
		}
		const style = window.getComputedStyle(el);
		if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
			return true;
		}
	}

	const type = constants.attributes[key];
	const raw = el.getAttribute('aria-' + key);

	if (raw) {
		if (type === 'bool') {
			return raw === 'true';
		} else if (type === 'tristate') {
			return raw === 'true' ? true : raw === 'false' ? false : 'mixed';
		} else if (type === 'bool-undefined') {
			return raw === 'true' ? true : raw === 'false' ? false : undefined;
		} else if (type === 'id-list') {
			return raw.split(/\s+/);
		} else if (type === 'integer') {
			return parseInt(raw, 10);
		} else if (type === 'number') {
			return parseFloat(raw);
		} else if (type === 'token-list') {
			return raw.split(/\s+/);
		} else {
			return raw;
		}
	}

	// TODO
	// autocomplete
	// contextmenu -> aria-haspopup
	// indeterminate -> aria-checked="mixed"
	// list -> aria-controls

	if (key === 'level') {
		for (let i = 1; i <= 6; i++) {
			if (el.tagName.toLowerCase() === 'h' + i) {
				return i;
			}
		}
	} else if (constants.attributeWeakMapping.hasOwnProperty(key)) {
		return el[constants.attributeWeakMapping[key]];
	}

	if (key in constants.attrsWithDefaults) {
		const role = getRole(el);
		const defaults = constants.roles[role].defaults;
		if (defaults && defaults.hasOwnProperty(key)) {
			return defaults[key];
		}
	}

	if (type === 'bool' || type === 'tristate') {
		return false;
	}
};

module.exports = {
	getRole: getRole,
	hasRole: hasRole,
	getAttribute: getAttribute,
};

},{"./constants.js":7}],7:[function(require,module,exports){
// https://www.w3.org/TR/wai-aria/#state_prop_def
exports.attributes = {
	'activedescendant': 'id',
	'atomic': 'bool',
	'autocomplete': 'token',
	'braillelabel': 'string',
	'brailleroledescription': 'string',
	'busy': 'bool',
	'checked': 'tristate',
	'colcount': 'int',
	'colindex': 'int',
	'colindextext': 'string',
	'colspan': 'int',
	'controls': 'id-list',
	'current': 'token',
	'describedby': 'id-list',
	'description': 'string',
	'details': 'id',
	'disabled': 'bool',
	'dropeffect': 'token-list',
	'errormessage': 'id',
	'expanded': 'bool-undefined',
	'flowto': 'id-list',
	'grabbed': 'bool-undefined',
	'haspopup': 'token',
	'hidden': 'bool-undefined',
	'invalid': 'token',
	'keyshortcuts': 'string',
	'label': 'string',
	'labelledby': 'id-list',
	'level': 'int',
	'live': 'token',
	'modal': 'bool',
	'multiline': 'bool',
	'multiselectable': 'bool',
	'orientation': 'token',
	'owns': 'id-list',
	'placeholder': 'string',
	'posinset': 'int',
	'pressed': 'tristate',
	'readonly': 'bool',
	'relevant': 'token-list',
	'required': 'bool',
	'roledescription': 'string',
	'rowcount': 'int',
	'rowindex': 'int',
	'rowindextext': 'string',
	'rowspan': 'int',
	'selected': 'bool-undefined',
	'setsize': 'int',
	'sort': 'token',
	'valuemax': 'number',
	'valuemin': 'number',
	'valuenow': 'number',
	'valuetext': 'string',
};

exports.attributeStrongMapping = {
	'disabled': 'disabled',
	'placeholder': 'placeholder',
	'readonly': 'readOnly',
	'required': 'required',
};

exports.attributeWeakMapping = {
	'checked': 'checked',
	'colspan': 'colSpan',
	'expanded': 'open',
	'multiselectable': 'multiple',
	'rowspan': 'rowSpan',
	'selected': 'selected',
};

// https://www.w3.org/TR/html/dom.html#sectioning-content-2
const scoped = ['article *', 'aside *', 'nav *', 'section *'].join(',');

const svgSelectors = function(selector) {
	return [
		// `${selector}:has(> title:not(:empty))`,
		// `${selector}:has(> desc:not(:empty))`,
		`${selector}[aria-label]`,
		`${selector}[aria-roledescription]`,
		`${selector}[aria-labelledby]`,
		`${selector}[aria-describedby]`,
		`${selector}[tabindex]`,
		`${selector}[role]`,
	];
};

// https://www.w3.org/TR/html-aam-1.0/#html-element-role-mappings
// https://www.w3.org/TR/wai-aria/roles
exports.roles = {
	alert: {
		childRoles: ['alertdialog'],
		defaults: {
			'live': 'assertive',
			'atomic': true,
		},
	},
	alertdialog: {},
	application: {},
	article: {
		selectors: ['article'],
		childRoles: ['comment'],
	},
	banner: {
		selectors: [`header:not(main *, ${scoped})`],
	},
	blockquote: {
		selectors: ['blockquote'],
	},
	button: {
		selectors: [
			'button',
			'input[type="button"]',
			'input[type="image"]',
			'input[type="reset"]',
			'input[type="submit"]',
			'summary',
		],
		nameFromContents: true,
	},
	caption: {
		selectors: ['caption', 'figcaption'],
	},
	cell: {
		selectors: ['td', 'td ~ th:not([scope])'],
		childRoles: ['columnheader', 'gridcell', 'rowheader'],
		nameFromContents: true,
	},
	checkbox: {
		selectors: ['input[type="checkbox"]'],
		childRoles: ['switch'],
		nameFromContents: true,
		defaults: {
			'checked': 'false',
		},
	},
	code: {
		selectors: ['code'],
	},
	columnheader: {
		selectors: ['th[scope="col"]'],
		nameFromContents: true,
	},
	combobox: {
		selectors: [
			'input:not([type])[list]',
			'input[type="email"][list]',
			'input[type="search"][list]',
			'input[type="tel"][list]',
			'input[type="text"][list]',
			'input[type="url"][list]',
			'select:not([size]):not([multiple])',
			'select[size="0"]:not([multiple])',
			'select[size="1"]:not([multiple])',
		],
		defaults: {
			'expanded': false,
			'haspopup': 'listbox',
		},
	},
	command: {
		abstract: true,
		childRoles: ['button', 'link', 'menuitem'],
	},
	comment: {
		nameFromContents: true,
	},
	complementary: {
		selectors: [
			`aside:not(${scoped})`,
			'aside[aria-label]',
			'aside[aria-labelledby]',
			'aside[title]',
		],
	},
	composite: {
		abstract: true,
		childRoles: ['grid', 'select', 'spinbutton', 'tablist'],
	},
	contentinfo: {
		selectors: [`footer:not(main *, ${scoped})`],
	},
	definition: {
		selectors: ['dd'],
	},
	deletion: {
		selectors: ['del', 's'],
	},
	dialog: {
		selectors: ['dialog'],
		childRoles: ['alertdialog'],
	},
	'doc-abstract': {},
	'doc-acknowledgments': {},
	'doc-afterword': {},
	'doc-appendix': {},
	'doc-backlink': {
		nameFromContents: true,
	},
	'doc-biblioentry': {},
	'doc-bibliography': {},
	'doc-biblioref': {
		nameFromContents: true,
	},
	'doc-chapter': {},
	'doc-colophon': {},
	'doc-conclusion': {},
	'doc-cover': {},
	'doc-credit': {},
	'doc-credits': {},
	'doc-dedication': {},
	'doc-endnote': {},
	'doc-endnotes': {},
	'doc-epilogue': {},
	'doc-epigraph': {},
	'doc-errata': {},
	'doc-example': {},
	'doc-footnote': {},
	'doc-foreword': {},
	'doc-glossary': {},
	'doc-glossref': {
		nameFromContents: true,
	},
	'doc-index': {},
	'doc-introduction': {},
	'doc-noteref': {
		nameFromContents: true,
	},
	'doc-notice': {},
	'doc-pagebreak': {
		nameFromContents: true,
	},
	'doc-pagefooter': {},
	'doc-pageheader': {},
	'doc-pagelist': {},
	'doc-part': {},
	'doc-preface': {},
	'doc-prologue': {},
	'doc-pullquote': {},
	'doc-qna': {},
	'doc-subtitle': {
		nameFromContents: true,
	},
	'doc-tip': {},
	'doc-toc': {},
	document: {
		selectors: ['html'],
		childRoles: ['article', 'graphics-document'],
	},
	emphasis: {
		selectors: ['em'],
	},
	feed: {},
	figure: {
		selectors: ['figure'],
		childRoles: ['doc-example'],
	},
	form: {
		selectors: ['form[aria-label]', 'form[aria-labelledby]', 'form[title]'],
	},
	generic: {
		selectors: [
			'a:not([*|href])',
			'area:not([*|href])',
			`aside:not(${scoped}):not([aria-label]):not([aria-labelledby]):not([title])`,
			'b',
			'bdi',
			'bdo',
			'body',
			'data',
			'div',
			// footer scoped
			// header scoped
			'i',
			'li:not(ul > li):not(ol > li)',
			'pre',
			'q',
			'samp',
			'section:not([aria-label]):not([aria-labelledby]):not([title])',
			'small',
			'span',
			'u',
		],
	},
	'graphics-document': {
		selectors: ['svg'],
	},
	'graphics-object': {
		selectors: [
			...svgSelectors('symbol'),
			...svgSelectors('use'),
		],
	},
	'graphics-symbol': {
		selectors: [
			...svgSelectors('circle'),
			...svgSelectors('ellipse'),
			...svgSelectors('line'),
			...svgSelectors('path'),
			...svgSelectors('polygon'),
			...svgSelectors('polyline'),
			...svgSelectors('rect'),
		],
	},
	grid: {
		childRoles: ['treegrid'],
	},
	gridcell: {
		childRoles: ['columnheader', 'rowheader'],
		nameFromContents: true,
	},
	group: {
		selectors: [
			'address',
			'details',
			'fieldset',
			'hgroup',
			'optgroup',
			...svgSelectors('foreignObject'),
			...svgSelectors('g'),
			'text',
			...svgSelectors('textPath'),
			...svgSelectors('tspan'),
		],
		childRoles: ['row', 'select', 'toolbar', 'graphics-object'],
	},
	heading: {
		selectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
		nameFromContents: true,
		defaults: {
			'level': 2,
		},
	},
	image: {
		selectors: [
			'img:not([alt=""])',
			'graphics-symbol',
			...svgSelectors('image'),
			...svgSelectors('mesh'),
		],
		childRoles: ['doc-cover'],
	},
	input: {
		abstract: true,
		childRoles: [
			'checkbox',
			'combobox',
			'option',
			'radio',
			'slider',
			'spinbutton',
			'textbox',
		],
	},
	insertion: {
		selectors: ['ins'],
	},
	landmark: {
		abstract: true,
		childRoles: [
			'banner',
			'complementary',
			'contentinfo',
			'doc-acknowledgments',
			'doc-afterword',
			'doc-appendix',
			'doc-bibliography',
			'doc-chapter',
			'doc-conclusion',
			'doc-credits',
			'doc-endnotes',
			'doc-epilogue',
			'doc-errata',
			'doc-foreword',
			'doc-glossary',
			'doc-introduction',
			'doc-part',
			'doc-preface',
			'doc-prologue',
			'form',
			'main',
			'navigation',
			'region',
			'search',
		],
	},
	link: {
		selectors: ['a[*|href]', 'area[href]'],
		childRoles: ['doc-backlink', 'doc-biblioref', 'doc-glossref', 'doc-noteref'],
		nameFromContents: true,
	},
	list: {
		selectors: ['dl', 'ol', 'ul', 'menu'],
		childRoles: ['feed'],
	},
	listbox: {
		selectors: [
			'datalist',
			'select[multiple]',
			'select[size]:not([size="0"]):not([size="1"])',
		],
		defaults: {
			'orientation': 'vertical',
		},
	},
	listitem: {
		selectors: ['ol > li', 'ul > li'],
		childRoles: ['doc-biblioentry', 'doc-endnote', 'treeitem'],
	},
	log: {
		defaults: {
			'live': 'polite',
		},
	},
	main: {
		selectors: ['main'],
	},
	mark: {
		selectors: ['mark'],
	},
	marquee: {},
	math: {
		selectors: ['math'],
	},
	meter: {
		selectors: ['meter'],
		defaults: {
			'valuemin': 0,
			'valuemax': 100,
		},
	},
	menu: {
		childRoles: ['menubar'],
		defaults: {
			'orientation': 'vertical',
		},
	},
	menubar: {
		defaults: {
			'orientation': 'horizontal',
		},
	},
	menuitem: {
		childRoles: ['menuitemcheckbox', 'menuitemradio'],
		nameFromContents: true,
	},
	menuitemcheckbox: {
		nameFromContents: true,
		defaults: {
			'checked': 'false',
		},
	},
	menuitemradio: {
		nameFromContents: true,
		defaults: {
			'checked': 'false',
		},
	},
	navigation: {
		selectors: ['nav'],
		childRoles: ['doc-index', 'doc-pagelist', 'doc-toc'],
	},
	none: {
		selectors: ['img[alt=""]'],
	},
	note: {
		childRoles: ['doc-notice', 'doc-tip'],
	},
	option: {
		selectors: ['option'],
		childRoles: ['treeitem'],
		nameFromContents: true,
		defaults: {
			'selected': 'false',
		},
	},
	paragraph: {
		selectors: ['p'],
	},
	progressbar: {
		selectors: ['progress'],
		defaults: {
			'valuemin': 0,
			'valuemax': 100,
		},
	},
	radio: {
		selectors: ['input[type="radio"]'],
		childRoles: ['menuitemradio'],
		nameFromContents: true,
		defaults: {
			'checked': 'false',
		},
	},
	radiogroup: {},
	range: {
		abstract: true,
		childRoles: ['meter', 'progressbar', 'scrollbar', 'slider', 'spinbutton'],
	},
	region: {
		selectors: ['section[aria-label]', 'section[aria-labelledby]', 'section[title]'],
	},
	roletype: {
		abstract: true,
		childRoles: ['structure', 'widget', 'window'],
	},
	row: {
		selectors: ['tr'],
		nameFromContents: true,
	},
	rowgroup: {
		selectors: ['tbody', 'thead', 'tfoot'],
	},
	rowheader: {
		selectors: ['th[scope="row"]', 'th:not([scope]):not(td ~ th)'],
		nameFromContents: true,
	},
	scrollbar: {
		defaults: {
			'orientation': 'vertical',
			'valuemin': 0,
			'valuemax': 100,
		},
	},
	search: {
		selectors: ['search'],
	},
	searchbox: {
		selectors: ['input[type="search"]:not([list])'],
	},
	section: {
		abstract: true,
		childRoles: [
			'alert',
			'blockquote',
			'caption',
			'cell',
			'code',
			'definition',
			'deletion',
			'doc-abstract',
			'doc-colophon',
			'doc-credit',
			'doc-dedication',
			'doc-epigraph',
			'doc-footnote',
			'doc-pagefooter',
			'doc-pageheader',
			'doc-pullquote',
			'doc-qna',
			'emphasis',
			'figure',
			'group',
			'image',
			'insertion',
			'landmark',
			'list',
			'listitem',
			'log',
			'mark',
			'marquee',
			'math',
			'note',
			'paragraph',
			'status',
			'strong',
			'subscript',
			'suggestion',
			'superscript',
			'table',
			'tabpanel',
			'term',
			'time',
			'tooltip',
		],
	},
	sectionhead: {
		abstract: true,
		childRoles: [
			'columnheader',
			'doc-subtitle',
			'heading',
			'rowheader',
			'tab',
		],
		nameFromContents: true,
	},
	select: {
		abstract: true,
		childRoles: ['listbox', 'menu', 'radiogroup', 'tree'],
	},
	separator: {
		// assume not focussable because <hr> is not
		selectors: ['hr'],
		childRoles: ['doc-pagebreak'],
		defaults: {
			'orientation': 'horizontal',
			'valuemin': 0,
			'valuemax': 100,
		},
	},
	slider: {
		selectors: ['input[type="range"]'],
		defaults: {
			'orientation': 'horizontal',
			'valuemin': 0,
			'valuemax': 100,
			// FIXME: halfway between actual valuemin and valuemax
			'valuenow': 50,
		},
	},
	spinbutton: {
		selectors: ['input[type="number"]'],
		defaults: {
			// FIXME: no valuemin/valuemax/valuenow
		},
	},
	status: {
		selectors: ['output'],
		childRoles: ['timer'],
		defaults: {
			'live': 'polite',
			'atomic': true,
		},
	},
	strong: {
		selectors: ['strong'],
	},
	structure: {
		abstract: true,
		childRoles: [
			'application',
			'document',
			'none',
			'generic',
			'range',
			'rowgroup',
			'section',
			'sectionhead',
			'separator',
		],
	},
	suggestion: {},
	subscript: {
		selectors: ['sub'],
	},
	superscript: {
		selectors: ['sup'],
	},
	switch: {
		nameFromContents: true,
		defaults: {
			'checked': false,
		},
	},
	tab: {
		nameFromContents: true,
		defaults: {
			'selected': false,
		},
	},
	table: {
		selectors: ['table'],
		childRoles: ['grid'],
	},
	tablist: {
		defaults: {
			'orientation': 'horizontal',
		},
	},
	tabpanel: {},
	term: {
		selectors: ['dfn', 'dt'],
	},
	textbox: {
		selectors: [
			'input:not([type]):not([list])',
			'input[type="email"]:not([list])',
			'input[type="tel"]:not([list])',
			'input[type="text"]:not([list])',
			'input[type="url"]:not([list])',
			'textarea',
		],
		childRoles: ['searchbox'],
	},
	time: {
		selectors: ['time'],
	},
	timer: {
		defaults: {
			'live': 'off',
		},
	},
	toolbar: {
		defaults: {
			'orientation': 'horizontal',
		},
	},
	tooltip: {
		nameFromContents: true,
	},
	tree: {
		childRoles: ['treegrid'],
		defaults: {
			'orientation': 'vertical',
		},
	},
	treegrid: {},
	treeitem: {
		nameFromContents: true,
	},
	widget: {
		abstract: true,
		childRoles: [
			'command',
			'composite',
			'gridcell',
			'input',
			'progressbar',
			'row',
			'scrollbar',
			'separator',
			'tab',
		],
	},
	window: {
		abstract: true,
		childRoles: ['dialog'],
	},
};

const getSubRoles = function(role) {
	const children = (exports.roles[role]).childRoles || [];
	const descendents = children.map(getSubRoles);

	const result = [role];

	descendents.forEach(list => {
		list.forEach(r => {
			if (!result.includes(r)) {
				result.push(r);
			}
		});
	});

	return result;
};

exports.attrsWithDefaults = [];

for (const role in exports.roles) {
	exports.roles[role].subRoles = getSubRoles(role);
	for (const key in exports.roles[role].defaults) {
		if (!exports.attrsWithDefaults.includes(key)) {
			exports.attrsWithDefaults.push(key);
		}
	}
}

exports.aliases = {
	'presentation': 'none',
	'directory': 'list',
	'img': 'image',
};

exports.nameFromDescendant = {
	'figure': 'figcaption',
	'table': 'caption',
	'fieldset': 'legend',
};

exports.nameDefaults = {
	'input[type="submit"]': 'Submit',
	'input[type="reset"]': 'Reset',
	'summary': 'Details',
};

},{}],8:[function(require,module,exports){
function cov_22i8nvh4cs(){var path="node_modules/aria-api/lib/name.js";var hash="33fb1e8c5c5d4b85b7cbe0185f2673ac454be0c8";var global=new Function("return this")();var gcv="__coverage__";var coverageData={path:"/home/tobias/code/a11y/babelacc/node_modules/aria-api/lib/name.js",statementMap:{"0":{start:{line:1,column:18},end:{line:1,column:43}},"1":{start:{line:2,column:14},end:{line:2,column:35}},"2":{start:{line:3,column:14},end:{line:3,column:35}},"3":{start:{line:5,column:18},end:{line:10,column:1}},"4":{start:{line:7,column:16},end:{line:7,column:59}},"5":{start:{line:8,column:16},end:{line:8,column:43}},"6":{start:{line:9,column:1},end:{line:9,column:36}},"7":{start:{line:12,column:25},end:{line:39,column:1}},"8":{start:{line:13,column:16},end:{line:13,column:59}},"9":{start:{line:14,column:12},end:{line:14,column:53}},"10":{start:{line:15,column:11},end:{line:15,column:13}},"11":{start:{line:18,column:1},end:{line:36,column:2}},"12":{start:{line:19,column:2},end:{line:34,column:3}},"13":{start:{line:20,column:3},end:{line:20,column:22}},"14":{start:{line:21,column:9},end:{line:34,column:3}},"15":{start:{line:22,column:3},end:{line:24,column:4}},"16":{start:{line:23,column:4},end:{line:23,column:46}},"17":{start:{line:25,column:9},end:{line:34,column:3}},"18":{start:{line:26,column:3},end:{line:28,column:4}},"19":{start:{line:27,column:4},end:{line:27,column:18}},"20":{start:{line:29,column:9},end:{line:34,column:3}},"21":{start:{line:30,column:3},end:{line:30,column:12}},"22":{start:{line:33,column:3},end:{line:33,column:13}},"23":{start:{line:35,column:2},end:{line:35,column:44}},"24":{start:{line:38,column:1},end:{line:38,column:52}},"25":{start:{line:41,column:19},end:{line:59,column:1}},"26":{start:{line:42,column:18},end:{line:42,column:43}},"27":{start:{line:44,column:11},end:{line:44,column:13}},"28":{start:{line:45,column:1},end:{line:56,column:2}},"29":{start:{line:45,column:14},end:{line:45,column:15}},"30":{start:{line:46,column:15},end:{line:46,column:26}},"31":{start:{line:47,column:2},end:{line:55,column:3}},"32":{start:{line:48,column:3},end:{line:48,column:27}},"33":{start:{line:49,column:9},end:{line:55,column:3}},"34":{start:{line:50,column:3},end:{line:54,column:4}},"35":{start:{line:51,column:4},end:{line:51,column:16}},"36":{start:{line:53,column:4},end:{line:53,column:59}},"37":{start:{line:58,column:1},end:{line:58,column:12}},"38":{start:{line:61,column:29},end:{line:66,column:1}},"39":{start:{line:62,column:14},end:{line:62,column:31}},"40":{start:{line:63,column:1},end:{line:65,column:2}},"41":{start:{line:64,column:2},end:{line:64,column:48}},"42":{start:{line:68,column:16},end:{line:183,column:1}},"43":{start:{line:69,column:11},end:{line:69,column:13}},"44":{start:{line:71,column:1},end:{line:71,column:25}},"45":{start:{line:72,column:1},end:{line:78,column:2}},"46":{start:{line:73,column:2},end:{line:75,column:3}},"47":{start:{line:74,column:3},end:{line:74,column:13}},"48":{start:{line:77,column:2},end:{line:77,column:19}},"49":{start:{line:84,column:1},end:{line:91,column:2}},"50":{start:{line:85,column:14},end:{line:85,column:61}},"51":{start:{line:86,column:18},end:{line:89,column:4}},"52":{start:{line:87,column:17},end:{line:87,column:44}},"53":{start:{line:88,column:3},end:{line:88,column:65}},"54":{start:{line:90,column:2},end:{line:90,column:26}},"55":{start:{line:94,column:1},end:{line:107,column:2}},"56":{start:{line:95,column:2},end:{line:106,column:3}},"57":{start:{line:96,column:3},end:{line:96,column:36}},"58":{start:{line:97,column:9},end:{line:106,column:3}},"59":{start:{line:98,column:20},end:{line:98,column:93}},"60":{start:{line:99,column:3},end:{line:103,column:4}},"61":{start:{line:100,column:4},end:{line:100,column:67}},"62":{start:{line:102,column:4},end:{line:102,column:25}},"63":{start:{line:104,column:9},end:{line:106,column:3}},"64":{start:{line:105,column:3},end:{line:105,column:102}},"65":{start:{line:110,column:1},end:{line:113,column:2}},"66":{start:{line:112,column:2},end:{line:112,column:38}},"67":{start:{line:116,column:1},end:{line:121,column:2}},"68":{start:{line:117,column:18},end:{line:119,column:4}},"69":{start:{line:118,column:3},end:{line:118,column:59}},"70":{start:{line:120,column:2},end:{line:120,column:26}},"71":{start:{line:122,column:1},end:{line:124,column:2}},"72":{start:{line:123,column:2},end:{line:123,column:21}},"73":{start:{line:125,column:1},end:{line:127,column:2}},"74":{start:{line:126,column:2},end:{line:126,column:17}},"75":{start:{line:128,column:1},end:{line:137,column:2}},"76":{start:{line:129,column:2},end:{line:136,column:3}},"77":{start:{line:130,column:3},end:{line:135,column:4}},"78":{start:{line:131,column:23},end:{line:131,column:79}},"79":{start:{line:132,column:4},end:{line:134,column:5}},"80":{start:{line:133,column:5},end:{line:133,column:65}},"81":{start:{line:138,column:1},end:{line:143,column:2}},"82":{start:{line:139,column:19},end:{line:139,column:44}},"83":{start:{line:140,column:2},end:{line:142,column:3}},"84":{start:{line:141,column:3},end:{line:141,column:30}},"85":{start:{line:144,column:1},end:{line:146,column:2}},"86":{start:{line:145,column:2},end:{line:145,column:45}},"87":{start:{line:150,column:1},end:{line:152,column:2}},"88":{start:{line:151,column:2},end:{line:151,column:51}},"89":{start:{line:154,column:1},end:{line:156,column:2}},"90":{start:{line:155,column:2},end:{line:155,column:23}},"91":{start:{line:158,column:1},end:{line:164,column:2}},"92":{start:{line:159,column:2},end:{line:163,column:3}},"93":{start:{line:160,column:3},end:{line:162,column:4}},"94":{start:{line:161,column:4},end:{line:161,column:43}},"95":{start:{line:170,column:1},end:{line:172,column:2}},"96":{start:{line:171,column:2},end:{line:171,column:41}},"97":{start:{line:176,column:1},end:{line:178,column:2}},"98":{start:{line:177,column:2},end:{line:177,column:12}},"99":{start:{line:180,column:16},end:{line:180,column:47}},"100":{start:{line:181,column:15},end:{line:181,column:45}},"101":{start:{line:182,column:1},end:{line:182,column:44}},"102":{start:{line:185,column:23},end:{line:190,column:1}},"103":{start:{line:186,column:1},end:{line:189,column:21}},"104":{start:{line:192,column:23},end:{line:223,column:1}},"105":{start:{line:193,column:11},end:{line:193,column:13}},"106":{start:{line:195,column:1},end:{line:211,column:2}},"107":{start:{line:196,column:14},end:{line:196,column:62}},"108":{start:{line:197,column:18},end:{line:200,column:4}},"109":{start:{line:198,column:17},end:{line:198,column:44}},"110":{start:{line:199,column:3},end:{line:199,column:50}},"111":{start:{line:201,column:2},end:{line:201,column:26}},"112":{start:{line:202,column:8},end:{line:211,column:2}},"113":{start:{line:203,column:2},end:{line:203,column:44}},"114":{start:{line:204,column:8},end:{line:211,column:2}},"115":{start:{line:205,column:18},end:{line:205,column:42}},"116":{start:{line:206,column:2},end:{line:208,column:3}},"117":{start:{line:207,column:3},end:{line:207,column:29}},"118":{start:{line:209,column:8},end:{line:211,column:2}},"119":{start:{line:210,column:2},end:{line:210,column:17}},"120":{start:{line:212,column:1},end:{line:214,column:2}},"121":{start:{line:213,column:2},end:{line:213,column:45}},"122":{start:{line:216,column:1},end:{line:216,column:47}},"123":{start:{line:218,column:1},end:{line:220,column:2}},"124":{start:{line:219,column:2},end:{line:219,column:11}},"125":{start:{line:222,column:1},end:{line:222,column:12}},"126":{start:{line:225,column:0},end:{line:228,column:2}}},fnMap:{"0":{name:"(anonymous_0)",decl:{start:{line:5,column:18},end:{line:5,column:19}},loc:{start:{line:5,column:53},end:{line:10,column:1}},line:5},"1":{name:"(anonymous_1)",decl:{start:{line:12,column:25},end:{line:12,column:26}},loc:{start:{line:12,column:54},end:{line:39,column:1}},line:12},"2":{name:"(anonymous_2)",decl:{start:{line:41,column:19},end:{line:41,column:20}},loc:{start:{line:41,column:62},end:{line:59,column:1}},line:41},"3":{name:"(anonymous_3)",decl:{start:{line:61,column:29},end:{line:61,column:30}},loc:{start:{line:61,column:42},end:{line:66,column:1}},line:61},"4":{name:"(anonymous_4)",decl:{start:{line:68,column:16},end:{line:68,column:17}},loc:{start:{line:68,column:85},end:{line:183,column:1}},line:68},"5":{name:"(anonymous_5)",decl:{start:{line:86,column:26},end:{line:86,column:27}},loc:{start:{line:86,column:32},end:{line:89,column:3}},line:86},"6":{name:"(anonymous_6)",decl:{start:{line:117,column:54},end:{line:117,column:55}},loc:{start:{line:117,column:63},end:{line:119,column:3}},line:117},"7":{name:"(anonymous_7)",decl:{start:{line:185,column:23},end:{line:185,column:24}},loc:{start:{line:185,column:36},end:{line:190,column:1}},line:185},"8":{name:"(anonymous_8)",decl:{start:{line:192,column:23},end:{line:192,column:24}},loc:{start:{line:192,column:36},end:{line:223,column:1}},line:192},"9":{name:"(anonymous_9)",decl:{start:{line:197,column:26},end:{line:197,column:27}},loc:{start:{line:197,column:32},end:{line:200,column:3}},line:197}},branchMap:{"0":{loc:{start:{line:9,column:8},end:{line:9,column:35}},type:"cond-expr",locations:[{start:{line:9,column:17},end:{line:9,column:21}},{start:{line:9,column:24},end:{line:9,column:35}}],line:9},"1":{loc:{start:{line:19,column:2},end:{line:34,column:3}},type:"if",locations:[{start:{line:19,column:2},end:{line:34,column:3}},{start:{line:19,column:2},end:{line:34,column:3}}],line:19},"2":{loc:{start:{line:21,column:9},end:{line:34,column:3}},type:"if",locations:[{start:{line:21,column:9},end:{line:34,column:3}},{start:{line:21,column:9},end:{line:34,column:3}}],line:21},"3":{loc:{start:{line:22,column:3},end:{line:24,column:4}},type:"if",locations:[{start:{line:22,column:3},end:{line:24,column:4}},{start:{line:22,column:3},end:{line:24,column:4}}],line:22},"4":{loc:{start:{line:23,column:13},end:{line:23,column:44}},type:"binary-expr",locations:[{start:{line:23,column:13},end:{line:23,column:38}},{start:{line:23,column:42},end:{line:23,column:44}}],line:23},"5":{loc:{start:{line:25,column:9},end:{line:34,column:3}},type:"if",locations:[{start:{line:25,column:9},end:{line:34,column:3}},{start:{line:25,column:9},end:{line:34,column:3}}],line:25},"6":{loc:{start:{line:26,column:3},end:{line:28,column:4}},type:"if",locations:[{start:{line:26,column:3},end:{line:28,column:4}},{start:{line:26,column:3},end:{line:28,column:4}}],line:26},"7":{loc:{start:{line:26,column:7},end:{line:26,column:62}},type:"binary-expr",locations:[{start:{line:26,column:7},end:{line:26,column:32}},{start:{line:26,column:36},end:{line:26,column:62}}],line:26},"8":{loc:{start:{line:29,column:9},end:{line:34,column:3}},type:"if",locations:[{start:{line:29,column:9},end:{line:34,column:3}},{start:{line:29,column:9},end:{line:34,column:3}}],line:29},"9":{loc:{start:{line:47,column:2},end:{line:55,column:3}},type:"if",locations:[{start:{line:47,column:2},end:{line:55,column:3}},{start:{line:47,column:2},end:{line:55,column:3}}],line:47},"10":{loc:{start:{line:49,column:9},end:{line:55,column:3}},type:"if",locations:[{start:{line:49,column:9},end:{line:55,column:3}},{start:{line:49,column:9},end:{line:55,column:3}}],line:49},"11":{loc:{start:{line:50,column:3},end:{line:54,column:4}},type:"if",locations:[{start:{line:50,column:3},end:{line:54,column:4}},{start:{line:50,column:3},end:{line:54,column:4}}],line:50},"12":{loc:{start:{line:63,column:1},end:{line:65,column:2}},type:"if",locations:[{start:{line:63,column:1},end:{line:65,column:2}},{start:{line:63,column:1},end:{line:65,column:2}}],line:63},"13":{loc:{start:{line:71,column:11},end:{line:71,column:24}},type:"binary-expr",locations:[{start:{line:71,column:11},end:{line:71,column:18}},{start:{line:71,column:22},end:{line:71,column:24}}],line:71},"14":{loc:{start:{line:72,column:1},end:{line:78,column:2}},type:"if",locations:[{start:{line:72,column:1},end:{line:78,column:2}},{start:{line:72,column:1},end:{line:78,column:2}}],line:72},"15":{loc:{start:{line:73,column:2},end:{line:75,column:3}},type:"if",locations:[{start:{line:73,column:2},end:{line:75,column:3}},{start:{line:73,column:2},end:{line:75,column:3}}],line:73},"16":{loc:{start:{line:84,column:1},end:{line:91,column:2}},type:"if",locations:[{start:{line:84,column:1},end:{line:91,column:2}},{start:{line:84,column:1},end:{line:91,column:2}}],line:84},"17":{loc:{start:{line:84,column:5},end:{line:84,column:58}},type:"binary-expr",locations:[{start:{line:84,column:5},end:{line:84,column:23}},{start:{line:84,column:27},end:{line:84,column:58}}],line:84},"18":{loc:{start:{line:88,column:10},end:{line:88,column:64}},type:"cond-expr",locations:[{start:{line:88,column:18},end:{line:88,column:59}},{start:{line:88,column:62},end:{line:88,column:64}}],line:88},"19":{loc:{start:{line:94,column:1},end:{line:107,column:2}},type:"if",locations:[{start:{line:94,column:1},end:{line:107,column:2}},{start:{line:94,column:1},end:{line:107,column:2}}],line:94},"20":{loc:{start:{line:94,column:5},end:{line:94,column:29}},type:"binary-expr",locations:[{start:{line:94,column:5},end:{line:94,column:16}},{start:{line:94,column:20},end:{line:94,column:29}}],line:94},"21":{loc:{start:{line:95,column:2},end:{line:106,column:3}},type:"if",locations:[{start:{line:95,column:2},end:{line:106,column:3}},{start:{line:95,column:2},end:{line:106,column:3}}],line:95},"22":{loc:{start:{line:96,column:9},end:{line:96,column:35}},type:"binary-expr",locations:[{start:{line:96,column:9},end:{line:96,column:17}},{start:{line:96,column:21},end:{line:96,column:35}}],line:96},"23":{loc:{start:{line:97,column:9},end:{line:106,column:3}},type:"if",locations:[{start:{line:97,column:9},end:{line:106,column:3}},{start:{line:97,column:9},end:{line:106,column:3}}],line:97},"24":{loc:{start:{line:98,column:20},end:{line:98,column:93}},type:"binary-expr",locations:[{start:{line:98,column:20},end:{line:98,column:56}},{start:{line:98,column:60},end:{line:98,column:93}}],line:98},"25":{loc:{start:{line:99,column:3},end:{line:103,column:4}},type:"if",locations:[{start:{line:99,column:3},end:{line:103,column:4}},{start:{line:99,column:3},end:{line:103,column:4}}],line:99},"26":{loc:{start:{line:102,column:10},end:{line:102,column:24}},type:"binary-expr",locations:[{start:{line:102,column:10},end:{line:102,column:18}},{start:{line:102,column:22},end:{line:102,column:24}}],line:102},"27":{loc:{start:{line:104,column:9},end:{line:106,column:3}},type:"if",locations:[{start:{line:104,column:9},end:{line:106,column:3}},{start:{line:104,column:9},end:{line:106,column:3}}],line:104},"28":{loc:{start:{line:105,column:15},end:{line:105,column:100}},type:"binary-expr",locations:[{start:{line:105,column:15},end:{line:105,column:50}},{start:{line:105,column:54},end:{line:105,column:88}},{start:{line:105,column:92},end:{line:105,column:100}}],line:105},"29":{loc:{start:{line:110,column:1},end:{line:113,column:2}},type:"if",locations:[{start:{line:110,column:1},end:{line:113,column:2}},{start:{line:110,column:1},end:{line:113,column:2}}],line:110},"30":{loc:{start:{line:110,column:5},end:{line:110,column:46}},type:"binary-expr",locations:[{start:{line:110,column:5},end:{line:110,column:16}},{start:{line:110,column:20},end:{line:110,column:46}}],line:110},"31":{loc:{start:{line:116,column:1},end:{line:121,column:2}},type:"if",locations:[{start:{line:116,column:1},end:{line:121,column:2}},{start:{line:116,column:1},end:{line:121,column:2}}],line:116},"32":{loc:{start:{line:116,column:5},end:{line:116,column:43}},type:"binary-expr",locations:[{start:{line:116,column:5},end:{line:116,column:16}},{start:{line:116,column:20},end:{line:116,column:30}},{start:{line:116,column:34},end:{line:116,column:43}}],line:116},"33":{loc:{start:{line:122,column:1},end:{line:124,column:2}},type:"if",locations:[{start:{line:122,column:1},end:{line:124,column:2}},{start:{line:122,column:1},end:{line:124,column:2}}],line:122},"34":{loc:{start:{line:123,column:8},end:{line:123,column:20}},type:"binary-expr",locations:[{start:{line:123,column:8},end:{line:123,column:14}},{start:{line:123,column:18},end:{line:123,column:20}}],line:123},"35":{loc:{start:{line:125,column:1},end:{line:127,column:2}},type:"if",locations:[{start:{line:125,column:1},end:{line:127,column:2}},{start:{line:125,column:1},end:{line:127,column:2}}],line:125},"36":{loc:{start:{line:125,column:5},end:{line:125,column:58}},type:"binary-expr",locations:[{start:{line:125,column:5},end:{line:125,column:16}},{start:{line:125,column:20},end:{line:125,column:46}},{start:{line:125,column:50},end:{line:125,column:58}}],line:125},"37":{loc:{start:{line:128,column:1},end:{line:137,column:2}},type:"if",locations:[{start:{line:128,column:1},end:{line:137,column:2}},{start:{line:128,column:1},end:{line:137,column:2}}],line:128},"38":{loc:{start:{line:130,column:3},end:{line:135,column:4}},type:"if",locations:[{start:{line:130,column:3},end:{line:135,column:4}},{start:{line:130,column:3},end:{line:135,column:4}}],line:130},"39":{loc:{start:{line:132,column:4},end:{line:134,column:5}},type:"if",locations:[{start:{line:132,column:4},end:{line:134,column:5}},{start:{line:132,column:4},end:{line:134,column:5}}],line:132},"40":{loc:{start:{line:138,column:1},end:{line:143,column:2}},type:"if",locations:[{start:{line:138,column:1},end:{line:143,column:2}},{start:{line:138,column:1},end:{line:143,column:2}}],line:138},"41":{loc:{start:{line:138,column:5},end:{line:138,column:39}},type:"binary-expr",locations:[{start:{line:138,column:5},end:{line:138,column:16}},{start:{line:138,column:20},end:{line:138,column:39}}],line:138},"42":{loc:{start:{line:140,column:2},end:{line:142,column:3}},type:"if",locations:[{start:{line:140,column:2},end:{line:142,column:3}},{start:{line:140,column:2},end:{line:142,column:3}}],line:140},"43":{loc:{start:{line:140,column:6},end:{line:140,column:47}},type:"binary-expr",locations:[{start:{line:140,column:6},end:{line:140,column:14}},{start:{line:140,column:18},end:{line:140,column:47}}],line:140},"44":{loc:{start:{line:144,column:1},end:{line:146,column:2}},type:"if",locations:[{start:{line:144,column:1},end:{line:146,column:2}},{start:{line:144,column:1},end:{line:146,column:2}}],line:144},"45":{loc:{start:{line:144,column:5},end:{line:144,column:35}},type:"binary-expr",locations:[{start:{line:144,column:5},end:{line:144,column:16}},{start:{line:144,column:20},end:{line:144,column:35}}],line:144},"46":{loc:{start:{line:145,column:8},end:{line:145,column:44}},type:"binary-expr",locations:[{start:{line:145,column:8},end:{line:145,column:38}},{start:{line:145,column:42},end:{line:145,column:44}}],line:145},"47":{loc:{start:{line:150,column:1},end:{line:152,column:2}},type:"if",locations:[{start:{line:150,column:1},end:{line:152,column:2}},{start:{line:150,column:1},end:{line:152,column:2}}],line:150},"48":{loc:{start:{line:150,column:5},end:{line:150,column:112}},type:"binary-expr",locations:[{start:{line:150,column:5},end:{line:150,column:16}},{start:{line:150,column:21},end:{line:150,column:30}},{start:{line:150,column:34},end:{line:150,column:58}},{start:{line:150,column:62},end:{line:150,column:81}},{start:{line:150,column:86},end:{line:150,column:112}}],line:150},"49":{loc:{start:{line:154,column:1},end:{line:156,column:2}},type:"if",locations:[{start:{line:154,column:1},end:{line:156,column:2}},{start:{line:154,column:1},end:{line:156,column:2}}],line:154},"50":{loc:{start:{line:154,column:5},end:{line:154,column:47}},type:"binary-expr",locations:[{start:{line:154,column:5},end:{line:154,column:16}},{start:{line:154,column:20},end:{line:154,column:47}}],line:154},"51":{loc:{start:{line:155,column:8},end:{line:155,column:22}},type:"binary-expr",locations:[{start:{line:155,column:8},end:{line:155,column:16}},{start:{line:155,column:20},end:{line:155,column:22}}],line:155},"52":{loc:{start:{line:158,column:1},end:{line:164,column:2}},type:"if",locations:[{start:{line:158,column:1},end:{line:164,column:2}},{start:{line:158,column:1},end:{line:164,column:2}}],line:158},"53":{loc:{start:{line:160,column:3},end:{line:162,column:4}},type:"if",locations:[{start:{line:160,column:3},end:{line:162,column:4}},{start:{line:160,column:3},end:{line:162,column:4}}],line:160},"54":{loc:{start:{line:170,column:1},end:{line:172,column:2}},type:"if",locations:[{start:{line:170,column:1},end:{line:172,column:2}},{start:{line:170,column:1},end:{line:172,column:2}}],line:170},"55":{loc:{start:{line:171,column:8},end:{line:171,column:40}},type:"binary-expr",locations:[{start:{line:171,column:8},end:{line:171,column:16}},{start:{line:171,column:20},end:{line:171,column:34}},{start:{line:171,column:38},end:{line:171,column:40}}],line:171},"56":{loc:{start:{line:176,column:1},end:{line:178,column:2}},type:"if",locations:[{start:{line:176,column:1},end:{line:178,column:2}},{start:{line:176,column:1},end:{line:178,column:2}}],line:176},"57":{loc:{start:{line:195,column:1},end:{line:211,column:2}},type:"if",locations:[{start:{line:195,column:1},end:{line:211,column:2}},{start:{line:195,column:1},end:{line:211,column:2}}],line:195},"58":{loc:{start:{line:199,column:10},end:{line:199,column:49}},type:"cond-expr",locations:[{start:{line:199,column:18},end:{line:199,column:44}},{start:{line:199,column:47},end:{line:199,column:49}}],line:199},"59":{loc:{start:{line:202,column:8},end:{line:211,column:2}},type:"if",locations:[{start:{line:202,column:8},end:{line:211,column:2}},{start:{line:202,column:8},end:{line:211,column:2}}],line:202},"60":{loc:{start:{line:204,column:8},end:{line:211,column:2}},type:"if",locations:[{start:{line:204,column:8},end:{line:211,column:2}},{start:{line:204,column:8},end:{line:211,column:2}}],line:204},"61":{loc:{start:{line:206,column:2},end:{line:208,column:3}},type:"if",locations:[{start:{line:206,column:2},end:{line:208,column:3}},{start:{line:206,column:2},end:{line:208,column:3}}],line:206},"62":{loc:{start:{line:206,column:6},end:{line:206,column:45}},type:"binary-expr",locations:[{start:{line:206,column:6},end:{line:206,column:13}},{start:{line:206,column:17},end:{line:206,column:45}}],line:206},"63":{loc:{start:{line:209,column:8},end:{line:211,column:2}},type:"if",locations:[{start:{line:209,column:8},end:{line:211,column:2}},{start:{line:209,column:8},end:{line:211,column:2}}],line:209},"64":{loc:{start:{line:212,column:1},end:{line:214,column:2}},type:"if",locations:[{start:{line:212,column:1},end:{line:214,column:2}},{start:{line:212,column:1},end:{line:214,column:2}}],line:212},"65":{loc:{start:{line:212,column:5},end:{line:212,column:35}},type:"binary-expr",locations:[{start:{line:212,column:5},end:{line:212,column:16}},{start:{line:212,column:20},end:{line:212,column:35}}],line:212},"66":{loc:{start:{line:213,column:8},end:{line:213,column:44}},type:"binary-expr",locations:[{start:{line:213,column:8},end:{line:213,column:38}},{start:{line:213,column:42},end:{line:213,column:44}}],line:213},"67":{loc:{start:{line:216,column:8},end:{line:216,column:17}},type:"binary-expr",locations:[{start:{line:216,column:8},end:{line:216,column:11}},{start:{line:216,column:15},end:{line:216,column:17}}],line:216},"68":{loc:{start:{line:218,column:1},end:{line:220,column:2}},type:"if",locations:[{start:{line:218,column:1},end:{line:220,column:2}},{start:{line:218,column:1},end:{line:220,column:2}}],line:218}},s:{"0":0,"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0,"10":0,"11":0,"12":0,"13":0,"14":0,"15":0,"16":0,"17":0,"18":0,"19":0,"20":0,"21":0,"22":0,"23":0,"24":0,"25":0,"26":0,"27":0,"28":0,"29":0,"30":0,"31":0,"32":0,"33":0,"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0,"41":0,"42":0,"43":0,"44":0,"45":0,"46":0,"47":0,"48":0,"49":0,"50":0,"51":0,"52":0,"53":0,"54":0,"55":0,"56":0,"57":0,"58":0,"59":0,"60":0,"61":0,"62":0,"63":0,"64":0,"65":0,"66":0,"67":0,"68":0,"69":0,"70":0,"71":0,"72":0,"73":0,"74":0,"75":0,"76":0,"77":0,"78":0,"79":0,"80":0,"81":0,"82":0,"83":0,"84":0,"85":0,"86":0,"87":0,"88":0,"89":0,"90":0,"91":0,"92":0,"93":0,"94":0,"95":0,"96":0,"97":0,"98":0,"99":0,"100":0,"101":0,"102":0,"103":0,"104":0,"105":0,"106":0,"107":0,"108":0,"109":0,"110":0,"111":0,"112":0,"113":0,"114":0,"115":0,"116":0,"117":0,"118":0,"119":0,"120":0,"121":0,"122":0,"123":0,"124":0,"125":0,"126":0},f:{"0":0,"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0},b:{"0":[0,0],"1":[0,0],"2":[0,0],"3":[0,0],"4":[0,0],"5":[0,0],"6":[0,0],"7":[0,0],"8":[0,0],"9":[0,0],"10":[0,0],"11":[0,0],"12":[0,0],"13":[0,0],"14":[0,0],"15":[0,0],"16":[0,0],"17":[0,0],"18":[0,0],"19":[0,0],"20":[0,0],"21":[0,0],"22":[0,0],"23":[0,0],"24":[0,0],"25":[0,0],"26":[0,0],"27":[0,0],"28":[0,0,0],"29":[0,0],"30":[0,0],"31":[0,0],"32":[0,0,0],"33":[0,0],"34":[0,0],"35":[0,0],"36":[0,0,0],"37":[0,0],"38":[0,0],"39":[0,0],"40":[0,0],"41":[0,0],"42":[0,0],"43":[0,0],"44":[0,0],"45":[0,0],"46":[0,0],"47":[0,0],"48":[0,0,0,0,0],"49":[0,0],"50":[0,0],"51":[0,0],"52":[0,0],"53":[0,0],"54":[0,0],"55":[0,0,0],"56":[0,0],"57":[0,0],"58":[0,0],"59":[0,0],"60":[0,0],"61":[0,0],"62":[0,0],"63":[0,0],"64":[0,0],"65":[0,0],"66":[0,0],"67":[0,0],"68":[0,0]},_coverageSchema:"1a1c01bbd47fc00a2c39e90264f33305004495a9",hash:"33fb1e8c5c5d4b85b7cbe0185f2673ac454be0c8"};var coverage=global[gcv]||(global[gcv]={});if(!coverage[path]||coverage[path].hash!==hash){coverage[path]=coverageData;}var actualCoverage=coverage[path];{// @ts-ignore
cov_22i8nvh4cs=function(){return actualCoverage;};}return actualCoverage;}cov_22i8nvh4cs();const constants=(cov_22i8nvh4cs().s[0]++,require('./constants.js'));const atree=(cov_22i8nvh4cs().s[1]++,require('./atree.js'));const query=(cov_22i8nvh4cs().s[2]++,require('./query.js'));cov_22i8nvh4cs().s[3]++;const addSpaces=function(text,el,pseudoSelector){cov_22i8nvh4cs().f[0]++;// https://github.com/w3c/accname/issues/3
const styles=(cov_22i8nvh4cs().s[4]++,window.getComputedStyle(el,pseudoSelector));const inline=(cov_22i8nvh4cs().s[5]++,styles.display==='inline');cov_22i8nvh4cs().s[6]++;return inline?(cov_22i8nvh4cs().b[0][0]++,text):(cov_22i8nvh4cs().b[0][1]++,` ${text} `);};cov_22i8nvh4cs().s[7]++;const getPseudoContent=function(el,pseudoSelector){cov_22i8nvh4cs().f[1]++;const styles=(cov_22i8nvh4cs().s[8]++,window.getComputedStyle(el,pseudoSelector));let tail=(cov_22i8nvh4cs().s[9]++,styles.getPropertyValue('content').trim());let ret=(cov_22i8nvh4cs().s[10]++,[]);let match;cov_22i8nvh4cs().s[11]++;while(tail.length){cov_22i8nvh4cs().s[12]++;if(match=tail.match(/^"([^"]*)"/)){cov_22i8nvh4cs().b[1][0]++;cov_22i8nvh4cs().s[13]++;ret.push(match[1]);}else{cov_22i8nvh4cs().b[1][1]++;cov_22i8nvh4cs().s[14]++;if(match=tail.match(/^([a-z-]+)\(([^)]*)\)/)){cov_22i8nvh4cs().b[2][0]++;cov_22i8nvh4cs().s[15]++;if(match[1]==='attr'){cov_22i8nvh4cs().b[3][0]++;cov_22i8nvh4cs().s[16]++;ret.push((cov_22i8nvh4cs().b[4][0]++,el.getAttribute(match[2]))||(cov_22i8nvh4cs().b[4][1]++,''));}else{cov_22i8nvh4cs().b[3][1]++;}}else{cov_22i8nvh4cs().b[2][1]++;cov_22i8nvh4cs().s[17]++;if(match=tail.match(/^([a-z-]+)/)){cov_22i8nvh4cs().b[5][0]++;cov_22i8nvh4cs().s[18]++;if((cov_22i8nvh4cs().b[7][0]++,match[1]==='open-quote')||(cov_22i8nvh4cs().b[7][1]++,match[1]==='close-quote')){cov_22i8nvh4cs().b[6][0]++;cov_22i8nvh4cs().s[19]++;ret.push('"');}else{cov_22i8nvh4cs().b[6][1]++;}}else{cov_22i8nvh4cs().b[5][1]++;cov_22i8nvh4cs().s[20]++;if(match=tail.match(/^\//)){cov_22i8nvh4cs().b[8][0]++;cov_22i8nvh4cs().s[21]++;ret=[];}else{cov_22i8nvh4cs().b[8][1]++;cov_22i8nvh4cs().s[22]++;// invalid content, ignore
return'';}}}}cov_22i8nvh4cs().s[23]++;tail=tail.slice(match[0].length).trim();}cov_22i8nvh4cs().s[24]++;return addSpaces(ret.join(''),el,pseudoSelector);};cov_22i8nvh4cs().s[25]++;const getContent=function(root,ongoingLabelledBy,visited){cov_22i8nvh4cs().f[2]++;const children=(cov_22i8nvh4cs().s[26]++,atree.getChildNodes(root));let ret=(cov_22i8nvh4cs().s[27]++,'');cov_22i8nvh4cs().s[28]++;for(let i=(cov_22i8nvh4cs().s[29]++,0);i<children.length;i++){const node=(cov_22i8nvh4cs().s[30]++,children[i]);cov_22i8nvh4cs().s[31]++;if(node.nodeType===node.TEXT_NODE){cov_22i8nvh4cs().b[9][0]++;cov_22i8nvh4cs().s[32]++;ret+=node.textContent;}else{cov_22i8nvh4cs().b[9][1]++;cov_22i8nvh4cs().s[33]++;if(node.nodeType===node.ELEMENT_NODE){cov_22i8nvh4cs().b[10][0]++;cov_22i8nvh4cs().s[34]++;if(node.tagName.toLowerCase()==='br'){cov_22i8nvh4cs().b[11][0]++;cov_22i8nvh4cs().s[35]++;ret+='\n';}else{cov_22i8nvh4cs().b[11][1]++;cov_22i8nvh4cs().s[36]++;ret+=getName(node,true,ongoingLabelledBy,visited);}}else{cov_22i8nvh4cs().b[10][1]++;}}}cov_22i8nvh4cs().s[37]++;return ret;};cov_22i8nvh4cs().s[38]++;const allowNameFromContent=function(el){cov_22i8nvh4cs().f[3]++;const role=(cov_22i8nvh4cs().s[39]++,query.getRole(el));cov_22i8nvh4cs().s[40]++;if(role){cov_22i8nvh4cs().b[12][0]++;cov_22i8nvh4cs().s[41]++;return constants.roles[role].nameFromContents;}else{cov_22i8nvh4cs().b[12][1]++;}};cov_22i8nvh4cs().s[42]++;const getName=function(el,recursive,ongoingLabelledBy,visited,directReference){cov_22i8nvh4cs().f[4]++;let ret=(cov_22i8nvh4cs().s[43]++,'');cov_22i8nvh4cs().s[44]++;visited=(cov_22i8nvh4cs().b[13][0]++,visited)||(cov_22i8nvh4cs().b[13][1]++,[]);cov_22i8nvh4cs().s[45]++;if(visited.includes(el)){cov_22i8nvh4cs().b[14][0]++;cov_22i8nvh4cs().s[46]++;if(!directReference){cov_22i8nvh4cs().b[15][0]++;cov_22i8nvh4cs().s[47]++;return'';}else{cov_22i8nvh4cs().b[15][1]++;}}else{cov_22i8nvh4cs().b[14][1]++;cov_22i8nvh4cs().s[48]++;visited.push(el);}// A
// handled in atree
// B
cov_22i8nvh4cs().s[49]++;if((cov_22i8nvh4cs().b[17][0]++,!ongoingLabelledBy)&&(cov_22i8nvh4cs().b[17][1]++,el.matches('[aria-labelledby]'))){cov_22i8nvh4cs().b[16][0]++;const ids=(cov_22i8nvh4cs().s[50]++,el.getAttribute('aria-labelledby').split(/\s+/));const strings=(cov_22i8nvh4cs().s[51]++,ids.map(id=>{cov_22i8nvh4cs().f[5]++;const label=(cov_22i8nvh4cs().s[52]++,document.getElementById(id));cov_22i8nvh4cs().s[53]++;return label?(cov_22i8nvh4cs().b[18][0]++,getName(label,true,true,visited,true)):(cov_22i8nvh4cs().b[18][1]++,'');}));cov_22i8nvh4cs().s[54]++;ret=strings.join(' ');}else{cov_22i8nvh4cs().b[16][1]++;}// E (the current draft has this at this high priority)
cov_22i8nvh4cs().s[55]++;if((cov_22i8nvh4cs().b[20][0]++,!ret.trim())&&(cov_22i8nvh4cs().b[20][1]++,recursive)){cov_22i8nvh4cs().b[19][0]++;cov_22i8nvh4cs().s[56]++;if(query.matches(el,'textbox')){cov_22i8nvh4cs().b[21][0]++;cov_22i8nvh4cs().s[57]++;ret=(cov_22i8nvh4cs().b[22][0]++,el.value)||(cov_22i8nvh4cs().b[22][1]++,el.textContent);}else{cov_22i8nvh4cs().b[21][1]++;cov_22i8nvh4cs().s[58]++;if(query.matches(el,'combobox,listbox')){cov_22i8nvh4cs().b[23][0]++;const selected=(cov_22i8nvh4cs().s[59]++,(cov_22i8nvh4cs().b[24][0]++,query.querySelector(el,':selected'))||(cov_22i8nvh4cs().b[24][1]++,query.querySelector(el,'option')));cov_22i8nvh4cs().s[60]++;if(selected){cov_22i8nvh4cs().b[25][0]++;cov_22i8nvh4cs().s[61]++;ret=getName(selected,recursive,ongoingLabelledBy,visited);}else{cov_22i8nvh4cs().b[25][1]++;cov_22i8nvh4cs().s[62]++;ret=(cov_22i8nvh4cs().b[26][0]++,el.value)||(cov_22i8nvh4cs().b[26][1]++,'');}}else{cov_22i8nvh4cs().b[23][1]++;cov_22i8nvh4cs().s[63]++;if(query.matches(el,'range')){cov_22i8nvh4cs().b[27][0]++;cov_22i8nvh4cs().s[64]++;ret=''+((cov_22i8nvh4cs().b[28][0]++,query.getAttribute(el,'valuetext'))||(cov_22i8nvh4cs().b[28][1]++,query.getAttribute(el,'valuenow'))||(cov_22i8nvh4cs().b[28][2]++,el.value));}else{cov_22i8nvh4cs().b[27][1]++;}}}}else{cov_22i8nvh4cs().b[19][1]++;}// C
cov_22i8nvh4cs().s[65]++;if((cov_22i8nvh4cs().b[30][0]++,!ret.trim())&&(cov_22i8nvh4cs().b[30][1]++,el.matches('[aria-label]'))){cov_22i8nvh4cs().b[29][0]++;cov_22i8nvh4cs().s[66]++;// FIXME: may skip to 2E
ret=el.getAttribute('aria-label');}else{cov_22i8nvh4cs().b[29][1]++;}// D
cov_22i8nvh4cs().s[67]++;if((cov_22i8nvh4cs().b[32][0]++,!ret.trim())&&(cov_22i8nvh4cs().b[32][1]++,!recursive)&&(cov_22i8nvh4cs().b[32][2]++,el.labels)){cov_22i8nvh4cs().b[31][0]++;const strings=(cov_22i8nvh4cs().s[68]++,Array.prototype.map.call(el.labels,label=>{cov_22i8nvh4cs().f[6]++;cov_22i8nvh4cs().s[69]++;return getName(label,true,ongoingLabelledBy,visited);}));cov_22i8nvh4cs().s[70]++;ret=strings.join(' ');}else{cov_22i8nvh4cs().b[31][1]++;}cov_22i8nvh4cs().s[71]++;if(!ret.trim()){cov_22i8nvh4cs().b[33][0]++;cov_22i8nvh4cs().s[72]++;ret=(cov_22i8nvh4cs().b[34][0]++,el.alt)||(cov_22i8nvh4cs().b[34][1]++,'');}else{cov_22i8nvh4cs().b[33][1]++;}cov_22i8nvh4cs().s[73]++;if((cov_22i8nvh4cs().b[36][0]++,!ret.trim())&&(cov_22i8nvh4cs().b[36][1]++,el.matches('abbr,acronym'))&&(cov_22i8nvh4cs().b[36][2]++,el.title)){cov_22i8nvh4cs().b[35][0]++;cov_22i8nvh4cs().s[74]++;ret=el.title;}else{cov_22i8nvh4cs().b[35][1]++;}cov_22i8nvh4cs().s[75]++;if(!ret.trim()){cov_22i8nvh4cs().b[37][0]++;cov_22i8nvh4cs().s[76]++;for(const selector in constants.nameFromDescendant){cov_22i8nvh4cs().s[77]++;if(el.matches(selector)){cov_22i8nvh4cs().b[38][0]++;const descendant=(cov_22i8nvh4cs().s[78]++,el.querySelector(constants.nameFromDescendant[selector]));cov_22i8nvh4cs().s[79]++;if(descendant){cov_22i8nvh4cs().b[39][0]++;cov_22i8nvh4cs().s[80]++;ret=getName(descendant,true,ongoingLabelledBy,visited);}else{cov_22i8nvh4cs().b[39][1]++;}}else{cov_22i8nvh4cs().b[38][1]++;}}}else{cov_22i8nvh4cs().b[37][1]++;}cov_22i8nvh4cs().s[81]++;if((cov_22i8nvh4cs().b[41][0]++,!ret.trim())&&(cov_22i8nvh4cs().b[41][1]++,el.matches('svg *'))){cov_22i8nvh4cs().b[40][0]++;const svgTitle=(cov_22i8nvh4cs().s[82]++,el.querySelector('title'));cov_22i8nvh4cs().s[83]++;if((cov_22i8nvh4cs().b[43][0]++,svgTitle)&&(cov_22i8nvh4cs().b[43][1]++,svgTitle.parentElement===el)){cov_22i8nvh4cs().b[42][0]++;cov_22i8nvh4cs().s[84]++;ret=svgTitle.textContent;}else{cov_22i8nvh4cs().b[42][1]++;}}else{cov_22i8nvh4cs().b[40][1]++;}cov_22i8nvh4cs().s[85]++;if((cov_22i8nvh4cs().b[45][0]++,!ret.trim())&&(cov_22i8nvh4cs().b[45][1]++,el.matches('a'))){cov_22i8nvh4cs().b[44][0]++;cov_22i8nvh4cs().s[86]++;ret=(cov_22i8nvh4cs().b[46][0]++,el.getAttribute('xlink:title'))||(cov_22i8nvh4cs().b[46][1]++,'');}else{cov_22i8nvh4cs().b[44][1]++;}// F
// FIXME: menu is not mentioned in the spec
cov_22i8nvh4cs().s[87]++;if((cov_22i8nvh4cs().b[48][0]++,!ret.trim())&&((cov_22i8nvh4cs().b[48][1]++,recursive)||(cov_22i8nvh4cs().b[48][2]++,allowNameFromContent(el))||(cov_22i8nvh4cs().b[48][3]++,el.closest('label')))&&(cov_22i8nvh4cs().b[48][4]++,!query.matches(el,'menu'))){cov_22i8nvh4cs().b[47][0]++;cov_22i8nvh4cs().s[88]++;ret=getContent(el,ongoingLabelledBy,visited);}else{cov_22i8nvh4cs().b[47][1]++;}cov_22i8nvh4cs().s[89]++;if((cov_22i8nvh4cs().b[50][0]++,!ret.trim())&&(cov_22i8nvh4cs().b[50][1]++,query.matches(el,'button'))){cov_22i8nvh4cs().b[49][0]++;cov_22i8nvh4cs().s[90]++;ret=(cov_22i8nvh4cs().b[51][0]++,el.value)||(cov_22i8nvh4cs().b[51][1]++,'');}else{cov_22i8nvh4cs().b[49][1]++;}cov_22i8nvh4cs().s[91]++;if(!ret.trim()){cov_22i8nvh4cs().b[52][0]++;cov_22i8nvh4cs().s[92]++;for(const selector in constants.nameDefaults){cov_22i8nvh4cs().s[93]++;if(el.matches(selector)){cov_22i8nvh4cs().b[53][0]++;cov_22i8nvh4cs().s[94]++;ret=constants.nameDefaults[selector];}else{cov_22i8nvh4cs().b[53][1]++;}}}else{cov_22i8nvh4cs().b[52][1]++;}// G/H
// handled in getContent
// I
cov_22i8nvh4cs().s[95]++;if(!ret.trim()){cov_22i8nvh4cs().b[54][0]++;cov_22i8nvh4cs().s[96]++;ret=(cov_22i8nvh4cs().b[55][0]++,el.title)||(cov_22i8nvh4cs().b[55][1]++,el.placeholder)||(cov_22i8nvh4cs().b[55][2]++,'');}else{cov_22i8nvh4cs().b[54][1]++;}// FIXME: not exactly sure about this, but it reduces the number of failing
// WPT tests. Whitespace is hard.
cov_22i8nvh4cs().s[97]++;if(!ret.trim()){cov_22i8nvh4cs().b[56][0]++;cov_22i8nvh4cs().s[98]++;ret=' ';}else{cov_22i8nvh4cs().b[56][1]++;}const before=(cov_22i8nvh4cs().s[99]++,getPseudoContent(el,':before'));const after=(cov_22i8nvh4cs().s[100]++,getPseudoContent(el,':after'));cov_22i8nvh4cs().s[101]++;return addSpaces(before+ret+after,el);};cov_22i8nvh4cs().s[102]++;const getNameTrimmed=function(el){cov_22i8nvh4cs().f[7]++;cov_22i8nvh4cs().s[103]++;return getName(el).replace(/[ \n\r\t\f]+/g,' ').replace(/^ /,'').replace(/ $/,'');};cov_22i8nvh4cs().s[104]++;const getDescription=function(el){cov_22i8nvh4cs().f[8]++;let ret=(cov_22i8nvh4cs().s[105]++,'');cov_22i8nvh4cs().s[106]++;if(el.matches('[aria-describedby]')){cov_22i8nvh4cs().b[57][0]++;const ids=(cov_22i8nvh4cs().s[107]++,el.getAttribute('aria-describedby').split(/\s+/));const strings=(cov_22i8nvh4cs().s[108]++,ids.map(id=>{cov_22i8nvh4cs().f[9]++;const label=(cov_22i8nvh4cs().s[109]++,document.getElementById(id));cov_22i8nvh4cs().s[110]++;return label?(cov_22i8nvh4cs().b[58][0]++,getName(label,true,true)):(cov_22i8nvh4cs().b[58][1]++,'');}));cov_22i8nvh4cs().s[111]++;ret=strings.join(' ');}else{cov_22i8nvh4cs().b[57][1]++;cov_22i8nvh4cs().s[112]++;if(el.matches('[aria-description]')){cov_22i8nvh4cs().b[59][0]++;cov_22i8nvh4cs().s[113]++;ret=el.getAttribute('aria-description');}else{cov_22i8nvh4cs().b[59][1]++;cov_22i8nvh4cs().s[114]++;if(el.matches('svg *')){cov_22i8nvh4cs().b[60][0]++;const svgDesc=(cov_22i8nvh4cs().s[115]++,el.querySelector('desc'));cov_22i8nvh4cs().s[116]++;if((cov_22i8nvh4cs().b[62][0]++,svgDesc)&&(cov_22i8nvh4cs().b[62][1]++,svgDesc.parentElement===el)){cov_22i8nvh4cs().b[61][0]++;cov_22i8nvh4cs().s[117]++;ret=svgDesc.textContent;}else{cov_22i8nvh4cs().b[61][1]++;}}else{cov_22i8nvh4cs().b[60][1]++;cov_22i8nvh4cs().s[118]++;if(el.title){cov_22i8nvh4cs().b[63][0]++;cov_22i8nvh4cs().s[119]++;ret=el.title;}else{cov_22i8nvh4cs().b[63][1]++;}}}}cov_22i8nvh4cs().s[120]++;if((cov_22i8nvh4cs().b[65][0]++,!ret.trim())&&(cov_22i8nvh4cs().b[65][1]++,el.matches('a'))){cov_22i8nvh4cs().b[64][0]++;cov_22i8nvh4cs().s[121]++;ret=(cov_22i8nvh4cs().b[66][0]++,el.getAttribute('xlink:title'))||(cov_22i8nvh4cs().b[66][1]++,'');}else{cov_22i8nvh4cs().b[64][1]++;}cov_22i8nvh4cs().s[122]++;ret=((cov_22i8nvh4cs().b[67][0]++,ret)||(cov_22i8nvh4cs().b[67][1]++,'')).trim().replace(/\s+/g,' ');cov_22i8nvh4cs().s[123]++;if(ret===getNameTrimmed(el)){cov_22i8nvh4cs().b[68][0]++;cov_22i8nvh4cs().s[124]++;ret='';}else{cov_22i8nvh4cs().b[68][1]++;}cov_22i8nvh4cs().s[125]++;return ret;};cov_22i8nvh4cs().s[126]++;module.exports={getName:getNameTrimmed,getDescription:getDescription};


},{"./atree.js":5,"./constants.js":7,"./query.js":9}],9:[function(require,module,exports){
const attrs = require('./attrs.js');
const atree = require('./atree.js');


const matches = function(el, selector) {
	if (selector.substr(0, 1) === ':') {
		const attr = selector.substr(1);
		return attrs.getAttribute(el, attr);
	} else if (selector.substr(0, 1) === '[') {
		const match = /\[([a-z]+)="(.*)"\]/.exec(selector);
		const actual = attrs.getAttribute(el, match[1]);
		const rawValue = match[2];
		return actual.toString() === rawValue;
	} else {
		return attrs.hasRole(el, selector.split(','));
	}
};

const _querySelector = function(all) {
	return function(root, selector) {
		const results = [];
		try {
			atree.walk(root, node => {
				if (node.nodeType === node.ELEMENT_NODE) {
					// FIXME: skip hidden elements
					if (matches(node, selector)) {
						results.push(node);
						if (!all) {
							throw 'StopIteration';
						}
					}
				}
			});
		} catch (e) {
			if (e !== 'StopIteration') {
				throw e;
			}
		}
		return all ? results : results[0];
	};
};

const closest = function(el, selector) {
	return atree.searchUp(el, candidate => {
		if (candidate.nodeType === candidate.ELEMENT_NODE) {
			return matches(candidate, selector);
		}
	});
};

module.exports = {
	getRole: el => attrs.getRole(el),
	getAttribute: attrs.getAttribute,
	matches: matches,
	querySelector: _querySelector(),
	querySelectorAll: _querySelector(true),
	closest: closest,
};

},{"./atree.js":5,"./attrs.js":6}],10:[function(require,module,exports){
/*@license
CalcNames: The AccName Computation Prototype, compute the Name and Description property values for a DOM node
Returns an object with 'name' and 'desc' properties.
Functionality mirrors the steps within the W3C Accessible Name and Description computation algorithm.
https://w3c.github.io/accname/
Author: Bryan Garaventa
https://github.com/whatsock/w3c-alternative-text-computation
Distributed under the terms of the Open Source Initiative OSI - MIT License
*/

(function () {
  var nameSpace = window.AccNamePrototypeNameSpace || window;
  if (nameSpace && typeof nameSpace === "string" && nameSpace.length) {
    window[nameSpace] = {};
    nameSpace = window[nameSpace];
  }
  nameSpace.getAccNameVersion = "2.62";
  // AccName Computation Prototype
  nameSpace.getAccName = nameSpace.calcNames = function (
    node,
    fnc,
    preventVisualARIASelfCSSRef,
    overrides,
  ) {
    overrides = overrides || {};
    var docO = overrides.document || document;
    var props = { name: "", desc: "", error: "" };
    var nameFromPlaceholder = false;
    var nameFromUserAgent = false;
    try {
      if (!node || node.nodeType !== 1) {
        return props;
      }
      var rootNode = node;
      var rootRole = trim(node.getAttribute("role") || "");
      // Track nodes to prevent duplicate node reference parsing.
      // Separating Name and Description to prevent duplicate node references from suppressing one or the other from being fully computed.
      var nodes = {
        name: [],
        desc: [],
      };
      // Track aria-owns references to prevent duplicate parsing.
      var owns = [];

      // Recursively process a DOM node to compute an accessible name in accordance with the spec
      var walk = function (
        refNode,
        stop,
        skip,
        nodesToIgnoreValues,
        skipAbort,
        ownedBy,
        skipTo,
      ) {
        skipTo = skipTo || {};
        skipTo.tag = skipTo.tag || false;
        skipTo.role = skipTo.role || false;
        skipTo.go = skipTo.go || false;
        var fullResult = {
          name: "",
          title: "",
        };
        var hasLabel = false;

        /*
  ARIA Role Exception Rule Set 1.1
  The following Role Exception Rule Set is based on the following ARIA Working Group discussion involving all relevant browser venders.
  https://lists.w3.org/Archives/Public/public-aria/2017Jun/0057.html
Plus roles extended for the Role Parity project.
  */
        var isException = function (node, refNode) {
          if (
            !refNode ||
            !node ||
            refNode.nodeType !== 1 ||
            node.nodeType !== 1
          ) {
            return false;
          }

          var role = getRole(node);
          var tag = node.nodeName.toLowerCase();

          var inList = function (node, list) {
            return (
              (role && list.roles.indexOf(role) >= 0) ||
              (!role && list.tags.indexOf(tag) >= 0)
            );
          };

          // The list3 overrides must be checked first.
          if (inList(node, list3)) {
            if (
              node === refNode &&
              !(node.id && ownedBy[node.id] && ownedBy[node.id].node)
            ) {
              return !isFocusable(node);
            } else {
              // Note: the inParent checker needs to be present to allow for embedded roles matching list3 when the referenced parent is referenced using aria-labelledby, aria-describedby, or aria-owns.
              return !(
                (inParent(node, ownedBy.top) &&
                  node.nodeName.toLowerCase() !== "select") ||
                inList(refNode, list1)
              );
            }
          }
          // Otherwise process list2 to identify roles to ignore processing name from content.
          else {
            return !!(
              (inList(node, list2) ||
                (node === rootNode && !inList(node, list1))) &&
              !(
                !role &&
                ["section"].indexOf(tag) !== -1 &&
                !(
                  node.getAttribute("aria-labelledby") ||
                  node.getAttribute("aria-label")
                )
              ) &&
              !skipTo.go
            );
          }
        };

        var inParent = function (node, parent) {
          var trackNodes = [];
          while (node) {
            if (
              node.id &&
              ownedBy[node.id] &&
              ownedBy[node.id].node &&
              trackNodes.indexOf(node) === -1
            ) {
              trackNodes.push(node);
              node = ownedBy[node.id].node;
            } else {
              node = node.parentNode;
            }
            if (node && node === parent) {
              return true;
            } else if (!node || node === ownedBy.top || node === docO.body) {
              return false;
            }
          }
          return false;
        };

        // Placeholder for storing CSS before and after pseudo element text values for the top level node
        var cssOP = {
          before: "",
          after: "",
        };

        if (
          !skipTo.tag &&
          !skipTo.role &&
          nodes[!ownedBy.computingDesc ? "name" : "desc"].indexOf(refNode) ===
            -1
        ) {
          // Store the before and after pseudo element 'content' values for the top level DOM node
          // Note: If the pseudo element includes block level styling, a space will be added, otherwise inline is asumed and no spacing is added.
          cssOP = getCSSText(refNode, null);

          // Enabled in Visual ARIA to prevent self referencing by Visual ARIA tooltips
          if (preventVisualARIASelfCSSRef) {
            if (
              cssOP.before.indexOf(" [ARIA] ") !== -1 ||
              cssOP.before.indexOf(" aria-") !== -1 ||
              cssOP.before.indexOf(" accName: ") !== -1
            )
              cssOP.before = "";
            if (
              cssOP.after.indexOf(" [ARIA] ") !== -1 ||
              cssOP.after.indexOf(" aria-") !== -1 ||
              cssOP.after.indexOf(" accDescription: ") !== -1
            )
              cssOP.after = "";
          }
        }

        // Recursively apply the same naming computation to all nodes within the referenced structure
        var walkDOM = function (node, fn, refNode) {
          var res = {
            name: "",
            title: "",
          };
          if (!node) {
            return res;
          }
          var nodeIsBlock = !!(
            node &&
            node.nodeType === 1 &&
            isBlockLevelElement(node)
          );
          var currentNode = node;
          var fResult = fn(node) || {};
          if (fResult.name && fResult.name.length) {
            res.name += fResult.name;
          }
          if (!fResult.skip && !isException(node, ownedBy.top)) {
            if (skipTo.go) skipTo.go = false;
            node = node.firstChild;
            while (node) {
              res.name += walkDOM(node, fn, refNode).name;
              node = node.nextSibling;
            }
          }
          res.name += fResult.owns || "";
          if (
            rootNode === currentNode &&
            refNode === currentNode &&
            !trim(res.name) &&
            trim(fResult.title)
          ) {
            res.name = addSpacing(fResult.title);
          } else if (
            rootNode === currentNode &&
            refNode === currentNode &&
            trim(fResult.title)
          ) {
            res.title = addSpacing(fResult.title);
          }
          if (
            rootNode === currentNode &&
            refNode === currentNode &&
            trim(fResult.desc)
          ) {
            res.title = addSpacing(fResult.desc);
          }
          if (
            rootNode === currentNode &&
            refNode === currentNode &&
            trim(fResult.placeholder) &&
            !trim(res.name)
          ) {
            res.name = addSpacing(fResult.placeholder);
            nameFromPlaceholder = true;
          } else if (
            rootNode === currentNode &&
            refNode === currentNode &&
            trim(fResult.placeholder) &&
            !trim(res.title)
          ) {
            res.title = addSpacing(fResult.placeholder);
          }
          if (nodeIsBlock || fResult.isWidget) {
            res.name = addSpacing(res.name);
          }
          return res;
        };

        fullResult = walkDOM(
          refNode,
          function (node) {
            var i = 0;
            var element = null;
            var ids = [];
            var parts = [];
            var result = {
              name: "",
              title: "",
              owns: "",
              skip: false,
            };
            var isEmbeddedNode = !!(
              node &&
              node.nodeType === 1 &&
              nodesToIgnoreValues &&
              nodesToIgnoreValues.length &&
              nodesToIgnoreValues.indexOf(node) !== -1 &&
              node === rootNode &&
              node !== refNode
            );
            var hLabel = false;

            if (
              (skip || !node || isHidden(node, ownedBy.top)) &&
              !skipAbort &&
              !isEmbeddedNode
            ) {
              // Abort if algorithm step is already completed, or if node is a hidden child of refNode, or skip abort if aria-labelledby self references same node.
              return result;
            }

            if (
              !skipTo.tag &&
              !skipTo.role &&
              nodes[!ownedBy.computingDesc ? "name" : "desc"].indexOf(node) ===
                -1
            ) {
              nodes[!ownedBy.computingDesc ? "name" : "desc"].push(node);
            } else {
              // Abort if this node has already been processed.
              return result;
            }

            // Store name for the current node.
            var name = "";
            // Store name from aria-owns references if detected.
            var ariaO = "";
            // Placeholder for storing CSS before and after pseudo element text values for the current node container element
            var cssO = {
              before: "",
              after: "",
            };

            var parent = refNode === node ? node : node.parentNode;
            if (
              !skipTo.tag &&
              !skipTo.role &&
              nodes[!ownedBy.computingDesc ? "name" : "desc"].indexOf(
                parent,
              ) === -1
            ) {
              nodes[!ownedBy.computingDesc ? "name" : "desc"].push(parent);
              // Store the before and after pseudo element 'content' values for the current node container element
              // Note: If the pseudo element includes block level styling, a space will be added, otherwise inline is asumed and no spacing is added.
              cssO = getCSSText(parent, refNode);

              // Enabled in Visual ARIA to prevent self referencing by Visual ARIA tooltips
              if (preventVisualARIASelfCSSRef) {
                if (
                  cssO.before.indexOf(" [ARIA] ") !== -1 ||
                  cssO.before.indexOf(" aria-") !== -1 ||
                  cssO.before.indexOf(" accName: ") !== -1
                )
                  cssO.before = "";
                if (
                  cssO.after.indexOf(" [ARIA] ") !== -1 ||
                  cssO.after.indexOf(" aria-") !== -1 ||
                  cssO.after.indexOf(" accDescription: ") !== -1
                )
                  cssO.after = "";
              }
            }

            // Process standard DOM element node
            if (node.nodeType === 1) {
              var nTag = node.nodeName.toLowerCase();
              var nRole = getRole(node);
              var aLabelledby =
                (!skipTo.tag &&
                  !skipTo.role &&
                  node.getAttribute("aria-labelledby")) ||
                "";
              var aDescribedby =
                (!skipTo.tag &&
                  !skipTo.role &&
                  node.getAttribute("aria-describedby")) ||
                "";
              var aDescription =
                !skipTo.tag &&
                !skipTo.role &&
                node.getAttribute("aria-description");
              var aLabel =
                (!skipTo.tag &&
                  !skipTo.role &&
                  node.getAttribute("aria-label")) ||
                "";
              var nTitle =
                (!skipTo.tag && !skipTo.role && node.getAttribute("title")) ||
                "";

              // Added to prevent name on generic elements.
              // https://www.w3.org/TR/wai-aria-1.2/#generic
              var isGeneric =
                node === rootNode &&
                !nRole &&
                genericElements.indexOf(nTag) !== -1;
              if (isGeneric) {
                // Abort since an implicitly generic rootNode cannot have a name
                return result;
              }

              // Added to prevent name on roles that do not support a name.
              // https://www.w3.org/TR/wai-aria-1.2/#namefromprohibited
              var isProhibited =
                node === rootNode &&
                (nameProhibitedRoles.indexOf(nRole) !== -1 ||
                  (!nRole && nameProhibitedElements.indexOf(nTag) !== -1));
              if (isProhibited) {
                return result;
              }

              var isNativeFormField = nativeFormFields.indexOf(nTag) !== -1;
              var isNativeButton = ["input"].indexOf(nTag) !== -1;
              var isRangeWidgetRole = rangeWidgetRoles.indexOf(nRole) !== -1;
              var isEditWidgetRole = editWidgetRoles.indexOf(nRole) !== -1;
              var isSelectWidgetRole = selectWidgetRoles.indexOf(nRole) !== -1;
              var isSimulatedFormField =
                isRangeWidgetRole ||
                isEditWidgetRole ||
                isSelectWidgetRole ||
                nRole === "combobox";
              var isWidgetRole =
                (isSimulatedFormField ||
                  otherWidgetRoles.indexOf(nRole) !== -1) &&
                nRole !== "link";
              result.isWidget = isNativeFormField || isWidgetRole;

              var hasName = false;
              var hasDesc = false;
              var aOwns = node.getAttribute("aria-owns") || "";
              var isSeparatChildFormField = !!(
                !skipTo.tag &&
                !skipTo.role &&
                !isEmbeddedNode &&
                ((node !== refNode &&
                  (isNativeFormField || isSimulatedFormField)) ||
                  (node.id &&
                    ownedBy[node.id] &&
                    ownedBy[node.id].target &&
                    ownedBy[node.id].target === node))
              );

              // Check for non-empty value of aria-labelledby on current node, follow each ID ref, then stop and process no deeper.
              if (!stop && !skipTo.tag && !skipTo.role && aLabelledby) {
                ids = aLabelledby.split(/\s+/);
                parts = [];
                for (i = 0; i < ids.length; i++) {
                  element = docO.getElementById(ids[i]);
                  // Also prevent the current form field from having its value included in the naming computation if nested as a child of label
                  parts.push(
                    walk(element, true, skip, [node], element === refNode, {
                      ref: ownedBy,
                      top: element,
                    }).name,
                  );
                }
                // Check for blank value, since whitespace chars alone are not valid as a name
                name = trim(parts.join(" "));

                if (trim(name)) {
                  hasName = true;
                  hLabel = true;
                  hasLabel = true;
                  // Abort further recursion if name is valid.
                  result.skip = true;
                }
              }

              // Check for non-empty value of aria-describedby/description if current node equals reference node, follow each ID ref, then stop and process no deeper.
              if (
                !stop &&
                node === refNode &&
                !skipTo.tag &&
                !skipTo.role &&
                (aDescribedby || aDescription)
              ) {
                if (aDescribedby) {
                  var desc;
                  ids = aDescribedby.split(/\s+/);
                  parts = [];
                  for (i = 0; i < ids.length; i++) {
                    element = docO.getElementById(ids[i]);
                    // Also prevent the current form field from having its value included in the naming computation if nested as a child of label
                    parts.push(
                      walk(element, true, false, [node], false, {
                        ref: ownedBy,
                        top: element,
                        computingDesc: true,
                      }).name,
                    );
                  }
                  // Check for blank value, since whitespace chars alone are not valid as a name
                  desc = trim(parts.join(" "));
                } else {
                  desc = trim(aDescription);
                }
                if (trim(desc)) {
                  result.desc = desc;
                  hasDesc = true;
                }
              }

              // Otherwise, if current node has a non-empty aria-label then set as name and process no deeper within the branch.
              if (
                !skipTo.tag &&
                !skipTo.role &&
                !hasName &&
                trim(aLabel) &&
                !isSeparatChildFormField
              ) {
                name = aLabel;

                // Check for blank value, since whitespace chars alone are not valid as a name
                if (trim(name)) {
                  hasName = true;
                  hLabel = true;
                  if (node === refNode) {
                    // If name is non-empty and both the current and refObject nodes match, then don't process any deeper within the branch.
                    skip = true;
                    hasLabel = true;
                  }
                }
              }

              var rolePresentation =
                !skipTo.tag &&
                !skipTo.role &&
                !hasName &&
                nTag !== "iframe" &&
                nRole &&
                presentationRoles.indexOf(nRole) !== -1 &&
                !isFocusable(node) &&
                !hasGlobalAttr(node);

              // Otherwise, if the current node is not a nested widget control within the parent ref obj, but is instead a native markup element that includes a host-defined labelling mechanism, then set the name and description accordingly if present.
              if (!isSeparatChildFormField) {
                // Otherwise, if name is still empty and the current node matches the ref node and is a standard form field with a non-empty associated label element, process label with same naming computation algorithm.
                if (
                  !skipTo.tag &&
                  !skipTo.role &&
                  !hasName &&
                  node === refNode &&
                  isNativeFormField
                ) {
                  // Logic modified to match issue
                  // https://github.com/WhatSock/w3c-alternative-text-computation/issues/12 */
                  var labels = docO.querySelectorAll("label");
                  var lblName = "";
                  var implicitLabel = getParent(node, "label") || false;

                  for (i = 0; i < labels.length; i++) {
                    if (
                      ((labels[i] === implicitLabel &&
                        typeof implicitLabel.getAttribute("for") !==
                          "string") ||
                        labels[i].getAttribute("for") === node.id) &&
                      !isParentHidden(labels[i], docO.body, true)
                    ) {
                      lblName += addSpacing(
                        walk(labels[i], true, skip, [node], false, {
                          ref: ownedBy,
                          top: labels[i],
                        }).name,
                      );
                    }
                  }

                  name = lblName;

                  if (trim(name)) {
                    hasName = true;
                  }
                }

                // Process native form field buttons in accordance with the HTML AAM
                // https://w3c.github.io/html-aam/#accessible-name-and-description-computation
                var btnType =
                  (!skipTo.tag &&
                    !skipTo.role &&
                    isNativeButton &&
                    (node.getAttribute("type") || "").toLowerCase()) ||
                  false;
                var btnValue =
                  (!skipTo.tag &&
                    !skipTo.role &&
                    btnType &&
                    trim(node.getAttribute("value"))) ||
                  false;

                var nAlt =
                  rolePresentation && nTag === "img"
                    ? ""
                    : trim(node.alt || node.getAttribute("alt"));

                // Otherwise, if name is still empty and current node is a standard non-presentational img or image button with a non-empty alt or title attribute, set alt or title attribute value as the accessible name.
                if (
                  !skipTo.tag &&
                  !skipTo.role &&
                  !hasName &&
                  !rolePresentation &&
                  (nRole === "img" || nTag === "img" || btnType === "image") &&
                  (nAlt || trim(nTitle))
                ) {
                  // Check for blank value, since whitespace chars alone are not valid as a name
                  name = trim(nAlt) || trim(nTitle);
                  if (trim(name)) {
                    hasName = true;
                  }
                }

                // Process native HTML area tags to use alt as name when not explicitly set using aria-labelledby or aria-label.
                if (
                  !skipTo.tag &&
                  !skipTo.role &&
                  !hasName &&
                  !rolePresentation &&
                  nTag === "area" &&
                  nAlt
                ) {
                  // Check for blank value, since whitespace chars alone are not valid as a name
                  name = trim(nAlt);
                  if (trim(name)) {
                    hasName = true;
                  }
                }

                // Process native HTML optgroup tags to use label as name when not explicitly set using aria-labelledby or aria-label.
                if (nTag === "optgroup") {
                  if (
                    !skipTo.tag &&
                    !skipTo.role &&
                    !hasName &&
                    !rolePresentation &&
                    node.getAttribute("label")
                  ) {
                    // Check for blank value, since whitespace chars alone are not valid as a name
                    name = trim(node.getAttribute("label"));
                    if (trim(name)) {
                      hasName = true;
                    }
                  }
                  result.skip = true;
                }

                // Process the accessible names for native HTML buttons
                if (
                  !skipTo.tag &&
                  !skipTo.role &&
                  !hasName &&
                  node === refNode &&
                  btnType &&
                  ["button", "submit", "reset"].indexOf(btnType) !== -1
                ) {
                  if (btnValue) {
                    name = btnValue;
                  } else {
                    switch (btnType) {
                      case "submit":
                        name = "submit";
                        break;
                      case "reset":
                        name = "reset";
                        break;
                      default:
                        name = "";
                    }
                  }
                  if (trim(name)) {
                    hasName = true;
                  }
                }

                if (
                  !skipTo.tag &&
                  !skipTo.role &&
                  hasName &&
                  node === refNode &&
                  btnType &&
                  ["button", "submit", "reset"].indexOf(btnType) !== -1 &&
                  btnValue &&
                  btnValue !== name &&
                  !result.desc
                ) {
                  result.desc = btnValue;
                  hasDesc = true;
                }

                // Process the accessible names for native HTML image buttons
                if (
                  !skipTo.tag &&
                  !skipTo.role &&
                  !hasName &&
                  node === refNode &&
                  btnType &&
                  btnType === "image"
                ) {
                  name = "Submit Query";
                  hasName = true;
                  nameFromUserAgent = true;
                }

                var isFieldset =
                  !skipTo.tag &&
                  !skipTo.role &&
                  !hasName &&
                  node === rootNode &&
                  (nRole === "group" ||
                    nRole === "radiogroup" ||
                    (!nRole && nTag === "fieldset"));

                // Otherwise, if name is still empty and the current node matches the root node and is a standard fieldset element with a non-empty associated legend element as the first child node, process legend with same naming computation algorithm.
                // Plus do the same for role="group" and role="radiogroup" with embedded role="legend", or a combination of these.
                if (isFieldset) {
                  var fChild =
                    firstChild(node, ["legend"], ["legend"]) || false;
                  if (fChild) {
                    name = trim(
                      walk(fChild, stop, false, [], false, {
                        ref: ownedBy,
                        top: fChild,
                      }).name,
                    );
                  }
                  if (trim(name)) {
                    hasName = true;
                  }
                  skip = true;
                }

                var isTable =
                  !skipTo.tag &&
                  !skipTo.role &&
                  !hasName &&
                  node === rootNode &&
                  (nRole === "table" || (!nRole && nTag === "table"));

                // Otherwise, if name is still empty and the current node matches the root node and is a standard table element with a non-empty associated caption element as the first child node, process caption with same naming computation algorithm.
                // Plus do the same for role="table" with embedded role="caption", or a combination of these.
                if (isTable) {
                  fChild = firstChild(node, ["caption"], ["caption"]) || false;
                  if (fChild) {
                    name = trim(
                      walk(fChild, stop, false, [], false, {
                        ref: ownedBy,
                        top: fChild,
                      }).name,
                    );
                  }
                  if (trim(name)) {
                    hasName = true;
                  }
                  skip = true;
                }

                // Otherwise, if name is still empty and the root node and the current node are the same and node is an svg element, then parse the content of the title element to set the name and the desc element to set the description.
                if (!skipTo.tag && !skipTo.role && nTag === "svg") {
                  var svgT = node.querySelector("title") || false;
                  var svgD =
                    (node === rootNode && node.querySelector("desc")) || false;
                  if (!hasName && svgT) {
                    name = trim(
                      walk(svgT, true, false, [], false, {
                        ref: ownedBy,
                        top: svgT,
                      }).name,
                    );
                  }
                  if (!hasDesc && svgD) {
                    var dE = trim(
                      walk(svgD, true, false, [], false, {
                        ref: ownedBy,
                        top: svgD,
                      }).name,
                    );
                    if (trim(dE)) {
                      result.desc = dE;
                    }
                  }
                  result.skip = true;
                }
              }

              // Otherwise, if the current node is a nested widget control within the parent ref obj, then add only its value and process no deeper within the branch.
              if (!skipTo.tag && !skipTo.role && isSeparatChildFormField) {
                // Prevent the referencing node from having its value included in the case of form control labels that contain the element with focus.
                if (
                  !(
                    nodesToIgnoreValues &&
                    nodesToIgnoreValues.length &&
                    nodesToIgnoreValues.indexOf(node) !== -1
                  )
                ) {
                  if (isRangeWidgetRole) {
                    // For range widgets, append aria-valuetext if non-empty, or aria-valuenow if non-empty, or node.value if applicable.
                    name = getObjectValue(nRole, node, true);
                  } else if (
                    isEditWidgetRole ||
                    (nRole === "combobox" && isNativeFormField)
                  ) {
                    // For simulated edit widgets, append text from content if applicable, or node.value if applicable.
                    name = getObjectValue(nRole, node, false, true);
                  } else if (isSelectWidgetRole) {
                    // For simulated select widgets, append same naming computation algorithm for all child nodes including aria-selected="true" separated by a space when multiple.
                    // Also filter nodes so that only valid child roles of relevant parent role that include aria-selected="true" are included.
                    name = getObjectValue(nRole, node, false, false, true);
                  } else if (
                    isNativeFormField &&
                    ["input", "textarea"].indexOf(nTag) !== -1 &&
                    (!isWidgetRole || isEditWidgetRole)
                  ) {
                    // For native edit fields, append node.value when applicable.
                    name = getObjectValue(
                      nRole,
                      node,
                      false,
                      false,
                      false,
                      true,
                    );
                  } else if (
                    isNativeFormField &&
                    nTag === "select" &&
                    (!isWidgetRole || nRole === "combobox")
                  ) {
                    // For native select fields, get text from content for all options with selected attribute separated by a space when multiple, but don't process if another widget role is present unless it matches role="combobox".
                    // Reference: https://github.com/WhatSock/w3c-alternative-text-computation/issues/7
                    name = getObjectValue(
                      nRole,
                      node,
                      false,
                      false,
                      true,
                      true,
                    );
                  }

                  // Check for blank value, since whitespace chars alone are not valid as a name
                  name = trim(name);
                }
              }

              // Otherwise, if current node is the same as rootNode and is non-presentational and includes a non-empty title attribute, store title attribute value as the accessible name if name is still empty, or the description if not.
              // Processing for this is handled within the walkDOM function.
              if (
                !skipTo.tag &&
                !skipTo.role &&
                !rolePresentation &&
                trim(nTitle)
              ) {
                if (!(name && aDescription === " ")) {
                  result.title = trim(nTitle);
                }
              }

              var nType =
                isNativeFormField &&
                trim(node.getAttribute("type") || "").toLowerCase();
              if (!nType) nType = "text";
              var placeholder =
                !skipTo.tag &&
                !skipTo.role &&
                node === rootNode &&
                node === refNode &&
                (isEditWidgetRole ||
                  (isNativeFormField &&
                    (nTag === "textarea" ||
                      (nTag === "input" &&
                        [
                          "password",
                          "search",
                          "tel",
                          "text",
                          "url",
                          "email",
                        ].indexOf(nType) !== -1)))) &&
                trim(
                  node.getAttribute("placeholder") ||
                    node.getAttribute("aria-placeholder"),
                );

              if (placeholder) {
                result.placeholder = placeholder;
              }

              var isSkipTo =
                (skipTo.role && skipTo.role === nRole) ||
                (!nRole && skipTo.tag && skipTo.tag === nTag);

              // Process custom tag and role searches if needed.
              if (isSkipTo) {
                name = trim(
                  walk(node, stop, false, [], false, {
                    ref: ownedBy,
                    top: node,
                  }).name,
                );
                if (trim(name)) {
                  skip = true;
                }
              }

              // Check for non-empty value of aria-owns, follow each ID ref, then process with same naming computation.
              // Also abort aria-owns processing if contained on an element that does not support child elements.
              if (
                !isSkipTo &&
                aOwns &&
                ["input", "img", "progress"].indexOf(nTag) === -1
              ) {
                ids = aOwns.split(/\s+/);
                parts = [];
                for (i = 0; i < ids.length; i++) {
                  element = docO.getElementById(ids[i]);
                  // Abort processing if the referenced node has already been traversed
                  if (element && owns.indexOf(ids[i]) === -1) {
                    owns.push(ids[i]);
                    var oBy = { ref: ownedBy, top: ownedBy.top };
                    oBy[ids[i]] = {
                      refNode: refNode,
                      node: node,
                      target: element,
                    };
                    if (!isParentHidden(element, docO.body, true)) {
                      parts.push(
                        walk(element, true, skip, [], false, oBy).name,
                      );
                    }
                  }
                }
                // Join without adding whitespace since this is already handled by parsing individual nodes within the algorithm steps.
                ariaO = parts.join("");
              }
            }

            // Otherwise, process text node
            else if (!skipTo.tag && !skipTo.role && node.nodeType === 3) {
              name = node.data;
            }

            if (!hLabel) {
              // Prepend and append the current CSS pseudo element text, plus normalize all whitespace such as newline characters and others into flat spaces.
              name = cssO.before + name.replace(/\s+/g, " ") + cssO.after;
            }

            if (
              name.length &&
              !hasParentLabelOrHidden(node, ownedBy.top, ownedBy)
            ) {
              result.name = name;
            }

            result.owns = ariaO;

            return result;
          },
          refNode,
        );

        if (!hasLabel) {
          // Prepend and append the refObj CSS pseudo element text, plus normalize whitespace chars into flat spaces.
          fullResult.name =
            cssOP.before + fullResult.name.replace(/\s+/g, " ") + cssOP.after;
        }

        return fullResult;
      };

      var firstChild = function (e, t, r, s) {
        e = e ? e.firstChild : null;
        while (e) {
          var tr = getRole(e) || false;
          if (
            e.nodeType === 1 &&
            ((!t && !r) ||
              (tr && r && r.indexOf(tr) !== -1) ||
              (!tr && t && t.indexOf(e.nodeName.toLowerCase()) !== -1))
          ) {
            return e;
          } else if (!s && e.nodeType === 1 && (t || r)) {
            return null;
          }
          e = e.nextSibling;
        }
        return e;
      };

      var lastChild = function (e, t, r, s) {
        e = e ? e.lastChild : null;
        while (e) {
          var tr = getRole(e) || false;
          if (
            e.nodeType === 1 &&
            ((!t && !r) ||
              (tr && r && r.indexOf(tr) !== -1) ||
              (!tr && t && t.indexOf(e.nodeName.toLowerCase()) !== -1))
          ) {
            return e;
          } else if (!s && e.nodeType === 1 && (t || r)) {
            return null;
          }
          e = e.previousSibling;
        }
        return e;
      };

      var getRole = function (node) {
        var role =
          node && node.getAttribute
            ? (node.getAttribute("role") || "").toLowerCase()
            : "";
        if (!trim(role)) {
          return "";
        }
        var inList = function (list) {
          return trim(role).length > 0 && list.roles.indexOf(role) >= 0;
        };
        var roles = role.split(/\s+/);
        for (var i = 0; i < roles.length; i++) {
          role = roles[i];
          if (
            inList(list1) ||
            inList(list2) ||
            inList(list3) ||
            inList(list4) ||
            presentationRoles.indexOf(role) !== -1
          ) {
            return role;
          }
        }
        return "";
      };

      var isFocusable = function (node) {
        var nodeName = node.nodeName.toLowerCase();
        if (node.getAttribute("tabindex")) {
          return true;
        }
        if (nodeName === "a" && node.getAttribute("href")) {
          return true;
        }
        return (
          ["button", "input", "select", "textarea"].indexOf(nodeName) !== -1 &&
          (node.getAttribute("type") || "").toLowerCase() !== "hidden"
        );
      };

      // ARIA Role Exception Rule Set 1.2
      // The following Role Exception Rule Set is based on the following ARIA Working Group discussion involving all relevant browser venders.
      // https://lists.w3.org/Archives/Public/public-aria/2017Jun/0057.html

      // Always include name from content when the referenced node matches list1, as well as when child nodes match those within list3
      // Note: gridcell was added to list1 to account for focusable gridcells that match the ARIA 1.0 paradigm for interactive grids.
      // So too was row to match 'name from author' and 'name from content' in accordance with the spec.
      var list1 = {
        roles: [
          "button",
          "checkbox",
          "link",
          "option",
          "radio",
          "switch",
          "tab",
          "treeitem",
          "menuitem",
          "menuitemcheckbox",
          "menuitemradio",
          "row",
          "cell",
          "gridcell",
          "columnheader",
          "rowheader",
          "tooltip",
          "heading",
        ],
        tags: [
          "a",
          "button",
          "summary",
          "input",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "menuitem",
          "option",
          "tr",
          "td",
          "th",
        ],
      };
      // Never include name from content when current node matches list2
      // The rowgroup role was added to prevent 'name from content' in accordance with relevant ARIA 1.1 spec changes.
      // The fieldset element and group role was added to account for implicit mappings where name from content is not supported.
      var list2 = {
        roles: [
          "application",
          "alert",
          "log",
          "marquee",
          "timer",
          "alertdialog",
          "dialog",
          "banner",
          "complementary",
          "form",
          "main",
          "navigation",
          "progressbar",
          "region",
          "search",
          "article",
          "document",
          "feed",
          "figure",
          "img",
          "math",
          "toolbar",
          "menu",
          "menubar",
          "grid",
          "listbox",
          "radiogroup",
          "textbox",
          "searchbox",
          "spinbutton",
          "scrollbar",
          "slider",
          "tablist",
          "tabpanel",
          "tree",
          "treegrid",
          "separator",
          "rowgroup",
          "group",
        ],
        tags: [
          "article",
          "aside",
          "body",
          "select",
          "datalist",
          "optgroup",
          "dialog",
          "figure",
          "footer",
          "form",
          "header",
          "hr",
          "iframe",
          "img",
          "textarea",
          "input",
          "main",
          "math",
          "menu",
          "nav",
          "section",
          "thead",
          "tbody",
          "tfoot",
          "fieldset",
          "progress",
        ],
      };
      // As an override of list2, conditionally include name from content if current node is focusable, or if the current node matches list3 while the referenced parent node (root node) matches list1.
      var list3 = {
        roles: [
          "term",
          "definition",
          "directory",
          "list",
          "note",
          "status",
          "table",
          "contentinfo",
        ],
        tags: ["dl", "ul", "ol", "dd", "details", "output", "table"],
      };
      // Subsequent roles added as part of the Role Parity project for ARIA 1.2.
      // Tracks roles that don't specifically belong within the prior process lists.
      var list4 = {
        roles: [
          "legend",
          "caption",
          "code",
          "deletion",
          "emphasis",
          "generic",
          "insertion",
          "paragraph",
          "strong",
          "subscript",
          "superscript",
        ],
        tags: [
          "legend",
          "caption",
          "figcaption",
          "code",
          "del",
          "em",
          "div",
          "span",
          "ins",
          "p",
          "strong",
          "sub",
          "sup",
        ],
      };

      var genericElements = ["div", "span"];
      var nameProhibitedRoles = [
        "caption",
        "code",
        "deletion",
        "emphasis",
        "generic",
        "insertion",
        "none",
        "paragraph",
        "presentation",
        "strong",
        "subscript",
        "superscript",
      ];
      var nameProhibitedElements = [
        "caption",
        "figcaption",
        "code",
        "del",
        "em",
        "div",
        "span",
        "ins",
        "p",
        "strong",
        "sub",
        "sup",
      ];

      var nativeFormFields = [
        "button",
        "input",
        "progress",
        "select",
        "textarea",
      ];
      var rangeWidgetRoles = [
        "scrollbar",
        "slider",
        "spinbutton",
        "progressbar",
      ];
      var editWidgetRoles = ["searchbox", "textbox"];
      var selectWidgetRoles = [
        "grid",
        "listbox",
        "tablist",
        "tree",
        "treegrid",
      ];
      var otherWidgetRoles = [
        "button",
        "checkbox",
        "link",
        "switch",
        "option",
        "menu",
        "menubar",
        "menuitem",
        "menuitemcheckbox",
        "menuitemradio",
        "radio",
        "tab",
        "treeitem",
        "gridcell",
      ];
      var presentationRoles = ["presentation", "none"];

      var hasGlobalAttr = function (node) {
        var globalPropsAndStates = [
          "labelledby",
          "label",
          "describedby",
          "busy",
          "controls",
          "current",
          "details",
          "disabled",
          "dropeffect",
          "errormessage",
          "flowto",
          "grabbed",
          "haspopup",
          "invalid",
          "keyshortcuts",
          "live",
          "owns",
          "roledescription",
        ];
        for (var i = 0; i < globalPropsAndStates.length; i++) {
          var a = trim(node.getAttribute("aria-" + globalPropsAndStates[i]));
          if (a) {
            return true;
          }
        }
        return false;
      };

      var isHidden =
        overrides.isHidden ||
        function (node, refNode) {
          var hidden = function (node) {
            if (!node || node.nodeType !== 1 || node === refNode) {
              return false;
            }
            if (node.getAttribute("aria-hidden") === "true") {
              return true;
            }
            if (node.getAttribute("hidden")) {
              return true;
            }
            var style = getStyleObject(node);
            return (
              style["display"] === "none" || style["visibility"] === "hidden"
            );
          };
          return hidden(node);
        };

      var isParentHidden = function (node, refNode, skipOwned, skipCurrent) {
        while (node && node !== refNode) {
          if (!skipCurrent && node.nodeType === 1 && isHidden(node, refNode)) {
            return true;
          } else skipCurrent = false;
          node = node.parentNode;
        }
        return false;
      };

      var getStyleObject =
        overrides.getStyleObject ||
        function (node) {
          var style = {};
          if (docO.defaultView && docO.defaultView.getComputedStyle) {
            style = docO.defaultView.getComputedStyle(node, "");
          } else if (node.currentStyle) {
            style = node.currentStyle;
          }
          return style;
        };

      var cleanCSSText = function (node, text) {
        var s = text;
        if (s.indexOf("attr(") !== -1) {
          var m = s.match(/attr\((.|\n|\r\n)*?\)/g);
          for (var i = 0; i < m.length; i++) {
            var b = m[i].slice(5, -1);
            b = node.getAttribute(b) || "";
            s = s.replace(m[i], b);
          }
        }
        s = s.replace(/url\((.*?)\)\s+\/|url\((.*?)\)/g, "").replace(/\"/g, "");
        return s;
      };

      var isBlockLevelElement = function (node, cssObj) {
        var styleObject = cssObj || getStyleObject(node);
        for (var prop in blockStyles) {
          var values = blockStyles[prop];
          for (var i = 0; i < values.length; i++) {
            if (
              styleObject[prop] &&
              ((values[i].indexOf("!") === 0 &&
                [values[i].slice(1), "inherit", "initial", "unset"].indexOf(
                  styleObject[prop],
                ) === -1) ||
                styleObject[prop].indexOf(values[i]) === 0)
            ) {
              return true;
            }
          }
        }
        return (
          !cssObj &&
          node.nodeName &&
          blockElements.indexOf(node.nodeName.toLowerCase()) !== -1 &&
          !(
            styleObject["display"] &&
            styleObject["display"].indexOf("inline") === 0 &&
            node.nodeName.toLowerCase() !== "br"
          )
        );
      };

      // CSS Block Styles indexed from:
      // https://developer.mozilla.org/en-US/docs/Web/Guide/CSS/Block_formatting_context
      var blockStyles = {
        display: ["block", "grid", "table", "flow-root", "flex"],
        position: ["absolute", "fixed"],
        float: ["left", "right", "inline"],
        clear: ["left", "right", "both", "inline"],
        overflow: ["hidden", "scroll", "auto"],
        "column-count": ["!auto"],
        "column-width": ["!auto"],
        "column-span": ["all"],
        contain: ["layout", "content", "strict"],
      };

      // HTML5 Block Elements indexed from:
      // https://github.com/webmodules/block-elements
      // Note: 'br' was added to this array because it impacts visual display and should thus add a space .
      // Reference issue: https://github.com/w3c/accname/issues/4
      // Note: Added in 1.13, td, th, tr, and legend
      var blockElements = [
        "address",
        "article",
        "aside",
        "blockquote",
        "br",
        "canvas",
        "dd",
        "div",
        "dl",
        "dt",
        "fieldset",
        "figcaption",
        "figure",
        "footer",
        "form",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "header",
        "hgroup",
        "hr",
        "legend",
        "li",
        "main",
        "nav",
        "noscript",
        "ol",
        "output",
        "p",
        "pre",
        "section",
        "table",
        "td",
        "tfoot",
        "th",
        "tr",
        "ul",
        "video",
      ];

      var getObjectValue = function (
        role,
        node,
        isRange,
        isEdit,
        isSelect,
        isNative,
      ) {
        var val = "";
        var bypass = false;

        if (isRange && !isNative) {
          val =
            node.getAttribute("aria-valuetext") ||
            node.getAttribute("aria-valuenow") ||
            "";
        } else if (isEdit && !isNative) {
          val = getText(node) || "";
        } else if (isSelect && !isNative) {
          var childRoles = [];
          if (role === "grid" || role === "treegrid") {
            childRoles = ["gridcell", "rowheader", "columnheader"];
          } else if (role === "listbox") {
            childRoles = ["option"];
          } else if (role === "tablist") {
            childRoles = ["tab"];
          } else if (role === "tree") {
            childRoles = ["treeitem"];
          }
          val = joinSelectedParts(
            node,
            node.querySelectorAll('*[aria-selected="true"]'),
            false,
            childRoles,
          );
          bypass = true;
        }
        val = trim(val);
        if (!val && (isRange || isEdit) && node.value) {
          val = node.value;
        }
        if (!bypass && !val && isNative) {
          if (isSelect) {
            val = joinSelectedParts(
              node,
              node.querySelectorAll("option[selected]"),
              true,
            );
          } else {
            val = node.value;
          }
        }

        return val;
      };

      var addSpacing = function (s) {
        return trim(s).length ? " " + s + " " : " ";
      };

      var joinSelectedParts = function (node, nOA, isNative, childRoles) {
        if (!nOA || !nOA.length) {
          return "";
        }
        var parts = [];
        for (var i = 0; i < nOA.length; i++) {
          var role = getRole(nOA[i]);
          var isValidChildRole = !childRoles || childRoles.indexOf(role) !== -1;
          if (isValidChildRole) {
            parts.push(
              isNative
                ? getText(nOA[i])
                : walk(nOA[i], true, false, [], false, { top: nOA[i] }).name,
            );
          }
        }
        return parts.join(" ");
      };

      var getPseudoElStyleObj =
        overrides.getPseudoElStyleObj ||
        function (node, position) {
          var styleObj = {};
          for (var prop in blockStyles) {
            styleObj[prop] = docO.defaultView
              .getComputedStyle(node, position)
              .getPropertyValue(prop);
          }
          styleObj["content"] = docO.defaultView
            .getComputedStyle(node, position)
            .getPropertyValue("content")
            .replace(/^"|\\|"$/g, "");
          return styleObj;
        };

      var getText = function (node, position) {
        if (!position && node.nodeType === 1) {
          return node.innerText || node.textContent || "";
        }
        var styles = getPseudoElStyleObj(node, position);
        var text = styles["content"];
        if (!text || text === "none") {
          return "";
        }
        if (isBlockLevelElement({}, styles)) {
          if (position === ":before") {
            text += " ";
          } else if (position === ":after") {
            text = " " + text;
          }
        }
        return text;
      };

      var getCSSText =
        overrides.getCSSText ||
        function (node, refNode) {
          if (
            (node && node.nodeType !== 1) ||
            node === refNode ||
            [
              "input",
              "select",
              "textarea",
              "img",
              "iframe",
              "optgroup",
            ].indexOf(node.nodeName.toLowerCase()) !== -1
          ) {
            return { before: "", after: "" };
          }
          return {
            before: cleanCSSText(node, getText(node, ":before")),
            after: cleanCSSText(node, getText(node, ":after")),
          };
        };

      var getParent = function (node, nTag, nRole, noRole) {
        noRole = !!noRole;
        while (node) {
          node = node.parentNode;
          if (
            node &&
            ((nRole && getRole(node) === nRole) ||
              (nTag &&
                node.nodeName &&
                node.nodeName.toLowerCase() === nTag &&
                (!noRole || getRole(node).length < 1)))
          ) {
            return node;
          }
        }
        return {};
      };

      var hasParentLabelOrHidden = function (
        node,
        refNode,
        ownedBy,
        ignoreHidden,
      ) {
        var trackNodes = [];
        while (node && node !== refNode) {
          if (
            node.id &&
            ownedBy &&
            ownedBy[node.id] &&
            ownedBy[node.id].node &&
            trackNodes.indexOf(node) === -1
          ) {
            trackNodes.push(node);
            node = ownedBy[node.id].node;
          } else {
            node = node.parentNode;
          }
          if (node && node.getAttribute) {
            if (
              trim(node.getAttribute("aria-label")) ||
              (!ignoreHidden && isHidden(node, refNode))
            ) {
              return true;
            }
          }
        }
        return false;
      };

      if (
        isParentHidden(
          node,
          docO.body,
          true,
          !!(node && node.nodeName && node.nodeName.toLowerCase() === "area"),
        )
      ) {
        return props;
      }

      // Compute accessible Name and Description properties value for node
      var accProps = walk(node, false, false, [], false, { top: node });

      var accName = trim(accProps.name.replace(/\s+/g, " "));
      var accDesc = trim(accProps.title.replace(/\s+/g, " "));

      // if (accName === accDesc) {
      // If both Name and Description properties match, then clear the Description property value. (Ideal but not in the spec so commented out.)
      // accDesc = "";
      // }

      props.hasUpperCase =
        rootRole && rootRole !== rootRole.toLowerCase() ? true : false;
      props.name = accName;
      props.desc = accDesc;

      // Clear track variables
      nodes = {
        name: [],
        desc: [],
      };
      owns = [];
    } catch (e) {
      props.error = e;
    }
    props.placeholder = nameFromPlaceholder;
    props.userAgent = nameFromUserAgent;

    if (fnc && typeof fnc === "function") {
      return fnc.apply(node, [props, node]);
    } else {
      return props;
    }
  };

  var trim = function (str) {
    if (typeof str !== "string") {
      return "";
    }
    return str.replace(/^\s+|\s+$/g, "");
  };

  // Customize returned string for testable statements

  nameSpace.getAccNameMsg = nameSpace.getNames = function (node, overrides) {
    var props = nameSpace.getAccName(node, null, false, overrides);
    if (props.error) {
      return (
        props.error +
        "\n\n" +
        "An error has been thrown in AccName Prototype version " +
        nameSpace.getAccNameVersion +
        ". Please copy this error message and the HTML markup that caused it, and submit both as a new GitHub issue at\n" +
        "https://github.com/whatsock/w3c-alternative-text-computation"
      );
    }
    var r =
      'accName: "' + props.name + '"\n\naccDesc: "' + props.desc + '"\n\n';
    if (props.placeholder) r += "Name from placeholder: true\n\n";
    if (props.userAgent) r += "Name from user agent: true\n\n";
    r +=
      "(Running AccName Computation Prototype version: " +
      nameSpace.getAccNameVersion +
      ")";
    return r;
  };

  if (typeof module === "object" && module.exports) {
    module.exports = {
      getNames: nameSpace.getNames,
      calcNames: nameSpace.calcNames,
    };
  }
})();

},{}]},{},[3]);
