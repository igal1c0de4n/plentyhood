;(function () {
  "use strict";

Template.landing.ready = function () {
  return client.isStaticContentReady();
};

Template.showLandingPage.resUrl = function (path) {
  return client.getResourceUrl(path);
};

}());
