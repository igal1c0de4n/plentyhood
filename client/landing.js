(function() {
  "use strict";

  Template.land.ready = function() {
    return client.isStaticContentReady();
  };

  Template.showLandingPage.resUrl = function(path) {
    return client.getResourceUrl(path);
  };

}());