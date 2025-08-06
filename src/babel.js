var ariaApi = require('aria-api/dist/aria.js');
var accdc = require('w3c-alternative-text-computation');
var axe = require('axe-core');
var domAccessibilityApi = require('dom-accessibility-api');

var form = document.querySelector('#ba-form');
var preview = document.querySelector('#ba-preview');
var results = document.querySelector('#ba-results');

var ex = function(fn, args, _this) {
	try {
		return fn.apply(_this, args);
	} catch (error) {
		return error;
	}
};

var implementations = [{
	name: 'aria-api (0.8.0)',
	url: 'https://github.com/xi/aria-api',
	fn: function(el) {
		return {
			name: ex(ariaApi.getName, [el]),
			desc: ex(ariaApi.getDescription, [el]),
			role: ex(ariaApi.getRole, [el]),
		};
	},
}, {
	name: 'WhatSock (2.64)',
	url: 'https://github.com/WhatSock/w3c-alternative-text-computation',
	fn: accdc.calcNames,
}, {
	name: 'dom-accessibility-api (0.7.0)',
	url: 'https://github.com/eps1lon/dom-accessibility-api/',
	fn: function(el) {
		return {
			name: domAccessibilityApi.computeAccessibleName(el),
			desc: domAccessibilityApi.computeAccessibleDescription(el),
			role: domAccessibilityApi.getRole(el),
		};
	},
}, {
	name: 'axe (4.10.3)',
	url: 'https://github.com/dequelabs/axe-core',
	fn: function(el) {
		axe._tree = axe.utils.getFlattenedTree(document.body);
		return {
			name: ex(axe.commons.text.accessibleText, [el]),
			desc: '-',
			role: ex(axe.commons.aria.getRole, [el]),
		};
	},
}];

var createTd = function(text, url) {
	var td = document.createElement('td');
	if (url) {
		var a = document.createElement('a');
		a.href = url;
		a.textContent = text;
		td.append(a);
	} else {
		td.textContent = text;
	}
	return td;
};

var run = function(html) {
	preview.innerHTML = html;
	results.innerHTML = '';

	return Promise.all(implementations.map(function(impl) {
		var p = impl.fn(preview.querySelector('#test') || preview.children[0] || preview);

		return Promise.resolve(p).then(function(result) {
			var tr = document.createElement('tr');

			tr.appendChild(createTd(impl.name, impl.url));
			tr.appendChild(createTd(result.name));
			tr.appendChild(createTd(result.desc));
			tr.appendChild(createTd(result.role));

			results.appendChild(tr);
		});
	}));
};

// https://stackoverflow.com/questions/454202
var resize = function(event) {
	/* 0-timeout to get the already changed text */
	setTimeout(function() {
		event.target.style.height = 'auto';
		event.target.style.height = event.target.scrollHeight + 5 + 'px';
	}, 0);
};
form.input.addEventListener('keydown', resize);
resize({target: form.input});

try {
	eval('alert("This tools requires a browser that supports CSP. Please update!")');
} catch (error) {
	location.search.substr(1).split('&').forEach(function(part) {
		var p = part.split('=');
		if (p[0] === 'input') {
			var html = decodeURIComponent(p[1].replace(/\+/g, ' '));
			form.input.value = html;
			run(html);
		}
	});
}
