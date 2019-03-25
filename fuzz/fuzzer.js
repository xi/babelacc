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
