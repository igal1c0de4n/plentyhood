///////////////////////////////////////////////////////////////////////////////
// Leaflet Map
///////////////////////////////////////////////////////////////////////////////

var map = {
  handle: undefined,
  renderCount: undefined, // for troubleshooting extra renders
  defaultZoom: 15,
  minZoomForMarkers: 13,
  maxZoom: 16, // server does not serve higher zoom level
  defaultCenter: {
    // TBD: remove once auto-locate and cross-session last-location is stored
    // GeoJson for santa clara
    type: "Point", coordinates: [ -121.95751, 37.35024]
  },
  selectedPlaceOpacity: 1,
  unselectedPlaceOpacity: 0.5,
};

Template.leafletMap.created = function() {
  console.log("template leafletMap created");
  Session.set('mapCenter', map.defaultCenter);
  Session.set("mapZoom", map.defaultZoom);
  map.renderCount = 0;
};

Template.leafletMap.destroyed = function() {
  console.log("leafletmap -> destroyed");
  map.handle.remove();
  map.handle = undefined;
  this.handlePlacesChanged.stop();
  this.handleZoomChanged.stop();
  this.handleSubscriptions.stop();
};

Template.leafletMap.rendered = function() {
  var self = this;
  var last = {};
  last.center = {};
  if (map.renderCount++ > 0) {
    // workaround for meteor-leaflet issue
    //     console.log("leaflet rendered skip", map.renderCount);
    return;
  }
  //   console.log("render iteration " + map.renderCount);
  latLng2GeoJson = function () {
    return {type: "Point", coordinates: [latlng.lng, latlng.lat]};
  };
  var latlng2GeoJson = function (latlng) {
    return {type: "Point", coordinates: [latlng.lng, latlng.lat]};
  };
  var areMapPlacesVisible = function (zoom) { 
    return zoom >= map.minZoomForMarkers;
  }
  var updateMapBounds = function () {
    var b = map.handle.getBounds();
    var drawBounds = Session.get("drawBounds");
    // increase size of bounds by phi for more fluent user experience
    var kmPerDegree = 111.2;
    var marginKm = 1;
    var phi = marginKm / kmPerDegree;
    var bounds = [
      [b.getWest() - phi, b.getSouth() - phi],
      [b.getEast() + phi, b.getNorth() + phi],
    ];
    if (drawBounds) {
      // debug 
      if (last.rect) {
        map.handle.removeLayer(last.rect);
        delete last.rect;
      }
      var rb = L.latLngBounds(
        L.latLng(bounds[0][1], bounds[0][0]),
        L.latLng(bounds[1][1], bounds[1][0])
      );
      last.rect = L.rectangle(rb, {color: "#ff7800", weight: 2}).addTo(map.handle);
    }
    //     console.log("bounds", bounds, b);
    Session.set("mapBounds", bounds);
  }
  var initOptions =  {
    maxZoom: map.maxZoom,
    minZoom: 3,
    noWrap: true,
    zoomControl: false,
    markerZoomAnimation: true,
  };
  var coords = Session.get("mapCenter").coordinates;
  //console.log("map center", coords, "zoom", Session.get("mapZoom"));
  map.handle = L.map('leaflet-map', initOptions).
    setView(L.GeoJSON.coordsToLatLng(coords), Session.get("mapZoom")).
    locate({maximumAge : 1000 * 60, setView: false}).
    whenReady(function () { 
    //console.log("leaflet ready")
  });
  L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: map.maxZoom,
    attribution : 'Tiles: &copy; Esri, National Geographic'
  }).addTo(map.handle);
  map.handle.addControl(L.control.zoom({position: 'bottomright'}));
  L.control.scale({
    updateWhenIdle: true, metric: false,
  }).addTo(map.handle);
  map.handle.on('moveend', function(e) {
    var zoom = map.handle.getZoom();
    Session.set("mapZoom", zoom);
    //     console.log('map moveend', latlng2GeoJson(map.handle.getCenter()), zoom);
    Session.set('mapCenter', latlng2GeoJson(map.handle.getCenter()));
    updateMapBounds();
  });
  map.handle.on('click', function(e) {
    //     console.log('clicked at', e.latlng);
    // ctrl is meta key to add a new place
    if (e.originalEvent.ctrlKey === true) {
      if(! Meteor.userId()) {
        console.log("must be logged in to create events");
        return;
      }
      schedCreateDialog(latlng2GeoJson(e.latlng));
    }
  });  
  var userLocationMarker;
  map.handle.on('locationfound', function(e) {
    var newLocation = latlng2GeoJson(e.latlng);
    if (!_.objectsEqual(last.userLocation, newLocation)) {
      if (userLocationMarker) {
        // remove previous user location
        map.handle.removeLayer(userLocationMarker);
      }
      // mark user on the map with circle
      var userLocMarkerOpts = {
        color: 'yellow' /* for blue: '#15f'*/, 
        opacity: 0.9,
        fillOpacity: 0.6,
        radius: 10, 
        stroke: true
      };
      userLocationMarker = 
        new L.CircleMarker(e.latlng, userLocMarkerOpts);
      userLocationMarker.addTo(map.handle);
//       console.log("updated current loc marker to", e.latlng.toString());
      last.userLocation = newLocation;
    }
    // pan the map to user location
    Session.set("mapZoom", map.defaultZoom);
    updateMapBounds();
    Session.set('mapCenter', newLocation);
    console.log('locationfound:', newLocation.coordinates);
  });
  map.handle.on('locationerror', function(e) {
    console.log('locationerror',e.message, e.code);
  });
  // closure vars
  var markers = [];
  // control all markers via a single layer
  var markerLayer = L.layerGroup().addTo(map.handle);
  var staticRoot = "https://s3.amazonaws.com/plentyhood/"
  var leafletStaticFolder = staticRoot + "leaflet/images/";
  var markerIcon = L.icon({
    iconUrl: leafletStaticFolder + "marker-icon.png",
    shadowUrl: leafletStaticFolder + "marker-shadow.png",
    iconAnchor: [12, 41], // half width, full length of marker-icon.png
  });
  var markerStyle = {icon: markerIcon, riseOnHover: true,};

  var markers = new HashTable();

  this.handlePlacesChanged = Deps.autorun(function () {

    var removeMarkers = function () {
        markers.each(function (k, m) {
          markerLayer.removeLayer(m.lmark);
        });
        markers.clear();
    };

    var updateMarkers = function () {
      // map recenter and tags trigger a new search
      var places = client.getMatchingPlaces();
      //     console.log("handlePlacesChanged", places);
      // before redawing markers, delete the current ones
      // TBD optimization: update only the markers which change
      //
      // TDB: move selectedPlace to a new Deps.autorun as there's no
      // need to refilter and search for places when selected place 
      // changes. Just redraw two markers
      var selected = Session.get("selectedPlace");

      markers.each(function (k, m) {
        // kept makers will marked soon
        m.keep = false;
      });

      _.each(places, function (p) {
        // check if place is alerady on map
        var id = p._id;
        var m = markers.getItem(id);
        if (m) {
          // place p is already marked on map, preserve existing marker
          m.keep = true;
        }
        else {
          // no marker for place yet
          var m = {};
          var latlng = L.GeoJSON.coordsToLatLng(p.location.coordinates);
          m.lmark = L.marker(latlng, markerStyle).addTo(markerLayer);
          m.lmark.placeId = id;
          m.lmark.on('click', function(e) {
            //             console.log("selected place", this.placeId)
            Session.set("selectedPlace", this.placeId);
            Session.set("placeEditLocation", undefined);
          });
          m.keep = true;
          markers.setItem(id, m);
        }
        opacity = selected == id ?
          map.selectedPlaceOpacity : map.unselectedPlaceOpacity;
        m.lmark.setOpacity(opacity);
      });

      // cleanup - remove markers for all places which 
      // disappeared from the map
      var removedMarkers = [];
      markers.each(function (k, m) {
        if (!m.keep) {
          // add to list makers
          // TBD: check if can removeItem here
          removedMarkers.push(m);
        }
      });
      _.each(removedMarkers, function (m) {
          markerLayer.removeLayer(m.lmark);
          markers.removeItem(m.lmark.placeId);
      });
    };
    if (Session.get("mapZoomedEnough")) {
      updateMarkers();
    }
    else {
      removeMarkers();
    }
  });

  this.handleSubscriptions  = Deps.autorun(function () {
    var b = Session.get("mapBounds");
    if (b) {
      Meteor.subscribe("places", b);
    }
    Meteor.subscribe("tags");
  });

  this.handleZoomChanged = Deps.autorun(function () {
    Session.set(
      "mapZoomedEnough",
      areMapPlacesVisible(Session.get("mapZoom")));
  });

  client.placeDragSet = function (action) {
    var updatePlaceCoords = function (id, c) {
      App.collections.Places.update(
        {_id: id},
        { $set: { 'location.coordinates': c}});
    };
    //     console.log("markers", markers);
    var placeId = Session.get("selectedPlace");
    var lm = markers.getItem(placeId).lmark;
    if (action == "edit") {
      //       console.log("enable marker drag", lm);
      // store original coords in case user cancels
      last.coordsBeforeDrag = lm.toGeoJSON().geometry.coordinates;
      lm.on('dragend', function (e) {
        var coords = this.toGeoJSON().geometry.coordinates;
        //         console.log("marker", this, "moved to", coords);
        updatePlaceCoords(this.placeId, coords);
      });
      lm.dragging.enable();
    } else {
      lm.dragging.disable();
      lm.off('dragend', undefined);
      if (action == "cancel") {
        var sameLocation = _.objectsEqual(
          lm.toGeoJSON().geometry.coordinates, last.coordsBeforeDrag);
        if (!sameLocation) {
          console.log("restoring previous coordinates", last.coordsBeforeDrag);
          updatePlaceCoords(placeId, last.coordsBeforeDrag);
          lm.setLatLng(L.GeoJSON.coordsToLatLng(last.coordsBeforeDrag));
        }
        delete last.coordsBeforeDrag;
      }
    }
  };
};

var schedCreateDialog = function (geoJsonLoc) {
  Session.set("selectedPlace", undefined);
  Session.set("placeLocation", geoJsonLoc);
  Session.set("createError", null);
  Session.set("activeDialog", "placeEdit");
};
