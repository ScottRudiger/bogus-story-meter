angular.module('app', [])

  .controller('AppCtrl', function($http, $scope, request) {

    var that = this;

    this.rating = null;
    this.urlId = null;
    this.currentUser = null;
    this.uservote = null;
    this.url = null;

    chrome.identity.getAuthToken({ 'interactive': true }, function(token) {
    // Use the token.
      console.log('new token: ', token, new Date());
      if (token) {
        // var url = 'https://www.googleapis.com/oauth2/v1/userinfo?access_token=';
        //var url = 'https://www.googleapis.com/oauth2/v3/tokeninfo?access_token='

        this.loggedIn = true;
        $scope.$apply();


        $http({
          method: 'GET',
          url: 'https://www.googleapis.com/oauth2/v1/userinfo?access_token=' + token
        }).then(function(userData) {
          console.log('userData', userData);
        }.bind(this), function() {
          console.log('error');
        });

      }
    }.bind(this));

    chrome.runtime.sendMessage({msg: 'Give me data on this tab'});

    chrome.extension.onMessage.addListener(function(urlObj) {
      console.log('from background ', urlObj)
      that.rating = urlObj.rating;
      that.urlId = urlObj.urlId;
      that.url = urlObj.tabUrl;
      that.currentUser = urlObj.username;
      that.uservote = urlObj.uservote;
      if (that.rating === 0) {
        that.rated = true;
      } else {
        that.rated = !!that.rating;
      }
      $scope.$apply();
    });

    this.handleProfile = () => {
      chrome.tabs.create({url: `${window.serverUri}/profile` });
      window.close();
    };

    this.handleVote = (vote) => {
      if (this.url === null) {
        return;
      }
      var data = {
        urlId: this.urlId,
        url: this.url,
        username: this.currentUser,
        type: vote
      };
      let errMsg = 'Could not submit vote: ';

      console.log('inside handlevote - data ', data)

      // if user hasnt voted before, new vote:
      if (this.uservote === null) {
        request.post('/urlvote', data, errMsg, (postResponse) => {
          that.urlId = postResponse;
          request.get(`/urlvote/${that.urlId}`, null, null, errMsg, (getResponse) => {
            that.rating = getResponse;
            that.uservote = vote;
            chrome.runtime.sendMessage({'rating': that.rating, 'uservote': that.uservote, 'urlId': that.urlId});
          });
        });
      } else if (this.uservote !== vote) { // if user is changing vote
        request.put('/urlvote', data, errMsg, (postResponse) => {
          that.urlId = postResponse;
          request.get(`/urlvote/${that.urlId}`, null, null, errMsg, (getResponse) => {
            that.rating = getResponse;
            that.uservote = vote;
            chrome.runtime.sendMessage({'rating': that.rating, 'uservote': that.uservote, 'urlId': that.urlId});
          });
        });

      } else if (this.uservote === vote) {
        return; // don't let user send same rating twice for same URL
      }
    };

    this.handleSubmitComment = function(comment) {
      if (this.url === null) {
        return;
      }
      var data = {
        url: this.url,
        urlId: this.urlId,
        username: this.currentUser,
        comment: comment
      };
      request.post('/urlcomment', data, 'Could not submit comment: ', (resData) => {
        if(resData) {
          that.urlId = resData;
          chrome.runtime.sendMessage({'rating': that.rating, 'uservote': that.uservote, 'urlId': that.urlId});
        }
        console.log('that.urlId after comment response ', that.urlId);
      });
      this.comment = '';
    };

    this.handleStatsLink = () => {
      let currentUrlId = this.urlId;
      let currentUrl = this.url;
      console.log('------currentUrl:', currentUrl);
      let params = {
        currentUrl
      };
      let errMsg = 'failed to get stats page: ';
      request.get('/stats/generate-retrieve', null, params, errMsg, (response) => {
        chrome.tabs.create({
          url: response
        });
        window.close();
      });
    };
  })
  .component('app', {
    templateUrl: '../templates/app.html'
  });
