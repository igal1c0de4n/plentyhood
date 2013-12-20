;(function () {

  "use strict";

  if(typeof String.prototype.trim !== 'function') {
    String.prototype.trim = function() {
      return this.replace(/^\s+|\s+$/g, ''); 
    }
  }

// extend underscore
_.mixin({
  capitalize: function(string) {
    return string.charAt(0).toUpperCase() + string.substring(1).toLowerCase();
  },

  toTitleCase: function (str) {
    var regex = /\w\S*/g;
    return str.replace(regex, function(w) {
      return w.charAt(0).toUpperCase() + w.substr(1).toLowerCase();
    });
  },
});

}());
