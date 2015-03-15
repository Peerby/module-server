require('third-party/jquery/jquery');

var $content = $('#content');

function loadPage(name) {
    return function() {
        loadModule(name, function (page) {
            page.render($content);
        });
    };
}

$('#page1').click(loadPage('page1'));
$('#page2').click(loadPage('page2'));
