L.Api = L.Class.extend({

    initialize : function () {
        console.log('L.Api connected!');
    },

    geocodeReverse : function (options, callback) {

        // create url 
        var url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/';
        url += options.lng;
        url += '%2C'
        url += options.lat;
        url += '.json?access_token=';
        url += options.access_token || mapboxgl.accessToken;

        // get request
        this.get(url, callback);
    },

    // delete a feature
    deleteRecord : function (options, callback) {
        this.post('/delete', options, callback);
    },

    undoRecord : function (options, callback) {
        this.post('/undo', options, callback);
    },

    // post a feature
    note : function (options, callback) {
        this.post('/note', options, callback);
    },

    // upload image
    upload : function (file, callback, progressCallback) {
        var formData = new FormData();
        formData.append("file", file);
        var http = new XMLHttpRequest();
        var url = window.location.origin + '/v1/upload';
       
        // progress bar
        http.upload.addEventListener("progress", function(e) {
            var pc = parseInt((e.loaded / e.total * 100));
            progressCallback && progressCallback(pc);
        }, false);

        // post
        http.open("POST", url);
        http.send(formData);
        http.onreadystatechange = function() {
            if (http.readyState == 4) {
                if (http.status == 200) {
                    // all good!
                    callback && callback(null, http.responseText);
                } else {
                    callback && callback(http.status, http.responseText);
                }
            }
        };
    },

    // get all notes
    getTable : function (callback) {
        var url = window.location.origin + '/v1/table';
        url += '?access_token=' + app.access_token;
        this.get(url, callback);
    },

    // get tags
    getTags : function (callback) {
        var url = window.location.origin + '/v1/tags';
        url += '?access_token=' + app.access_token;
        this.get(url, callback);
    },

    setTags : function (options, callback) {
        this.post('/tags', options, callback);
    },

    // update tag on a note
    updateTags : function (options, callback) {
        this.post('/updateTags', options, callback);
    },

    // get all notes
    getConfig : function (callback) {
        var url = window.location.origin + '/v1/config';
        url += '?access_token=' + app.access_token;
        this.get(url, callback);
    },

    setConfig : function (config, callback) {
        this.post('/config', config, callback);
    },

    filterPost : function (options, callback) {
        this.post('/filterPost', options, callback);
    },

    // get all notes
    getSocialMediaFeedAdmin : function (callback) {
        var url = window.location.origin + '/v1/social';
        url += '?access_token=' + app.access_token;
        url += '&filter=all';
        this.get(url, callback);
    },

     // get all notes
    getSocialMediaFeed : function (callback) {
        var url = window.location.origin + '/v1/social';
        this.get(url, callback);
    },













    get : function (url, done) {

        // create request
        var http = new XMLHttpRequest();

        // open
        http.open("GET", url, true);

        // set json header
        http.setRequestHeader('Content-type', 'application/json');

        // response
        http.onreadystatechange = function() {
            if (http.readyState == 4) {
                if (http.status == 200) {

                    // return OK 
                    done && done(null, http.responseText);
                } else {

                    // return err
                    done && done(http.status, http.responseText);
                }
            }
        };
        
        // send
        http.send();
    },

    post : function (path, json, done, http_options) {
        
        // create request
        var http = new XMLHttpRequest();

        // set url
        var url = this.serverUrl() + path;

        // open
        http.open("POST", url, true);

        // set json header
        if (http_options) {
            if (http_options.content_type) {
                http.setRequestHeader('Content-type', http_options.content_type);
            }
        } else {
            http.setRequestHeader('Content-type', 'application/json');
        }

        // response
        http.onreadystatechange = function() {
            if (http.readyState == 4) {
                if (http.status == 200) {
                    done && done(null, http.responseText); 
                } else {
                    done && done(http.status, http.responseText);
                }
            }
        };

        // add access_token to request
        var options = _.isString(json) ? safeParse(json) : json;
        options.access_token = app.access_token;
        var send_json = safeStringify(options);
       
        // send
        http.send(send_json);
    },

    serverUrl : function () {
        var api_version = 'v1'
        var url = window.location.origin + '/' + api_version;
        return url;
    },


});