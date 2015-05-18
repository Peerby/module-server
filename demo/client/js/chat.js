require('third-party/jquery/jquery');
var chatMessages = require('chatMessages');

exports.render = function($el) {
    $el.html('<h3>Chat with Willy</h3>');
    $el.append(chatMessages);
};

console.log('loaded chat');
