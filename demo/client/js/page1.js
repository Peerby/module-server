var sectionA = require('sectionA');

exports.render = function($el) {
    $el.html('<h3>page 1</h3>');
    $el.append('<p>'+sectionA+'</p>');
};

console.log('loaded page 1');
