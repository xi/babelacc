var ariaApi = require('aria-api');
var accdc = require('w3c-alternative-text-computation');
var fuzz = require('./fuzz');

var preview = document.querySelector('#ba-preview');

var oracle = function(input) {
	preview.innerHTML = input.toString();
	console.log(preview.innerHTML);
	var el = preview.querySelector('#test') || preview.children[0] || preview;
	var v1, v2;

	try {
		v1 = accdc.calcNames(el).name;
	} catch (error) {
		return {'error': ['crash:accdc', error]};
	}

	try {
		v2 = ariaApi.getName(el);
	} catch (error) {
		return {'error': ['crash:ariaApi', error]};
	}

	// HACK: accdc does not caculate names for divs, so skip here
	if (v1 && v1 !== v2) {
		return {'error': ['no-match', v1, v2]};
	}

	return {};
};

document.addEventListener('DOMContentLoaded', function() {
	fuzz.test(10, oracle);
	console.log('done');
});
