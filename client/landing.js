(function() {
  "use strict";
  Template.land.ready = function() {
    return staticResources.ready();
  };
  Template.showLandingPage.resUrl = function(path) {
    return staticResources.get(path);
  };
}());