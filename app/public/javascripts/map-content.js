
L.MapContent = L.Evented.extend({
    initialize : function (options) {

        // set options
        L.setOptions(this, options);

        // set container
        this._container = options.container;

        // init content
        this._initContent();

        // set events
        this.listen();

        // debug
        window.debug = window.debug || {};
        window.debug.map = this._map;
    },

    listen : function () {
        this.on('reverse-lookup', this._onReverseLookup);
    },

    _initContent : function () {

        // get map container
        this._content = L.DomUtil.get('map');

        // initialize mapboxgl
        mapboxgl.accessToken = 'pk.eyJ1IjoibWFwaWMiLCJhIjoiY2l2MmE1ZW4wMDAwZTJvcnhtZGI4YXdlcyJ9.rD_-Ou1OdKQsHqEqL6FJLg';
        var map = this._map = new mapboxgl.Map({
            container: 'map',
            // style: 'mapbox://styles/mapbox/streets-v9',
            style: 'mapbox://styles/mapbox/satellite-v9',
            center: [10.234364120842656, 59.795007354532544],
            zoom : 12,
            attributionControl : false,
        });

        // map ready event
        map.on('load', this._onMapLoad.bind(this));

        // create (+) button
        this._createAddButton();
    },

    _createAddButton : function () {

        // create button
        this._addButton = L.DomUtil.create('div', 'add-button', this._container);
        this._shadowButton = L.DomUtil.create('div', 'shadow-button', this._container);

        // add event
        L.DomEvent.on(this._addButton, 'click', this.addNote, this);

    },

    addNote : function () {

        // 1. add a pin to map, so user can move
        // 2. add a button to accept position of pin
        // 3. when accepted, open note screen
        // 4. add upload/photo function
        // 5. add button for posting note
        

        // 1. hide other markers
        this._hideMarkers();

        // hide (+) button
        L.DomUtil.addClass(this._addButton, 'display-none');
        L.DomUtil.addClass(this._shadowButton, 'display-none');

        // add marker in middle of screen
        this._geoMarker = L.DomUtil.create('div', 'geo-marker', this._container);

        // add "accept geo" button
        this._acceptPositionButton = L.DomUtil.create('div', 'accept-geo-button', this._container);
        L.DomEvent.on(this._acceptPositionButton, 'click', this._openNotesCreator, this);

    },

    _hideMarkers : function () {
        _.each(this._layers, function (l) {
            map.setLayoutProperty(l.id, 'visibility', 'none');
        });
    },
    _showMarkers : function () {
        _.each(this._layers, function (l) {
            map.setLayoutProperty(l.id, 'visibility', 'visible');
        });
    },

    _getAddress : function () {

        // get position of marker
        var center = this._map.getCenter();

        // reverse lookup for address
        app.api.geocodeReverse({ 
            lat: center.lat, 
            lng: center.lng
        }, function(err, res) {
            if (err) console.error(err);

            var results = safeParse(res);
            console.log('_getAddress', results);

            var features = results ? results.features : [];
            if (!_.size(features)) console.error('no result');

            // get address
            var address = features[0] ? features[0].place_name : '';

            // fire event
            this.fire('reverse-lookup', {
                address : address,
                features : features
            });

        }.bind(this));

    },

    _onReverseLookup : function (options) {

        // save
        this.note.address = options.address;

        // get div
        var div = this._reverseLookupAddressDiv;
        if (!div) return console.error('div not ready');

        // set address
        div.innerHTML = this.note.address;
    },

    _openNotesCreator : function (center) {

        var map = this._map;

        // object
        this.note = {};

        // reverse lookup address
        this._getAddress();
      
        // get position of marker
        this.note.center = map.getCenter();

        // get zoom
        this.note.zoom = map.getZoom();

        // container
        this.note.container = L.DomUtil.create('div', 'write-note-container', app._container);

        // content
        var container = this._writeNoteContent = L.DomUtil.create('div', 'write-note-content', this.note.container);

        // content:
        // - reverse lookup address
        // - title
        // - explanation/description
        // - text-box
        // - button for taking/uploading photo
        // - OK-button (post!)

        // title
        var title = L.DomUtil.create('div', 'write-note-title', container);
        title.innerHTML = 'Skriv et forslag!';

        // address
        var address = this._reverseLookupAddressDiv = L.DomUtil.create('div', 'write-note-address', container);

        // description
        var explanation = L.DomUtil.create('div', 'write-note-explanation', container);
        explanation.innerHTML = 'Skriv inn ditt forslag, legg ved tags og bilder, og trykk OK';

        // text input
        var textBox = this.note.textbox = L.DomUtil.create('textarea', 'write-note-textarea', container);
        // textBox.setAttribute('type', 'textarea');
        textBox.setAttribute('placeholder', 'Skriv ditt forslag til #MittLier');

        // photo button (only if supported)
        if (window.File && window.FileReader && window.FormData) {
            var photoBtn = L.DomUtil.create('input', 'write-note-photo-button', container);
            photoBtn.setAttribute('id', 'file');
            photoBtn.setAttribute('type', 'file');
            photoBtn.setAttribute('accept', 'image/*');
            L.DomEvent.on(photoBtn, 'change', this._onPhotoBtnChange, this);
        }

        var label = L.DomUtil.create('label', '', container);
        label.setAttribute('for', 'file');
        label.innerHTML = 'Legg ved bilde';

        // ok button
        var okBtn = L.DomUtil.create('div', 'write-note-ok-button', container);
        okBtn.innerHTML = 'ok!';
        L.DomEvent.on(okBtn, 'click', this._sendNote, this);

    },

    _onPhotoBtnChange : function (e) {
        console.log('_onPhotoBtnChange', e);
        var file = e.target.files[0];
        if (file) {
            if (/^image\//i.test(file.type)) {
                this._readFile(file);
            } else {
                alert('Not a valid image!');
            }
        }
    },

    _readFile : function (file) {
        var reader = new FileReader();
        var processFile = this._processFile.bind(this);

        reader.onloadend = function () {
            processFile(reader.result, file.type);
        }

        reader.onerror = function () {
            alert('There was an error reading the file!');
        }

        reader.readAsDataURL(file);
    },

    _processFile : function (dataURL, fileType) {

        console.log('_processFile cxt', this);

        var maxWidth = 800;
        var maxHeight = 800;

        var image = new Image();
        var sendFile = this._sendFile;

        image.src = dataURL;

        image.onload = function () {
            var width = image.width;
            var height = image.height;
            var shouldResize = (width > maxWidth) || (height > maxHeight);

            if (!shouldResize) {
                sendFile(dataURL);
                return;
            }

            var newWidth;
            var newHeight;

            if (width > height) {
                newHeight = height * (maxWidth / width);
                newWidth = maxWidth;
            } else {
                newWidth = width * (maxHeight / height);
                newHeight = maxHeight;
            }

            var canvas = document.createElement('canvas');

            canvas.width = newWidth;
            canvas.height = newHeight;

            var context = canvas.getContext('2d');

            context.drawImage(this, 0, 0, newWidth, newHeight);

            dataURL = canvas.toDataURL(fileType);

            sendFile(dataURL);
        
        };

        image.onerror = function () {
            alert('There was an error processing your file!');
        };

    },


    _sendFile : function (fileData) {
        var formData = new FormData();

        formData.append('imageData', fileData);

        console.log('_sendFile', fileData);

        app.api.upload({
            image : fileData,
        }, function (err, result) {
            console.log('upload err, res', err, result);
        });

        // return;

        // $.ajax({
        //     type: 'POST',
        //     url: '/your/upload/url',
        //     data: formData,
        //     contentType: false,
        //     processData: false,
        //     success: function (data) {
        //         if (data.success) {
        //             alert('Your file was successfully uploaded!');
        //         } else {
        //             alert('There was an error uploading your file!');
        //         }
        //     },
        //     error: function (data) {
        //         alert('There was an error uploading your file!');
        //     }
        // });
    },

    _sendNote : function () {
        console.log('send note!');

        var text = this.note.textbox.value;
        var center = this.note.center;
        var address = this.note.address;
        var zoom = this.note.zoom;
        var username = 'anonymous';
        var image = 's3://etc';
        var tags = ['ok', 'lier'];
        var portal_tag = 'mittlier';


        // get other meta:
        // 1. user gps
        // 2. 

        var feature = this._createFeature({
            properties : {
                text : text,
                address : address,
                username : username,
                image : image,
                tags : tags
            }, 
            center : center
        });

        console.log('feature', feature);

        // send note to server
        this._postFeature(feature);

    },

    _createFeature : function (options) {

        // new note
        var feature = {
          "type": "Feature",
          "properties": options.properties,
          "geometry": {
            "type": "Point",
            "coordinates": [
              options.center.lng,
              options.center.lat
            ]
          }
        }

        // return
        return feature;
    },

    _postFeature : function (feature) {
        console.log('_postFeature', feature);

        app.api.note(feature, function (err, result) {
            if (err) console.error(err);
            console.log('feature result', result);
        });

        // continue with flow..
    },

    _onMapLoad : function () {
       
        // shortcut
        var map = this._map;
       
        // set data url
        var data_url = 'https://gist.githubusercontent.com/anonymous/edb86febf4f61176be3a695a999edcd6/raw/fad8092ded78fc5305f81b46afc474461f5d22e8/map.geojson';
       
        // Add a new source from our GeoJSON data and set the
        // 'cluster' option to true. GL-JS will add the point_count property to your source data.
        map.addSource("earthquakes", {
            type: "geojson",
            // Point to GeoJSON data. 
            data: data_url, 
            // https://www.mapbox.com/mapbox-gl-js/style-spec/#sources-geojson-cluster
            cluster: true,
            clusterMaxZoom: 13, // Max zoom to cluster points on
            clusterRadius: 20 // Radius of each cluster when clustering points (defaults to 50)
        });

        // clustering
        var clustered_layer = {
            id: "clusters",
            type: "circle",
            source: "earthquakes",
            filter: ["has", "point_count"],
            paint: {
                "circle-color": {
                    property: "point_count",
                    type: "interval",
                    stops: [
                        [0, "#51bbd6"],
                        [2, "#f1f075"],
                        [5, "#f28cb1"],
                    ]
                },
                "circle-radius": {
                    property: "point_count",
                    type: "interval",
                    stops: [
                        [0, 20],
                        [2, 30],
                        [5, 40]
                    ]
                }
            }
        }

        // clustering numbers
        var cluster_number_layer = {
            id: "cluster-count",
            type: "symbol",
            source: "earthquakes",
            filter: ["has", "point_count"],
            layout: {
                "text-field": "{point_count_abbreviated}",
                "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
                "text-size": 26
            }
        }

        // unclustedered points
        var notes_layer = {
            id: "notes",
            type: "circle",
            source: "earthquakes",
            filter: ["!has", "point_count"],
            paint: {
                "circle-color": "#11b4da",
                "circle-radius": 10,
                "circle-stroke-width": 1,
                "circle-stroke-color": "#fff"
            }
        }

        // add layers
        map.addLayer(clustered_layer);
        map.addLayer(cluster_number_layer);
        map.addLayer(notes_layer);

        this._layers = {
            clustered_layer : clustered_layer,
            cluster_number_layer : cluster_number_layer,
            notes_layer : notes_layer
        }

        // when map moves
        map.on('moveend', this._onMoveEnd.bind(this));

        // add popups
        this._addPopups();

        // debug
        window.map = map;

    },

    _onMoveEnd : function () {
    },

    _addPopups : function () {

        var map = this._map;

        // Create a popup, but don't add it to the map yet.
        var popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            anchor : 'bottom',
            offset : 10
        });

        // show popup
        map.on('mouseenter', 'notes', function(e) {
            
            // cursor
            map.getCanvas().style.cursor = 'pointer';

            // feature
            var feature = e.features[0];

            // show popup
            popup.setLngLat(feature.geometry.coordinates)
            .setHTML(this._createPopupHTML(feature.properties))
            .addTo(map);

        }.bind(this));

        // hide popup
        map.on('mouseleave', 'notes', function() {
            map.getCanvas().style.cursor = '';
            popup.remove();
        }.bind(this));

    },  

    _createPopupHTML : function (p) {
        
        // parse tags
        var tags = safeParse(p.tags);
        var niceTags = tags ? tags.join(', ') : '';

        // create html
        var html = '<div class="notes-popup">';
        html    += '    <div class="notes-text">'
        html    +=          p.text
        html    += '    </div>'
        html    += '    <div class="notes-tags">'
        html    +=          niceTags;
        html    += '    </div>'
        html    += '    <div class="notes-users">'
        html    +=          p.user
        html    += '    </div>'
        html    += '</div>'
        return html;
    },

    resize : function () {
        this._map.resize();
    },

});