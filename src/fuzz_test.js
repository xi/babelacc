var ariaApi = require('aria-api');
var accdc = require('w3c-alternative-text-computation');
var fuzz = require('./fuzz');

var preview = document.querySelector('#ba-preview');
var fingerprints = document.querySelector('#ba-fingerprints');
var errors = document.querySelector('#ba-errors');
var results = document.querySelector('#ba-results');

var oracle = function(input) {
	preview.innerHTML = input.toString();
	var el = preview.querySelector('#test') || preview.children[0] || preview;
	var v1, v2;

	try {
		v1 = accdc.calcNames(el).name;
	} catch (error) {
		v1 = '__crash1__';
	}

	try {
		v2 = ariaApi.getName(el);
	} catch (error) {
		v2 = '__crash2__';
	}

	return {
		'v1': v1,
		'v2': v2,
		'html': preview.innerHTML,
		'error': v1 !== v2,
	};
};

var renderResult = function(result) {
	var tr = document.createElement('tr');
	var td1 = document.createElement('td');
	td1.textContent = result.html;
	tr.append(td1);
	var td2 = document.createElement('td');
	td2.textContent = result.v1;
	tr.append(td2);
	var td3 = document.createElement('td');
	td3.textContent = result.v2;
	tr.append(td3);
	return tr;
};

document.addEventListener('DOMContentLoaded', function() {
	var errorCount = 0;
	fuzz.test(10, oracle, function(fingerprint, c) {
		fingerprints.textContent = c;
	}, function(result) {
		errorCount += 1;
		errors.textContent = errorCount;
		results.append(renderResult(result));
	}, function() {
		preview.innerHTML = 'DONE';
	});
});
