require('third-party/jquery/jquery');

$(document).mouseleave(runChurnCampaign);

var marketingCampaignRan = false;
function runChurnCampaign () {
    if (marketingCampaignRan) return;
    marketingCampaignRan = true;
    alert('Hey, where are YOU going? Get a FREE cookie if you stay with us!');
}
