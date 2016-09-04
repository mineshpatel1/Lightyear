app.factory('Global', ['$http', '$q', function($http, $q) {
	var fetchConnections = function(conns, success) {
		var authCalls = [];
		authCalls.push(checkGoogle(conns));
		authCalls.push(checkFB(conns));
		authCalls.push(checkTwitter(conns));
		$q.all(authCalls).then(function() {
			success();
		});
	}

	// Gets Google user information and checks authentication
	function checkGoogle(conns) {
		var deferred = $q.defer();
		if (!conns.google.name) {
			$http.get('/google/user').then(function(response) {
				if (response.data) {
					conns.google = response.data;
					deferred.resolve();
				} else {
					deferred.resolve();
				}
			}, function() {
				deferred.resolve();
			});
		} else {
			deferred.resolve();
		}
		return deferred.promise;
	}

	// Gets Facebook user information and checks authentication
	function checkFB(conns) {
		var deferred = $q.defer();
		if (!conns.facebook.name) {
			$http.get('/facebook/user').then(function(response) {
				if (response.data) {
					conns.facebook = response.data;
					deferred.resolve();
				} else {
					deferred.resolve();
				}
			}, function() {
				deferred.resolve();
			});
		} else {
			deferred.resolve();
		}

		return deferred.promise;
	}

	function checkTwitter(conns) {
		var deferred = $q.defer();
		if (!conns.twitter.name) {
			$http.get('/twitter/user').then(function(response) {
				if (response.data) {
					conns.twitter = response.data;
					deferred.resolve();
				} else {
					deferred.resolve();
				}
			}, function() {
				deferred.resolve();
			});
		} else {
			deferred.resolve();
		}

		return deferred.promise;
	}

	var Global = {
		fetchConnections : fetchConnections
	};
	return Global;
}]);
