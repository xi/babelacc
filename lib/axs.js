global.goog = {
	provide: function() {},
	require: function() {},
};
global.axs = {
	browserUtils: {},
	color: {},
	dom: {},
	utils: {},
	properties: {},
};

require('accessibility-developer-tools/src/js/AccessibilityUtils');
require('accessibility-developer-tools/src/js/BrowserUtils');
require('accessibility-developer-tools/src/js/Color');
require('accessibility-developer-tools/src/js/DOMUtils');
require('accessibility-developer-tools/src/js/Properties');

module.exports = global.axs;
