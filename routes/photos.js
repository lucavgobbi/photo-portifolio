/**
 * Created by lucavgobbi on 4/4/15.
 */
var express = require('express');
var router = express.Router();
var Photo = require('../models/photo').Photo;
var LoginHelper = new (require('../aux/loginHelper'));
var easyimg = require('easyimage');

router.get('/:id', LoginHelper.validateToken, function (req, res) {
    Photo.findById(req.params.id)
        .populate('albums')
        .exec(function (err, data) {
        if (err) {
            res.status(500).json({error: true, type: 'internal_error', details: err});
        } else if (!data) {
            res.status(404).json({error: false, message: 'not_found'});
        } else {
            res.status(200).json(data);
        }
    })
});

router.get('/', LoginHelper.validateToken, function (req, res) {
    Photo.find(function (err, data) {
        if (err) {
            res.status(500).json({error: true, type: 'internal_error', details: err});
        } else {
            res.status(200).json(data);
        }
    });
});

router.put('/:id', LoginHelper.validateAdminToken, function (req, res) {
    req.body.updatedAt = new Date();
    Photo.findByIdAndUpdate(req.params.id, req.body, function (err, data) {
        if (err) {
            res.status(500).json({error: true, type: 'internal_error', details: err});
        } else {
            Photo.findById(req.params.id, function (err, data) {
                cropAndResize(data, function (err, data) {
                    "use strict";
                    if (err) {
                        res.status(500).json({ error: true, type: 'internal_error', details: err });
                    } else {
                        res.status(200).json(data);
                    }
                });
            });
        }
    })
});

router.post('/', LoginHelper.validateAdminToken, function (req, res) {
    var newPhoto = new Photo(req.body);
    newPhoto.createdAt = new Date();
    newPhoto.updatedAt = new Date();

    newPhoto.save(function (err, savedData) {
        if (err) {
        } else {
            res.status(201).json(savedData);
        }
    });
});

function moveAndCreatePhoto (filename, callback) {
    var fs = require('fs');
    var crypto = require('crypto');
    var newFileName = crypto.randomBytes(32).toString('hex') + filename;
    console.log('newFileName:' + newFileName);
    fs.rename(appConfig.appPath + 'import/' + filename, appConfig.appPath + '/public/images/' + newFileName, function (err) {
        console.log('Renamed');
        if (err) {
            console.log(__dirname);
            console.log(err);
            callback(err);
        } else {
            var newPhoto = new Photo();
            newPhoto.createdAt = new Date();
            newPhoto.updatedAt = new Date();
            newPhoto.title = filename;
            newPhoto.url = '/images/' + newFileName;

            newPhoto.save(function (err, savedData) {
                if (err) {
                    callback(err);
                } else {
                    callback();
                }
            });
        }
    });
}

router.post('/import', LoginHelper.validateAdminToken, function (req, res) {
    var fs = require('fs');
    fs.readdir(appConfig.appPath + 'import', function (err, files) {
        require('async').each(files, moveAndCreatePhoto, function (err) {
            if (err) {
                res.status(500).json({error: true, type: 'internal_error', details: err});
            } else {
                res.status(200).json({error: false, data: files});
            }
        });
    });

});

function cropAndResize (photo, callback) {
    "use strict";
    var dst = appConfig.appPath + 'public/thumbs' + photo.url;
    easyimg.crop({
        src: appConfig.appPath + 'public' + photo.url,
        dst: dst,
        cropwidth: parseInt(photo.thumbDetails.width),
        cropheight: parseInt(photo.thumbDetails.height),
        gravity:'NorthWest',
        x: parseInt(photo.thumbDetails.x),
        y: parseInt(photo.thumbDetails.y)
    }).then(function (image) {
        easyimg.resize({
            src: dst,
            dst: dst,
            width: 250,
            height: 250
        }).then(function (image) {
            callback(null, image);
        }, function (err) {
            callback(err);
        });
    }, function(err) {
        callback(err);
    });
}

router.post('/generateThumb', function (req, res) {
    Photo.find()
        .exec(function (err, data) {
            if (err) {
                res.status(500).json({error: true, type: 'internal_error', details: err});
            } else if (!data) {
                res.status(404).json({error: false, message: 'not_found'});
            } else {
                require('async').eachSeries(data, cropAndResize, function(err) {
                    if (err) {
                        res.status(500).json({error: true, type: 'internal_error', details: err});
                    } else {
                        res.status(200).json({ success: true });
                    }
                })
            }
        });
});

router.post('/:id/addToAlbum/:albumId', LoginHelper.validateAdminToken, function (req, res) {
    Photo.findById(req.params.id, function (err, data) {
        if (err) {
            res.status(500).json({error: true, type: 'internal_error', details: err});
        } else {
            data.albums.addToSet(req.params.albumId);
            data.save(function (err, savedPhoto) {
                if (err) {
                    res.status(500).json({error: true, type: 'internal_error', details: err});
                } else {
                    res.status(200).json(savedPhoto);
                }
            })
        }
    })
});

router.delete('/:id/addToAlbum/:albumId', LoginHelper.validateAdminToken, function (req, res) {
    Photo.findById(req.params.id, function (err, data) {
        if (err) {
            res.status(500).json({error: true, type: 'internal_error', details: err});
        } else {
            data.albums.remove(req.params.albumId);
            data.save(function (err, savedPhoto) {
                if (err) {
                    res.status(500).json({error: true, type: 'internal_error', details: err});
                } else {
                    res.status(200).json(savedPhoto);
                }
            })
        }
    })
});


module.exports = router;
