panels = {};

;(function () {
  "use strict";

  panels.backAction = function () {
    if (Session.get("panel") === "place") {
      // place panel must have been open
      var lastCenter = Session.get("mapCenterLast");
      if (lastCenter) {
        // recenter map before other panels are loaded
        // console.log("panning map back to last center");
        Session.set("mapCenter", lastCenter);
        Session.set("mapCenterLast", undefined);
      }
      // console.log("panelBack, deselecting place");
      client.placeSet();
    } 
    // console.log("panelBack, poping last panel");
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
      handler: function(e) {
        var r = app.getCurRow();
        if (!r)
          return;
        function moveTo(jobj) {
          // console.log("moveTo", r, jobj.length);
          if (jobj.length) {
            // console.log("moving", r, jobj);
            app.selectResourceRow(jobj);
          }
        };
        // console.log("resultsListRow.keyup", e.keyCode)
        switch(e.keyCode) {
          case client.keyCode.ARROW_UP: {
            // console.log("arrow_up");
            moveTo(r.prev());
            break;
          }
          case client.keyCode.ARROW_DOWN: {
            // console.log("arrow_down");
            moveTo(r.next());
            break;
          }
          case client.keyCode.ESCAPE: {
            // console.log("resultsList escape");
            panels.pop();
            break;
          }
          case client.keyCode.ENTER: {
            var placeId = r[0].dataset.placeid;
            // console.log("enter", placeId, e);
            app.setCenterPlace(placeId);
            break;
          }
        }
      }
    }],
  },
  {
    name: "place",
    events: [defaultKeyupHandler],
  },
  ];

  (function setupPanels() {
    // setup panels
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
      // console.log("pushing panel", cxt.name);
      panelEventsActive(false);
      stack.push(cxt);
      panelEventsActive(true);
      Session.set("panel", cxt.name);
    };
    panels.pop = function () {
      panelEventsActive(false);
      var prv = stack.pop();
      panelEventsActive(true);
      // console.log("pop panel", prv.name, "current", currentPanel().name);
      Session.set("panel", currentPanel().name);
    };
  })();
}());
