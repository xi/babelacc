var ariaApi = require('aria-api');
var accdc = require('../lib/accdc');
var axe = require('axe-core');
var axs = require('../lib/axs');

var form = document.querySelector('#ba-form');
var preview = document.querySelector('#ba-preview');
var results = document.querySelector('#ba-results');

var implementations = {
	'aria-api': function(el) {
		return {
			name: ariaApi.getName(el),
			desc: ariaApi.getDescription(el)
		};
	},
	'accdc': accdc.calcNames,
	'axe': function(el) {
		return {
			name: axe.commons.text.accessibleText(el),
			desc: null,
		};
	},
	'axs': function(el) {
		return {
			name: axs.properties.findTextAlternatives(el, {}),
			desc: null,
		};
	},
};

var createTd = function(text) {
	var td = document.createElement('td');
	td.textContent = text;
	return td;
};

var run = function(html) {
	preview.innerHTML = html;
	results.innerHTML = '';

	return Promise.all(Object.keys(implementations).map(function(key) {
		var promise;

		try {
			p = implementations[key](preview);
			promise = Promise.resolve(p);
		} catch (error) {
			promise = Promise.resolve({
				name: error,
				description: error,
			});
		}

		return promise.then(function(result) {
			var tr = document.createElement('tr');

			tr.appendChild(createTd(key));
			tr.appendChild(createTd(result.name));
			tr.appendChild(createTd(result.desc));

			results.appendChild(tr);
		});
	}));
};

location.search.substr(1).split('&').forEach(function(part) {
	var p = part.split('=');
	if (p[0] === 'input') {
		var html = decodeURIComponent(p[1].replace(/\+/g, ' '));
		form.input.value = html;
		run(html);
	}
});

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
