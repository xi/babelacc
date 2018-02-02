var form = document.querySelector('#ba-form');
var preview = document.querySelector('#ba-preview');
var results = document.querySelector('#ba-results');

var implementations = {
	'aria-api': function(el) {
		return {
			name: aria.getName(el),
			desc: aria.getDescription(el)
		};
	},
	'accdc': calcNames
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
		var p = implementations[key](preview);
		return Promise.resolve(p).then(function(result) {
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
