mapProvider = {};

;(function () {
  "use strict";

///////////////////////////////////////////////////////////////////////////////
// Leaflet Map
///////////////////////////////////////////////////////////////////////////////

var map = {
  handle: undefined,
  renderCount: undefined, // for troubleshooting extra renders
  defaultZoom: 12,
  minZoomForMarkers: 12,
  maxZoom: 16, // server does not serve higher zoom level
  minZoom: 3,
  selectedPlaceOpacity: 1,
  unselectedPlaceOpacity: 0.5,
  ancientLevantGJ: {
    type: "Point",
    // Jerusalem, "cradle of man kind" :)
    coordinates: [35.21873474121094, 31.78669746847703], 
  },
};

Template.leafletMap.created = function() {
  // console.log("template leafletMap created");
  map.renderCount = 0;
};

Template.leafletMap.destroyed = function() {
  // console.log("leafletmap -> destroyed");
  map.handle.remove();
  map.handle = undefined;
  this.handlePlacesChanged.stop();
  this.handleZoomChanged.stop();
  this.handleCenterChange.stop();
};

Template.leafletMap.rendered = function() {
  var self = this;
  var last = {};
  last.center = {};
  if (map.renderCount++ > 0) {
    // workaround for meteor-leaflet issue
    // console.log("leaflet rendered skip", map.renderCount);
    return;
  }
  //   console.log("render iteration " + map.renderCount);
  var latlng2GeoJson = function (latlng) {
    return {type: "Point", coordinates: [latlng.lng, latlng.lat]};
  };
  var areMapPlacesVisible = function (zoom) { 
    return zoom >= map.minZoomForMarkers;
  }
  var updateMapBounds = function () {
    var b = map.handle.getBounds();
    // increase size of bounds by phi for more fluent user experience
    var kmPerDegree = 111.2;
    var marginKm = 1;
    var phi = marginKm / kmPerDegree;
    var bounds = [
      [b.getWest() - phi, b.getSouth() - phi],
      [b.getEast() + phi, b.getNorth() + phi],
    ];
    if (Session.get("drawBounds")) {
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
    minZoom: map.minZoom,
    zoomControl: false,
    markerZoomAnimation: true,
    keyboard: false,
  };
  // console.log("creating map handle and attempting auto locate");
  Session.set('mapCenter', undefined);
  Session.set('mapBounds', undefined);
  panels.push("locate");
  map.handle = L.map('leaflet-map', initOptions).
    locate({maximumAge : 1000 * 60, setView: false}).
    whenReady(function () { 
    //console.log("leaflet ready")
  });
  L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: map.maxZoom,
    attribution : 'Tiles: &copy; Esri'
  }).addTo(map.handle);
  map.handle.addControl(L.control.zoom({position: 'bottomright'}));
  L.control.scale({
    updateWhenIdle: true, metric: false,
  }).addTo(map.handle);
  map.handle.on('moveend', function(e) {
    var zoom = map.handle.getZoom();
    var mcc = latlng2GeoJson(map.handle.getCenter());
    // console.log('map moveend', mcc.coordinates, zoom);
    Session.set("mapZoom", zoom);
    Session.set('mapCenter', mcc);
  });
  map.handle.on('click', function(e) {
    //     console.log('clicked at', e.latlng);
    // ctrl is meta key to add a new place
    if (e.originalEvent.ctrlKey === true) {
      if(!Meteor.userId()) {
        alert("must be logged in to create place");
        return;
      }
      schedCreateDialog(latlng2GeoJson(e.latlng));
    }
  });  
  var userLocationMarker;
  map.handle.on('locationfound', function(e) {
    var newLocation = latlng2GeoJson(e.latlng);
    if (!_.isEqual(last.userLocation, newLocation)) {
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
        stroke: true,
        clickable: true,
      };
      userLocationMarker = 
        new L.CircleMarker(e.latlng, userLocMarkerOpts);
      L.featureGroup([userLocationMarker]).
        bindPopup('Your detected location').
        on('click', function() { 
        // console.log('location marker clicked'); 
      });
      userLocationMarker.addTo(map.handle);
      // console.log("updated current loc marker to", e.latlng.toString());
      last.userLocation = newLocation;
    }
    // pan the map to user location
    Session.set("mapZoom", map.defaultZoom);
    Session.set('mapCenter', newLocation);
    Session.set('locationAvailable', true);
    // console.log('locationfound:', newLocation.coordinates);
    panels.pop();
    panels.push("main");
  });
  map.handle.on('locationerror', function(e) {
    // console.log('locationerror', e.message, e.code);
    Session.set('mapCenter', map.ancientLevantGJ);
    Session.set("mapZoom", map.minZoom);
    panels.pop();
    panels.push("main");
  });
  // closure vars
  var markers = [];
  // control all markers via a single layer
  var markerLayer = L.layerGroup().addTo(map.handle);
  var path = client.getResourceUrl("img/leaflet/");
  var markerIcon = L.icon({
    iconUrl: path + "marker-icon.png",
    shadowUrl: path + "marker-shadow.png",
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
      var places = Session.get("placesSearchResults");
      //     console.log("handlePlacesChanged", places);
      // before redawing markers, delete the current ones
      // TBD optimization: update only the markers which change
      //
      // TDB: move selectedPlace to a new Deps.autorun as there's no
      // need to refilter and search for places when selected place 
      // changes. Just redraw two markers
      var selected = client.selectedPlaceId();

      markers.each(function (k, m) {
        // default is not keep markers. Kept makers will be specifically marked
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
          // console.log("setting popup", p.title);
          m.lmark.bindPopup(
            L.popup().setContent(p.title),
            {offset: L.point(1,-19)});
          m.lmark.on('click', function(e) {
            // console.log("selected place", this.placeId)
            client.placeSet(this.placeId);
            panels.push("place");
          });
          m.keep = true;
          markers.setItem(id, m);
        }
        var opacity = selected == id ?
          map.selectedPlaceOpacity : map.unselectedPlaceOpacity;
        if (selected == id) {
          m.lmark.openPopup();
        } else {
          m.lmark.closePopup();
        }
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

  this.handleZoomChanged = Deps.autorun(function () {
    Session.set("mapZoomedEnough",
      areMapPlacesVisible(Session.get("mapZoom")));
  });

  this.handleCenterChange = Deps.autorun(function () {
    var wrapLongitude = function (d) {
      // this is kind of a hack to keep the map and all markers between [-180,180]
      if (d > 180) {
        d -= 360;
      }
      if (d < -180) {
        d += 360;
      }
      return d;
    };
    var mc = Session.get('mapCenter');
    if (map.handle && mc) {
      mc.coordinates[0] = wrapLongitude(mc.coordinates[0]);
      // console.log("setting view center", mc.coordinates);
      map.handle.setView(
        L.GeoJSON.coordsToLatLng(
          mc.coordinates), 
          Session.get('mapZoom'),
          {animate: true}
      );
      updateMapBounds();
    } else {
      // console.log("skipping setView");
    }
  });

  mapProvider.placeDragSet = function (action) {
    var updatePlaceCoords = function (id, c) {
      collections.Places.update(
        {_id: id},
        { $set: { 'location.coordinates': c}});
    };
    //     console.log("markers", markers);
    var placeId = client.selectedPlaceId();
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
        var sameLocation = _.isEqual(
          lm.toGeoJSON().geometry.coordinates, last.coordsBeforeDrag);
        if (!sameLocation) {
          // console.log("restoring previous coordinates", last.coordsBeforeDrag);
          updatePlaceCoords(placeId, last.coordsBeforeDrag);
          lm.setLatLng(L.GeoJSON.coordsToLatLng(last.coordsBeforeDrag));
        }
        delete last.coordsBeforeDrag;
      }
    }
  };
};

var schedCreateDialog = function (geoJsonLoc) {
  client.placeSet();
  Session.set("placeLocation", geoJsonLoc);
  Session.set("createError", null);
  Session.set("activeDialog", "placeEdit");
};

}());
