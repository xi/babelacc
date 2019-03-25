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
