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

	corpus.forEach(function(item) {
		queue.push(item);
	});

	var step = function() {
		if (queue.length) {
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
	['role',             Array.prototype.concat.apply([], Object.values(constants.subRoles)).filter((v, i, a) => a.indexOf(v) === i)],
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

},{"aria-api/lib/constants":5}],3:[function(require,module,exports){
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

},{"./fuzzer":1,"./html":2,"aria-api/instrumented.js":4,"w3c-alternative-text-computation":9}],4:[function(require,module,exports){
var query = require('./lib/query.js');
var name = require('./lib/name-inst.js');

module.exports = {
	getRole: query.getRole,
	getAttribute: query.getAttribute,
	getName: name.getName,
	getDescription: name.getDescription,

	matches: query.matches,
	querySelector: query.querySelector,
	querySelectorAll: query.querySelectorAll,
	closest: query.closest,
};

},{"./lib/name-inst.js":6,"./lib/query.js":7}],5:[function(require,module,exports){
exports.attributes = {
	// widget
	'autocomplete': 'token',
	'checked': 'tristate',
	'current': 'token',
	'disabled': 'bool',
	'expanded': 'bool-undefined',
	'haspopup': 'token',
	'hidden': 'bool',  // !
	'invalid': 'token',
	'keyshortcuts': 'string',
	'label': 'string',
	'level': 'int',
	'modal': 'bool',
	'multiline': 'bool',
	'multiselectable': 'bool',
	'orientation': 'token',
	'placeholder': 'string',
	'pressed': 'tristate',
	'readonly': 'bool',
	'required': 'bool',
	'roledescription': 'string',
	'selected': 'bool-undefined',
	'valuemax': 'number',
	'valuemin': 'number',
	'valuenow': 'number',
	'valuetext': 'string',

	// live
	'atomic': 'bool',
	'busy': 'bool',
	'live': 'token',
	'relevant': 'token-list',

	// dragndrop
	'dropeffect': 'token-list',
	'grabbed': 'bool-undefined',

	// relationship
	'activedescendant': 'id',
	'colcount': 'int',
	'colindex': 'int',
	'colspan': 'int',
	'controls': 'id-list',
	'describedby': 'id-list',
	'details': 'id',
	'errormessage': 'id',
	'flowto': 'id-list',
	'labelledby': 'id-list',
	'owns': 'id-list',
	'posinset': 'int',
	'rowcount': 'int',
	'rowindex': 'int',
	'rowspan': 'int',
	'setsize': 'int',
	'sort': 'token',
};

exports.attributeStrongMapping = {
	'disabled': 'disabled',
	'hidden': 'hidden',
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

// https://www.w3.org/TR/html-aria/#docconformance
exports.extraSelectors = {
	article: ['article'],
	button: [
		'button',
		'input[type="button"]',
		'input[type="image"]',
		'input[type="reset"]',
		'input[type="submit"]',
		'summary',
	],
	cell: ['td'],
	checkbox: ['input[type="checkbox"]'],
	combobox: [
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
	complementary: ['aside'],
	definition: ['dd'],
	dialog: ['dialog'],
	document: ['body'],
	figure: ['figure'],
	form: ['form[aria-label]', 'form[aria-labelledby]'],
	group: ['details', 'optgroup'],
	heading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
	img: ['img:not([alt=""])', 'graphics-symbol'],
	link: ['a[href]', 'area[href]', 'link[href]'],
	list: ['dl', 'ol', 'ul'],
	listbox: [
		'select[multiple]',
		'select[size]:not([size="0"]):not([size="1"])',
	],
	listitem: ['dt', 'ul > li', 'ol > li'],
	main: ['main'],
	math: ['math'],
	menuitemcheckbox: ['menuitem[type="checkbox"]'],
	menuitem: ['menuitem[type="command"]'],
	menuitemradio: ['menuitem[type="radio"]'],
	menu: ['menu[type="context"]'],
	navigation: ['nav'],
	option: ['option'],
	progressbar: ['progress'],
	radio: ['input[type="radio"]'],
	region: ['section[aria-label]', 'section[aria-labelledby]', 'section[title]'],
	rowgroup: ['tbody', 'thead', 'tfoot'],
	row: ['tr'],
	searchbox: ['input[type="search"]:not([list])'],
	separator: ['hr'],
	slider: ['input[type="range"]'],
	spinbutton: ['input[type="number"]'],
	status: ['output'],
	table: ['table'],
	term: ['dfn', 'dt'],
	textbox: [
		'input:not([type]):not([list])',
		'input[type="email"]:not([list])',
		'input[type="tel"]:not([list])',
		'input[type="text"]:not([list])',
		'input[type="url"]:not([list])',
		'textarea',
	],

	// if scope is missing, it is calculated automatically
	rowheader: ['th[scope="row"]'],
	columnheader: ['th[scope="col"]'],
};

exports.scoped = [
	'article *', 'aside *', 'main *', 'nav *', 'section *',
].join(',');

// https://www.w3.org/TR/wai-aria/roles
var subRoles = {
	cell: ['gridcell', 'rowheader'],
	command: ['button', 'link', 'menuitem'],
	composite: ['grid', 'select', 'spinbutton', 'tablist'],
	img: ['doc-cover'],
	input: ['checkbox', 'option', 'radio', 'slider', 'spinbutton', 'textbox'],
	landmark: [
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
	range: ['progressbar', 'scrollbar', 'slider', 'spinbutton'],
	roletype: ['structure', 'widget', 'window'],
	section: [
		'alert',
		'cell',
		'definition',
		'doc-abstract',
		'doc-colophon',
		'doc-credit',
		'doc-dedication',
		'doc-epigraph',
		'doc-example',
		'doc-footnote',
		'doc-qna',
		'figure',
		'group',
		'img',
		'landmark',
		'list',
		'listitem',
		'log',
		'marquee',
		'math',
		'note',
		'status',
		'table',
		'tabpanel',
		'term',
		'tooltip',
	],
	sectionhead: [
		'columnheader',
		'doc-subtitle',
		'heading',
		'rowheader',
		'tab',
	],
	select: ['combobox', 'listbox', 'menu', 'radiogroup', 'tree'],
	separator: ['doc-pagebreak'],
	structure: [
		'application',
		'document',
		'none',
		'presentation',
		'rowgroup',
		'section',
		'sectionhead',
		'separator',
	],
	table: ['grid'],
	textbox: ['searchbox'],
	widget: [
		'command',
		'composite',
		'gridcell',
		'input',
		'range',
		'row',
		'separator',
		'tab',
	],
	window: ['dialog'],
	alert: ['alertdialog'],
	checkbox: ['menuitemcheckbox', 'switch'],
	dialog: ['alertdialog'],
	gridcell: ['columnheader', 'rowheader'],
	menuitem: ['menuitemcheckbox'],
	menuitemcheckbox: ['menuitemradio'],
	option: ['treeitem'],
	radio: ['menuitemradio'],
	status: ['timer'],
	grid: ['treegrid'],
	menu: ['menubar'],
	tree: ['treegrid'],
	document: ['article', 'graphics-document'],
	group: ['row', 'select', 'toolbar', 'graphics-object'],
	link: ['doc-backlink', 'doc-biblioref', 'doc-glossref', 'doc-noteref'],
	list: ['directory', 'feed'],
	listitem: ['doc-biblioentry', 'doc-endnote', 'treeitem'],
	navigation: ['doc-index', 'doc-pagelist', 'doc-toc'],
	note: ['doc-notice', 'doc-tip'],
};

var getSubRoles = function(role) {
	var children = subRoles[role] || [];
	var descendents = children.map(getSubRoles);

	var result = [role];

	descendents.forEach(function(list) {
		list.forEach(function(r) {
			if (result.indexOf(r) === -1) {
				result.push(r);
			}
		});
	});

	return result;
};

exports.subRoles = {};
for (var role in subRoles) {
	exports.subRoles[role] = getSubRoles(role);
}
exports.subRoles['none'] = ['none', 'presentation'];
exports.subRoles['presentation'] = ['presentation', 'none'];

exports.nameFromContents = [
	'button',
	'checkbox',
	'columnheader',
	'doc-backlink',
	'doc-biblioref',
	'doc-glossref',
	'doc-noteref',
	'gridcell',
	'heading',
	'link',
	'menuitem',
	'menuitemcheckbox',
	'menuitemradio',
	'option',
	'radio',
	'row',
	'rowgroup',
	'rowheader',
	'sectionhead',
	'tab',
	'tooltip',
	'treeitem',
	'switch',
];

exports.nameFromDescendant = {
	'figure': 'figcaption',
	'table': 'caption',
	'fieldset': 'legend',
};

exports.nameDefaults = {
	'[type="submit"]': 'Submit',
	'[type="reset"]': 'Reset',
	'summary': 'Details',
};

exports.labelable = [
	'button',
	'input:not([type="hidden"])',
	'keygen',
	'meter',
	'output',
	'progress',
	'select',
	'textarea',
];

},{}],6:[function(require,module,exports){
var cov_2q245nv9x6=function(){var path="node_modules/aria-api/lib/name.js";var hash="5c805f0e3f5a395e829925703a8d9d82cab75605";var Function=function(){}.constructor;var global=new Function("return this")();var gcv="__coverage__";var coverageData={path:"node_modules/aria-api/lib/name.js",statementMap:{"0":{start:{line:1,column:16},end:{line:1,column:41}},"1":{start:{line:2,column:12},end:{line:2,column:33}},"2":{start:{line:3,column:11},end:{line:3,column:31}},"3":{start:{line:5,column:23},end:{line:21,column:1}},"4":{start:{line:6,column:14},end:{line:6,column:53}},"5":{start:{line:7,column:11},end:{line:7,column:45}},"6":{start:{line:8,column:14},end:{line:8,column:54}},"7":{start:{line:9,column:1},end:{line:11,column:2}},"8":{start:{line:10,column:2},end:{line:10,column:12}},"9":{start:{line:12,column:1},end:{line:20,column:2}},"10":{start:{line:13,column:2},end:{line:13,column:12}},"11":{start:{line:15,column:2},end:{line:19,column:3}},"12":{start:{line:16,column:3},end:{line:16,column:27}},"13":{start:{line:18,column:3},end:{line:18,column:39}},"14":{start:{line:23,column:17},end:{line:61,column:1}},"15":{start:{line:24,column:16},end:{line:24,column:18}},"16":{start:{line:26,column:1},end:{line:31,column:2}},"17":{start:{line:26,column:14},end:{line:26,column:15}},"18":{start:{line:27,column:13},end:{line:27,column:31}},"19":{start:{line:28,column:2},end:{line:30,column:3}},"20":{start:{line:29,column:3},end:{line:29,column:23}},"21":{start:{line:33,column:12},end:{line:33,column:50}},"22":{start:{line:34,column:1},end:{line:40,column:2}},"23":{start:{line:34,column:14},end:{line:34,column:15}},"24":{start:{line:35,column:14},end:{line:35,column:46}},"25":{start:{line:36,column:2},end:{line:39,column:3}},"26":{start:{line:37,column:3},end:{line:37,column:24}},"27":{start:{line:38,column:3},end:{line:38,column:24}},"28":{start:{line:42,column:11},end:{line:42,column:13}},"29":{start:{line:43,column:1},end:{line:58,column:2}},"30":{start:{line:43,column:14},end:{line:43,column:15}},"31":{start:{line:44,column:13},end:{line:44,column:24}},"32":{start:{line:45,column:2},end:{line:57,column:3}},"33":{start:{line:46,column:3},end:{line:46,column:27}},"34":{start:{line:47,column:9},end:{line:57,column:3}},"35":{start:{line:48,column:3},end:{line:56,column:4}},"36":{start:{line:49,column:4},end:{line:49,column:16}},"37":{start:{line:50,column:10},end:{line:56,column:4}},"38":{start:{line:53,column:4},end:{line:53,column:50}},"39":{start:{line:55,column:4},end:{line:55,column:62}},"40":{start:{line:60,column:1},end:{line:60,column:12}},"41":{start:{line:63,column:27},end:{line:66,column:1}},"42":{start:{line:64,column:12},end:{line:64,column:29}},"43":{start:{line:65,column:1},end:{line:65,column:65}},"44":{start:{line:68,column:18},end:{line:71,column:1}},"45":{start:{line:69,column:16},end:{line:69,column:45}},"46":{start:{line:70,column:1},end:{line:70,column:29}},"47":{start:{line:74,column:20},end:{line:89,column:1}},"48":{start:{line:75,column:14},end:{line:75,column:16}},"49":{start:{line:76,column:17},end:{line:76,column:46}},"50":{start:{line:77,column:1},end:{line:87,column:4}},"51":{start:{line:78,column:2},end:{line:86,column:3}},"52":{start:{line:79,column:3},end:{line:85,column:4}},"53":{start:{line:80,column:4},end:{line:82,column:5}},"54":{start:{line:81,column:5},end:{line:81,column:23}},"55":{start:{line:83,column:10},end:{line:85,column:4}},"56":{start:{line:84,column:4},end:{line:84,column:22}},"57":{start:{line:88,column:1},end:{line:88,column:15}},"58":{start:{line:93,column:14},end:{line:170,column:1}},"59":{start:{line:94,column:11},end:{line:94,column:13}},"60":{start:{line:95,column:13},end:{line:95,column:24}},"61":{start:{line:97,column:1},end:{line:99,column:2}},"62":{start:{line:98,column:2},end:{line:98,column:12}},"63":{start:{line:100,column:1},end:{line:107,column:2}},"64":{start:{line:101,column:12},end:{line:101,column:59}},"65":{start:{line:102,column:16},end:{line:105,column:4}},"66":{start:{line:103,column:15},end:{line:103,column:42}},"67":{start:{line:104,column:3},end:{line:104,column:58}},"68":{start:{line:106,column:2},end:{line:106,column:26}},"69":{start:{line:108,column:1},end:{line:110,column:2}},"70":{start:{line:109,column:2},end:{line:109,column:38}},"71":{start:{line:111,column:1},end:{line:113,column:2}},"72":{start:{line:112,column:2},end:{line:112,column:43}},"73":{start:{line:114,column:1},end:{line:119,column:2}},"74":{start:{line:115,column:16},end:{line:117,column:4}},"75":{start:{line:116,column:3},end:{line:116,column:45}},"76":{start:{line:118,column:2},end:{line:118,column:26}},"77":{start:{line:120,column:1},end:{line:122,column:2}},"78":{start:{line:121,column:2},end:{line:121,column:29}},"79":{start:{line:123,column:1},end:{line:125,column:2}},"80":{start:{line:124,column:2},end:{line:124,column:21}},"81":{start:{line:126,column:1},end:{line:128,column:2}},"82":{start:{line:127,column:2},end:{line:127,column:17}},"83":{start:{line:129,column:1},end:{line:138,column:2}},"84":{start:{line:130,column:2},end:{line:137,column:3}},"85":{start:{line:131,column:3},end:{line:136,column:4}},"86":{start:{line:132,column:21},end:{line:132,column:77}},"87":{start:{line:133,column:4},end:{line:135,column:5}},"88":{start:{line:134,column:5},end:{line:134,column:56}},"89":{start:{line:139,column:1},end:{line:152,column:2}},"90":{start:{line:140,column:2},end:{line:151,column:3}},"91":{start:{line:141,column:3},end:{line:150,column:4}},"92":{start:{line:142,column:4},end:{line:142,column:37}},"93":{start:{line:143,column:10},end:{line:150,column:4}},"94":{start:{line:144,column:19},end:{line:144,column:92}},"95":{start:{line:145,column:4},end:{line:147,column:5}},"96":{start:{line:146,column:5},end:{line:146,column:59}},"97":{start:{line:148,column:10},end:{line:150,column:4}},"98":{start:{line:149,column:4},end:{line:149,column:103}},"99":{start:{line:153,column:1},end:{line:155,column:2}},"100":{start:{line:154,column:2},end:{line:154,column:42}},"101":{start:{line:156,column:1},end:{line:162,column:2}},"102":{start:{line:157,column:2},end:{line:161,column:3}},"103":{start:{line:158,column:3},end:{line:160,column:4}},"104":{start:{line:159,column:4},end:{line:159,column:43}},"105":{start:{line:163,column:1},end:{line:165,column:2}},"106":{start:{line:164,column:2},end:{line:164,column:23}},"107":{start:{line:167,column:14},end:{line:167,column:45}},"108":{start:{line:168,column:13},end:{line:168,column:43}},"109":{start:{line:169,column:1},end:{line:169,column:29}},"110":{start:{line:172,column:21},end:{line:174,column:1}},"111":{start:{line:173,column:1},end:{line:173,column:48}},"112":{start:{line:176,column:21},end:{line:200,column:1}},"113":{start:{line:177,column:11},end:{line:177,column:13}},"114":{start:{line:178,column:13},end:{line:178,column:15}},"115":{start:{line:180,column:1},end:{line:191,column:2}},"116":{start:{line:181,column:12},end:{line:181,column:60}},"117":{start:{line:182,column:16},end:{line:185,column:4}},"118":{start:{line:183,column:15},end:{line:183,column:42}},"119":{start:{line:184,column:3},end:{line:184,column:58}},"120":{start:{line:186,column:2},end:{line:186,column:26}},"121":{start:{line:187,column:8},end:{line:191,column:2}},"122":{start:{line:188,column:2},end:{line:188,column:17}},"123":{start:{line:189,column:8},end:{line:191,column:2}},"124":{start:{line:190,column:2},end:{line:190,column:23}},"125":{start:{line:193,column:1},end:{line:193,column:47}},"126":{start:{line:195,column:1},end:{line:197,column:2}},"127":{start:{line:196,column:2},end:{line:196,column:11}},"128":{start:{line:199,column:1},end:{line:199,column:12}},"129":{start:{line:202,column:0},end:{line:205,column:2}}},fnMap:{"0":{name:"(anonymous_0)",decl:{start:{line:5,column:23},end:{line:5,column:24}},loc:{start:{line:5,column:48},end:{line:21,column:1}},line:5},"1":{name:"(anonymous_1)",decl:{start:{line:23,column:17},end:{line:23,column:18}},loc:{start:{line:23,column:51},end:{line:61,column:1}},line:23},"2":{name:"(anonymous_2)",decl:{start:{line:63,column:27},end:{line:63,column:28}},loc:{start:{line:63,column:40},end:{line:66,column:1}},line:63},"3":{name:"(anonymous_3)",decl:{start:{line:68,column:18},end:{line:68,column:19}},loc:{start:{line:68,column:31},end:{line:71,column:1}},line:68},"4":{name:"(anonymous_4)",decl:{start:{line:74,column:20},end:{line:74,column:21}},loc:{start:{line:74,column:38},end:{line:89,column:1}},line:74},"5":{name:"(anonymous_5)",decl:{start:{line:77,column:29},end:{line:77,column:30}},loc:{start:{line:77,column:44},end:{line:87,column:2}},line:77},"6":{name:"(anonymous_6)",decl:{start:{line:93,column:14},end:{line:93,column:15}},loc:{start:{line:93,column:57},end:{line:170,column:1}},line:93},"7":{name:"(anonymous_7)",decl:{start:{line:102,column:24},end:{line:102,column:25}},loc:{start:{line:102,column:37},end:{line:105,column:3}},line:102},"8":{name:"(anonymous_8)",decl:{start:{line:115,column:38},end:{line:115,column:39}},loc:{start:{line:115,column:54},end:{line:117,column:3}},line:115},"9":{name:"(anonymous_9)",decl:{start:{line:172,column:21},end:{line:172,column:22}},loc:{start:{line:172,column:34},end:{line:174,column:1}},line:172},"10":{name:"(anonymous_10)",decl:{start:{line:176,column:21},end:{line:176,column:22}},loc:{start:{line:176,column:34},end:{line:200,column:1}},line:176},"11":{name:"(anonymous_11)",decl:{start:{line:182,column:24},end:{line:182,column:25}},loc:{start:{line:182,column:37},end:{line:185,column:3}},line:182}},branchMap:{"0":{loc:{start:{line:9,column:1},end:{line:11,column:2}},type:"if",locations:[{start:{line:9,column:1},end:{line:11,column:2}},{start:{line:9,column:1},end:{line:11,column:2}}],line:9},"1":{loc:{start:{line:12,column:1},end:{line:20,column:2}},type:"if",locations:[{start:{line:12,column:1},end:{line:20,column:2}},{start:{line:12,column:1},end:{line:20,column:2}}],line:12},"2":{loc:{start:{line:15,column:2},end:{line:19,column:3}},type:"if",locations:[{start:{line:15,column:2},end:{line:19,column:3}},{start:{line:15,column:2},end:{line:19,column:3}}],line:15},"3":{loc:{start:{line:28,column:2},end:{line:30,column:3}},type:"if",locations:[{start:{line:28,column:2},end:{line:30,column:3}},{start:{line:28,column:2},end:{line:30,column:3}}],line:28},"4":{loc:{start:{line:28,column:6},end:{line:28,column:75}},type:"binary-expr",locations:[{start:{line:28,column:6},end:{line:28,column:14}},{start:{line:28,column:18},end:{line:28,column:75}}],line:28},"5":{loc:{start:{line:33,column:12},end:{line:33,column:50}},type:"binary-expr",locations:[{start:{line:33,column:12},end:{line:33,column:44}},{start:{line:33,column:48},end:{line:33,column:50}}],line:33},"6":{loc:{start:{line:36,column:2},end:{line:39,column:3}},type:"if",locations:[{start:{line:36,column:2},end:{line:39,column:3}},{start:{line:36,column:2},end:{line:39,column:3}}],line:36},"7":{loc:{start:{line:36,column:6},end:{line:36,column:63}},type:"binary-expr",locations:[{start:{line:36,column:6},end:{line:36,column:11}},{start:{line:36,column:15},end:{line:36,column:29}},{start:{line:36,column:33},end:{line:36,column:63}}],line:36},"8":{loc:{start:{line:45,column:2},end:{line:57,column:3}},type:"if",locations:[{start:{line:45,column:2},end:{line:57,column:3}},{start:{line:45,column:2},end:{line:57,column:3}}],line:45},"9":{loc:{start:{line:47,column:9},end:{line:57,column:3}},type:"if",locations:[{start:{line:47,column:9},end:{line:57,column:3}},{start:{line:47,column:9},end:{line:57,column:3}}],line:47},"10":{loc:{start:{line:48,column:3},end:{line:56,column:4}},type:"if",locations:[{start:{line:48,column:3},end:{line:56,column:4}},{start:{line:48,column:3},end:{line:56,column:4}}],line:48},"11":{loc:{start:{line:50,column:10},end:{line:56,column:4}},type:"if",locations:[{start:{line:50,column:10},end:{line:56,column:4}},{start:{line:50,column:10},end:{line:56,column:4}}],line:50},"12":{loc:{start:{line:50,column:14},end:{line:52,column:41}},type:"binary-expr",locations:[{start:{line:50,column:14},end:{line:50,column:77}},{start:{line:51,column:5},end:{line:51,column:43}},{start:{line:52,column:5},end:{line:52,column:41}}],line:50},"13":{loc:{start:{line:65,column:8},end:{line:65,column:64}},type:"binary-expr",locations:[{start:{line:65,column:8},end:{line:65,column:13}},{start:{line:65,column:17},end:{line:65,column:64}}],line:65},"14":{loc:{start:{line:78,column:2},end:{line:86,column:3}},type:"if",locations:[{start:{line:78,column:2},end:{line:86,column:3}},{start:{line:78,column:2},end:{line:86,column:3}}],line:78},"15":{loc:{start:{line:78,column:6},end:{line:78,column:60}},type:"binary-expr",locations:[{start:{line:78,column:6},end:{line:78,column:18}},{start:{line:78,column:22},end:{line:78,column:60}}],line:78},"16":{loc:{start:{line:79,column:3},end:{line:85,column:4}},type:"if",locations:[{start:{line:79,column:3},end:{line:85,column:4}},{start:{line:79,column:3},end:{line:85,column:4}}],line:79},"17":{loc:{start:{line:80,column:4},end:{line:82,column:5}},type:"if",locations:[{start:{line:80,column:4},end:{line:82,column:5}},{start:{line:80,column:4},end:{line:82,column:5}}],line:80},"18":{loc:{start:{line:80,column:8},end:{line:80,column:61}},type:"binary-expr",locations:[{start:{line:80,column:8},end:{line:80,column:18}},{start:{line:80,column:22},end:{line:80,column:61}}],line:80},"19":{loc:{start:{line:83,column:10},end:{line:85,column:4}},type:"if",locations:[{start:{line:83,column:10},end:{line:85,column:4}},{start:{line:83,column:10},end:{line:85,column:4}}],line:83},"20":{loc:{start:{line:95,column:13},end:{line:95,column:24}},type:"binary-expr",locations:[{start:{line:95,column:13},end:{line:95,column:18}},{start:{line:95,column:22},end:{line:95,column:24}}],line:95},"21":{loc:{start:{line:97,column:1},end:{line:99,column:2}},type:"if",locations:[{start:{line:97,column:1},end:{line:99,column:2}},{start:{line:97,column:1},end:{line:99,column:2}}],line:97},"22":{loc:{start:{line:100,column:1},end:{line:107,column:2}},type:"if",locations:[{start:{line:100,column:1},end:{line:107,column:2}},{start:{line:100,column:1},end:{line:107,column:2}}],line:100},"23":{loc:{start:{line:100,column:5},end:{line:100,column:50}},type:"binary-expr",locations:[{start:{line:100,column:5},end:{line:100,column:15}},{start:{line:100,column:19},end:{line:100,column:50}}],line:100},"24":{loc:{start:{line:104,column:10},end:{line:104,column:57}},type:"cond-expr",locations:[{start:{line:104,column:18},end:{line:104,column:52}},{start:{line:104,column:55},end:{line:104,column:57}}],line:104},"25":{loc:{start:{line:108,column:1},end:{line:110,column:2}},type:"if",locations:[{start:{line:108,column:1},end:{line:110,column:2}},{start:{line:108,column:1},end:{line:110,column:2}}],line:108},"26":{loc:{start:{line:108,column:5},end:{line:108,column:46}},type:"binary-expr",locations:[{start:{line:108,column:5},end:{line:108,column:16}},{start:{line:108,column:20},end:{line:108,column:46}}],line:108},"27":{loc:{start:{line:111,column:1},end:{line:113,column:2}},type:"if",locations:[{start:{line:111,column:1},end:{line:113,column:2}},{start:{line:111,column:1},end:{line:113,column:2}}],line:111},"28":{loc:{start:{line:111,column:5},end:{line:111,column:53}},type:"binary-expr",locations:[{start:{line:111,column:5},end:{line:111,column:16}},{start:{line:111,column:20},end:{line:111,column:53}}],line:111},"29":{loc:{start:{line:114,column:1},end:{line:119,column:2}},type:"if",locations:[{start:{line:114,column:1},end:{line:119,column:2}},{start:{line:114,column:1},end:{line:119,column:2}}],line:114},"30":{loc:{start:{line:114,column:5},end:{line:114,column:42}},type:"binary-expr",locations:[{start:{line:114,column:5},end:{line:114,column:9}},{start:{line:114,column:13},end:{line:114,column:23}},{start:{line:114,column:27},end:{line:114,column:42}}],line:114},"31":{loc:{start:{line:120,column:1},end:{line:122,column:2}},type:"if",locations:[{start:{line:120,column:1},end:{line:122,column:2}},{start:{line:120,column:1},end:{line:122,column:2}}],line:120},"32":{loc:{start:{line:121,column:8},end:{line:121,column:28}},type:"binary-expr",locations:[{start:{line:121,column:8},end:{line:121,column:22}},{start:{line:121,column:26},end:{line:121,column:28}}],line:121},"33":{loc:{start:{line:123,column:1},end:{line:125,column:2}},type:"if",locations:[{start:{line:123,column:1},end:{line:125,column:2}},{start:{line:123,column:1},end:{line:125,column:2}}],line:123},"34":{loc:{start:{line:124,column:8},end:{line:124,column:20}},type:"binary-expr",locations:[{start:{line:124,column:8},end:{line:124,column:14}},{start:{line:124,column:18},end:{line:124,column:20}}],line:124},"35":{loc:{start:{line:126,column:1},end:{line:128,column:2}},type:"if",locations:[{start:{line:126,column:1},end:{line:128,column:2}},{start:{line:126,column:1},end:{line:128,column:2}}],line:126},"36":{loc:{start:{line:126,column:5},end:{line:126,column:58}},type:"binary-expr",locations:[{start:{line:126,column:5},end:{line:126,column:16}},{start:{line:126,column:20},end:{line:126,column:46}},{start:{line:126,column:50},end:{line:126,column:58}}],line:126},"37":{loc:{start:{line:129,column:1},end:{line:138,column:2}},type:"if",locations:[{start:{line:129,column:1},end:{line:138,column:2}},{start:{line:129,column:1},end:{line:138,column:2}}],line:129},"38":{loc:{start:{line:131,column:3},end:{line:136,column:4}},type:"if",locations:[{start:{line:131,column:3},end:{line:136,column:4}},{start:{line:131,column:3},end:{line:136,column:4}}],line:131},"39":{loc:{start:{line:133,column:4},end:{line:135,column:5}},type:"if",locations:[{start:{line:133,column:4},end:{line:135,column:5}},{start:{line:133,column:4},end:{line:135,column:5}}],line:133},"40":{loc:{start:{line:139,column:1},end:{line:152,column:2}},type:"if",locations:[{start:{line:139,column:1},end:{line:152,column:2}},{start:{line:139,column:1},end:{line:152,column:2}}],line:139},"41":{loc:{start:{line:139,column:5},end:{line:139,column:68}},type:"binary-expr",locations:[{start:{line:139,column:5},end:{line:139,column:24}},{start:{line:139,column:28},end:{line:139,column:37}},{start:{line:139,column:41},end:{line:139,column:68}}],line:139},"42":{loc:{start:{line:140,column:2},end:{line:151,column:3}},type:"if",locations:[{start:{line:140,column:2},end:{line:151,column:3}},{start:{line:140,column:2},end:{line:151,column:3}}],line:140},"43":{loc:{start:{line:140,column:6},end:{line:140,column:79}},type:"binary-expr",locations:[{start:{line:140,column:6},end:{line:140,column:17}},{start:{line:140,column:21},end:{line:140,column:79}}],line:140},"44":{loc:{start:{line:141,column:3},end:{line:150,column:4}},type:"if",locations:[{start:{line:141,column:3},end:{line:150,column:4}},{start:{line:141,column:3},end:{line:150,column:4}}],line:141},"45":{loc:{start:{line:142,column:10},end:{line:142,column:36}},type:"binary-expr",locations:[{start:{line:142,column:10},end:{line:142,column:18}},{start:{line:142,column:22},end:{line:142,column:36}}],line:142},"46":{loc:{start:{line:143,column:10},end:{line:150,column:4}},type:"if",locations:[{start:{line:143,column:10},end:{line:150,column:4}},{start:{line:143,column:10},end:{line:150,column:4}}],line:143},"47":{loc:{start:{line:144,column:19},end:{line:144,column:92}},type:"binary-expr",locations:[{start:{line:144,column:19},end:{line:144,column:55}},{start:{line:144,column:59},end:{line:144,column:92}}],line:144},"48":{loc:{start:{line:145,column:4},end:{line:147,column:5}},type:"if",locations:[{start:{line:145,column:4},end:{line:147,column:5}},{start:{line:145,column:4},end:{line:147,column:5}}],line:145},"49":{loc:{start:{line:148,column:10},end:{line:150,column:4}},type:"if",locations:[{start:{line:148,column:10},end:{line:150,column:4}},{start:{line:148,column:10},end:{line:150,column:4}}],line:148},"50":{loc:{start:{line:149,column:16},end:{line:149,column:101}},type:"binary-expr",locations:[{start:{line:149,column:16},end:{line:149,column:51}},{start:{line:149,column:55},end:{line:149,column:89}},{start:{line:149,column:93},end:{line:149,column:101}}],line:149},"51":{loc:{start:{line:153,column:1},end:{line:155,column:2}},type:"if",locations:[{start:{line:153,column:1},end:{line:155,column:2}},{start:{line:153,column:1},end:{line:155,column:2}}],line:153},"52":{loc:{start:{line:153,column:5},end:{line:153,column:89}},type:"binary-expr",locations:[{start:{line:153,column:5},end:{line:153,column:16}},{start:{line:153,column:21},end:{line:153,column:30}},{start:{line:153,column:34},end:{line:153,column:58}},{start:{line:153,column:63},end:{line:153,column:89}}],line:153},"53":{loc:{start:{line:156,column:1},end:{line:162,column:2}},type:"if",locations:[{start:{line:156,column:1},end:{line:162,column:2}},{start:{line:156,column:1},end:{line:162,column:2}}],line:156},"54":{loc:{start:{line:158,column:3},end:{line:160,column:4}},type:"if",locations:[{start:{line:158,column:3},end:{line:160,column:4}},{start:{line:158,column:3},end:{line:160,column:4}}],line:158},"55":{loc:{start:{line:163,column:1},end:{line:165,column:2}},type:"if",locations:[{start:{line:163,column:1},end:{line:165,column:2}},{start:{line:163,column:1},end:{line:165,column:2}}],line:163},"56":{loc:{start:{line:164,column:8},end:{line:164,column:22}},type:"binary-expr",locations:[{start:{line:164,column:8},end:{line:164,column:16}},{start:{line:164,column:20},end:{line:164,column:22}}],line:164},"57":{loc:{start:{line:180,column:1},end:{line:191,column:2}},type:"if",locations:[{start:{line:180,column:1},end:{line:191,column:2}},{start:{line:180,column:1},end:{line:191,column:2}}],line:180},"58":{loc:{start:{line:184,column:10},end:{line:184,column:57}},type:"cond-expr",locations:[{start:{line:184,column:18},end:{line:184,column:52}},{start:{line:184,column:55},end:{line:184,column:57}}],line:184},"59":{loc:{start:{line:187,column:8},end:{line:191,column:2}},type:"if",locations:[{start:{line:187,column:8},end:{line:191,column:2}},{start:{line:187,column:8},end:{line:191,column:2}}],line:187},"60":{loc:{start:{line:189,column:8},end:{line:191,column:2}},type:"if",locations:[{start:{line:189,column:8},end:{line:191,column:2}},{start:{line:189,column:8},end:{line:191,column:2}}],line:189},"61":{loc:{start:{line:193,column:8},end:{line:193,column:17}},type:"binary-expr",locations:[{start:{line:193,column:8},end:{line:193,column:11}},{start:{line:193,column:15},end:{line:193,column:17}}],line:193},"62":{loc:{start:{line:195,column:1},end:{line:197,column:2}},type:"if",locations:[{start:{line:195,column:1},end:{line:197,column:2}},{start:{line:195,column:1},end:{line:197,column:2}}],line:195}},s:{"0":0,"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0,"10":0,"11":0,"12":0,"13":0,"14":0,"15":0,"16":0,"17":0,"18":0,"19":0,"20":0,"21":0,"22":0,"23":0,"24":0,"25":0,"26":0,"27":0,"28":0,"29":0,"30":0,"31":0,"32":0,"33":0,"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0,"41":0,"42":0,"43":0,"44":0,"45":0,"46":0,"47":0,"48":0,"49":0,"50":0,"51":0,"52":0,"53":0,"54":0,"55":0,"56":0,"57":0,"58":0,"59":0,"60":0,"61":0,"62":0,"63":0,"64":0,"65":0,"66":0,"67":0,"68":0,"69":0,"70":0,"71":0,"72":0,"73":0,"74":0,"75":0,"76":0,"77":0,"78":0,"79":0,"80":0,"81":0,"82":0,"83":0,"84":0,"85":0,"86":0,"87":0,"88":0,"89":0,"90":0,"91":0,"92":0,"93":0,"94":0,"95":0,"96":0,"97":0,"98":0,"99":0,"100":0,"101":0,"102":0,"103":0,"104":0,"105":0,"106":0,"107":0,"108":0,"109":0,"110":0,"111":0,"112":0,"113":0,"114":0,"115":0,"116":0,"117":0,"118":0,"119":0,"120":0,"121":0,"122":0,"123":0,"124":0,"125":0,"126":0,"127":0,"128":0,"129":0},f:{"0":0,"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0,"10":0,"11":0},b:{"0":[0,0],"1":[0,0],"2":[0,0],"3":[0,0],"4":[0,0],"5":[0,0],"6":[0,0],"7":[0,0,0],"8":[0,0],"9":[0,0],"10":[0,0],"11":[0,0],"12":[0,0,0],"13":[0,0],"14":[0,0],"15":[0,0],"16":[0,0],"17":[0,0],"18":[0,0],"19":[0,0],"20":[0,0],"21":[0,0],"22":[0,0],"23":[0,0],"24":[0,0],"25":[0,0],"26":[0,0],"27":[0,0],"28":[0,0],"29":[0,0],"30":[0,0,0],"31":[0,0],"32":[0,0],"33":[0,0],"34":[0,0],"35":[0,0],"36":[0,0,0],"37":[0,0],"38":[0,0],"39":[0,0],"40":[0,0],"41":[0,0,0],"42":[0,0],"43":[0,0],"44":[0,0],"45":[0,0],"46":[0,0],"47":[0,0],"48":[0,0],"49":[0,0],"50":[0,0,0],"51":[0,0],"52":[0,0,0,0],"53":[0,0],"54":[0,0],"55":[0,0],"56":[0,0],"57":[0,0],"58":[0,0],"59":[0,0],"60":[0,0],"61":[0,0],"62":[0,0]},_coverageSchema:"43e27e138ebf9cfc5966b082cf9a028302ed4184"};var coverage=global[gcv]||(global[gcv]={});if(coverage[path]&&coverage[path].hash===hash){return coverage[path];}coverageData.hash=hash;return coverage[path]=coverageData;}();var constants=(cov_2q245nv9x6.s[0]++,require('./constants.js'));var query=(cov_2q245nv9x6.s[1]++,require('./query.js'));var util=(cov_2q245nv9x6.s[2]++,require('./util.js'));cov_2q245nv9x6.s[3]++;var getPseudoContent=function(node,selector){cov_2q245nv9x6.f[0]++;var styles=(cov_2q245nv9x6.s[4]++,window.getComputedStyle(node,selector));var ret=(cov_2q245nv9x6.s[5]++,styles.getPropertyValue('content'));var inline=(cov_2q245nv9x6.s[6]++,styles.display.substr(0,6)==='inline');cov_2q245nv9x6.s[7]++;if(!ret){cov_2q245nv9x6.b[0][0]++;cov_2q245nv9x6.s[8]++;return'';}else{cov_2q245nv9x6.b[0][1]++;}cov_2q245nv9x6.s[9]++;if(ret.substr(0,1)!=='"'){cov_2q245nv9x6.b[1][0]++;cov_2q245nv9x6.s[10]++;return'';}else{cov_2q245nv9x6.b[1][1]++;cov_2q245nv9x6.s[11]++;if(inline){cov_2q245nv9x6.b[2][0]++;cov_2q245nv9x6.s[12]++;return ret.slice(1,-1);}else{cov_2q245nv9x6.b[2][1]++;cov_2q245nv9x6.s[13]++;return' '+ret.slice(1,-1)+' ';}}};cov_2q245nv9x6.s[14]++;var getContent=function(root,referenced,owned){cov_2q245nv9x6.f[1]++;var children=(cov_2q245nv9x6.s[15]++,[]);cov_2q245nv9x6.s[16]++;for(var i=(cov_2q245nv9x6.s[17]++,0);i<root.childNodes.length;i++){var node=(cov_2q245nv9x6.s[18]++,root.childNodes[i]);cov_2q245nv9x6.s[19]++;if((cov_2q245nv9x6.b[4][0]++,!node.id)||(cov_2q245nv9x6.b[4][1]++,!document.querySelector('[aria-owns~="'+node.id+'"]'))){cov_2q245nv9x6.b[3][0]++;cov_2q245nv9x6.s[20]++;children.push(node);}else{cov_2q245nv9x6.b[3][1]++;}}var owns=(cov_2q245nv9x6.s[21]++,(cov_2q245nv9x6.b[5][0]++,query.getAttribute(root,'owns'))||(cov_2q245nv9x6.b[5][1]++,[]));cov_2q245nv9x6.s[22]++;for(var i=(cov_2q245nv9x6.s[23]++,0);i<owns.length;i++){var child=(cov_2q245nv9x6.s[24]++,document.getElementById(owns[i]));cov_2q245nv9x6.s[25]++;if((cov_2q245nv9x6.b[7][0]++,child)&&(cov_2q245nv9x6.b[7][1]++,child!==root)&&(cov_2q245nv9x6.b[7][2]++,owned.indexOf(child.id)===-1)){cov_2q245nv9x6.b[6][0]++;cov_2q245nv9x6.s[26]++;children.push(child);cov_2q245nv9x6.s[27]++;owned.push(child.id);}else{cov_2q245nv9x6.b[6][1]++;}}var ret=(cov_2q245nv9x6.s[28]++,'');cov_2q245nv9x6.s[29]++;for(var i=(cov_2q245nv9x6.s[30]++,0);i<children.length;i++){var node=(cov_2q245nv9x6.s[31]++,children[i]);cov_2q245nv9x6.s[32]++;if(node.nodeType===node.TEXT_NODE){cov_2q245nv9x6.b[8][0]++;cov_2q245nv9x6.s[33]++;ret+=node.textContent;}else{cov_2q245nv9x6.b[8][1]++;cov_2q245nv9x6.s[34]++;if(node.nodeType===node.ELEMENT_NODE){cov_2q245nv9x6.b[9][0]++;cov_2q245nv9x6.s[35]++;if(node.tagName.toLowerCase()==='br'){cov_2q245nv9x6.b[10][0]++;cov_2q245nv9x6.s[36]++;ret+='\n';}else{cov_2q245nv9x6.b[10][1]++;cov_2q245nv9x6.s[37]++;if((cov_2q245nv9x6.b[12][0]++,window.getComputedStyle(node).display.substr(0,6)==='inline')&&(cov_2q245nv9x6.b[12][1]++,node.tagName.toLowerCase()!=='input')&&(cov_2q245nv9x6.b[12][2]++,node.tagName.toLowerCase()!=='img')){cov_2q245nv9x6.b[11][0]++;cov_2q245nv9x6.s[38]++;// https://github.com/w3c/accname/issues/3
ret+=getName(node,true,referenced,owned);}else{cov_2q245nv9x6.b[11][1]++;cov_2q245nv9x6.s[39]++;ret+=' '+getName(node,true,referenced,owned)+' ';}}}else{cov_2q245nv9x6.b[9][1]++;}}}cov_2q245nv9x6.s[40]++;return ret;};cov_2q245nv9x6.s[41]++;var allowNameFromContent=function(el){cov_2q245nv9x6.f[2]++;var role=(cov_2q245nv9x6.s[42]++,query.getRole(el));cov_2q245nv9x6.s[43]++;return(cov_2q245nv9x6.b[13][0]++,!role)||(cov_2q245nv9x6.b[13][1]++,constants.nameFromContents.indexOf(role)!==-1);};cov_2q245nv9x6.s[44]++;var isLabelable=function(el){cov_2q245nv9x6.f[3]++;var selector=(cov_2q245nv9x6.s[45]++,constants.labelable.join(','));cov_2q245nv9x6.s[46]++;return el.matches(selector);};// Control.labels is part of the standard, but not supported in most browsers
cov_2q245nv9x6.s[47]++;var getLabelNodes=function(element){cov_2q245nv9x6.f[4]++;var labels=(cov_2q245nv9x6.s[48]++,[]);var labelable=(cov_2q245nv9x6.s[49]++,constants.labelable.join(','));cov_2q245nv9x6.s[50]++;util.walkDOM(document.body,function(node){cov_2q245nv9x6.f[5]++;cov_2q245nv9x6.s[51]++;if((cov_2q245nv9x6.b[15][0]++,node.tagName)&&(cov_2q245nv9x6.b[15][1]++,node.tagName.toLowerCase()==='label')){cov_2q245nv9x6.b[14][0]++;cov_2q245nv9x6.s[52]++;if(node.getAttribute('for')){cov_2q245nv9x6.b[16][0]++;cov_2q245nv9x6.s[53]++;if((cov_2q245nv9x6.b[18][0]++,element.id)&&(cov_2q245nv9x6.b[18][1]++,node.getAttribute('for')===element.id)){cov_2q245nv9x6.b[17][0]++;cov_2q245nv9x6.s[54]++;labels.push(node);}else{cov_2q245nv9x6.b[17][1]++;}}else{cov_2q245nv9x6.b[16][1]++;cov_2q245nv9x6.s[55]++;if(node.querySelector(labelable)===element){cov_2q245nv9x6.b[19][0]++;cov_2q245nv9x6.s[56]++;labels.push(node);}else{cov_2q245nv9x6.b[19][1]++;}}}else{cov_2q245nv9x6.b[14][1]++;}});cov_2q245nv9x6.s[57]++;return labels;};// http://www.ssbbartgroup.com/blog/how-the-w3c-text-alternative-computation-works/
// https://www.w3.org/TR/accname-aam-1.1/#h-mapping_additional_nd_te
cov_2q245nv9x6.s[58]++;var getName=function(el,recursive,referenced,owned){cov_2q245nv9x6.f[6]++;var ret=(cov_2q245nv9x6.s[59]++,'');var owned=(cov_2q245nv9x6.s[60]++,(cov_2q245nv9x6.b[20][0]++,owned)||(cov_2q245nv9x6.b[20][1]++,[]));cov_2q245nv9x6.s[61]++;if(query.getAttribute(el,'hidden',referenced)){cov_2q245nv9x6.b[21][0]++;cov_2q245nv9x6.s[62]++;return'';}else{cov_2q245nv9x6.b[21][1]++;}cov_2q245nv9x6.s[63]++;if((cov_2q245nv9x6.b[23][0]++,!recursive)&&(cov_2q245nv9x6.b[23][1]++,el.matches('[aria-labelledby]'))){cov_2q245nv9x6.b[22][0]++;var ids=(cov_2q245nv9x6.s[64]++,el.getAttribute('aria-labelledby').split(/\s+/));var strings=(cov_2q245nv9x6.s[65]++,ids.map(function(id){cov_2q245nv9x6.f[7]++;var label=(cov_2q245nv9x6.s[66]++,document.getElementById(id));cov_2q245nv9x6.s[67]++;return label?(cov_2q245nv9x6.b[24][0]++,getName(label,true,label,owned)):(cov_2q245nv9x6.b[24][1]++,'');}));cov_2q245nv9x6.s[68]++;ret=strings.join(' ');}else{cov_2q245nv9x6.b[22][1]++;}cov_2q245nv9x6.s[69]++;if((cov_2q245nv9x6.b[26][0]++,!ret.trim())&&(cov_2q245nv9x6.b[26][1]++,el.matches('[aria-label]'))){cov_2q245nv9x6.b[25][0]++;cov_2q245nv9x6.s[70]++;ret=el.getAttribute('aria-label');}else{cov_2q245nv9x6.b[25][1]++;}cov_2q245nv9x6.s[71]++;if((cov_2q245nv9x6.b[28][0]++,!ret.trim())&&(cov_2q245nv9x6.b[28][1]++,query.matches(el,'presentation'))){cov_2q245nv9x6.b[27][0]++;cov_2q245nv9x6.s[72]++;return getContent(el,referenced,owned);}else{cov_2q245nv9x6.b[27][1]++;}cov_2q245nv9x6.s[73]++;if((cov_2q245nv9x6.b[30][0]++,!ret)&&(cov_2q245nv9x6.b[30][1]++,!recursive)&&(cov_2q245nv9x6.b[30][2]++,isLabelable(el))){cov_2q245nv9x6.b[29][0]++;var strings=(cov_2q245nv9x6.s[74]++,getLabelNodes(el).map(function(label){cov_2q245nv9x6.f[8]++;cov_2q245nv9x6.s[75]++;return getName(label,true,label,owned);}));cov_2q245nv9x6.s[76]++;ret=strings.join(' ');}else{cov_2q245nv9x6.b[29][1]++;}cov_2q245nv9x6.s[77]++;if(!ret.trim()){cov_2q245nv9x6.b[31][0]++;cov_2q245nv9x6.s[78]++;ret=(cov_2q245nv9x6.b[32][0]++,el.placeholder)||(cov_2q245nv9x6.b[32][1]++,'');}else{cov_2q245nv9x6.b[31][1]++;}cov_2q245nv9x6.s[79]++;if(!ret.trim()){cov_2q245nv9x6.b[33][0]++;cov_2q245nv9x6.s[80]++;ret=(cov_2q245nv9x6.b[34][0]++,el.alt)||(cov_2q245nv9x6.b[34][1]++,'');}else{cov_2q245nv9x6.b[33][1]++;}cov_2q245nv9x6.s[81]++;if((cov_2q245nv9x6.b[36][0]++,!ret.trim())&&(cov_2q245nv9x6.b[36][1]++,el.matches('abbr,acronym'))&&(cov_2q245nv9x6.b[36][2]++,el.title)){cov_2q245nv9x6.b[35][0]++;cov_2q245nv9x6.s[82]++;ret=el.title;}else{cov_2q245nv9x6.b[35][1]++;}cov_2q245nv9x6.s[83]++;if(!ret.trim()){cov_2q245nv9x6.b[37][0]++;cov_2q245nv9x6.s[84]++;for(var selector in constants.nameFromDescendant){cov_2q245nv9x6.s[85]++;if(el.matches(selector)){cov_2q245nv9x6.b[38][0]++;var descendant=(cov_2q245nv9x6.s[86]++,el.querySelector(constants.nameFromDescendant[selector]));cov_2q245nv9x6.s[87]++;if(descendant){cov_2q245nv9x6.b[39][0]++;cov_2q245nv9x6.s[88]++;ret=getName(descendant,true,descendant,owned);}else{cov_2q245nv9x6.b[39][1]++;}}else{cov_2q245nv9x6.b[38][1]++;}}}else{cov_2q245nv9x6.b[37][1]++;}cov_2q245nv9x6.s[89]++;if((cov_2q245nv9x6.b[41][0]++,el.closest('label'))||(cov_2q245nv9x6.b[41][1]++,recursive)||(cov_2q245nv9x6.b[41][2]++,query.matches(el,'button'))){cov_2q245nv9x6.b[40][0]++;cov_2q245nv9x6.s[90]++;if((cov_2q245nv9x6.b[43][0]++,!ret.trim())&&(cov_2q245nv9x6.b[43][1]++,query.matches(el,'textbox,button,combobox,listbox,range'))){cov_2q245nv9x6.b[42][0]++;cov_2q245nv9x6.s[91]++;if(query.matches(el,'textbox,button')){cov_2q245nv9x6.b[44][0]++;cov_2q245nv9x6.s[92]++;ret=(cov_2q245nv9x6.b[45][0]++,el.value)||(cov_2q245nv9x6.b[45][1]++,el.textContent);}else{cov_2q245nv9x6.b[44][1]++;cov_2q245nv9x6.s[93]++;if(query.matches(el,'combobox,listbox')){cov_2q245nv9x6.b[46][0]++;var selected=(cov_2q245nv9x6.s[94]++,(cov_2q245nv9x6.b[47][0]++,query.querySelector(el,':selected'))||(cov_2q245nv9x6.b[47][1]++,query.querySelector(el,'option')));cov_2q245nv9x6.s[95]++;if(selected){cov_2q245nv9x6.b[48][0]++;cov_2q245nv9x6.s[96]++;ret=getName(selected,recursive,referenced,owned);}else{cov_2q245nv9x6.b[48][1]++;}}else{cov_2q245nv9x6.b[46][1]++;cov_2q245nv9x6.s[97]++;if(query.matches(el,'range')){cov_2q245nv9x6.b[49][0]++;cov_2q245nv9x6.s[98]++;ret=''+((cov_2q245nv9x6.b[50][0]++,query.getAttribute(el,'valuetext'))||(cov_2q245nv9x6.b[50][1]++,query.getAttribute(el,'valuenow'))||(cov_2q245nv9x6.b[50][2]++,el.value));}else{cov_2q245nv9x6.b[49][1]++;}}}}else{cov_2q245nv9x6.b[42][1]++;}}else{cov_2q245nv9x6.b[40][1]++;}cov_2q245nv9x6.s[99]++;if((cov_2q245nv9x6.b[52][0]++,!ret.trim())&&((cov_2q245nv9x6.b[52][1]++,recursive)||(cov_2q245nv9x6.b[52][2]++,allowNameFromContent(el)))&&(cov_2q245nv9x6.b[52][3]++,!query.matches(el,'menu'))){cov_2q245nv9x6.b[51][0]++;cov_2q245nv9x6.s[100]++;ret=getContent(el,referenced,owned);}else{cov_2q245nv9x6.b[51][1]++;}cov_2q245nv9x6.s[101]++;if(!ret.trim()){cov_2q245nv9x6.b[53][0]++;cov_2q245nv9x6.s[102]++;for(var selector in constants.nameDefaults){cov_2q245nv9x6.s[103]++;if(el.matches(selector)){cov_2q245nv9x6.b[54][0]++;cov_2q245nv9x6.s[104]++;ret=constants.nameDefaults[selector];}else{cov_2q245nv9x6.b[54][1]++;}}}else{cov_2q245nv9x6.b[53][1]++;}cov_2q245nv9x6.s[105]++;if(!ret.trim()){cov_2q245nv9x6.b[55][0]++;cov_2q245nv9x6.s[106]++;ret=(cov_2q245nv9x6.b[56][0]++,el.title)||(cov_2q245nv9x6.b[56][1]++,'');}else{cov_2q245nv9x6.b[55][1]++;}var before=(cov_2q245nv9x6.s[107]++,getPseudoContent(el,':before'));var after=(cov_2q245nv9x6.s[108]++,getPseudoContent(el,':after'));cov_2q245nv9x6.s[109]++;return before+ret+after;};cov_2q245nv9x6.s[110]++;var getNameTrimmed=function(el){cov_2q245nv9x6.f[9]++;cov_2q245nv9x6.s[111]++;return getName(el).replace(/\s+/g,' ').trim();};cov_2q245nv9x6.s[112]++;var getDescription=function(el){cov_2q245nv9x6.f[10]++;var ret=(cov_2q245nv9x6.s[113]++,'');var owned=(cov_2q245nv9x6.s[114]++,[]);cov_2q245nv9x6.s[115]++;if(el.matches('[aria-describedby]')){cov_2q245nv9x6.b[57][0]++;var ids=(cov_2q245nv9x6.s[116]++,el.getAttribute('aria-describedby').split(/\s+/));var strings=(cov_2q245nv9x6.s[117]++,ids.map(function(id){cov_2q245nv9x6.f[11]++;var label=(cov_2q245nv9x6.s[118]++,document.getElementById(id));cov_2q245nv9x6.s[119]++;return label?(cov_2q245nv9x6.b[58][0]++,getName(label,true,label,owned)):(cov_2q245nv9x6.b[58][1]++,'');}));cov_2q245nv9x6.s[120]++;ret=strings.join(' ');}else{cov_2q245nv9x6.b[57][1]++;cov_2q245nv9x6.s[121]++;if(el.title){cov_2q245nv9x6.b[59][0]++;cov_2q245nv9x6.s[122]++;ret=el.title;}else{cov_2q245nv9x6.b[59][1]++;cov_2q245nv9x6.s[123]++;if(el.placeholder){cov_2q245nv9x6.b[60][0]++;cov_2q245nv9x6.s[124]++;ret=el.placeholder;}else{cov_2q245nv9x6.b[60][1]++;}}}cov_2q245nv9x6.s[125]++;ret=((cov_2q245nv9x6.b[61][0]++,ret)||(cov_2q245nv9x6.b[61][1]++,'')).trim().replace(/\s+/g,' ');cov_2q245nv9x6.s[126]++;if(ret===getNameTrimmed(el)){cov_2q245nv9x6.b[62][0]++;cov_2q245nv9x6.s[127]++;ret='';}else{cov_2q245nv9x6.b[62][1]++;}cov_2q245nv9x6.s[128]++;return ret;};cov_2q245nv9x6.s[129]++;module.exports={getName:getNameTrimmed,getDescription:getDescription};

},{"./constants.js":5,"./query.js":7,"./util.js":8}],7:[function(require,module,exports){
var constants = require('./constants.js');
var util = require('./util.js');

var getSubRoles = function(roles) {
	return [].concat.apply([], roles.map(function(role) {
		return constants.subRoles[role] || [role];
	}));
};

// candidates can be passed for performance optimization
var _getRole = function(el, candidates) {
	if (el.hasAttribute('role')) {
		return el.getAttribute('role');
	}
	for (var role in constants.extraSelectors) {
		var selector = constants.extraSelectors[role].join(',');
		if ((!candidates || candidates.indexOf(role) !== -1) && el.matches(selector)) {
			return role;
		}
	}

	if (!candidates ||
			candidates.indexOf('banner') !== -1 ||
			candidates.indexOf('contentinfo') !== -1) {
		var scoped = el.matches(constants.scoped);

		if (el.matches('header') && !scoped) {
			return 'banner';
		}
		if (el.matches('footer') && !scoped) {
			return 'contentinfo';
		}
	}
};

var getAttribute = function(el, key, _hiddenRoot) {
	if (key === 'hidden' && el === _hiddenRoot) {  // used for name calculation
		return false;
	}

	if (constants.attributeStrongMapping.hasOwnProperty(key)) {
		var value = el[constants.attributeStrongMapping[key]];
		if (value) {
			return value;
		}
	}
	if (key === 'readonly' && el.contentEditable) {
		return false;
	} else if (key === 'invalid' && el.checkValidity) {
		return !el.checkValidity();
	} else if (key === 'hidden') {
		var style = window.getComputedStyle(el);
		if (style.display === 'none' || style.visibility === 'hidden') {
			return true;
		}
	}

	var type = constants.attributes[key];
	var raw = el.getAttribute('aria-' + key);

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
			return parseInt(raw);
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
		for (var i = 1; i <= 6; i++) {
			if (el.tagName.toLowerCase() === 'h' + i) {
				return i;
			}
		}
	} else if (key === 'hidden') {
		if (el.clientHeight === 0) {  // rough check for performance
			return el.parentNode && getAttribute(el.parentNode, 'hidden', _hiddenRoot);
		}
	} else if (constants.attributeWeakMapping.hasOwnProperty(key)) {
		return el[constants.attributeWeakMapping[key]];
	}

	if (type === 'bool' || type === 'tristate') {
		return false;
	}
};

var matches = function(el, selector) {
	var actual;

	if (selector.substr(0, 1) === ':') {
		var attr = selector.substr(1);
		return getAttribute(el, attr);
	} else if (selector.substr(0, 1) === '[') {
		var match = /\[([a-z]+)="(.*)"\]/.exec(selector);
		actual = getAttribute(el, match[1]);
		var rawValue = match[2];
		return actual.toString() == rawValue;
	} else {
		var candidates = getSubRoles(selector.split(','));
		actual = _getRole(el, candidates);
		return candidates.indexOf(actual) !== -1;
	}
};

var _querySelector = function(all) {
	return function(root, role) {
		var results = [];
		util.walkDOM(root, function(node) {
			if (node.nodeType === node.ELEMENT_NODE) {
				// FIXME: skip hidden elements
				if (matches(node, role)) {
					results.push(node);
					if (!all) {
						return false;
					}
				}
			}
		});
		return all ? results : results[0];
	};
};

var closest = function(el, selector) {
	return util.searchUp(el, function(candidate) {
		return matches(candidate, selector);
	});
};

module.exports = {
	getRole: function(el) {
		return _getRole(el);
	},
	getAttribute: getAttribute,
	matches: matches,
	querySelector: _querySelector(),
	querySelectorAll: _querySelector(true),
	closest: closest,
};

},{"./constants.js":5,"./util.js":8}],8:[function(require,module,exports){
var walkDOM = function(root, fn) {
	if (fn(root) === false) {
		return false;
	}
	var node = root.firstChild;
	while (node) {
		if (walkDOM(node, fn) === false) {
			return false;
		}
		node = node.nextSibling;
	}
};

var searchUp = function(el, test) {
	var candidate = el.parentElement;
	if (candidate) {
		if (test(candidate)) {
			return candidate;
		} else {
			return searchUp(candidate, test);
		}
	}
};

module.exports = {
	walkDOM: walkDOM,
	searchUp: searchUp,
};

},{}],9:[function(require,module,exports){
var currentVersion = "2.20";

/*!
CalcNames: The AccName Computation Prototype, compute the Name and Description property values for a DOM node
Returns an object with 'name' and 'desc' properties.
Functionality mirrors the steps within the W3C Accessible Name and Description computation algorithm.
http://www.w3.org/TR/accname-aam-1.1/
Authored by Bryan Garaventa, plus refactoring contrabutions by Tobias Bengfort
https://github.com/whatsock/w3c-alternative-text-computation
Distributed under the terms of the Open Source Initiative OSI - MIT License
*/

// AccName Computation Prototype
var calcNames = function(node, fnc, preventVisualARIASelfCSSRef) {
  var props = { name: "", desc: "" };
  if (!node || node.nodeType !== 1) {
    return props;
  }
  var rootNode = node;

  // Track nodes to prevent duplicate node reference parsing.
  var nodes = [];
  // Track aria-owns references to prevent duplicate parsing.
  var owns = [];

  // Recursively process a DOM node to compute an accessible name in accordance with the spec
  var walk = function(
    refNode,
    stop,
    skip,
    nodesToIgnoreValues,
    skipAbort,
    ownedBy
  ) {
    var fullResult = {
      name: "",
      title: ""
    };

    /*
  ARIA Role Exception Rule Set 1.1
  The following Role Exception Rule Set is based on the following ARIA Working Group discussion involving all relevant browser venders.
  https://lists.w3.org/Archives/Public/public-aria/2017Jun/0057.html
  */
    var isException = function(node, refNode) {
      if (!refNode || !node || refNode.nodeType !== 1 || node.nodeType !== 1) {
        return false;
      }

      var inList = function(node, list) {
        var role = getRole(node);
        var tag = node.nodeName.toLowerCase();
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
      else if (
        inList(node, list2) ||
        (node === rootNode && !inList(node, list1))
      ) {
        return true;
      } else {
        return false;
      }
    };

    var inParent = function(node, parent) {
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
        } else if (!node || node === ownedBy.top || node === document.body) {
          return false;
        }
      }
      return false;
    };

    // Placeholder for storing CSS before and after pseudo element text values for the top level node
    var cssOP = {
      before: "",
      after: ""
    };

    if (ownedBy.ref) {
      if (isParentHidden(refNode, document.body, true, true)) {
        // If referenced via aria-labelledby or aria-describedby, do not return a name or description if a parent node is hidden.
        return fullResult;
      } else if (isHidden(refNode, document.body)) {
        // Otherwise, if aria-labelledby or aria-describedby reference a node that is explicitly hidden, then process all children regardless of their individual hidden states.
        var ignoreHidden = true;
      }
    }

    if (nodes.indexOf(refNode) === -1) {
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
    var walkDOM = function(node, fn, refNode) {
      var res = {
        name: "",
        title: ""
      };
      if (!node) {
        return res;
      }
      var nodeIsBlock =
        node && node.nodeType === 1 && isBlockLevelElement(node) ? true : false;
      var fResult = fn(node) || {};
      if (fResult.name && fResult.name.length) {
        res.name += fResult.name;
      }
      if (!isException(node, ownedBy.top, ownedBy)) {
        node = node.firstChild;
        while (node) {
          res.name += walkDOM(node, fn, refNode).name;
          node = node.nextSibling;
        }
      }
      res.name += fResult.owns || "";
      if (rootNode === refNode && !trim(res.name) && trim(fResult.title)) {
        res.name = addSpacing(fResult.title);
      } else if (rootNode === refNode && trim(fResult.title)) {
        res.title = addSpacing(fResult.title);
      }
      if (rootNode === refNode && trim(fResult.desc)) {
        res.title = addSpacing(fResult.desc);
      }
      if (nodeIsBlock || fResult.isWidget) {
        res.name = addSpacing(res.name);
      }
      return res;
    };

    fullResult = walkDOM(
      refNode,
      function(node) {
        var i = 0;
        var element = null;
        var ids = [];
        var parts = [];
        var result = {
          name: "",
          title: "",
          owns: ""
        };
        var isEmbeddedNode =
          node &&
          node.nodeType === 1 &&
          nodesToIgnoreValues &&
          nodesToIgnoreValues.length &&
          nodesToIgnoreValues.indexOf(node) !== -1 &&
          node === rootNode &&
          node !== refNode
            ? true
            : false;

        if (
          (skip ||
            !node ||
            nodes.indexOf(node) !== -1 ||
            (!ignoreHidden && isHidden(node, ownedBy.top))) &&
          !skipAbort &&
          !isEmbeddedNode
        ) {
          // Abort if algorithm step is already completed, or if node is a hidden child of refNode, or if this node has already been processed, or skip abort if aria-labelledby self references same node.
          return result;
        }

        if (nodes.indexOf(node) === -1) {
          nodes.push(node);
        }

        // Store name for the current node.
        var name = "";
        // Store name from aria-owns references if detected.
        var ariaO = "";
        // Placeholder for storing CSS before and after pseudo element text values for the current node container element
        var cssO = {
          before: "",
          after: ""
        };

        var parent = refNode === node ? node : node.parentNode;
        if (nodes.indexOf(parent) === -1) {
          nodes.push(parent);
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
          var aLabelledby = node.getAttribute("aria-labelledby") || "";
          var aDescribedby = node.getAttribute("aria-describedby") || "";
          var aLabel = node.getAttribute("aria-label") || "";
          var nTitle = node.getAttribute("title") || "";
          var nTag = node.nodeName.toLowerCase();
          var nRole = getRole(node);

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
            (isSimulatedFormField || otherWidgetRoles.indexOf(nRole) !== -1) &&
            nRole !== "link";
          result.isWidget = isNativeFormField || isWidgetRole;

          var hasName = false;
          var aOwns = node.getAttribute("aria-owns") || "";
          var isSeparatChildFormField =
            !isEmbeddedNode &&
            ((node !== refNode &&
              (isNativeFormField || isSimulatedFormField)) ||
              (node.id &&
                ownedBy[node.id] &&
                ownedBy[node.id].target &&
                ownedBy[node.id].target === node))
              ? true
              : false;

          if (!stop && node === refNode) {
            // Check for non-empty value of aria-labelledby if current node equals reference node, follow each ID ref, then stop and process no deeper.
            if (aLabelledby) {
              ids = aLabelledby.split(/\s+/);
              parts = [];
              for (i = 0; i < ids.length; i++) {
                element = document.getElementById(ids[i]);
                // Also prevent the current form field from having its value included in the naming computation if nested as a child of label
                parts.push(
                  walk(element, true, skip, [node], element === refNode, {
                    ref: ownedBy,
                    top: element
                  }).name
                );
              }
              // Check for blank value, since whitespace chars alone are not valid as a name
              name = trim(parts.join(" "));

              if (trim(name)) {
                hasName = true;
                // Abort further recursion if name is valid.
                skip = true;
              }
            }

            // Check for non-empty value of aria-describedby if current node equals reference node, follow each ID ref, then stop and process no deeper.
            if (aDescribedby) {
              var desc = "";
              ids = aDescribedby.split(/\s+/);
              parts = [];
              for (i = 0; i < ids.length; i++) {
                element = document.getElementById(ids[i]);
                // Also prevent the current form field from having its value included in the naming computation if nested as a child of label
                parts.push(
                  walk(element, true, false, [node], false, {
                    ref: ownedBy,
                    top: element
                  }).name
                );
              }
              // Check for blank value, since whitespace chars alone are not valid as a name
              desc = trim(parts.join(" "));

              if (trim(desc)) {
                result.desc = desc;
              }
            }
          }

          // Otherwise, if the current node is a nested widget control within the parent ref obj, then add only its value and process no deeper within the branch.
          if (isSeparatChildFormField) {
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
                name = getObjectValue(nRole, node, false, false, false, true);
              } else if (
                isNativeFormField &&
                nTag === "select" &&
                (!isWidgetRole || nRole === "combobox")
              ) {
                // For native select fields, get text from content for all options with selected attribute separated by a space when multiple, but don't process if another widget role is present unless it matches role="combobox".
                // Reference: https://github.com/WhatSock/w3c-alternative-text-computation/issues/7
                name = getObjectValue(nRole, node, false, false, true, true);
              }

              // Check for blank value, since whitespace chars alone are not valid as a name
              name = trim(name);
            }

            if (trim(name)) {
              hasName = true;
            }
          }

          // Otherwise, if current node has a non-empty aria-label then set as name and process no deeper within the branch.
          if (!hasName && trim(aLabel) && !isSeparatChildFormField) {
            name = aLabel;

            // Check for blank value, since whitespace chars alone are not valid as a name
            if (trim(name)) {
              hasName = true;
              if (node === refNode) {
                // If name is non-empty and both the current and refObject nodes match, then don't process any deeper within the branch.
                skip = true;
              }
            }
          }

          // Otherwise, if name is still empty and the current node matches the ref node and is a standard form field with a non-empty associated label element, process label with same naming computation algorithm.
          if (!hasName && node === refNode && isNativeFormField) {
            // Logic modified to match issue
            // https://github.com/WhatSock/w3c-alternative-text-computation/issues/12 */
            var labels = document.querySelectorAll("label");
            var implicitLabel = getParent(node, "label") || false;
            var explicitLabel =
              node.id &&
              document.querySelectorAll('label[for="' + node.id + '"]').length
                ? document.querySelector('label[for="' + node.id + '"]')
                : false;
            var implicitI = 0;
            var explicitI = 0;
            for (i = 0; i < labels.length; i++) {
              if (labels[i] === implicitLabel) {
                implicitI = i;
              } else if (labels[i] === explicitLabel) {
                explicitI = i;
              }
            }
            var isImplicitFirst =
              implicitLabel &&
              implicitLabel.nodeType === 1 &&
              explicitLabel &&
              explicitLabel.nodeType === 1 &&
              implicitI < explicitI
                ? true
                : false;

            if (explicitLabel) {
              var eLblName = trim(
                walk(explicitLabel, true, skip, [node], false, {
                  ref: ownedBy,
                  top: explicitLabel
                }).name
              );
            }
            if (implicitLabel && implicitLabel !== explicitLabel) {
              var iLblName = trim(
                walk(implicitLabel, true, skip, [node], false, {
                  ref: ownedBy,
                  top: implicitLabel
                }).name
              );
            }

            if (iLblName && eLblName && isImplicitFirst) {
              name = iLblName + " " + eLblName;
            } else if (eLblName && iLblName) {
              name = eLblName + " " + iLblName;
            } else if (eLblName) {
              name = eLblName;
            } else if (iLblName) {
              name = iLblName;
            }

            if (trim(name)) {
              hasName = true;
            }
          }

          // Process native form field buttons in accordance with the HTML AAM
          // https://w3c.github.io/html-aam/#accessible-name-and-description-computation
          var btnType = (isNativeButton && node.getAttribute("type")) || false;
          var btnValue = (btnType && trim(node.getAttribute("value"))) || false;

          var rolePresentation =
            !hasName &&
            nRole &&
            presentationRoles.indexOf(nRole) !== -1 &&
            !isFocusable(node) &&
            !hasGlobalAttr(node)
              ? true
              : false;
          var nAlt = rolePresentation ? "" : trim(node.getAttribute("alt"));

          // Otherwise, if name is still empty and current node is a standard non-presentational img or image button with a non-empty alt attribute, set alt attribute value as the accessible name.
          if (
            !hasName &&
            !rolePresentation &&
            (nTag === "img" || btnType === "image") &&
            nAlt
          ) {
            // Check for blank value, since whitespace chars alone are not valid as a name
            name = trim(nAlt);
            if (trim(name)) {
              hasName = true;
            }
          }

          if (
            !hasName &&
            node === refNode &&
            btnType &&
            ["button", "image", "submit", "reset"].indexOf(btnType) !== -1
          ) {
            if (btnValue) {
              name = btnValue;
            } else {
              switch (btnType) {
                case "submit":
                case "image":
                  name = "Submit Query";
                  break;
                case "reset":
                  name = "Reset";
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
            hasName &&
            node === refNode &&
            btnType &&
            ["button", "submit", "reset"].indexOf(btnType) !== -1 &&
            btnValue &&
            btnValue !== name &&
            !result.desc
          ) {
            result.desc = btnValue;
          }

          // Otherwise, if current node is the same as rootNode and is non-presentational and includes a non-empty title attribute and is not a separate embedded form field, store title attribute value as the accessible name if name is still empty, or the description if not.
          if (
            node === rootNode &&
            !rolePresentation &&
            trim(nTitle) &&
            !isSeparatChildFormField
          ) {
            result.title = trim(nTitle);
          }

          // Check for non-empty value of aria-owns, follow each ID ref, then process with same naming computation.
          // Also abort aria-owns processing if contained on an element that does not support child elements.
          if (aOwns && !isNativeFormField && nTag !== "img") {
            ids = aOwns.split(/\s+/);
            parts = [];
            for (i = 0; i < ids.length; i++) {
              element = document.getElementById(ids[i]);
              // Abort processing if the referenced node has already been traversed
              if (element && owns.indexOf(ids[i]) === -1) {
                owns.push(ids[i]);
                var oBy = { ref: ownedBy, top: ownedBy.top };
                oBy[ids[i]] = {
                  refNode: refNode,
                  node: node,
                  target: element
                };
                if (!isParentHidden(element, document.body, true)) {
                  parts.push(walk(element, true, skip, [], false, oBy).name);
                }
              }
            }
            // Join without adding whitespace since this is already handled by parsing individual nodes within the algorithm steps.
            ariaO = parts.join("");
          }
        }

        // Otherwise, process text node
        else if (node.nodeType === 3) {
          name = node.data;
        }

        // Prepend and append the current CSS pseudo element text, plus normalize all whitespace such as newline characters and others into flat spaces.
        name = cssO.before + name.replace(/\s+/g, " ") + cssO.after;

        if (
          name.length &&
          !hasParentLabelOrHidden(node, ownedBy.top, ownedBy, ignoreHidden)
        ) {
          result.name = name;
        }

        result.owns = ariaO;

        return result;
      },
      refNode
    );

    // Prepend and append the refObj CSS pseudo element text, plus normalize whitespace chars into flat spaces.
    fullResult.name =
      cssOP.before + fullResult.name.replace(/\s+/g, " ") + cssOP.after;

    return fullResult;
  };

  var getRole = function(node) {
    var role = node && node.getAttribute ? node.getAttribute("role") : "";
    if (!trim(role)) {
      return "";
    }
    var inList = function(list) {
      return trim(role).length > 0 && list.roles.indexOf(role) >= 0;
    };
    var roles = role.split(/\s+/);
    for (var i = 0; i < roles.length; i++) {
      role = roles[i];
      if (
        inList(list1) ||
        inList(list2) ||
        inList(list3) ||
        presentationRoles.indexOf(role) !== -1
      ) {
        return role;
      }
    }
    return "";
  };

  var isFocusable = function(node) {
    var nodeName = node.nodeName.toLowerCase();
    if (node.getAttribute("tabindex")) {
      return true;
    }
    if (nodeName === "a" && node.getAttribute("href")) {
      return true;
    }
    if (
      ["button", "input", "select", "textarea"].indexOf(nodeName) !== -1 &&
      node.getAttribute("type") !== "hidden"
    ) {
      return true;
    }
    return false;
  };

  // ARIA Role Exception Rule Set 1.1
  // The following Role Exception Rule Set is based on the following ARIA Working Group discussion involving all relevant browser venders.
  // https://lists.w3.org/Archives/Public/public-aria/2017Jun/0057.html

  // Always include name from content when the referenced node matches list1, as well as when child nodes match those within list3
  // Note: gridcell was added to list1 to account for focusable gridcells that match the ARIA 1.0 paradigm for interactive grids.
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
      "cell",
      "gridcell",
      "columnheader",
      "rowheader",
      "tooltip",
      "heading"
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
      "td",
      "th"
    ]
  };
  // Never include name from content when current node matches list2
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
      "separator"
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
      "img",
      "textarea",
      "input",
      "main",
      "math",
      "menu",
      "nav",
      "section"
    ]
  };
  // As an override of list2, conditionally include name from content if current node is focusable, or if the current node matches list3 while the referenced parent node matches list1.
  var list3 = {
    roles: [
      "term",
      "definition",
      "directory",
      "list",
      "group",
      "note",
      "status",
      "table",
      "rowgroup",
      "row",
      "contentinfo"
    ],
    tags: [
      "dl",
      "ul",
      "ol",
      "dd",
      "details",
      "output",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr"
    ]
  };

  var nativeFormFields = ["button", "input", "select", "textarea"];
  var rangeWidgetRoles = ["scrollbar", "slider", "spinbutton"];
  var editWidgetRoles = ["searchbox", "textbox"];
  var selectWidgetRoles = ["grid", "listbox", "tablist", "tree", "treegrid"];
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
    "gridcell"
  ];
  var presentationRoles = ["presentation", "none"];

  var hasGlobalAttr = function(node) {
    var globalPropsAndStates = [
      "busy",
      "controls",
      "current",
      "describedby",
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
      "roledescription"
    ];
    for (var i = 0; i < globalPropsAndStates.length; i++) {
      var a = trim(node.getAttribute("aria-" + globalPropsAndStates[i]));
      if (a) {
        return true;
      }
    }
    return false;
  };

  var isHidden = function(node, refNode) {
    var hidden = function(node) {
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
      if (style["display"] === "none" || style["visibility"] === "hidden") {
        return true;
      }
      return false;
    };
    return hidden(node);
  };

  var isParentHidden = function(node, refNode, skipOwned, skipCurrent) {
    while (node && node !== refNode) {
      if (!skipCurrent && node.nodeType === 1 && isHidden(node, refNode)) {
        return true;
      } else skipCurrent = false;
      node = node.parentNode;
    }
    return false;
  };

  var getStyleObject = function(node) {
    var style = {};
    if (document.defaultView && document.defaultView.getComputedStyle) {
      style = document.defaultView.getComputedStyle(node, "");
    } else if (node.currentStyle) {
      style = node.currentStyle;
    }
    return style;
  };

  var cleanCSSText = function(node, text) {
    var s = text;
    if (s.indexOf("attr(") !== -1) {
      var m = s.match(/attr\((.|\n|\r\n)*?\)/g);
      for (var i = 0; i < m.length; i++) {
        var b = m[i].slice(5, -1);
        b = node.getAttribute(b) || "";
        s = s.replace(m[i], b);
      }
    }
    return s || text;
  };

  var isBlockLevelElement = function(node, cssObj) {
    var styleObject = cssObj || getStyleObject(node);
    for (var prop in blockStyles) {
      var values = blockStyles[prop];
      for (var i = 0; i < values.length; i++) {
        if (
          styleObject[prop] &&
          ((values[i].indexOf("!") === 0 &&
            [values[i].slice(1), "inherit", "initial", "unset"].indexOf(
              styleObject[prop]
            ) === -1) ||
            styleObject[prop].indexOf(values[i]) !== -1)
        ) {
          return true;
        }
      }
    }
    if (
      !cssObj &&
      node.nodeName &&
      blockElements.indexOf(node.nodeName.toLowerCase()) !== -1
    ) {
      return true;
    }
    return false;
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
    contain: ["layout", "content", "strict"]
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
    "video"
  ];

  var getObjectValue = function(
    role,
    node,
    isRange,
    isEdit,
    isSelect,
    isNative
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
        childRoles
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
          true
        );
      } else {
        val = node.value;
      }
    }

    return val;
  };

  var addSpacing = function(s) {
    return trim(s).length ? " " + s + " " : " ";
  };

  var joinSelectedParts = function(node, nOA, isNative, childRoles) {
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
            : walk(nOA[i], true, false, [], false, { top: nOA[i] }).name
        );
      }
    }
    return parts.join(" ");
  };

  var getPseudoElStyleObj = function(node, position) {
    var styleObj = {};
    for (var prop in blockStyles) {
      styleObj[prop] = document.defaultView
        .getComputedStyle(node, position)
        .getPropertyValue(prop);
    }
    styleObj["content"] = document.defaultView
      .getComputedStyle(node, position)
      .getPropertyValue("content")
      .replace(/^"|\\|"$/g, "");
    return styleObj;
  };

  var getText = function(node, position) {
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

  var getCSSText = function(node, refNode) {
    if (
      (node && node.nodeType !== 1) ||
      node === refNode ||
      ["input", "select", "textarea", "img", "iframe"].indexOf(
        node.nodeName.toLowerCase()
      ) !== -1
    ) {
      return { before: "", after: "" };
    }
    if (document.defaultView && document.defaultView.getComputedStyle) {
      return {
        before: cleanCSSText(node, getText(node, ":before")),
        after: cleanCSSText(node, getText(node, ":after"))
      };
    } else {
      return { before: "", after: "" };
    }
  };

  var getParent = function(node, nTag) {
    while (node) {
      node = node.parentNode;
      if (node && node.nodeName && node.nodeName.toLowerCase() === nTag) {
        return node;
      }
    }
    return {};
  };

  var hasParentLabelOrHidden = function(node, refNode, ownedBy, ignoreHidden) {
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

  var trim = function(str) {
    if (typeof str !== "string") {
      return "";
    }
    return str.replace(/^\s+|\s+$/g, "");
  };

  if (isParentHidden(node, document.body, true)) {
    return props;
  }

  // Compute accessible Name and Description properties value for node
  var accProps = walk(node, false, false, [], false, { top: node });

  var accName = trim(accProps.name.replace(/\s+/g, " "));
  var accDesc = trim(accProps.title.replace(/\s+/g, " "));

  if (accName === accDesc) {
    // If both Name and Description properties match, then clear the Description property value.
    accDesc = "";
  }

  props.name = accName;
  props.desc = accDesc;

  // Clear track variables
  nodes = [];
  owns = [];

  if (fnc && typeof fnc === "function") {
    return fnc.apply(node, [node, props]);
  } else {
    return props;
  }
};

// Customize returned string for testable statements

var getNames = function(node) {
  var props = calcNames(node);
  return (
    'accName: "' +
    props.name +
    '"\n\naccDesc: "' +
    props.desc +
    '"\n\n(Running AccName Computation Prototype version: ' +
    currentVersion +
    ")"
  );
};

if (typeof module === "object" && module.exports) {
  module.exports = {
    getNames: getNames,
    calcNames: calcNames
  };
}

},{}]},{},[3]);
