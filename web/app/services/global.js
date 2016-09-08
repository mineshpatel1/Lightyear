app.factory('Global', ['$http', '$q', '$mdDialog', function($http, $q, $mdDialog) {
	var fetchConnections = function(conns, success) {
		var authCalls = [];
		authCalls.push(checkGoogle(conns));
		authCalls.push(checkFB(conns));
		authCalls.push(checkTwitter(conns));
		authCalls.push(checkPostgre(conns));
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

	function checkPostgre(conns) {
		var deferred = $q.defer();
		if (!conns.postgre.name) {
			$http.get('/postgre/user').then(function(response) {
				if (response.data) {
					conns.postgre = response.data;
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
