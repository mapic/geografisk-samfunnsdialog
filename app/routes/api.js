var fs = require('fs-extra');
var GJV = require("geojson-validation");
var generator = require('generate-password');
var _ = require('lodash');
var shortid = require('shortid');
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-');
var config = require('../app-config.js');
var redis = require('redis').createClient({ host : 'redis' });
redis.on('error', function (err) { console.log('Redis error: ', err); });
redis.auth(config.redis.auth);
var sizeOf = require('image-size');

// storage handler
var multer = require('multer');

// helpers
safeStringify = function (o) {try {var s = JSON.stringify(o);return s;} catch (e) {return false;}}
safeParse = function (s) {try { var o = JSON.parse(s); return o; } catch (e) {return false;}}

// module
module.exports = api = {

    twitter : function (req, res, next) {

        // debug
        var Twit = require('twit')
        var T = new Twit(config.twitter);
        T.get('search/tweets', { q: 'oslo filter:images filter:safe', result_type: 'recent', count: 3 }, function(err, data, response) {
            console.log(data)
        });
    },

    checkAccess : function (req, res, next) {

        // get access token
        var access_token = req.body.access_token;

        // deny if no token
        if (!access_token) return res.send(api.noAccess)
        
        // check access token
        redis.get(access_token, function (err, token) {

            // if no token
            if (err || !token) return res.send(api.noAccess);

            // parse
            var parsed_token = safeParse(token);

            // ensure token
            if (!parsed_token) return res.send(api.noAccess);

            // check privilege = admin
            var priv = parsed_token.privilege;
            if (priv != 'admin') return res.send(api.noAccess);

            // access granted
            next()
        });

    },
    noAccess : {
        error : 'Invalid or missing access token'
    },

    // route: /v1/upload
    upload : function (req, res) {
        console.log('post /v1/upload');

        // create unique file id
        var file_id = shortid.generate();

        // filename
        var filename;

        // multer: create storage
        var storage = multer.diskStorage({
            destination: function(req, file, callback) {
                callback(null, '/uploads');
            },
            filename: function(req, file, callback) {
                var ext;
                if (file.mimetype == 'image/jpeg') ext = '.jpg';
                if (file.mimetype == 'image/png') ext = '.png';
                filename = file_id + ext;
                callback(null, filename);
            }
        });

        // multer: create uploader
        var upload = multer({ 
            storage: storage,
            limits : { fileSize : 11000000 } // 10 MB
        }).single('file');

        console.log('upload', upload);

       

        // store to disk
        upload(req, res, function (err, something) {
            if (err) return res.send({error : "Couldn't upload image!"});

            console.log('err, something', err, something);

            var file = req.file;
            var disk_path = file.path;

            console.log('disk_path:', disk_path);
            console.log('file; ', file);

            var watermark_filename = file.filename + '.watermarked.jpg';


            var options = {
                input : disk_path,
                size : 400,
                watermark : '/entrypoint/public/stylesheets/watermark.png',
                output : '/uploads/' + watermark_filename,
                quality : 90
            };

            api._addWatermark(options, function (err, results) {
                console.log('api._addWatermark err, results', err, results);

                 // create image url
                var image_url = 'https://' + config.domain + '/v1/image/' + file.filename;
                var watermark_url = 'https://' + config.domain + '/v1/image/' + watermark_filename;

                // return to client
                res.send({
                    error : null,
                    endpoint : '/v1/upload',
                    image_url : image_url,
                    watermark : watermark_url
                });

            });

           
        });
    },

    _addWatermark : function (options, done) {
        
        // todo: async: https://www.npmjs.com/package/threads#basic-usage

        console.time('watermark');
        console.log('watermark options', options);

        var sizeOf = require('image-size');
        sizeOf(options.input, function (err, dimensions) {
            
            var x = 0;
            var y = err ? 0 : dimensions.height - 100;

            // var fs.readFile()
            var images = require("images");
            images(fs.readFileSync(options.input))                           //Load image from file 
            .draw(images(options.watermark), x, y)        //Drawn logo at coordinates (10,10)
            // .size(options.size)                             //Geometric scaling the image to 400 pixels width
            .saveAsync(options.output, 2, {                         //Save the image to a file, with quality 50
                quality : options.quality                       
            }, function (err) {
                console.timeEnd('watermark');
                done(err);
            });

         });
    },

    // route: /v1/image/:filename
    image : function (req, res) {

        console.log('image req.params', req.params);

        // get id
        var path = '/uploads/' + req.params.filename;

        // read file and send to client
        fs.readFile(path, function (err, image) {
            res.set('Content-Type', 'image/png'); // todo: more specific?
            res.send(image);
        });
    },

    // route: GET /
    index : function (req, res) {
        res.render('front-page', {
            fb_app_id : config.facebook.app_id,
            // id : p.id,
            image_url : 'https://' + config.domain + '/stylesheets/facebook-logo.png',
            // title : p.title,
            // text : p.text,
            og_type : 'website',
            url : 'https://' + config.domain,
            main_title : config.facebook.title,
        });
    },

    // route: GET /admin
    admin : function (req, res) {
        res.render('admin-page');
    },

    // route: GET /direct/:id
    direct : function (req, res) {
        
        console.log('direct req.params', req.params);

        var id = req.params.id;

        // res.send('ok');
        // return;

        console.log('direct -> id', id);

        api._getFeature(id, function (err, feature) {
            if (err) return res.send({error : err});

            var f = safeParse(feature);
            if (!f) return api.index(req, res);

            console.log('f: ', f);

            var p = f.properties;

            console.log('_getFeature prps', p);

            // { title: 'asd',
            // text: 'asd',
            // address: 'Lierbakkene 50, Lier, 3425 Buskerud, Norway',
            // username: 'Anonymt innlegg',
            // tags: [ 'ok', 'lier' ],
            // zoom: 12,
            // portal_tag: 'mittlier',
            // timestamp: 1495992742903,
            // id: 'bks163' }

            res.render('front-page', {
                id : p.id,
                // image_url : p.image_url || 'https://' + config.domain + '/stylesheets/facebook-logo.png',
                image_url : p.watermark_url || 'https://' + config.domain + '/stylesheets/facebook-logo.png',
                fb_app_id : config.facebook.app_id,
                title : p.title,
                text : p.text,
                url : 'https://' + config.domain + '/v1/direct/' + p.id,
                main_title : config.facebook.title,
                og_type : 'article',
            });

        });
    },

    _getFeature : function (id, done) {
        var key = config.redis.key + '-' + id;
        redis.get(key, done);
    },

    _saveFeature : function (feature, done) {

        // check valid feature
        if (!feature || !api._checkValidFeature(feature) || !feature.properties) return res.send({error : '#149 Invalid feature'});

        // get key
        var key = config.redis.key + '-' + feature.properties.id;
        redis.set(key, safeStringify(feature), done);
    },

    // route: POST /v1/note
    note : function (req, res) {

        // get options
        var options = req.body;

        if (!options) return res.send({error : '#144 Invalid options'});

        // save feature
        api._saveFeature(options.feature, function (err, result) {
            if (err) return res.send({error : err});

            // debug
            res.send({
                error : err, 
                feature : options.feature,
                fn : 'api.note',
            });
        });

    },

    _getAllNotesAsGeoJSON : function (done) {

        // get keys
        var key = config.redis.key + '-*' ;
        redis.keys(key, function (err, list) {
            if (err) return done(err);

            // get list of keys
            redis.mget(list, function (err, mlist) {
                if (err) return done(err)

                // geojson base
                var geojson = {
                  "type": "FeatureCollection",
                  "features": []
                };

                // parse
                _.each(mlist, function (m) {
                    geojson.features.push(safeParse(m));
                });

                // check valid
                if (!GJV.valid(geojson)) return done('#226 Invalid GeoJSON')

                // return
                done(null, geojson);

            });
        });
    },

    // route: GET /v1/notes
    getNotes : function (req, res) {
       api._getAllNotesAsGeoJSON(function (err, geojson) {
            if (err) return res.send({error : err});
            res.send(geojson);
       });
    },

    _deleteNoteById : function (id, done) {
        if (!id) return done('No such note id.');
        var key = config.redis.key + '-' + id ;
        redis.del(key, done);
    },

    deleteNote : function (req, res) {

        // get note id
        var note_id = req.body.id;

        // delete
        api._deleteNoteById(note_id, function (err, result) {
            res.send({error : err});
        });

    },

    // rout: GET /v1/table
    getTable : function (req, res) {

        api._getAllNotesAsGeoJSON(function (err, geojson) {
            if (err) return res.send({error : err});

            // check if ANY notes exist
            if (!geojson || !_.size(geojson) || !geojson.features) {
                return res.send();
            };

            // parse into table format
            var table = [];
            _.each(geojson.features, function (feature) {
                console.log('feature:', feature);

                // add properties and geometry
                var table_entry = feature.properties;
                table_entry.coordinates = feature.geometry.coordinates;

                // push to stack
                table.push(table_entry);
            
            });

            // send
            res.send(table);
        });

    },

    _checkValidFeature : function (feature) {

        var geojson = {
          "type": "FeatureCollection",
          "features": [feature]
        };

        // check valid geojson
        var valid = GJV.valid(geojson);

        // todo: check for other keys
        if (!feature.properties.id) valid = false;

        // return
        return valid;
    },


    // route: /login
    login : function (req, res, next) {

        // get info
        var email = req.body.email;
        var password = req.body.password;

        // check for user
        redis.get(email, function (err, result) {
            if (err) {
                console.log('Login err: ', err);
                return res.send({
                    access_token : null,
                    error : 'Noe feil skjedde. Vennligst prøv igjen.'
                });
            }

            // parse
            var user = safeParse(result);

            // if no user 
            if (!user) {
                console.log('No such user:', email);
                return res.send({
                    access_token : null,
                    error : 'Feil kombinasjon av email og passord. Vennligst prøv igjen.'
                });
            }

            // if password matches
            if (user.password === password) {
                console.log('Login successful', user);

                // create access token
                var access_token = generator.generate({
                    length: 25,
                    numbers: true,
                    uppercase : false,
                });

                // save access token
                redis.set(access_token, safeStringify({
                    email : user.email,
                    privilege : 'admin',
                    access_token : access_token
                }), function (err) {
                    console.log('saved access_token', err);
                    res.send({
                        access_token : access_token,
                        error : null
                    });
                });


            // if wrong password
            } else {
                console.log('No such user:', email);
                return res.send({
                    access_token : null,
                    error : 'Feil kombinasjon av email og passord. Vennligst prøv igjen.'
                });
            };

        });

    },


}
