panels = {};

;(function () {
  "use strict";

  panels.backAction = function () {
    if (Session.get("panel") === "place") {
      if (Session.get("autoBackToSearchCenter")) {
        var lastCenter = Session.get("mapCenterLast");
        if (lastCenter) {
          // recenter map before other panels are loaded
          // console.log("panning map back to last center");
          mapProvider.centerSet(lastCenter, false);
          Session.set("mapCenterLast", undefined);
        }
      }
      // console.log("panel back from place");
      client.placeSet();
    } 
    // console.log("panelBack removing top panel");
    panels.pop();
  };

  var defaultKeyupHandler = {
    type: "keyup",
    handler: function(e) {
      // console.log("panel keyup");
      if (e.keyCode == client.keyCode.ESCAPE) {
        panels.backAction();
      }
    }
  };

  var panelContexts = [{
    name: "main"
  },
  { 
    name: "search",
    events: [defaultKeyupHandler],
  },
  { 
    name: "resultsList",
    events: [{
      type: "keyup", 
      handler: function(e) { // app.resultListKeyupHandler
        var r = app.getCurRow();
        function moveTo(jobj) {
          // console.log("moveTo", r, jobj.length);
          if (jobj.length) {
            // console.log("moving", r, jobj);
            app.selectResourceRow(jobj);
          }
        };
        // console.log("rListEntry.keyup", e.keyCode)
        if (r.length) {
          switch(e.keyCode) {
            case client.keyCode.ARROW_UP: {
              // console.log("arrow_up", r.prev());
              var dest = r.prev();
              dest.hasClass("rListEntry") && moveTo(dest);
              break;
            }
            case client.keyCode.ARROW_DOWN: {
              // console.log("arrow_down", r.prev());
              var dest = r.next();
              dest.hasClass("rListEntry") && moveTo(dest);
              break;
            }
            case client.keyCode.ENTER: {
              var placeId = r[0].dataset.placeid;
              // console.log("enter", placeId);
              app.setCenterPlace(placeId);
              break;
            }
          }
        }
        if (e.keyCode == client.keyCode.ESCAPE) {
          // console.log("resultsList escape");
          panels.pop();
        }
      }
    }],
  },
  {
    name: "place",
    events: [defaultKeyupHandler],
  },
  {
    name: "locate",
  },
  ];

  (function setupPanels() {
    // console.log("setup panels");
    var stack = [];
    var currentPanel = function () {
      return stack.length ? stack[stack.length - 1] : undefined;
    };
    var panelEventsActive = function (on) {
      var p = currentPanel();
      var events = p ? p.events : undefined;
      // console.log("panelEventsActive", on, events);
      _.each(events, function (e) {
        // console.log("panel", p.name, e.type, on ? "on" : "off");
        var f = on ? $(document).on : $(document).off;
        f.call($(document), e.type, e.handler);
      });
    };
    panels.push = function (name) {
      var cxt = _.find(panelContexts, function (c) {
        return c.name == name;
      });
      var cp = currentPanel();
      if (cp && cp.name == 'place') {
        console.log("place panel replace stacking skipped");
        return;
      }
      panelEventsActive(false);
      stack.push(cxt);
      panelEventsActive(true);
      Session.set("panel", cxt.name);
      // console.log("push", name, stack);
    };
    panels.pop = function () {
      panelEventsActive(false);
      // console.log("pop panel", currentPanel().name, stack);
      var prv = stack.pop();
      panelEventsActive(true);
      var cp = currentPanel();
      Session.set("panel", cp ? cp.name : undefined);
    };
    panels.clear = function () {
      // in case there are external references
      stack.length = 0;
    };
  })();
}());
