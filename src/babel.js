var ariaApi = require('aria-api');
var accdc = require('../lib/accdc');
var axe = require('axe-core');
var axs = require('../lib/axs');

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

var implementations = {
	'aria-api': function(el) {
		return {
			name: ex(ariaApi.getName, [el]),
			desc: ex(ariaApi.getDescription, [el]),
			role: ex(ariaApi.getRole, [el.children[0]]),
		};
	},
	'accdc': accdc.calcNames,
	'axe': function(el) {
		return {
			name: ex(axe.commons.text.accessibleText, [el]),
			desc: '-',
			role: el.children[0].getAttribute('role') || ex(axe.commons.aria.implicitRole, [el.children[0]]),
		};
	},
	'axs': function(el) {
		return {
			name: ex(axs.properties.findTextAlternatives, [el, {}]),
			desc: '-',
			role: ex(function() {
				var roles = axs.utils.getRoles(el.children[0], true);
				if (roles) {
					return roles.roles.map(x => x.name).join(' ');
				}
			})
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
			tr.appendChild(createTd(result.role));

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
