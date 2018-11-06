var passport = require('passport');
var db = require('../database/models/index');
var client = db.client;
var jwt = require('jsonwebtoken');
var configAuth = require('../config/auth');
var ProjectConfiguration = db.projectConfiguration;
// var fs = require('fs');
var path = require('path');
// var paymentListener = require('../packageCart/paymentListener');
var bcrypt = require('bcrypt-nodejs');
var mailer = require('../emailer/impl');
const ImageDataURI = require('image-data-uri');
const readChunk = require('read-chunk');
const fileType = require('file-type');
module.exports = {

  getLogin: function (req, res) {
    res.render('login', {
      message: req.flash('loginMessage')
    });
  },

  postLogin: (req, res, next) => {
    passport.authenticate('local-login', {
      session: false,
    }, async (err, user, info) => {
      console.log("Info" + info);
      try {
        if (err || !user) {
          const error = new Error('An Error occured')
          return res.json({
            'token': "failure",
            'message': info
          });
        }
        const token = jwt.sign({
          userId: user.uniqueId,
        }, configAuth.jwtAuthKey.secret, {
            expiresIn: configAuth.jwtAuthKey.tokenLife
          });
        //Send back the token to the user
        res.cookie('clientToken', token, {
          expire: 360000 + Date.now()
        });
        console.log(token,"token")
        return res.send(token) //res.redirect('/dashboard')
      } catch (error) {
        return next(error); 
      }
    })(req, res, next);
  },

  getSignup: function (req, res) {
    // render the page and pass in any flash data if it exists
    res.render('signup.ejs', {
      message: req.flash('signupMessage')
    });
  },

  postSignup: passport.authenticate('local-signup', {
    session: false,
    successRedirect: '/login', // redirect to the secure profile section
    failureRedirect: '/signup', // redirect back to the signup page if there is an error
    failureFlash: true // allow flash messages
  }),

  getDashboard: async function (req, res) {
    var projectArray = await getProjectArray(req.user.email);
    var address;
    address = req.cookies['address'];
    // console.log("cookie is ", address);
    if (!address) {
      client.find({
        where: {
          'email': req.user.email
        }
      }).then(async client => {
        var addresses = await client.getUserCurrencyAddresses();
        address = addresses[0].address;
        res.cookie('address', address, {
          expire: 360000 + Date.now()
        });
        res.render('profile.ejs', {
          user: req.user, // get the user out of session and pass to template
          ProjectConfiguration: projectArray,
          message: req.flash('package_flash'),
          contractMessage: req.flash('contract_flash'),
          address: address
        });
      });
    } else {
      res.render('profile.ejs', {
        user: req.user, // get the user out of session and pass to template
        ProjectConfiguration: projectArray,
        message: req.flash('package_flash'),
        contractMessage: req.flash('contract_flash'),
        address: address
      });
    }
  },

  googleLogin: passport.authenticate("google", {
    scope: ["profile ", "email"]
  }),

  googleLoginCallback: passport.authenticate("google", {
    successRedirect: '/dashboard',
    failureRedirect: '/'
  }),

  getLogout: function (req, res) {
    res.clearCookie('clientToken');
    res.clearCookie('address');
    res.redirect('/dashboard');
  },

  githubLogin: passport.authenticate('github'),

  githubLoginCallback: passport.authenticate('github', {
    successRedirect: '/dashboard',
    failureRedirect: '/'
  }),

  KYCpage: function (req, res) {
    res.render('adminKYC.ejs', {
      user: req.user,
    })
  },
  KYCpagePending: function (req, res) {
    res.render('pendingAdminKYC.ejs', {
      user: req.user,
    })
  },
  KYCdocUpload: async function (req, res) { //{ ext: 'jpg', mime: 'image/jpeg' }

    let buffer1 = readChunk.sync((req.files[0].path), 0, 4100);
    let buffer2 = readChunk.sync((req.files[1].path), 0, 4100);
    let buffer3 = readChunk.sync((req.files[2].path), 0, 4100);
    if (fileType(buffer1).mime == "image/jpeg" && fileType(buffer2).mime == 'image/jpeg' && fileType(buffer3).mime == 'image/jpeg') {
      client.update({
        "name": req.body.first_name + " " + req.body.last_name,
        "isd_code": req.body.ISD_code,
        "mobile": req.body.number,
        'kycDoc1': await ImageDataURI.encodeFromFile(req.files[0].path),
        'kycDoc2': await ImageDataURI.encodeFromFile(req.files[1].path),
        'kycDoc3': await ImageDataURI.encodeFromFile(req.files[2].path),
        "kyc_verified": "pending"
      }, {
          where: {
            'email': req.user.email
          }
        }).then(() => {
          res.redirect('/KYCpage/pending');
        });
    } else {
      res.send("Error occured while uploading! Please check your images!")
    }
  },

  getProjectList: (req, res) => {
    client.findAll({
      include: [ProjectConfiguration]
    }).then((clients) => {
      res.render('projectList.ejs', {
        clients: clients
      })
    });
  },

  getProjectArray: (req, res) => {
    var email = req.user.email;
    var projectArray = [];
    client.find({
      where: {
        'email': email
      },
      include: [{
        model: ProjectConfiguration,
        attributes: ['coinName', 'tokenContractAddress', 'tokenContractHash', 'networkType', 'networkURL', 'crowdsaleContractAddress', 'crowdsaleContractHash']
      }],
    }).then(client => {
      client.projectConfigurations.forEach(element => {
        projectArray.push(element.dataValues);
      });
      // res.send({'projectArray': projectArray});
      res.send(projectArray);
    });
  },

  getProfileDetails: async (req, res) => {
    var projectArray = await getProjectArray(req.user.email);
    var address = req.cookies['address'];
    res.render('profileDetails', {
      user: req.user,
      address: address,
      ProjectConfiguration: projectArray,
    });
  },

  getAPIProfileDetails: async (req, res) => {
    res.send(req.user);
  },

  forgotPassword: (req, res) => {
    client.find({
      where: {
        'email': req.query.email
      }
    }).then(result => {
      if (result == null) {
        res.send("User not found")
      } else if (result.password == null) {
        res.send("Password")
      } else {
        mailer.forgotPasswordMailer(req, req.query.email, bcrypt.hashSync(result.dataValues.uniqueId, bcrypt.genSaltSync(8), null));
        res.send("success")
      }
    })
  },
  resetPassword: (req, res) => {
    console.log(req.query)
    client.find({
      where: {
        'email': req.query.email
      }
    }).then(result => {
      if (!bcrypt.compareSync(result.dataValues.uniqueId, req.query.resetId)) { console.log("false") }
      else {
        console.log("true")
        res.render("resetPassword", { email: result.dataValues.email })
      }
    })
  },
  updatePassword: (req, res) => {
    console.log(req.body)
    client.find({
      where: {
        'email': req.body.email
      }
    }).then(result => {
      result.update({
        password: bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(8), null)
      }).then(result => {
        res.redirect("/")
      })
    })
  },
  verifyAccount: (req, res) => {
    console.log(req.query)
    client.find({
      where: {
        'email': req.query.email
      }
    }).then((client) => {
      client.status = true;
      client.save().then(res.redirect("/"));
    });
  },
  checkExistence: async (req, res) => {
    client.find({
      where: {
        'email': req.query.email
      }
    }).then((result) => {
      if (result != null) {
        res.send({
          status: 'success',
          message: 'Account Already Exists'
        });
      } else {
        res.status(200).send({
          status: 'success',
          message: 'Account does not exist.'
        });
      }
    })
      .catch((e) => {
        res.status("401").send("db error");
      })
  },
  forgotPassword: (req, res) => {
    client.find({
      where: {
        'email': req.query.email
      }
    }).then(result => {
      if (result == null) {
        res.send("User not found")
      } else if (result.password == null) {
        res.send("Password")
      } else {
        mailer.forgotPasswordMailer(req, req.query.email, bcrypt.hashSync(result.dataValues.uniqueId, bcrypt.genSaltSync(8), null));
        res.send("success")
      }
    })
  },
  resetPassword: (req, res) => {
    console.log(req.query)
    client.find({
      where: {
        'email': req.query.email
      }
    }).then(result => {
      if (!bcrypt.compareSync(result.dataValues.uniqueId, req.query.resetId)) {
        console.log("false")
      } else {
        console.log("true")
        res.render("resetPassword", {
          email: result.dataValues.email
        })
      }
    })
  },
  updatePassword: (req, res) => {
    console.log(req.body)
    client.find({
      where: {
        'email': req.body.email
      }
    }).then(result => {
      result.update({
        password: bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(8), null)
      }).then(result => {
        res.redirect("/")
      })
    })
  },
  verifyAccount: (req, res) => {
    console.log(req.query)
    client.find({
      where: {
        'email': req.query.email
      }
    }).then((client) => {
      client.status = true;
      client.save().then(res.redirect("/"));
    });
  }
};

function getProjectArray(email) {
  var projectArray = [];
  return new Promise(async function(resolve, reject) {
    client.find({
      where: {
        'email': email
      },
      include: [{
        model: ProjectConfiguration,
        attributes: ['coinName', 'tokenContractAddress', 'tokenContractHash', 'networkType', 'networkURL', 'crowdsaleContractAddress', 'crowdsaleContractHash']
      }],
    }).then(client => {
      client.projectConfigurations.forEach(element => {
        projectArray.push(element.dataValues);
      });
      // res.send({'projectArray': projectArray});
      resolve(projectArray);
    });
  });
}
