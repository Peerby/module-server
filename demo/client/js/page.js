require('third-party/jquery/jquery');

//show content in the content section
var content = require('content');
content.render($('#content'));

//load marketing campaign asynchronously
//loadModule is globally available
loadModule('stupidMarketingCampaign', function() {
    console.log('campaign `stupidMarketingCampaign` loaded');
});

//load chat asynchronously per user's request
$('#chat').click(loadPage('chat'));
$('#home').click(loadPage('content'));

//load and render a page
function loadPage(name) {
    return function() {
        loadModule(name, function (page) {
            page.render($('#content'));
        });
    };
}
